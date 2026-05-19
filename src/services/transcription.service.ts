import { basename, extname } from 'node:path';

import { transcribeBufferViaHttps } from '../ai/openai-transcription-upload.js';
import { logger } from '../utils/logger.js';

function mimeForAudioFilename(filename: string): string {
  const ext = extname(filename).toLowerCase();
  switch (ext) {
    case '.oga':
    case '.ogg':
      return 'audio/ogg';
    case '.mp3':
      return 'audio/mpeg';
    case '.mp4':
    case '.m4a':
      return 'audio/mp4';
    case '.wav':
      return 'audio/wav';
    case '.webm':
      return 'audio/webm';
    case '.flac':
      return 'audio/flac';
    default:
      return 'audio/ogg';
  }
}

export async function transcribeAudioBuffer(params: {
  readonly buffer: Buffer;
  readonly filename: string;
}): Promise<string> {
  const baseName = basename(params.filename.trim() !== '' ? params.filename : 'voice.oga');
  const mime = mimeForAudioFilename(baseName);
  try {
    const text = await transcribeBufferViaHttps({
      buffer: params.buffer,
      filename: baseName,
      mime,
    });
    return text.trim();
  } catch (err: unknown) {
    logger.error('Whisper direct HTTPS transcription failed', err, {
      filename: baseName,
      mime,
      bytes: params.buffer.length,
    });
    throw err;
  }
}
