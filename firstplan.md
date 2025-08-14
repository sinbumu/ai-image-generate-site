좋아! \*\*2번안(얇은 프록시 추가)\*\*만 깔끔하게 정리해줄게.
**Next.js(페이지 라우터)** 기준으로, 브라우저 → 우리 프록시(API 라우트) → OpenAI/PIAPI 로 흘려보내는 구조야.

* **이점**: CORS 깔끔, 키를 서버에 **저장하지 않고** 헤더로만 중계(로그 금지), Hailuo의 i2v는 **사전 업로드→URL**도 프록시로 처리.

---

# 0) 프로젝트 생성 & 설치

```bash
# 새 Next.js (pages 라우터 사용)
npx create-next-app@latest ai-media-toy --ts --eslint --app false
cd ai-media-toy

# 필요 패키지
npm i http-proxy @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

루트에 **`.env.local`**(S3/R2용) 준비:

```bash
# S3 또는 R2 (S3 호환) 계정
# 이미 쓰던 s3라서 이 저장용으로 쓸때는 별도 디렉토리에 모아야 함.
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_REGION=

# R2 쓸 경우 (선택): S3 호환 엔드포인트
# 예: https://<accountid>.r2.cloudflarestorage.com
S3_ENDPOINT=https://your-r2-endpoint
```

> **주의**: 이 데모는 “공개 URL 필요” 때문에 **퍼블릭 읽기 버킷**을 가정해. (실서비스는 서명 URL 기반의 안전한 공개 경로 설계 권장)

---

# 1) API 라우트 (프록시)

## 1-1. OpenAI 이미지 편집 프록시 (원본 스트림 그대로 전달)

`pages/api/openai-image-edit.ts`

```ts
import type { NextApiRequest, NextApiResponse } from 'next'
import httpProxy from 'http-proxy'

export const config = {
  api: { bodyParser: false }, // 멀티파트 그대로 스트리밍
}

const proxy = httpProxy.createProxyServer({ changeOrigin: true, secure: true })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const userKey = req.headers['x-user-openai-key']
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing x-user-openai-key' })

  // 업스트림으로 보낼 경로 지정
  req.url = '/v1/images/edits'
  // 민감헤더는 업스트림에만 전달하고, 우리 서버 로그 등에는 남기지 않음
  req.headers['authorization'] = `Bearer ${userKey}`
  delete req.headers['x-user-openai-key']
  // 호스트/원본 관련 헤더 정리
  req.headers['host'] = 'api.openai.com'

  await new Promise<void>((resolve, reject) => {
    proxy.once('error', reject)
    proxy.web(req, res, {
      target: 'https://api.openai.com',
      selfHandleResponse: false,
    })
  }).catch((e) => {
    res.status(502).json({ error: 'proxy_error', detail: String(e) })
  })
}
```

> 이 방식은 **요청 본문을 우리 서버가 파싱하지 않고** 그대로 OpenAI로 전달하므로 FormData(파일 포함) 호환이 좋아.

---

## 1-2. PIAPI(Hailuo) 태스크 생성/조회 프록시

`pages/api/piapi-task.ts`

```ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userKey = req.headers['x-user-piapi-key']
  if (!userKey || Array.isArray(userKey)) return res.status(400).json({ error: 'missing x-user-piapi-key' })

  const base = 'https://api.piapi.ai/api/v1/task'
  const headers: Record<string, string> = { 'x-api-key': String(userKey) }

  try {
    if (req.method === 'POST') {
      headers['content-type'] = 'application/json'
      const upstream = await fetch(base, { method: 'POST', headers, body: JSON.stringify(req.body) })
      const text = await upstream.text()
      return res.status(upstream.status).send(text)
    }
    if (req.method === 'GET') {
      const id = req.query.id
      if (!id || Array.isArray(id)) return res.status(400).json({ error: 'missing id' })
      const upstream = await fetch(`${base}/${encodeURIComponent(id)}`, { headers })
      const text = await upstream.text()
      return res.status(upstream.status).send(text)
    }
    return res.status(405).end()
  } catch (e: any) {
    return res.status(502).json({ error: 'proxy_error', detail: String(e?.message || e) })
  }
}
```

---

## 1-3. 사전 업로드용 프리사인 URL (S3/R2)

`pages/api/presign.ts`

```ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const {
  S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION, S3_ENDPOINT,
} = process.env

