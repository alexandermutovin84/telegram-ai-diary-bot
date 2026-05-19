import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Telegram } from 'telegraf';

const DOWNLOAD_TIMEOUT_MS = 90_000;

export async function downloadTelegramFileBuffer(
  telegram: Telegram,
  fileId: string,
): Promise<{ readonly buffer: Buffer; readonly filename: string }> {
  const meta = await telegram.getFile(fileId);
  if (meta.file_path === undefined) {
    throw new Error(
      'Telegram file path missing (file may be too large for the bot or not ready yet)',
    );
  }

  const filename = basename(meta.file_path) || 'voice.oga';
  const link = await telegram.getFileLink(meta);
  const href = typeof link === 'string' ? link : link.href;

  let buffer: Buffer;
  if (href.startsWith('file:')) {
    buffer = await readFile(fileURLToPath(href));
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(href, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Telegram file download failed with HTTP ${String(response.status)}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timer);
    }
  }

  if (buffer.length === 0) {
    throw new Error('Telegram file download returned empty body');
  }

  return { buffer, filename };
}
