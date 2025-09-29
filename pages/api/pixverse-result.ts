import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'

type PixResp = Record<string, unknown> | { raw: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers['x-user-pixverse-key']
  if (!apiKey || Array.isArray(apiKey)) return res.status(400).json({ error: 'missing pixverse key header' })
  const keyHash = hashUserKey(String(apiKey))
  if (req.method !== 'GET') return res.status(405).end()
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'missing id' })
  try {
    const r = await fetch(`https://app-api.pixverse.ai/openapi/v2/video/result/${encodeURIComponent(String(id))}`, {
      headers: {
        'API-KEY': String(apiKey),
      }
    })
    const text = await r.text()
    let parsed: PixResp
    try { parsed = JSON.parse(text) as Record<string, unknown> } catch { parsed = { raw: text } }

    // 최종 상태에서만 로깅: success(1) or failure-like(6/7/8). 진행중(5)은 기록하지 않음
    if (!r.ok) {
      db.prepare(`INSERT INTO pixverse_requests(key_hash, endpoint, status, response_json) VALUES (?,?,?,?)`)
        .run(keyHash, 'video.result', 'error', JSON.stringify(parsed).slice(0, 8192))
    } else {
      const get = (o: unknown, k: string) => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined)
      const respObj = (get(parsed, 'Resp') as Record<string, unknown>) || (get(parsed, 'resp') as Record<string, unknown>)
      const rawStatus = respObj ? respObj['status'] : undefined
      const statusNum = typeof rawStatus === 'number' ? rawStatus : (typeof rawStatus === 'string' ? parseInt(rawStatus, 10) : NaN)
      if (statusNum === 1) {
        db.prepare(`INSERT INTO pixverse_requests(key_hash, endpoint, status, response_json) VALUES (?,?,?,?)`)
          .run(keyHash, 'video.result', 'completed', JSON.stringify(parsed).slice(0, 8192))
      } else if (statusNum === 6 || statusNum === 7 || statusNum === 8) {
        db.prepare(`INSERT INTO pixverse_requests(key_hash, endpoint, status, response_json) VALUES (?,?,?,?)`)
          .run(keyHash, 'video.result', 'failed', JSON.stringify(parsed).slice(0, 8192))
      }
    }

    return res.status(r.ok ? 200 : 400).json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'result_failed', detail: message })
  }
}


