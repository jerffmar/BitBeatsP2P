// src/services/DiskManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { constants } from 'fs';
import { PrismaClient, Prisma } from '@prisma/client';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_QUOTA_BYTES = parseInt(process.env.MAX_USER_QUOTA_GB || '10') * 1024 * 1024 * 1024; // 10GB default

export class DiskManager {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.ensureUploadDir();
    }

    private async ensureUploadDir() {
        try {
            await fs.access(UPLOAD_DIR, constants.F_OK);
        } catch (error) {
            console.log(`Diretório de upload não encontrado. Criando: ${UPLOAD_DIR}`);
            await fs.mkdir(UPLOAD_DIR, { recursive: true });
        }
    }

    /**
     * Verifica se o usuário tem cota suficiente para um novo arquivo.
     * @param userId ID do usuário.
     * @param fileSize Tamanho do novo arquivo em bytes.
     * @returns true se houver cota, false caso contrário.
     */
    public async checkQuota(userId: number, fileSize: number): Promise<boolean> {
        let user;
        try {
            user = await this.prisma.user.findUnique({ where: { id: userId } });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
                throw new Error('Tabela User ausente. Execute `npx prisma migrate deploy` antes de fazer uploads.');
            }
            throw error;
        }

        if (!user) {
            throw new Error(`Usuário com ID ${userId} não encontrado.`);
        }

        const newStorageUsed = user.storageUsed + BigInt(fileSize);

        if (newStorageUsed > BigInt(MAX_QUOTA_BYTES)) {
            console.log(`Cota excedida para o usuário ${userId}. Usado: ${user.storageUsed}, Novo: ${newStorageUsed}, Limite: ${MAX_QUOTA_BYTES}`);
            return false;
        }

        return true;
    }

    /**
     * Salva o arquivo e atualiza o uso de armazenamento do usuário.
     * @param userId ID do usuário.
     * @param tempPath Caminho temporário do arquivo.
     * @param originalName Nome original do arquivo.
     * @returns O caminho final do arquivo.
     */
    public async saveFile(userId: number, tempPath: string, originalName: string): Promise<string> {
        const finalPath = path.join(UPLOAD_DIR, `${userId}_${Date.now()}_${originalName}`);

        await fs.rename(tempPath, finalPath);

        const stats = await fs.stat(finalPath);

        await this.prisma.user.update({
            where: { id: userId },
            data: { storageUsed: { increment: BigInt(stats.size) } }
        });

        return finalPath;
    }

    /**
     * Remove o arquivo e atualiza o uso de armazenamento do usuário.
     * @param userId ID do usuário.
     * @param filePath Caminho do arquivo a ser removido.
     * @param fileSize Tamanho do arquivo em bytes.
     */
    public async deleteFile(userId: number, filePath: string, fileSize: bigint): Promise<void> {
        await fs.unlink(filePath);

        await this.prisma.user.update({
            where: { id: userId },
            data: { storageUsed: { decrement: fileSize } }
        });
    }
}
