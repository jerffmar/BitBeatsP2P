import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { SeedService } from './services/SeedService.js';
import { TrackController } from './controllers/TrackController.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Sanitize filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'));
    }
});
const upload = multer({ storage });

// Middleware
app.use(express.json() as any);

// --- Static Serving ---

// 1. Serve Uploads for WebSeeds (Crucial for P2P fallbacks)
app.use('/uploads', express.static(UPLOAD_DIR) as any);

// 2. Serve React Static Files
// In production, we assume 'dist' is at the project root.
const CLIENT_DIST = path.join(process.cwd(), 'dist');
app.use(express.static(CLIENT_DIST) as any);

// --- API Routes ---

app.get('/api/tracks', TrackController.list);
app.post('/api/upload', upload.single('file') as any, TrackController.upload);
app.get('/api/stream/:id', TrackController.stream);

// --- Catch-All for React Router ---

app.get('*', (req: any, res: any) => {
    // If asking for API that doesn't exist, 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    // Otherwise serve index.html
    const indexPath = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('BitBeats API Server is running. Client build not found (run `npm run build`).');
    }
});

// --- Initialization ---

const startServer = async () => {
    try {
        // Initialize P2P Service
        const seedService = SeedService.getInstance();
        await seedService.restore();

        app.listen(PORT, () => {
            console.log(`\n🚀 BitBeats Server running at http://localhost:${PORT}`);
            console.log(`📁 Serving uploads from: ${UPLOAD_DIR}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();