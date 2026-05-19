import { setDefaultResultOrder } from 'node:dns';
import type { Agent } from 'node:http';

import { HttpsProxyAgent } from 'https-proxy-agent';
import OpenAI from 'openai';

import { env } from '../utils/env.js';

setDefaultResultOrder('ipv4first');

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (client !== null) {
    return client;
  }
  const proxyUrl = env.OPENAI_HTTPS_PROXY;
  if (proxyUrl !== undefined && proxyUrl !== '') {
    const httpAgent: Agent = new HttpsProxyAgent(proxyUrl, { keepAlive: true });
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      httpAgent,
    });
    return client;
  }

  client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
  return client;
}
