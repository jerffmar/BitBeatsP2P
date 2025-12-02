import WebTorrent from "webtorrent-hybrid";
import { PrismaClient } from "@prisma/client";

type SeedMeta = {
	trackId?: string;
	uploadedAt?: Date;
	webSeedUrl?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 90 * DAY_MS;

export class SeedService {
	private static instance: SeedService;
	private client: WebTorrent.Instance;
	private prisma: PrismaClient;
	private metaByInfoHash = new Map<string, Required<SeedMeta>>();
	private trackers = (process.env.TORRENT_TRACKERS?.split(",") ?? [
		"wss://tracker.openwebtorrent.com",
		"wss://tracker.btorrent.xyz",
		"wss://tracker.fastcast.nz"
	]).map(t => t.trim());
	private pruneTimer?: NodeJS.Timeout;

	private constructor() {
		this.client = new WebTorrent({ tracker: true, dht: false });
		this.prisma = new PrismaClient();
	}

	static getInstance(): SeedService {
		if (!SeedService.instance) {
			SeedService.instance = new SeedService();
		}
		return SeedService.instance;
	}

	async init(): Promise<void> {
		const tracks = await this.prisma.track.findMany({
			select: { id: true, filePath: true, uploadedAt: true, webSeedUrl: true }
		});
		for (const track of tracks) {
			await this.seed(track.filePath, {
				trackId: track.id,
				uploadedAt: track.uploadedAt,
				webSeedUrl: track.webSeedUrl ?? undefined
			}).catch(err => {
				console.error(`Failed to seed ${track.id}`, err);
			});
		}
		this.pruneTimer = setInterval(() => void this.prune(), DAY_MS);
	}

	async seed(filePath: string, meta: SeedMeta = {}): Promise<string> {
		return await new Promise((resolve, reject) => {
			this.client.seed(
				filePath,
				{
					announce: this.trackers,
					urlList: meta.webSeedUrl ? [meta.webSeedUrl] : undefined
				},
				torrent => {
					const record: Required<SeedMeta> = {
						trackId: meta.trackId ?? torrent.infoHash,
						uploadedAt: meta.uploadedAt ?? new Date(),
						webSeedUrl: meta.webSeedUrl ?? ""
					};
					this.metaByInfoHash.set(torrent.infoHash, record);
					resolve(torrent.magnetURI);
				}
			).once("error", reject);
		});
	}

	async prune(): Promise<void> {
		const now = Date.now();
		for (const torrent of this.client.torrents) {
			const meta = this.metaByInfoHash.get(torrent.infoHash);
			if (!meta) continue;
			if (now - meta.uploadedAt.getTime() > RETENTION_MS) {
				await new Promise<void>((resolve, reject) => {
					torrent.destroy(err => (err ? reject(err) : resolve()));
				});
				this.metaByInfoHash.delete(torrent.infoHash);
			}
		}
	}

	shutdown(): void {
		if (this.pruneTimer) clearInterval(this.pruneTimer);
		this.client.destroy();
		this.metaByInfoHash.clear();
	}
}
