import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { HealthPayload } from '../types/index.js';

export interface HealthServerHandle {
  readonly port: number;
  close: () => Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === 'GET' && req.url === '/health') {
    const body: HealthPayload = { status: 'ok', timestamp: new Date().toISOString() };
    sendJson(res, 200, body);
    return;
  }
  res.writeHead(404);
  res.end();
}

export function startHealthServer(port: number): Promise<HealthServerHandle> {
  const server: Server = createServer((req, res) => {
    try {
      handleRequest(req, res);
    } catch {
      sendJson(res, 500, { status: 'error', message: 'Internal server error' });
    }
  });

  return new Promise<HealthServerHandle>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      const address = server.address();
      const actualPort: number =
        typeof address === 'object' && address !== null && 'port' in address ? address.port : port;
      resolve({
        port: actualPort,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => {
              if (err !== undefined) {
                rej(err);
                return;
              }
              res();
            });
          }),
      });
    });
  });
}
