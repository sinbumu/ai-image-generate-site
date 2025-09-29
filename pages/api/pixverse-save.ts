import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userKey = req.headers['x-user-pixverse-key'] as string | string[] | undefined
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing user key header' })
  const keyHash = hashUserKey(String(userKey))
  try {
    const { prompt, model, duration, quality, motion_mode, video_url, thumb_url, metadata } = req.body || {}
    const r = db.prepare(`INSERT INTO pixverse_creations(key_hash, prompt, model, duration, quality, motion_mode, video_url, thumb_url, metadata_json) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(keyHash, prompt ?? null, model ?? null, duration ?? null, quality ?? null, motion_mode ?? null, video_url, thumb_url ?? null, metadata ? JSON.stringify(metadata).slice(0,8192) : null)
    return res.json({ id: r.lastInsertRowid })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ error: 'invalid_request', detail: message })
  }
}


