// src/controllers/TrackController.ts

import { Request, Response, NextFunction, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DiskManager } from './DiskManager';
import { SeedService } from './SeedService';
import prisma from './prisma.server';
import mime from 'mime-types';
import { Prisma } from '@prisma/client';

// Configuração do Multer para upload temporário
const upload = multer({ dest: path.join(process.cwd(), 'temp_uploads/') });

// Inicialização dos serviços
const diskManager = new DiskManager(prisma);
const seedService = SeedService.getInstance();

// helper: compute sha256 of a file (streamed)
const computeFileSHA256 = async (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => reject(err));
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

export class TrackController {
    public router: Router = Router();

    constructor() {
        this.router.post('/upload', upload.fields([
            { name: 'trackFile', maxCount: 1 },
            { name: 'file', maxCount: 1 },
        ]), this.uploadTrack);
        this.router.get('/tracks', this.listTracks);
        // delete track by id (remove seed, file and DB record)
        this.router.delete('/tracks/:id', this.deleteTrack);
        this.router.get('/stream/:trackId', this.streamTrack);
    }

    /**
     * Rota para upload de faixas.
     * Multer -> Check Quota -> Deduplicate by SHA256 -> Save Disk -> Start Seeding -> Save DB.
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

            // Quick quota check before heavy work
            const hasQuota = await diskManager.checkQuota(userId, fileSize);
            if (!hasQuota) {
                await fs.promises.unlink(tempPath);
                return res.status(403).json({ error: 'Cota de armazenamento excedida.' });
            }

            // Compute uploaded file hash
            const uploadedHash = await computeFileSHA256(tempPath);

            // 1) Attempt fast duplication lookup by size + sidecar/hash comparison
            const candidates = await prisma.track.findMany({
                where: { size: BigInt(fileSize) },
                select: { id: true, filePath: true, title: true, artist: true, album: true, magnetURI: true, webSeedUrl: true }
            });

            for (const cand of candidates) {
                try {
                    const sidecarPath = `${cand.filePath}.sha256`;
                    let candHash: string | null = null;

                    if (fs.existsSync(sidecarPath)) {
                        candHash = (await fs.promises.readFile(sidecarPath, 'utf8')).trim();
                    } else if (fs.existsSync(cand.filePath)) {
                        candHash = await computeFileSHA256(cand.filePath);
                        // write sidecar for next time (best-effort)
                        try {
                            await fs.promises.writeFile(sidecarPath, candHash, 'utf8');
                        } catch (e) {
                            console.warn('Unable to write sidecar for candidate file:', sidecarPath, e);
                        }
                    }

                    if (candHash && candHash === uploadedHash) {
                        // Duplicate found: remove temp upload and return existing track info
                        await fs.promises.unlink(tempPath).catch(() => { /* ignore */ });
                        return res.status(200).json({
                            message: 'Arquivo já existe no servidor (deduplicado).',
                            existing: true,
                            track: {
                                id: cand.id,
                                title: cand.title,
                                artist: cand.artist,
                                album: cand.album,
                                magnetURI: cand.magnetURI,
                                webSeedUrl: cand.webSeedUrl,
                            }
                        });
                    }
                } catch (innerErr) {
                    console.warn('Duplication check error for candidate', cand.filePath, innerErr);
                    // continue checking other candidates
                }
            }

            // 2) No duplicate -> proceed with normal save + seed flow
            const filePath = await diskManager.saveFile(userId, tempPath, originalName);

            // write sidecar for uploaded file to speed future dedupe checks
            try {
                await fs.promises.writeFile(`${filePath}.sha256`, uploadedHash, 'utf8');
            } catch (e) {
                console.warn('Failed writing sha256 sidecar for new file:', e);
            }

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

            return res.status(201).json({
                message: 'Faixa enviada e seeding iniciado com sucesso.',
                existing: false,
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

            // In dev expose error details to help debugging; keep generic in production
            const isDev = process.env.NODE_ENV !== 'production';
            if (this.isSchemaMissingError(error)) {
                const message = error instanceof Error && error.message
                    ? error.message
                    : 'Schema do banco ausente. Execute `npx prisma migrate deploy` antes de usar a API.';
                return res.status(503).json({ error: message });
            }

            if (isDev && error instanceof Error) {
                return res.status(500).json({
                    error: 'Erro interno do servidor durante o upload.',
                    message: error.message,
                    stack: error.stack,
                });
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
            if (this.isSchemaMissingError(error, 'Track')) {
                return res.status(503).json({
                    error: 'Schema do banco ausente. Execute `npx prisma migrate deploy` antes de usar a API.',
                });
            }
            res.status(500).json({ error: 'Erro ao listar faixas.' });
        }
    };

    // DELETE /api/tracks/:id
    private deleteTrack = async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid track id' });
        try {
            const track = await prisma.track.findUnique({ where: { id } });
            if (!track) return res.status(404).json({ error: 'Track not found' });

            // stop seeding if supported by SeedService (best-effort)
            try {
                if (seedService && typeof (seedService as any).stopSeeding === 'function') {
                    await (seedService as any).stopSeeding(track.magnetURI || track.webSeedUrl || '');
                }
            } catch (e) {
                console.warn('Failed to stop seeding for track', id, e);
            }

            // delete file from disk via DiskManager (best-effort)
            try {
                await diskManager.deleteFile(track.filePath);
            } catch (e) {
                console.warn('Failed to delete file from disk for track', id, e);
                // continue — we still remove DB record
            }

            // remove DB record
            await prisma.track.delete({ where: { id } });

            return res.json({ success: true, id });
        } catch (err) {
            console.error('Failed to delete track', id, err);
            return res.status(500).json({ error: 'Failed to delete track' });
        }
    };

    private isSchemaMissingError(error: unknown, modelName?: string): boolean {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
            const metaModel = (error.meta as { modelName?: string } | undefined)?.modelName;
            return modelName ? metaModel === modelName : true;
        }
        if (error instanceof Error && error.message.includes('Tabela User ausente')) {
            return true;
        }
        return false;
    }
}
