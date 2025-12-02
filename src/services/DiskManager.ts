import { mkdir, stat, readdir, unlink, rename } from "node:fs/promises";
import { join } from "node:path";

const BYTES_IN_GB = 1024 ** 3;

export class DiskManager {
	private static instance: DiskManager;
	private readonly rootDir: string;
	private readonly quotaBytes: number;

	private constructor(rootDir = "/opt/bitbeats/uploads", quotaGb = 10) {
		this.rootDir = rootDir;
		this.quotaBytes = quotaGb * BYTES_IN_GB;
	}

	static getInstance(): DiskManager {
		if (!DiskManager.instance) {
			DiskManager.instance = new DiskManager();
		}
		return DiskManager.instance;
	}

	async init(): Promise<void> {
		await mkdir(this.rootDir, { recursive: true });
	}

	getUploadPath(filename: string): string {
		return join(this.rootDir, filename);
	}

	async getDirectorySize(dir: string = this.rootDir): Promise<number> {
		let size = 0;
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const path = join(dir, entry.name);
			const stats = await stat(path);
			if (stats.isDirectory()) {
				size += await this.getDirectorySize(path);
			} else {
				size += stats.size;
			}
		}
		return size;
	}

	async assertQuota(incomingBytes: number): Promise<void> {
		const current = await this.getDirectorySize();
		if (current + incomingBytes > this.quotaBytes) {
			const usedGb = ((current + incomingBytes) / BYTES_IN_GB).toFixed(2);
			throw new Error(`Storage quota exceeded: attempting to use ${usedGb} GB of 10 GB.`);
		}
	}

	async persistTempFile(tempPath: string, destinationName: string): Promise<string> {
		const destPath = this.getUploadPath(destinationName);
		await this.assertQuota((await stat(tempPath)).size);
		await rename(tempPath, destPath);
		return destPath;
	}

	async removeFile(filePath: string): Promise<void> {
		try {
			await unlink(filePath);
		} catch (error: unknown) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
		}
	}
}
