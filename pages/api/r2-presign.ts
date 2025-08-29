import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type Body = {
  filename: string
  contentType: string
  bucket: string
  endpoint: string
  prefix?: string
}

function sanitizePath(p: string): string {
  return p.replace(/^\/+|\/+$/g, '')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // 사용자 제공 R2 크레덴셜(브라우저→서버, 로그 금지)
  const accessKey = req.headers['x-user-r2-access-key']
  const secretKey = req.headers['x-user-r2-secret-key']
  if (!accessKey || Array.isArray(accessKey) || !secretKey || Array.isArray(secretKey)) {
    return res.status(400).json({ error: 'missing_r2_credentials' })
  }

  const body: Partial<Body> = req.body || {}
  const { filename, contentType, bucket, endpoint } = body
  if (!filename || !contentType || !bucket || !endpoint) {
    return res.status(400).json({ error: 'missing_fields', detail: 'filename, contentType, bucket, endpoint are required' })
  }
  const prefix = sanitizePath(body.prefix || 'uploads')

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: String(accessKey), secretAccessKey: String(secretKey) },
    })

    const key = `${prefix}/${Date.now()}-${filename}`
    const putCmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(client, putCmd, { expiresIn: 60 })
    const objectUrl = `${sanitizePath(endpoint)}/${bucket}/${key}`

    return res.json({ uploadUrl, objectUrl, key })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'r2_presign_failed', detail: message })
  }
}


