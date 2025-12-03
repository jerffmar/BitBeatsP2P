// client/src/services/OPFSManager.ts

/**
 * Wrapper para o Origin Private File System (OPFS) - "The Vault"
 * Permite que os usuários "baixem" faixas para reprodução offline (0 bandwidth).
 */
export class OPFSManager {
  private root: FileSystemDirectoryHandle | null = null;
  private static instance: OPFSManager;

  private constructor() {
    this.init();
  }

  public static getInstance(): OPFSManager {
    if (!OPFSManager.instance) {
      OPFSManager.instance = new OPFSManager();
    }
    return OPFSManager.instance;
  }

  private async init() {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      try {
        // @ts-ignore - getDirectory é uma API experimental
        this.root = await navigator.storage.getDirectory();
        console.log('OPFS root directory handle obtido.');
      } catch (error) {
        console.error('Erro ao obter o diretório raiz do OPFS:', error);
      }
    } else {
      console.warn('Origin Private File System (OPFS) não suportado neste navegador.');
    }
  }

  /**
   * Salva um ArrayBuffer (dados da faixa) no OPFS.
   * @param trackId ID da faixa.
   * @param data ArrayBuffer dos dados da faixa.
   */
  public async saveTrack(trackId: number, data: ArrayBuffer): Promise<void> {
    if (!this.root) {
      throw new Error('OPFS não está inicializado ou suportado.');
    }

    try {
      const fileName = `track_${trackId}.mp3`; // Assumindo mp3
      const fileHandle = await this.root.getFileHandle(fileName, { create: true });
      // @ts-ignore
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      console.log(`Faixa ${trackId} salva no Vault (OPFS).`);
    } catch (error) {
      console.error(`Erro ao salvar a faixa ${trackId} no OPFS:`, error);
      throw error;
    }
  }

  /**
   * Lê uma faixa do OPFS.
   * @param trackId ID da faixa.
   * @returns ArrayBuffer dos dados da faixa ou null se não for encontrada.
   */
  public async getTrack(trackId: number): Promise<ArrayBuffer | null> {
    if (!this.root) return null;

    try {
      const fileName = `track_${trackId}.mp3`;
      const fileHandle = await this.root.getFileHandle(fileName);
      // @ts-ignore
      const file = await fileHandle.getFile();
      return file.arrayBuffer();
    } catch (error) {
      // console.log(`Faixa ${trackId} não encontrada no Vault (OPFS).`);
      return null;
    }
  }

  /**
   * Verifica se uma faixa está salva no OPFS.
   * @param trackId ID da faixa.
   */
  public async isTrackSaved(trackId: number): Promise<boolean> {
    return (await this.getTrack(trackId)) !== null;
  }
}
