import type { NextApiRequest, NextApiResponse } from 'next'

// DEV/PROD 전환을 위해 쿼리 또는 헤더로 base 전달 가능. 기본은 ENV 사용
const { MIJI_DEV_BASE, MIJI_PROD_BASE } = process.env

function pickBase(env: string | undefined): string {
  if (env === 'prod' && MIJI_PROD_BASE) return MIJI_PROD_BASE
  if (MIJI_DEV_BASE) return MIJI_DEV_BASE
  throw new Error('missing MIJI_DEV_BASE/MIJI_PROD_BASE')
}

function buildUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, '')
  const p = path.replace(/^\//, '')
  return `${b}/${p}`
}

async function forward(req: NextApiRequest, res: NextApiResponse) {
  const targetEnv = (req.query.env as string) || (req.headers['x-miji-env'] as string) || 'dev'
  const base = pickBase(targetEnv)
  const path = (req.query.path as string) || ''
  if (!path) return res.status(400).json({ error: 'missing_path' })

  const url = buildUrl(base, path)
  const method = (req.method || 'GET').toUpperCase()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(req.body || {}),
    })
    const text = await upstream.text()
    res.status(upstream.status)
    try {
      return res.json(JSON.parse(text))
    } catch {
      return res.send(text)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'proxy_failed', detail: message })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return forward(req, res)
}


