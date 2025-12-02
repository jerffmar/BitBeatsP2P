import { ensureDir, move } from "fs-extra";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import type { Express } from "express";
import getFolderSizeCb from "get-folder-size";

const getFolderSize = promisify(getFolderSizeCb);
const MAX_BYTES = 10 * 1024 * 1024 * 1024;
const STORAGE_PATH = (process.env.STORAGE_PATH ?? "/var/www/bitbeats/uploads").replace(/\/$/, "");

export class DiskManager {
	private static instance: DiskManager;

	static getInstance(): DiskManager {
		if (!DiskManager.instance) {
			DiskManager.instance = new DiskManager();
		}
		return DiskManager.instance;
	}

	private getUserDir(userId: string): string {
		return join(STORAGE_PATH, userId);
	}

	async checkQuota(userId: string, incomingBytes: number): Promise<boolean> {
		const dir = this.getUserDir(userId);
		await ensureDir(dir);
		const current = await getFolderSize(dir).catch(() => 0);
		return current + incomingBytes <= MAX_BYTES;
	}

	async saveFile(userId: string, file: Express.Multer.File): Promise<string> {
		const dir = this.getUserDir(userId);
		await ensureDir(dir);
		const destination = join(dir, file.originalname);
		await move(file.path, destination, { overwrite: true });
		return destination;
	}

	static tempDir(): string {
		return join(tmpdir(), "bitbeats-temp");
	}
}