const client = new S3Client({
  region: S3_REGION || 'auto',
  credentials: { accessKeyId: S3_ACCESS_KEY!, secretAccessKey: S3_SECRET_KEY! },
  ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}), // R2 대응
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { filename, contentType } = req.body || {}
    if (!filename || !contentType) return res.status(400).json({ error: 'filename/contentType required' })

    const key = `uploads/${Date.now()}-${filename}`
    const putCmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read', // 데모용(퍼블릭 버킷 정책이면 생략 가능)
    })

    const uploadUrl = await getSignedUrl(client, putCmd, { expiresIn: 60 }) // 1분
    // 퍼블릭 읽기 URL (버킷 공개 상태 가정)
    const objectUrl = S3_ENDPOINT
      ? `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
      : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`

    return res.json({ uploadUrl, objectUrl, key })
  } catch (e: any) {
    return res.status(500).json({ error: 'presign_failed', detail: String(e?.message || e) })
  }
}
```

> **실무**에선 `ACL: 'public-read'` 대신 버킷 정책으로 **폴더 단위 공개**를 권장.

---

# 2) 프런트 페이지(UI)

`pages/index.tsx`

```tsx
import { useEffect, useState } from 'react'

export default function Home() {
  // 키는 탭이 닫히면 없어지도록 sessionStorage 사용
  const [openaiKey, setOpenaiKey] = useState('')
  const [piapiKey, setPiapiKey] = useState('')

  // GPT
  const [gptFile, setGptFile] = useState<File | null>(null)
  const [gptPrompt, setGptPrompt] = useState('')
  const [gptStatus, setGptStatus] = useState('')
  const [gptImg, setGptImg] = useState<string>('')

  // Hailuo
  const [hlModel, setHlModel] = useState('i2v-02')
  const [hlRes, setHlRes] = useState('768')
  const [hlPrompt, setHlPrompt] = useState('')
  const [hlDuration, setHlDuration] = useState(6)
  const [hlExpand, setHlExpand] = useState(true)

  // 이미지 URL 방식
  const [hlImageUrl, setHlImageUrl] = useState('')
  // 사전 업로드 방식
  const [usePreupload, setUsePreupload] = useState(true)
  const [preuploadFile, setPreuploadFile] = useState<File | null>(null)

  const [hlStatus, setHlStatus] = useState('')
  const [hlVideoUrl, setHlVideoUrl] = useState('')

  useEffect(() => {
    setOpenaiKey(sessionStorage.getItem('OPENAI_KEY') || '')
    setPiapiKey(sessionStorage.getItem('PIAPI_KEY') || '')
  }, [])

  const saveOpenaiKey = (v: string) => {
    setOpenaiKey(v)
    sessionStorage.setItem('OPENAI_KEY', v)
  }
  const savePiapiKey = (v: string) => {
    setPiapiKey(v)
    sessionStorage.setItem('PIAPI_KEY', v)
  }

  const runGpt = async () => {
    setGptStatus('생성 중...')
    setGptImg('')
    if (!openaiKey || !gptFile || !gptPrompt) {
      setGptStatus('키/이미지/프롬프트 필수')
      return
    }
    const fd = new FormData()
    fd.append('model', 'gpt-image-1')
    fd.append('prompt', gptPrompt)
    fd.append('image[]', gptFile, gptFile.name)
    try {
      const r = await fetch('/api/openai-image-edit', {
        method: 'POST',
        headers: { 'x-user-openai-key': openaiKey },
        body: fd,
      })
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      const b64 = data?.data?.[0]?.b64_json
      if (!b64) throw new Error('응답에 이미지 없음')
      setGptImg(`data:image/png;base64,${b64}`)
      setGptStatus('완료')
    } catch (e: any) {
      setGptStatus('에러: ' + (e?.message || e))
    }
  }

  const preuploadToPublicUrl = async (): Promise<string> => {
    if (!preuploadFile) throw new Error('업로드할 파일 선택 필요')
    // 1) presign
    const pres = await fetch('/api/presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: preuploadFile.name, contentType: preuploadFile.type || 'image/png' }),
    })
    if (!pres.ok) throw new Error(await pres.text())
    const { uploadUrl, objectUrl } = await pres.json()
    // 2) PUT 업로드
    const put = await fetch(uploadUrl, { method: 'PUT', body: preuploadFile })
    if (!put.ok) throw new Error('업로드 실패')
    return objectUrl // 공개 읽기 URL
  }

  const runHailuo = async () => {
    setHlStatus('태스크 생성 준비...')
    setHlVideoUrl('')
    if (!piapiKey || !hlPrompt) {
      setHlStatus('PIAPI 키/프롬프트 필수')
      return
    }
    let imageUrl = hlImageUrl
    try {
      if (hlModel.startsWith('i2v')) {
        if (usePreupload) {
          if (!preuploadFile) throw new Error('i2v: 이미지 업로드 파일이 필요합니다.')
          setHlStatus('이미지 업로드 중...')
          imageUrl = await preuploadToPublicUrl()
        } else {
          if (!imageUrl) throw new Error('i2v: 이미지 URL 필요')
        }
      }
      // 1) 태스크 생성
      const body: any = {
        model: 'hailuo',
        task_type: 'video_generation',
        input: {
          prompt: hlPrompt,
          model: hlModel,
          duration: hlDuration,
          resolution: parseInt(hlRes, 10),
          expand_prompt: hlExpand,
          ...(hlModel.startsWith('i2v') ? { image_url: imageUrl } : {})
        },
        config: { service_mode: 'public' }
      }
      setHlStatus('태스크 생성 중...')
      const create = await fetch('/api/piapi-task', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-piapi-key': piapiKey },
        body: JSON.stringify(body)
      })
      if (!create.ok) throw new Error(await create.text())
      const { task_id } = await create.json()
      if (!task_id) throw new Error('task_id 없음')
      setHlStatus(`생성됨(${task_id}) — 진행상황 확인 중...`)

      // 2) 폴링
      let done = false, tries = 0
      while (!done && tries < 120) {
        await new Promise(r => setTimeout(r, 3000))
        const r = await fetch(`/api/piapi-task?id=${encodeURIComponent(task_id)}`, {
          headers: { 'x-user-piapi-key': piapiKey }
        })
        if (!r.ok) throw new Error(await r.text())
        const data = await r.json()
        const s = data?.status
        if (s === 'completed') {
          const url = data?.result?.video_url || data?.result?.url
          if (!url) throw new Error('완료됐지만 영상 URL 없음')
          setHlVideoUrl(url)
          setHlStatus('완료')
          done = true
        } else if (s === 'failed') {
          throw new Error('태스크 실패')
        } else {
          setHlStatus(`상태: ${s || '대기 중'}...`)
        }
        tries++
      }
      if (!done) throw new Error('타임아웃')
    } catch (e: any) {
      setHlStatus('에러: ' + (e?.message || e))
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '40px auto', fontFamily: 'ui-sans-serif,system-ui' }}>
      <h1>GPT 이미지 편집 & Hailuo 영상 생성 (프록시 버전)</h1>

      <section style={box}>
        <h2>API 키</h2>
        <label>OpenAI API Key</label>
        <input type="password" value={openaiKey} onChange={e => saveOpenaiKey(e.target.value)} placeholder="sk-..." />
        <label>PIAPI Key (Hailuo)</label>
        <input type="password" value={piapiKey} onChange={e => savePiapiKey(e.target.value)} placeholder="piapi-..." />
        <p style={muted}>* 키는 <b>sessionStorage</b>에만 저장됩니다(탭 닫으면 삭제).</p>
      </section>

      <section style={box}>
        <h2>GPT 이미지 편집</h2>
        <label>원본 이미지</label>
        <input type="file" accept="image/*" onChange={e => setGptFile(e.target.files?.[0] || null)} />
        <label>프롬프트</label>
        <textarea rows={3} value={gptPrompt} onChange={e => setGptPrompt(e.target.value)} placeholder="예) Create a chaotic logo with ..."/>
        <button onClick={runGpt}>이미지 생성</button>
        <p>{gptStatus}</p>
        {gptImg && <img src={gptImg} style={{ maxWidth: '100%', borderRadius: 8 }} />}
        <p style={muted}>* 프록시가 <code>/v1/images/edits</code>로 스트림을 그대로 중계합니다.</p>
      </section>

      <section style={box}>
        <h2>Hailuo 영상 생성</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label>모델</label>
            <select value={hlModel} onChange={e => setHlModel(e.target.value)}>
              <option value="i2v-02">i2v-02 (이미지→비디오)</option>
              <option value="t2v-01">t2v-01 (텍스트→비디오)</option>
            </select>
          </div>
          <div>
            <label>해상도</label>
            <select value={hlRes} onChange={e => setHlRes(e.target.value)}>
              <option value="768">768</option>
              <option value="720">720</option>
              <option value="1080">1080</option>
            </select>
          </div>
        </div>

        <label>프롬프트</label>
        <textarea rows={3} value={hlPrompt} onChange={e => setHlPrompt(e.target.value)} placeholder="예) fast, neo, hipster" />

        {hlModel.startsWith('i2v') && (
          <>
            <label>
              <input type="checkbox" checked={usePreupload} onChange={e => setUsePreupload(e.target.checked)} />
              {' '}이미지 파일을 사전 업로드로 URL 만들기
            </label>
            {usePreupload ? (
              <>
                <input type="file" accept="image/*" onChange={e => setPreuploadFile(e.target.files?.[0] || null)} />
                <p style={muted}>버킷이 퍼블릭 읽기여야 Hailuo가 접근할 수 있습니다.</p>
              </>
            ) : (
              <>
                <label>이미지 URL</label>
                <input type="url" value={hlImageUrl} onChange={e => setHlImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
              </>
            )}
          </>
        )}

        <label>길이(초)</label>
        <input type="number" min={2} max={10} value={hlDuration} onChange={e => setHlDuration(parseInt(e.target.value || '6', 10))} />

        <label><input type="checkbox" checked={hlExpand} onChange={e => setHlExpand(e.target.checked)} /> expand_prompt</label>

        <button onClick={runHailuo}>영상 생성</button>
        <p>{hlStatus}</p>
        {hlVideoUrl && <video src={hlVideoUrl} controls style={{ width: '100%', borderRadius: 8 }} />}
      </section>
    </div>
  )
}

