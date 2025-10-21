import type { NextApiRequest, NextApiResponse } from 'next'
import db from '@/lib/db'
import { z } from 'zod'
import { hashUserKey } from '@/lib/hash'

const BodySchema = z.object({
  provider: z.enum(['openai', 'hailuo', 'nanobanana', 'pixverse']),
  kind: z.enum(['image', 'video']),
  prompt: z.string().optional(),
  model: z.string().optional(),
  resolution: z.number().int().optional(),
  duration: z.number().int().optional(),
  expand_prompt: z.boolean().optional(),
  source_url: z.string().url().optional(),
  resource_url: z.string().url(),
  thumb_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userKey = (req.headers['x-user-openai-key'] || req.headers['x-user-piapi-key']) as string | string[] | undefined
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing user key header' })
  try {
    const body = BodySchema.parse(req.body || {})
    const keyHash = hashUserKey(String(userKey))
    const ins = db.prepare(`
      INSERT INTO saved_creations(
        provider,key_hash,kind,prompt,model,resolution,duration,expand_prompt,source_url,resource_url,thumb_url,metadata_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    const r = ins.run(
      body.provider,
      keyHash,
      body.kind,
      body.prompt ?? null,
      body.model ?? null,
      body.resolution ?? null,
      body.duration ?? null,
      typeof body.expand_prompt === 'boolean' ? (body.expand_prompt ? 1 : 0) : null,
      body.source_url ?? null,
      body.resource_url,
      body.thumb_url ?? null,
      body.metadata ? truncateJson(JSON.stringify(body.metadata)) : null,
    )
    return res.json({ id: r.lastInsertRowid })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ error: 'invalid_request', detail: message })
  }
}

function truncateJson(text: string | null, max = 8192): string | null {
  if (!text) return text
  return text.length > max ? text.slice(0, max) : text
}


