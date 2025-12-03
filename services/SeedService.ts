// src/services/SeedService.ts

import WebTorrent from 'webtorrent-hybrid';
import { Track } from '@prisma/client';
import { pathToFileURL } from 'url';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost'; // Em um ambiente real, isso seria o domínio público

export class SeedService {
    private static instance: SeedService;
    private client: WebTorrent.Client;
    private torrents: Map<number, WebTorrent.Torrent> = new Map();

    private constructor() {
        this.client = new WebTorrent();
        this.client.on('error', (err) => {
            console.error('WebTorrent Error:', err.message);
        });
        console.log('SeedService inicializado.');
    }

    public static getInstance(): SeedService {
        if (!SeedService.instance) {
            SeedService.instance = new SeedService();
        }
        return SeedService.instance;
    }

    /**
     * Inicia o seeding de um arquivo e retorna o magnet URI e o WebSeed URL.
     * @param track O objeto Track do banco de dados.
     * @returns Um objeto com magnetURI e webSeedUrl.
     */
    public async startSeeding(track: Track): Promise<{ magnetURI: string, webSeedUrl: string }> {
        return new Promise((resolve, reject) => {
            const webSeedUrl = `http://${HOST}:${PORT}/api/stream/${track.id}`;
            
            // O webtorrent-hybrid precisa do caminho do arquivo
            this.client.seed(track.filePath, {
                name: track.title,
                // CRITICAL: Adiciona o WebSeed URL ao metadado do torrent
                urlList: [webSeedUrl] 
            }, (torrent) => {
                this.torrents.set(track.id, torrent);

                torrent.on('error', (err) => {
                    console.error(`Torrent Error for track ${track.id}:`, err.message);
                    reject(err);
                });

                console.log(`Seeding iniciado para ${track.title}. Magnet URI: ${torrent.magnetURI}`);
                
                resolve({
                    magnetURI: torrent.magnetURI,
                    webSeedUrl: webSeedUrl
                });
            });
        });
    }

    /**
     * Para o seeding de uma faixa.
     * @param trackId ID da faixa.
     */
    public stopSeeding(trackId: number): void {
        const torrent = this.torrents.get(trackId);
        if (torrent) {
            torrent.destroy(() => {
                this.torrents.delete(trackId);
                console.log(`Seeding parado para a faixa ${trackId}.`);
            });
        }
    }

    /**
     * Obtém um torrent ativo pelo ID da faixa.
     * @param trackId ID da faixa.
     * @returns O objeto Torrent ou undefined.
     */
    public getTorrent(trackId: number): WebTorrent.Torrent | undefined {
        return this.torrents.get(trackId);
    }

    /**
     * Obtém o cliente WebTorrent.
     * @returns O cliente WebTorrent.
     */
    public getClient(): WebTorrent.Client {
        return this.client;
    }
}
