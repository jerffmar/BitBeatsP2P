import WebTorrent, { Torrent, TorrentOptions } from "webtorrent-hybrid";
import type { Track } from "@prisma/client";

type SeedableTrack = Pick<Track, "id" | "filePath" | "webSeedUrl" | "uploadedAt">;

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export class SeedService {
	private static instance: SeedService;
	private client: WebTorrent.Instance;
	private seeded: Map<string, Torrent>;
	private pruneInterval?: NodeJS.Timeout;

	private constructor() {
		this.client = new WebTorrent({
			tracker: true,
			dht: false
		});
		this.seeded = new Map();
	}

	static getInstance(): SeedService {
		if (!SeedService.instance) {
			SeedService.instance = new SeedService();
		}
		return SeedService.instance;
	}

	async init(existingTracks: SeedableTrack[]): Promise<void> {
		for (const track of existingTracks) {
			const expired = this.isExpired(track.uploadedAt);
			if (!expired) {
				await this.seedTrack(track);
			}
		}
		this.pruneInterval = setInterval(() => void this.pruneExpiredSeeds(), DAY_MS);
	}

	async seedTrack(track: SeedableTrack): Promise<Torrent> {
		if (this.seeded.has(track.id)) {
			return this.seeded.get(track.id)!;
		}
		const options: TorrentOptions = {
			path: track.filePath,
			announce: [
				"wss://tracker.openwebtorrent.com",
				"wss://tracker.btorrent.xyz",
				"wss://tracker.fastcast.nz"
			],
			webSeeds: [track.webSeedUrl]
		};

		return await new Promise<Torrent>((resolve, reject) => {
			this.client.seed(track.filePath, options, torrent => {
				this.seeded.set(track.id, torrent);
				resolve(torrent);
			}).once("error", reject);
		});
	}

	async removeTrack(trackId: string): Promise<void> {
		const torrent = this.seeded.get(trackId);
		if (!torrent) {
			return;
		}
		await new Promise<void>((resolve, reject) => {
			torrent.destroy(err => {
				if (err) return reject(err);
				this.seeded.delete(trackId);
				resolve();
			});
		});
	}

	private isExpired(uploadedAt: Date): boolean {
		return Date.now() - uploadedAt.getTime() > RETENTION_DAYS * DAY_MS;
	}

	private async pruneExpiredSeeds(): Promise<void> {
		for (const [trackId, torrent] of this.seeded.entries()) {
			const uploadedAt = new Date(torrent.created || Date.now());
			if (this.isExpired(uploadedAt)) {
				await this.removeTrack(trackId);
			}
		}
	}

	shutdown(): void {
		if (this.pruneInterval) {
			clearInterval(this.pruneInterval);
		}
		this.client.destroy();
	}
}
