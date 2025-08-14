import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { hashUserKey } from '@/lib/hash'
import { logServerError } from '@/lib/error'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userKey = req.headers['x-user-piapi-key']
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing x-user-piapi-key' })
  const keyHash = hashUserKey(String(userKey))

  const base = 'https://api.piapi.ai/api/v1/task'
  const headers: Record<string, string> = { 'x-api-key': String(userKey) }

  try {
    if (req.method === 'POST') {
      headers['content-type'] = 'application/json'
      const start = Date.now()
      const payload = JSON.stringify(req.body || null)
      const ins = db.prepare(`INSERT INTO api_requests(provider,key_hash,endpoint,status,payload_json) VALUES(?,?,?,?,?)`)
      const r = ins.run('hailuo', keyHash, base, 'pending', truncateJson(payload))
      const rowId = r.lastInsertRowid as number

      const upstream = await fetch(base, { method: 'POST', headers, body: payload })
      const text = await upstream.text()
      const ok = upstream.ok
      const taskId = extractTaskId(text)
      const upd = db.prepare(`UPDATE api_requests SET status=?, response_json=?, duration_ms=?, task_id=? WHERE id=?`)
      upd.run(ok ? 'created' : 'error', truncateJson(text), Date.now() - start, taskId ?? null, rowId)
      try { console.info('[hailuo_create_response]', JSON.stringify({ status: upstream.status, body: truncateJson(text, 1000) })) } catch {}
      return res.status(upstream.status).send(text)
    }
    if (req.method === 'GET') {
      const id = req.query.id
      if (!id || Array.isArray(id)) return res.status(400).json({ error: 'missing id' })
      const start = Date.now()
      const upstream = await fetch(`${base}/${encodeURIComponent(id)}`, { headers })
      const text = await upstream.text()
      const ok = upstream.ok
      // best-effort: 상태 업데이트
      try {
        const upd = db.prepare(`UPDATE api_requests SET status=?, response_json=?, duration_ms=? WHERE task_id=?`)
        const status = ok ? inferStatus(text) : 'error'
        upd.run(status, truncateJson(text), Date.now() - start, String(id))
      } catch {}
      try { console.info('[hailuo_poll_response]', JSON.stringify({ status: upstream.status, body: truncateJson(text, 1000) })) } catch {}
      return res.status(upstream.status).send(text)
    }
    return res.status(405).end()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const errorId = logServerError('hailuo_proxy_error', e)
    return res.status(502).json({ error: 'proxy_error', detail: message, error_id: errorId })
  }
}

function truncateJson(text: string | null, max = 8192): string | null {
  if (!text) return text
  return text.length > max ? text.slice(0, max) : text
}

function inferStatus(respText: string): 'completed' | 'failed' | 'pending' | 'created' | 'error' {
  try {
    const obj = JSON.parse(respText) as Record<string, unknown>
    const s = (get(obj, ['status']) ?? get(obj, ['data', 'status']) ?? get(obj, ['result', 'status']) ?? get(obj, ['output', 'status'])) as unknown
    if (s === 'completed' || s === 'failed' || s === 'pending' || s === 'created') return s
    if (typeof s === 'number') return s === 2 ? 'completed' : s === -1 ? 'failed' : 'pending'
    return 'pending'
  } catch {
    return 'error'
  }
}

function extractTaskId(respText: string): string | undefined {
  try {
    const obj = JSON.parse(respText) as Record<string, unknown>
    const candidates = [
      get(obj, ['task_id']),
      get(obj, ['taskId']),
      get(obj, ['id']),
      get(obj, ['data', 'task_id']),
      get(obj, ['data', 'id']),
      get(obj, ['result', 'task_id']),
      get(obj, ['result', 'id']),
    ]
    const v = candidates.find((x) => typeof x === 'string')
    return v as string | undefined
  } catch {
    return undefined
  }
}

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}


