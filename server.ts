// src/server.ts

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { TrackController } from './services/TrackController';
import prisma from './db';
import { SeedService } from './services/SeedService';

const app = express();
const PORT = process.env.PORT || 3000;

// Inicialização dos serviços
const seedService = SeedService.getInstance();
const trackController = new TrackController();

// Middleware para log de requisições
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 1. Rotas da API
app.get('/api/tracks', trackController.listTracks);
app.use('/api', trackController.router);

// 2. Servir arquivos estáticos do React Frontend
const clientDistPath = path.join(process.cwd(), 'client', 'dist');
app.use(express.static(clientDistPath));

// 3. Catch-all: Qualquer outra rota retorna o index.html do frontend
app.get('*', (req: Request, res: Response) => {
    // Exclui rotas de API não encontradas para evitar loop
    if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Inicialização do Servidor
async function startServer() {
    try {
        // Conectar ao banco de dados e garantir que a conexão está ok
        await prisma.$connect();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');

        // TODO: Lógica de inicialização:
        // 1. Carregar faixas existentes do DB
        // 2. Reiniciar o seeding para todas as faixas ativas
        // 3. Iniciar o cron job de retenção

        app.listen(PORT, () => {
            console.log(`\n--- BitBeats Server ---`);
            console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Servidor rodando em http://localhost:${PORT}`);
            console.log(`Diretório estático do cliente: ${clientDistPath}`);
            console.log(`-----------------------\n`);
        });
    } catch (error) {
        console.error('Falha ao iniciar o servidor:', error);
        process.exit(1);
    }
}

startServer();
