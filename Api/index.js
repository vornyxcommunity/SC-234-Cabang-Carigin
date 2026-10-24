import { Redis } from '@upstash/redis';
import { handle } from '../lib/core.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const out = await handle(redis, { method: req.method, a: req.query.a, body: req.body, auth: req.headers.authorization });
  res.status(out.code).json(out.body);
}
