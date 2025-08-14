import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const { S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_PREFIX } = process.env

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const missing: string[] = []
    if (!S3_BUCKET) missing.push('S3_BUCKET')
    if (!S3_ACCESS_KEY) missing.push('S3_ACCESS_KEY')
    if (!S3_SECRET_KEY) missing.push('S3_SECRET_KEY')
    // AWS S3를 사용하면 REGION 필요. R2(end-point 사용)면 region 없이도 동작 가능
    if (!S3_ENDPOINT && !S3_REGION) missing.push('S3_REGION')
    if (missing.length) {
      return res.status(500).json({ error: 'missing_env', detail: '환경변수 누락', missing })
    }

    const client = new S3Client({
      region: S3_REGION || 'auto',
      credentials: { accessKeyId: S3_ACCESS_KEY!, secretAccessKey: S3_SECRET_KEY! },
      ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
    })

    const { filename, contentType } = req.body || {}
    if (!filename || !contentType) return res.status(400).json({ error: 'filename/contentType required' })

    const basePrefix = (S3_PREFIX || 'ai-media-toy/uploads').replace(/^\/+|\/+$/g, '')
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const key = `${basePrefix}/${unique}-${filename}`
    const putCmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    })

    const uploadUrl = await getSignedUrl(client, putCmd, { expiresIn: 60 })
    const objectUrl = S3_ENDPOINT
      ? `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
      : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`

    return res.json({ uploadUrl, objectUrl, key })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'presign_failed', detail: message })
  }
}


