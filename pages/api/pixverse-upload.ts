import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'
type PixUploadResp = Record<string, unknown> | { raw: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers['x-user-pixverse-key']
  if (!apiKey || Array.isArray(apiKey)) return res.status(400).json({ error: 'missing pixverse key header' })
  const keyHash = hashUserKey(String(apiKey))
  if (req.method !== 'POST') return res.status(405).end()

  try {
    // 클라이언트에서 dataURL(base64)로 전달받아 서버에서 Pixverse로 멀티파트 전송
    const { filename, contentType, dataUrl } = req.body || {}
    if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' })
    const b64 = String(dataUrl).split(',')[1]
    const buf = Buffer.from(b64, 'base64')

    const upstream = await fetch('https://app-api.pixverse.ai/openapi/v2/image/upload', {
      method: 'POST',
      headers: {
        'API-KEY': String(apiKey),
      },
      body: (() => {
        const fd = new FormData()
        fd.append('image', new Blob([buf], { type: contentType || 'image/png' }), filename || 'image.png')
        return fd
      })(),
    })
    const text = await upstream.text()
    let parsed: PixUploadResp
    try { parsed = JSON.parse(text) as Record<string, unknown> } catch { parsed = { raw: text } }

    // 로그
    db.prepare(`INSERT INTO pixverse_requests(key_hash, endpoint, status, response_json) VALUES (?,?,?,?)`)
      .run(keyHash, 'image.upload', 'completed', JSON.stringify(parsed).slice(0, 8192))

    return res.status(upstream.ok ? 200 : 400).json(parsed)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'upload_failed', detail: message })
  }
}


