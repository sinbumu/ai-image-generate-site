import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'

type PixResp = Record<string, unknown> | { raw: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers['x-user-pixverse-key']
  if (!apiKey || Array.isArray(apiKey)) return res.status(400).json({ error: 'missing pixverse key header' })
  const keyHash = hashUserKey(String(apiKey))
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const start = Date.now()
    const r = await fetch('https://app-api.pixverse.ai/openapi/v2/video/transition/generate', {
      method: 'POST',
      headers: {
        'API-KEY': String(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    })
    const text = await r.text()
    let parsed: PixResp
    try { parsed = JSON.parse(text) as Record<string, unknown> } catch { parsed = { raw: text } }
    const dur = Date.now() - start
    db.prepare(`INSERT INTO pixverse_requests(key_hash, endpoint, status, response_json, payload_json, duration_ms) VALUES (?,?,?,?,?,?)`)
      .run(keyHash, 'video.transition.generate', r.ok ? 'created' : 'error', JSON.stringify(parsed).slice(0,8192), JSON.stringify(req.body || {}).slice(0,4096), dur)
    return res.status(r.ok ? 200 : 400).json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'generate_failed', detail: message })
  }
}


