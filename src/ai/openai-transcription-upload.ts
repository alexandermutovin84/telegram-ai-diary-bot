import { randomBytes } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns';
import * as https from 'node:https';
import { URL } from 'node:url';

import { env } from '../utils/env.js';

function createIpv4HttpsAgent(): https.Agent {
  return new https.Agent({
    keepAlive: false,
    maxSockets: 1,
    timeout: 180_000,
    lookup(hostname, options, callback) {
      dnsLookup(hostname, { ...options, family: 4 }, callback);
    },
  });
}

/**
 * Whisper через один цельный multipart-буфер и https.request (без streaming body в node-fetch).
 * Нужен там, где /v1/audio/transcriptions обрывается с ECONNRESET через VPN/DPI.
 */
export async function transcribeBufferViaHttps(params: {
  readonly buffer: Buffer;
  readonly filename: string;
  readonly mime: string;
}): Promise<string> {
  const boundary = `----NodeForm${randomBytes(12).toString('hex')}`;
  const crlf = '\r\n';
  const parts: Buffer[] = [];

  function appendField(name: string, value: string): void {
    parts.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${value}${crlf}`,
        'utf8',
      ),
    );
  }

  appendField('model', 'whisper-1');
  appendField('language', 'ru');
  parts.push(
    Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${params.filename.replace(/"/g, '')}"${crlf}Content-Type: ${params.mime}${crlf}${crlf}`,
      'utf8',
    ),
  );
  parts.push(params.buffer);
  parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8'));

  const body = Buffer.concat(parts);
  const baseRaw = process.env['OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1';
  const base = baseRaw.replace(/\/$/, '');
  const url = new URL(`${base}/audio/transcriptions`);
  const agent = createIpv4HttpsAgent();

  const resText: string = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        agent,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        timeout: 180_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => {
          chunks.push(c);
        });
        res.on('end', () => {
          const txt = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(txt);
            return;
          }
          reject(
            new Error(
              `OpenAI transcriptions HTTP ${String(res.statusCode)}: ${txt.slice(0, 500)}`,
            ),
          );
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const parsed: unknown = JSON.parse(resText) as unknown;
  if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) {
    const t = (parsed as { text?: unknown }).text;
    if (typeof t === 'string') {
      return t.trim();
    }
  }
  throw new Error(`Unexpected transcription response: ${resText.slice(0, 200)}`);
}
