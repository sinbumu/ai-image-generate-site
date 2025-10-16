import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const userKey = req.headers['x-user-pixverse-key'] as string | string[] | undefined
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing user key header' })

  const offset = parseInt((req.query.offset as string) || '0', 10)
  const limit = Math.min(50, parseInt((req.query.limit as string) || '10', 10))

  const keyHash = hashUserKey(String(userKey))
  const rows = db.prepare(`
    SELECT id, created_at, prompt, model, duration, quality, motion_mode, video_url, thumb_url, metadata_json
    FROM pixverse_creations
    WHERE key_hash = ?
    ORDER BY datetime(created_at) DESC
    LIMIT ? OFFSET ?
  `).all(keyHash, limit, offset) as Array<Record<string, unknown>>

  const items = rows.map((r) => {
    const mj = typeof r.metadata_json === 'string' ? r.metadata_json as string : null
    let metadata: unknown = null
    if (mj) {
      try { metadata = JSON.parse(mj) } catch { metadata = mj }
    }
    const { metadata_json, ...rest } = r
    return { ...rest, metadata }
  })

  return res.json({ items })
}


