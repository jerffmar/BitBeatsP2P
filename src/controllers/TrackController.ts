import fs from 'fs';
import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import mime from 'mime-types';
import { PrismaClient } from '@prisma/client';
import SeedService from '../services/SeedService';

const prisma = new PrismaClient();
const uploadDir = path.resolve(process.cwd(), 'uploads');
const TEN_GB = BigInt(10 * 1024 * 1024 * 1024);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${stamp}-${file.fieldname}${ext}`);
  },
});

const upload = multer({ storage });

export const trackRouter = Router();

trackRouter.post(
  '/upload',
  upload.single('track'),
  (req, res, next) => TrackController.upload(req, res, next)
);
trackRouter.get('/tracks', (req, res) => TrackController.list(req, res));
trackRouter.get('/stream/:id', (req, res, next) => TrackController.stream(req, res, next));

class TrackController {
  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      const { userId, username, title, artist, duration = 0 } = req.body;

      if (!file) return res.status(400).json({ message: 'Audio file is required.' });
      if (!userId) return res.status(400).json({ message: 'userId is required.' });
      if (!username) return res.status(400).json({ message: 'username is required.' });
      if (!title || !artist) return res.status(400).json({ message: 'title and artist are required.' });

      const sizeBigInt = BigInt(file.size);
      const parsedUserId = Number(userId);

      const user = await prisma.user.upsert({
        where: { id: parsedUserId },
        update: {},
        create: {
          id: parsedUserId,
          username,
          passwordHash: '',
        },
      });

      if (user.storageUsed + sizeBigInt > TEN_GB) {
        fs.unlink(file.path, () => null);
        return res.status(413).json({ message: 'Storage quota exceeded (10GB).' });
      }

      const seedService = SeedService.getInstance();
      const { magnetURI, webSeedUrl } = await seedService.seed(file.path);

      const [updatedUser, track] = await prisma.$transaction([
        prisma.user.update({
          where: { id: parsedUserId },
          data: { storageUsed: user.storageUsed + sizeBigInt },
        }),
        prisma.track.create({
          data: {
            title,
            artist,
            duration: Number(duration),
            filePath: file.path,
            magnetURI,
            webSeedUrl,
            sizeBytes: sizeBigInt,
            userId: parsedUserId,
          },
        }),
      ]);

      res.status(201).json({ track, user: updatedUser });
    } catch (error) {
      next(error);
    }
  }

  static async list(_req: Request, res: Response) {
    const tracks = await prisma.track.findMany({ orderBy: { uploadedAt: 'desc' } });
    res.json(tracks);
  }

  static async stream(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const track = await prisma.track.findUnique({ where: { id } });
      if (!track) return res.status(404).json({ message: 'Track not found.' });

      const stat = await fs.promises.stat(track.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const mimeType = mime.lookup(track.filePath) || 'application/octet-stream';

      if (!range) {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mimeType,
        });
        fs.createReadStream(track.filePath).pipe(res);
        return;
      }

      const bytesPrefix = 'bytes=';
      if (!range.startsWith(bytesPrefix)) {
        return res.status(416).json({ message: 'Invalid Range header.' });
      }

      const [startStr, endStr] = range.replace(bytesPrefix, '').split('-');
      const start = Number(startStr);
      const end = endStr ? Number(endStr) : fileSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
        return res.status(416).json({ message: 'Range Not Satisfiable' });
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });

      fs.createReadStream(track.filePath, { start, end }).pipe(res);
    } catch (error) {
      next(error);
    }
  }
}