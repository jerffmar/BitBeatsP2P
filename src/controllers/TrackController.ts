import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ensureDir } from "fs-extra";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import mime from "mime-types";
import { PrismaClient } from "@prisma/client";
import { DiskManager } from "../services/DiskManager";
import { SeedService } from "../services/SeedService";

const prisma = new PrismaClient();
const diskManager = DiskManager.getInstance();
const seedService = SeedService.getInstance();
const upload = multer({ dest: DiskManager.tempDir() });

const STREAM_BASE = (process.env.WEB_SEED_BASE_URL ?? process.env.API_BASE_URL ?? "https://api.bitbeats.com").replace(/\/$/, "");

export class TrackController {
	static uploadMiddleware = upload.single("file");

	static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = (req as any).user?.id ?? req.body.userId;
			if (!userId) {
				res.status(401).json({ message: "Missing user context" });
				return;
			}
			const file = req.file;
			if (!file) {
				res.status(400).json({ message: "No file provided" });
				return;
			}
			if (!(await diskManager.checkQuota(userId, file.size))) {
				res.status(413).json({ message: "Storage quota exceeded (10GB limit)" });
				return;
			}
			const storedPath = await diskManager.saveFile(userId, file);
			const trackId = randomUUID();
			const webSeedUrl = `${STREAM_BASE}/api/stream/${trackId}`;
			const magnetURI = await seedService.seed(storedPath, {
				trackId,
				uploadedAt: new Date(),
				webSeedUrl
			});
			const magnetWithWs = magnetURI.includes("&ws=")
				? magnetURI
				: `${magnetURI}&ws=${encodeURIComponent(webSeedUrl)}`;

			const track = await prisma.track.create({
				data: {
					id: trackId,
					title: req.body.title ?? file.originalname,
					magnetURI: magnetWithWs,
					webSeedUrl,
					filePath: storedPath,
					size: BigInt(file.size),
					uploadedAt: new Date(),
					uploaderId: userId,
					genreId: req.body.genreId ?? null,
					artistId: req.body.artistId ?? null,
					albumId: req.body.albumId ?? null
				}
			});

			await prisma.user.update({
				where: { id: userId },
				data: { storageUsed: { increment: BigInt(file.size) } }
			});

			res.status(201).json({ track });
		} catch (error) {
			next(error);
		}
	}

	static async stream(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const track = await prisma.track.findUnique({
				where: { id: req.params.id },
				select: { filePath: true }
			});
			if (!track) {
				res.sendStatus(404);
				return;
			}
			const filePath = track.filePath;
			await ensureDir(join(filePath, "..")); // noop if exists
			const fileStat = await stat(filePath);
			const fileSize = fileStat.size;
			const range = req.headers.range;
			const mimeType = mime.lookup(filePath) || "application/octet-stream";

			if (range) {
				const matches = /bytes=(\d*)-(\d*)/.exec(range);
				if (!matches) {
					res.status(416).send("Invalid Range");
					return;
				}
				const start = matches[1] ? parseInt(matches[1], 10) : 0;
				const end = matches[2] ? parseInt(matches[2], 10) : fileSize - 1;
				if (start >= fileSize || end >= fileSize || start > end) {
					res.status(416).send("Requested range not satisfiable");
					return;
				}
				const chunkSize = end - start + 1;
				res.status(206);
				res.set({
					"Content-Range": `bytes ${start}-${end}/${fileSize}`,
					"Accept-Ranges": "bytes",
					"Content-Length": chunkSize,
					"Content-Type": mimeType
				});
				createReadStream(filePath, { start, end }).pipe(res);
				return;
			}

			res.status(200);
			res.set({
				"Content-Length": fileSize,
				"Content-Type": mimeType,
				"Accept-Ranges": "bytes"
			});
			createReadStream(filePath).pipe(res);
		} catch (error) {
			next(error);
		}
	}
}
