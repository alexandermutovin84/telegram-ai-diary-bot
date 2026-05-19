/**
 * Calls Whisper with a tiny valid WAV (silence) — same path as the bot (direct HTTPS multipart).
 * Run: npm run check-whisper
 */
import { setDefaultResultOrder } from 'node:dns';

import 'dotenv/config';

import { transcribeBufferViaHttps } from '../src/ai/openai-transcription-upload.js';

setDefaultResultOrder('ipv4first');

function minimalWavSilence(): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const durationSec = 0.5;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = Math.floor(sampleRate * durationSec) * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

async function main(): Promise<void> {
  const buf = minimalWavSilence();
  const text = await transcribeBufferViaHttps({
    buffer: buf,
    filename: 'silence.wav',
    mime: 'audio/wav',
  });
  console.log(`OK: Whisper (${String(text.length)} chars): ${JSON.stringify(text)}`);
}

main().catch((err: unknown) => {
  console.error('FAIL: Whisper direct HTTPS');
  console.error(err);
  if (err instanceof Error && err.cause !== undefined) {
    console.error('cause:', err.cause);
  }
  process.exit(1);
});
