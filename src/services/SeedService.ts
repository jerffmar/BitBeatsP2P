import fs from 'fs';
import path from 'path';
import WebTorrent from 'webtorrent-hybrid';
import { PrismaClient } from '@prisma/client';

type SeedResult = {
  magnetURI: string;
  webSeedUrl: string;
};

class SeedService {
  private static instance: SeedService;
  private client: WebTorrent.Instance;
  private prisma = new PrismaClient();
  private baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

  private constructor() {
    this.client = new WebTorrent();
  }

  static getInstance(): SeedService {
    if (!SeedService.instance) {
      SeedService.instance = new SeedService();
    }
    return SeedService.instance;
  }

  async seed(filePath: string): Promise<SeedResult> {
    const filename = path.basename(filePath);
    const webSeedUrl = `${this.baseUrl}/uploads/${encodeURIComponent(filename)}`;

    return new Promise<SeedResult>((resolve, reject) => {
      this.client.seed(
        filePath,
        { urlList: [webSeedUrl], name: filename },
        (torrent) => resolve({ magnetURI: torrent.magnetURI, webSeedUrl })
      ).once('error', reject);
    });
  }

  async restore(): Promise<void> {
    const tracks = await this.prisma.track.findMany();
    for (const track of tracks) {
      try {
        await fs.promises.access(track.filePath, fs.constants.R_OK);
      } catch {
        continue;
      }
      this.client.seed(
        track.filePath,
        { urlList: [track.webSeedUrl], name: path.basename(track.filePath) },
        () => null
      );
    }
  }
}

export default SeedService;