const box: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 12, padding: 16, margin: '16px 0' }
const muted: React.CSSProperties = { color: '#666', fontSize: 12 }
```

---

# 3) 실행

```bash
npm run dev
# http://localhost:3000 접속
# 1) API 키 입력
# 2) GPT: 이미지 선택 + 프롬프트 → 결과 PNG
# 3) Hailuo: i2v는 파일 사전 업로드(권장) 또는 공개 URL → 생성/폴링 → 결과 영상
```

---

# 4) 보안/운영 메모

* **키 저장 금지**: 서버 로그/metrics에 `x-user-*-key`를 절대 남기지 말 것(현재 코드엔 로깅 없음).
* **업로드 버킷**: 데모는 **퍼블릭 읽기** 가정. 운영은 CloudFront/Signed URL 등 안전한 공개 경로로 대체.
* **제한**: 업로드 용량/타입 제한, 요청 rate-limit(예: IP당 동시 작업 수), 에러 메시지 가공(민감 정보 숨김) 권장.
* **CSP**: `img-src`/`media-src`에 S3/R2 도메인, Hailuo 반환 도메인 허용.

---

필요하면 위 구조를 **레포 초안**으로 묶어서 더 다듬어 줄게.

추가 : 있던 환경변수 재활용 할 생각이라 s3는 요거로?
