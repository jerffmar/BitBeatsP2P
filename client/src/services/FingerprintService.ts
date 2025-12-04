import { spawn } from 'child_process';
import fs from 'fs/promises';
import crypto from 'crypto';

export type FingerprintResult = {
  fingerprint: string;
  method: 'fpcalc' | 'sha256-file';
  duration?: number;
};

export class FingerprintService {
  // Try to run local 'fpcalc' (Chromaprint). If not available or it fails, fallback to file SHA-256.
  static async fingerprintFile(filePath: string): Promise<FingerprintResult> {
    // 1) Attempt fpcalc
    try {
      const out = await this.runFpcalc(filePath);
      const parsed = this.parseFpcalcOutput(out);
      if (parsed && parsed.fingerprint) {
        return { fingerprint: parsed.fingerprint, method: 'fpcalc', duration: parsed.duration };
      }
    } catch (err) {
      // fail silently to fallback
      // eslint-disable-next-line no-console
      console.warn('fpcalc unavailable or failed, falling back to sha256-file', err);
    }

    // 2) Fallback: SHA-256 of file bytes (content hash, not acoustical fingerprint)
    const buf = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    return { fingerprint: hash, method: 'sha256-file' };
  }

  private static runFpcalc(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('fpcalc', [filePath]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0 || stdout.length) {
          resolve(stdout);
        } else {
          reject(new Error(`fpcalc exited with code ${code}; stderr=${stderr}`));
        }
      });
    });
  }

  private static parseFpcalcOutput(out: string): { fingerprint?: string; duration?: number } | null {
    // Typical fpcalc output:
    // FILE=/path/to/file
    // DURATION=123
    // FINGERPRINT=...
    const lines = out.split(/\r?\n/);
    const result: { fingerprint?: string; duration?: number } = {};
    for (const line of lines) {
      const [k, v] = line.split('=');
      if (!k) continue;
      if (k === 'FINGERPRINT') result.fingerprint = v ?? '';
      if (k === 'DURATION') result.duration = Number(v || 0);
    }
    return Object.keys(result).length ? result : null;
  }
}
