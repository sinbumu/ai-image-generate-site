import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { url, name, contentType, size } = req.body || {}
      if (!url) return res.status(400).json({ error: 'url required' })
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
      const ins = db.prepare(`INSERT INTO uploaded_images(url,name,content_type,size,uploader_ip) VALUES(?,?,?,?,?)`)
      const r = ins.run(String(url), name ?? null, contentType ?? null, size ?? null, ip)
      return res.json({ id: r.lastInsertRowid })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return res.status(500).json({ error: 'insert_failed', detail: message })
    }
  }
  if (req.method === 'GET') {
    try {
      const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0)
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10))
      const rows = db.prepare(`SELECT id, created_at, url, name, content_type, size FROM uploaded_images ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`).all(limit, offset)
      return res.json({ items: rows })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return res.status(500).json({ error: 'select_failed', detail: message })
    }
  }
  return res.status(405).end()
}


