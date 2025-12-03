// src/controllers/TrackController.ts

import { Request, Response, NextFunction, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DiskManager } from './DiskManager';
import { SeedService } from './SeedService';
import prisma from './db';
import mime from 'mime-types';

// Configuração do Multer para upload temporário
const upload = multer({ dest: path.join(process.cwd(), 'temp_uploads/') });

// Inicialização dos serviços
const diskManager = new DiskManager(prisma);
const seedService = SeedService.getInstance();

export class TrackController {
    public router: Router = Router();

    constructor() {
        this.router.post('/upload', upload.fields([
            { name: 'trackFile', maxCount: 1 },
            { name: 'file', maxCount: 1 },
        ]), this.uploadTrack);
        this.router.get('/tracks', this.listTracks);
        this.router.get('/stream/:trackId', this.streamTrack);
    }

    /**
     * Rota para upload de faixas.
     * Multer -> Check Quota -> Save Disk -> Start Seeding -> Save DB.
     */
    private uploadTrack = async (req: Request, res: Response, next: NextFunction) => {
        const uploadedFile = this.resolveUploadedFile(req);
        if (!uploadedFile) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        let tempFilePath: string | null = uploadedFile.path;
        const userId = 1; // HARDCODED para fins de demonstração

        try {
            const fileSize = uploadedFile.size;
            const tempPath = uploadedFile.path;
            const originalName = uploadedFile.originalname;

            const hasQuota = await diskManager.checkQuota(userId, fileSize);
            if (!hasQuota) {
                await fs.promises.unlink(tempPath);
                return res.status(403).json({ error: 'Cota de armazenamento excedida.' });
            }

            // 2. Save Disk (move de temp para uploads e atualiza o uso de disco do usuário)
            const filePath = await diskManager.saveFile(userId, tempPath, originalName);

            // 3. Save DB (cria um registro Track inicial)
            let track = await prisma.track.create({
                data: {
                    title: originalName,
                    artist: 'Unknown', // Placeholder
                    album: 'Unknown', // Placeholder
                    magnetURI: '', // Será preenchido após o seeding
                    webSeedUrl: '', // Será preenchido após o seeding
                    filePath: filePath,
                    size: BigInt(fileSize),
                    genreId: 1, // Placeholder
                    userId: userId,
                }
            });

            // 4. Start Seeding (e obtém o magnetURI e webSeedUrl)
            const { magnetURI, webSeedUrl } = await seedService.startSeeding(track);

            // 5. Update DB com os dados do torrent
            track = await prisma.track.update({
                where: { id: track.id },
                data: { magnetURI, webSeedUrl }
            });

            res.status(201).json({
                message: 'Faixa enviada e seeding iniciado com sucesso.',
                track: {
                    id: track.id,
                    title: track.title,
                    magnetURI: track.magnetURI,
                    webSeedUrl: track.webSeedUrl
                }
            });

        } catch (error) {
            console.error('Erro no upload da faixa:', error);
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                await fs.promises.unlink(tempFilePath).catch(err => console.error('Erro ao limpar arquivo temporário:', err));
            }
            res.status(500).json({ error: 'Erro interno do servidor durante o upload.' });
        }
    };

    /**
     * Rota de streaming HTTP que suporta Range Requests (WebSeed Fallback).
     * @param trackId ID da faixa.
     */
    private streamTrack = async (req: Request, res: Response) => {
        const trackId = parseInt(req.params.trackId);
        const range = req.headers.range;

        if (isNaN(trackId)) {
            return res.status(400).send('ID da faixa inválido.');
        }

        try {
            const track = await prisma.track.findUnique({ where: { id: trackId } });

            if (!track) {
                return res.status(404).send('Faixa não encontrada.');
            }

            const filePath = track.filePath;
            const stat = await fs.promises.stat(filePath);
            const fileSize = stat.size;
            const contentType = mime.lookup(filePath) || 'application/octet-stream';

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                const file = fs.createReadStream(filePath, { start, end });
                const headers = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                };

                res.writeHead(206, headers); // HTTP 206 Partial Content
                file.pipe(res);
            } else {
                const headers = {
                    'Content-Length': fileSize,
                    'Content-Type': contentType,
                };
                res.writeHead(200, headers); // HTTP 200 OK
                fs.createReadStream(filePath).pipe(res);
            }

        } catch (error) {
            console.error(`Erro ao fazer stream da faixa ${trackId}:`, error);
            res.status(500).send('Erro interno do servidor ao fazer stream.');
        }
    };

    private resolveUploadedFile(req: Request): Express.Multer.File | undefined {
        if (req.file) return req.file;
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        return files?.trackFile?.[0] ?? files?.file?.[0];
    }

    private listTracks = async (_req: Request, res: Response) => {
        try {
            const tracks = await prisma.track.findMany({
                orderBy: { uploadedAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    artist: true,
                    album: true,
                    magnetURI: true,
                    size: true,
                    uploadedAt: true,
                },
            });

            res.json(tracks.map((track) => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                album: track.album,
                magnetURI: track.magnetURI,
                duration: 0,
                sizeBytes: track.size.toString(),
                uploadedAt: track.uploadedAt.toISOString(),
            })));
        } catch (error) {
            console.error('Erro ao listar faixas:', error);
            res.status(500).json({ error: 'Erro ao listar faixas.' });
        }
    };
}
