// src/server.ts

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { User as PrismaUser } from '@prisma/client';
import path from 'path';
import { TrackController } from './services/TrackController';
import prisma from './services/prisma.server';
import { SeedService } from './services/SeedService';
import { spawn } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_PEPPER = process.env.AUTH_PEPPER || 'bitbeats-pepper';
const normalizeUsername = (value: string) => value.trim().toLowerCase();
const isValidUsername = (value: string) => /^[a-z0-9._-]{3,32}$/.test(value);
const hashWithServerPepper = (clientHash: string) =>
    crypto.createHash('sha256').update(`${clientHash}${AUTH_PEPPER}`).digest('hex');
const buildSessionUser = (user: PrismaUser) => ({
    id: user.id.toString(),
    username: user.username,
    handle: user.username.startsWith('@') ? user.username : `@${user.username}`,
});
const issueSessionToken = () => crypto.randomBytes(32).toString('hex');
const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let schemaReady = false;

const runPrismaMigrations = () =>
    new Promise<void>((resolve, reject) => {
        const child = spawn(NPX_COMMAND, ['prisma', 'db', 'push', '--accept-data-loss'], {
            cwd: process.cwd(),
            stdio: 'inherit',
        });
        child.on('close', (code) => {
            if (code === 0) return resolve();
            reject(new Error(`Prisma db push exited with code ${code}`));
        });
        child.on('error', reject);
    });

const isSchemaMissingError = (
    error: unknown,
): error is Prisma.PrismaClientKnownRequestError =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';

const ensureDatabaseSchema = async (force = false) => {
    if (schemaReady && !force) return;
    try {
        await prisma.user.count();
        schemaReady = true;
    } catch (error) {
        if (!isSchemaMissingError(error)) throw error;
        console.warn('Database schema missing, running `prisma db push` automatically…');
        await prisma.$disconnect();
        await runPrismaMigrations();
        await prisma.$connect();
        schemaReady = true;
    }
};

// Inicialização dos serviços
const seedService = SeedService.getInstance();
const trackController = new TrackController();

const CORS_ORIGIN = process.env.CLIENT_ORIGIN || 'https://localhost';

// Middleware para log de requisições
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

app.use(express.json({ limit: '1mb' }));

// 1. Rotas da API
app.get('/healthz', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: (error as Error).message });
    }
});

app.use('/api', trackController.router);

app.post('/api/auth/register', async (req, res) => {
    const executeRegistration = async () => {
        const { username, passwordHash } = req.body ?? {};
        const normalized = typeof username === 'string' ? normalizeUsername(username) : '';
        if (!isValidUsername(normalized)) {
            throw new Error('Username must be 3-32 chars (a-z, 0-9, ., _, -).');
        }
        if (typeof passwordHash !== 'string' || passwordHash.length !== 64) {
            throw new Error('Invalid credential digest.');
        }
        const storedHash = hashWithServerPepper(passwordHash.toLowerCase());
        const user = await prisma.user.create({
            data: { username: normalized, passwordHash: storedHash },
        });
        return { token: issueSessionToken(), user: buildSessionUser(user) };
    };

    try {
        const payload = await executeRegistration();
        return res.status(201).json(payload);
    } catch (error) {
        if (isSchemaMissingError(error)) {
            try {
                await ensureDatabaseSchema(true);
                const payload = await executeRegistration();
                return res.status(201).json(payload);
            } catch (retryError) {
                console.error('Register retry failed after auto-migration:', retryError);
                return res.status(500).json({
                    message: 'Unable to register user after repairing the database schema.',
                });
            }
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ message: 'Username already registered.' });
        }
        if (error instanceof Error && error.message) {
            return res.status(400).json({ message: error.message });
        }
        console.error('Register error:', error);
        return res.status(500).json({ message: 'Unable to register user.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const executeLogin = async () => {
        const { username, passwordHash } = req.body ?? {};
        const normalized = typeof username === 'string' ? normalizeUsername(username) : '';
        if (!isValidUsername(normalized)) {
            throw new Error('Invalid username.');
        }
        if (typeof passwordHash !== 'string' || passwordHash.length !== 64) {
            throw new Error('Invalid credential digest.');
        }
        const user = await prisma.user.findUnique({ where: { username: normalized } });
        if (!user) {
            throw new Error('Invalid username or password.');
        }
        const hashedAttempt = hashWithServerPepper(passwordHash.toLowerCase());
        if (hashedAttempt !== user.passwordHash) {
            throw new Error('Invalid username or password.');
        }
        return { token: issueSessionToken(), user: buildSessionUser(user) };
    };

    try {
        const payload = await executeLogin();
        return res.json(payload);
    } catch (error) {
        if (isSchemaMissingError(error)) {
            try {
                await ensureDatabaseSchema(true);
                const payload = await executeLogin();
                return res.json(payload);
            } catch (retryError) {
                console.error('Login retry failed after auto-migration:', retryError);
                return res.status(500).json({
                    message: 'Unable to login after repairing the database schema.',
                });
            }
        }
        if (error instanceof Error && error.message === 'Invalid username or password.') {
            return res.status(401).json({ message: error.message });
        }
        if (error instanceof Error && error.message) {
            return res.status(400).json({ message: error.message });
        }
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Unable to login.' });
    }
});

// Proxy endpoint to avoid browser CORS when calling MusicBrainz
app.get('/api/musicbrainz', async (req, res) => {
  try {
    const endpoint = String(req.query.endpoint || '');
    if (!endpoint) {
      return res.status(400).json({ message: 'Missing endpoint query param (e.g. endpoint=artist|recording|release).' });
    }

    // Build MusicBrainz URL with incoming params (except `endpoint`)
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'endpoint') continue;
      if (Array.isArray(v)) {
        v.forEach((val) => params.append(k, String(val)));
      } else {
        params.set(k, String(v));
      }
    }
    params.set('fmt', 'json');

    const mbUrl = `https://musicbrainz.org/ws/2/${endpoint}?${params.toString()}`;

    const mbResp = await fetch(mbUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BitBeats/1.0 (https://example.com)',
      },
    });

    const text = await mbResp.text();
    if (!mbResp.ok) {
      // forward status & text
      return res.status(mbResp.status).send(text);
    }

    // parse JSON (MusicBrainz returns JSON when fmt=json)
    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch {
      // fallback to plaintext
      return res.type('text').send(text);
    }
  } catch (error) {
    console.error('MusicBrainz proxy error:', error);
    return res.status(502).json({ message: 'Failed to proxy request to MusicBrainz.' });
  }
});

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
        await ensureDatabaseSchema();
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
