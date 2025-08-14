import type { NextApiRequest, NextApiResponse } from 'next'
import httpProxy from 'http-proxy'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'
import { logServerError } from '@/lib/error'

export const config = {
  api: { bodyParser: false },
}

const proxy = httpProxy.createProxyServer({ changeOrigin: true, secure: true })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const userKey = req.headers['x-user-openai-key']
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing x-user-openai-key' })

  const keyHash = hashUserKey(String(userKey))
  const startTs = Date.now()
  const insert = db.prepare(`INSERT INTO api_requests(provider,key_hash,endpoint,status,payload_json) VALUES(?,?,?,?,?)`)
  const rec = insert.run('openai', keyHash, '/v1/images/edits', 'pending', null)
  const rowId = rec.lastInsertRowid as number

  req.url = '/v1/images/edits'
  req.headers['authorization'] = `Bearer ${userKey}`
  delete req.headers['x-user-openai-key']
  req.headers['host'] = 'api.openai.com'

  await new Promise<void>((resolve) => {
    proxy.web(
      req,
      res,
      {
        target: 'https://api.openai.com',
        selfHandleResponse: true,
      },
      (err) => {
        const duration = Date.now() - startTs
        const upd = db.prepare(`UPDATE api_requests SET status=?, error_message=?, duration_ms=? WHERE id=?`)
        upd.run('error', String(err), duration, rowId)
        const errorId = logServerError('openai_image_proxy_error', err)
        res.status(502).json({ error: 'proxy_error', detail: String(err), error_id: errorId })
        resolve()
      }
    )

    proxy.once('proxyRes', (proxyRes) => {
      const chunks: Buffer[] = []
      proxyRes.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      proxyRes.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const contentType = (proxyRes.headers['content-type'] || '').toString()
        const contentEncoding = (proxyRes.headers['content-encoding'] || '').toString()
        const isJson = contentType.includes('application/json')

        const duration = Date.now() - startTs
        const ok = proxyRes.statusCode && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300

        // For DB/log preview only: try to decode JSON if not compressed, otherwise log binary summary
        let preview: string
        try {
          if (isJson && !contentEncoding) {
            preview = truncateJson(buffer.toString('utf8'), 1000) || ''
          } else {
            preview = `binary:${buffer.length}B type=${contentType} enc=${contentEncoding || 'none'}`
          }
        } catch {
          preview = `binary:${buffer.length}B type=${contentType}`
        }

        const upd = db.prepare(`UPDATE api_requests SET status=?, response_json=?, duration_ms=? WHERE id=?`)
        upd.run(ok ? 'completed' : 'error', preview, duration, rowId)

        try {
          console.info('[openai_proxy_response]', JSON.stringify({ status: proxyRes.statusCode, preview }))
        } catch {}

        // Pass-through response as-is (keep compression and headers), only set content-length to actual buffer size
        res.status(proxyRes.statusCode || 200)
        Object.entries(proxyRes.headers || {}).forEach(([k, v]) => {
          if (typeof v === 'string' || Array.isArray(v)) {
            res.setHeader(k, v)
          }
        })
        res.setHeader('content-length', buffer.length)
        res.end(buffer)
        resolve()
      })
    })
  })
}

function truncateJson(text: string | null, max = 8192): string | null {
  if (!text) return text
  return text.length > max ? text.slice(0, max) : text
}


