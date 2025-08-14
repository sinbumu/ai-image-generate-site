import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const userKey = (req.headers['x-user-openai-key'] || req.headers['x-user-piapi-key']) as string | string[] | undefined
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing user key header' })

  const provider = (req.query.provider as string) || undefined
  const offset = parseInt((req.query.offset as string) || '0', 10)
  const limit = Math.min(50, parseInt((req.query.limit as string) || '10', 10))

  const keyHash = hashUserKey(String(userKey))
  const base = `SELECT id, created_at, provider, endpoint, task_id, status, error_message FROM api_requests WHERE key_hash = ?`
  const rows = provider
    ? db.prepare(base + ` AND provider = ? ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`).all(keyHash, provider, limit, offset)
    : db.prepare(base + ` ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`).all(keyHash, limit, offset)

  return res.json({ items: rows })
}


