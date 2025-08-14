import { useEffect, useState } from 'react'

export default function Home() {
  const [openaiKey, setOpenaiKey] = useState('')
  const [piapiKey, setPiapiKey] = useState('')

  const [gptFile, setGptFile] = useState<File | null>(null)
  const [gptPrompt, setGptPrompt] = useState('')
  const [gptStatus, setGptStatus] = useState('')
  const [gptImg, setGptImg] = useState<string>('')
  const [gptLoading, setGptLoading] = useState(false)
  const [gptBackground, setGptBackground] = useState<'transparent' | 'opaque'>('transparent')
  const [gptSize, setGptSize] = useState<'1024x1536' | '1536x1024' | '1024x1024'>('1024x1536')
  const [gptQuality, setGptQuality] = useState<'low' | 'medium' | 'high'>('low')
  const [gptSaved, setGptSaved] = useState(false)

  const [hlModel, setHlModel] = useState('i2v-02')
  const [hlRes, setHlRes] = useState('768')
  const [hlPrompt, setHlPrompt] = useState('')
  const [hlDuration, setHlDuration] = useState(6)
  const [hlExpand, setHlExpand] = useState(true)

  const [hlImageUrl, setHlImageUrl] = useState('')
  const [usePreupload, setUsePreupload] = useState(true)
  const [preuploadFile, setPreuploadFile] = useState<File | null>(null)

  const [hlStatus, setHlStatus] = useState('')
  const [hlVideoUrl, setHlVideoUrl] = useState('')
  const [hlLoading, setHlLoading] = useState(false)
  const [hlCoverUrl, setHlCoverUrl] = useState('')
  const [hlUsedSourceUrl, setHlUsedSourceUrl] = useState('')
  const [hlSaved, setHlSaved] = useState(false)

  // 히스토리 (요청/생성물)
  type RequestItem = { id: number; created_at: string; provider: string; endpoint?: string; task_id?: string; status: string; error_message?: string | null }
  type CreationItem = { id: number; created_at: string; provider: string; kind: 'image' | 'video'; prompt?: string | null; model?: string | null; resolution?: number | null; duration?: number | null; expand_prompt?: number | null; source_url?: string | null; resource_url: string; thumb_url?: string | null }
  const [reqOpenai, setReqOpenai] = useState<RequestItem[]>([])
  const [reqHailuo, setReqHailuo] = useState<RequestItem[]>([])
  const [creOpenai, setCreOpenai] = useState<CreationItem[]>([])
  const [creHailuo, setCreHailuo] = useState<CreationItem[]>([])
  const [reqOpenaiOffset, setReqOpenaiOffset] = useState(0)
  const [reqHailuoOffset, setReqHailuoOffset] = useState(0)
  const [creOpenaiOffset, setCreOpenaiOffset] = useState(0)
  const [creHailuoOffset, setCreHailuoOffset] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [modal, setModal] = useState<CreationItem | null>(null)

  const formatKST = (s: string) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date(s))

  useEffect(() => {
    setOpenaiKey(sessionStorage.getItem('OPENAI_KEY') || '')
    setPiapiKey(sessionStorage.getItem('PIAPI_KEY') || '')
  }, [])

  useEffect(() => {
    // 초기 로드 및 키/오프셋 변경 시 히스토리 갱신
    void (async () => {
      await Promise.all([refreshRequests(), refreshCreations()])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openaiKey, piapiKey, reqOpenaiOffset, reqHailuoOffset, creOpenaiOffset, creHailuoOffset])

  const persistOpenaiKey = () => {
    sessionStorage.setItem('OPENAI_KEY', openaiKey)
  }
  const clearOpenaiKey = () => {
    setOpenaiKey('')
    sessionStorage.removeItem('OPENAI_KEY')
  }
  const persistPiapiKey = () => {
    sessionStorage.setItem('PIAPI_KEY', piapiKey)
  }
  const clearPiapiKey = () => {
    setPiapiKey('')
    sessionStorage.removeItem('PIAPI_KEY')
  }

  const runGpt = async () => {
    setGptStatus('생성 중...')
    setGptLoading(true)
    setGptImg('')
    setGptSaved(false)
    if (!openaiKey || !gptFile || !gptPrompt) {
      setGptStatus('키/이미지/프롬프트 필수')
      setGptLoading(false)
      return
    }
    const fd = new FormData()
    fd.append('model', 'gpt-image-1')
    fd.append('prompt', gptPrompt)
    fd.append('image', gptFile, gptFile.name)
    fd.append('background', gptBackground)
    fd.append('size', gptSize)
    fd.append('quality', gptQuality)
    try {
      const r = await fetch('/api/openai-image-edit', {
        method: 'POST',
        headers: { 'x-user-openai-key': openaiKey },
        body: fd,
      })
      if (!r.ok) throw new Error(await r.text())
      const ct = r.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
      const data = await r.json()
      const b64 = data?.data?.[0]?.b64_json
      if (!b64) throw new Error('응답에 이미지 없음')
      setGptImg(`data:image/png;base64,${b64}`)
      } else {
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        setGptImg(url)
      }
      setGptStatus('완료')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setGptStatus('에러: ' + message)
    } finally {
      setGptLoading(false)
    }
  }

  const preuploadToPublicUrl = async (): Promise<string> => {
    if (!preuploadFile) throw new Error('업로드할 파일 선택 필요')
    const pres = await fetch('/api/presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: preuploadFile.name, contentType: preuploadFile.type || 'image/png' }),
    })
    if (!pres.ok) throw new Error(await pres.text())
    const { uploadUrl, objectUrl } = await pres.json()
    const put = await fetch(uploadUrl, { method: 'PUT', body: preuploadFile })
    if (!put.ok) throw new Error('업로드 실패')
    return objectUrl
  }

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [meta, b64] = dataUrl.split(',')
    const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream'
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new Blob([arr], { type: mime })
  }

  const preuploadBlobToPublicUrl = async (filename: string, contentType: string, blob: Blob): Promise<string> => {
    const pres = await fetch('/api/presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename, contentType }),
    })
    if (!pres.ok) throw new Error(await pres.text())
    const { uploadUrl, objectUrl } = await pres.json()
    const put = await fetch(uploadUrl, { method: 'PUT', body: blob })
    if (!put.ok) throw new Error('업로드 실패')
    return objectUrl
  }

  const saveCurrentGpt = async () => {
    if (!gptImg) return
    if (!openaiKey) throw new Error('OpenAI 키가 필요합니다')
    if (gptSaved) return
    const blob = dataUrlToBlob(gptImg)
    const url = await preuploadBlobToPublicUrl(`gpt-image-${Date.now()}.png`, 'image/png', blob)
    const resp = await fetch('/api/save-creation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-openai-key': openaiKey },
      body: JSON.stringify({
        provider: 'openai',
        kind: 'image',
        prompt: gptPrompt,
        model: 'gpt-image-1',
        resource_url: url,
        thumb_url: url,
        metadata: {},
      }),
    })
    if (!resp.ok) throw new Error(await resp.text())
    // 저장 후 히스토리 새로고침
    refreshCreations()
    setGptSaved(true)
  }

  const saveCurrentHailuo = async () => {
    if (!hlVideoUrl) return
    if (!piapiKey) throw new Error('PIAPI 키가 필요합니다')
    if (hlSaved) return
    let uploadUrl = hlVideoUrl
    try {
      const videoBlobResp = await fetch(hlVideoUrl)
      if (videoBlobResp.ok) {
        const blob = await videoBlobResp.blob()
        const guessedType = blob.type || 'video/mp4'
        uploadUrl = await preuploadBlobToPublicUrl(`hailuo-video-${Date.now()}.mp4`, guessedType, blob)
      }
    } catch {
      // 원본 URL 그대로 저장 (CORS 등으로 다운로드 실패 시)
      uploadUrl = hlVideoUrl
    }
    const resp = await fetch('/api/save-creation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-piapi-key': piapiKey },
      body: JSON.stringify({
        provider: 'hailuo',
        kind: 'video',
        prompt: hlPrompt,
        model: hlModel,
        resolution: parseInt(hlRes, 10),
        duration: hlDuration,
        expand_prompt: hlExpand,
        source_url: hlModel.startsWith('i2v') && hlUsedSourceUrl ? hlUsedSourceUrl : undefined,
        resource_url: uploadUrl,
        thumb_url: hlCoverUrl || undefined,
        metadata: {},
      }),
    })
    if (!resp.ok) throw new Error(await resp.text())
    refreshCreations()
    setHlSaved(true)
  }

  const refreshRequests = async () => {
    setHistoryLoading(true)
    try {
      if (openaiKey) {
        const r = await fetch(`/api/history/requests?provider=openai&offset=${reqOpenaiOffset}&limit=10`, { headers: { 'x-user-openai-key': openaiKey } })
        if (r.ok) {
          const { items } = await r.json()
          setReqOpenai(items)
        }
      }
      if (piapiKey) {
        const r = await fetch(`/api/history/requests?provider=hailuo&offset=${reqHailuoOffset}&limit=10`, { headers: { 'x-user-piapi-key': piapiKey } })
        if (r.ok) {
          const { items } = await r.json()
          setReqHailuo(items)
        }
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  const refreshCreations = async () => {
    setHistoryLoading(true)
    try {
      if (openaiKey) {
        const r = await fetch(`/api/history/creations?provider=openai&offset=${creOpenaiOffset}&limit=10`, { headers: { 'x-user-openai-key': openaiKey } })
        if (r.ok) {
          const { items } = await r.json()
          setCreOpenai(items)
        }
      }
      if (piapiKey) {
        const r = await fetch(`/api/history/creations?provider=hailuo&offset=${creHailuoOffset}&limit=10`, { headers: { 'x-user-piapi-key': piapiKey } })
        if (r.ok) {
          const { items } = await r.json()
          setCreHailuo(items)
        }
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  const runHailuo = async () => {
    if (hlLoading) return
    setHlStatus('태스크 생성 준비...')
    setHlVideoUrl('')
    setHlLoading(true)
    setHlSaved(false)
    if (!piapiKey || !hlPrompt) {
      setHlStatus('PIAPI 키/프롬프트 필수')
      setHlLoading(false)
      return
    }
    let imageUrl = hlImageUrl
    try {
      if (hlModel.startsWith('i2v')) {
        if (usePreupload) {
          if (!preuploadFile) throw new Error('i2v: 이미지 업로드 파일이 필요합니다.')
          setHlStatus('이미지 업로드 중...')
          imageUrl = await preuploadToPublicUrl()
          setHlUsedSourceUrl(imageUrl)
        } else {
          if (!imageUrl) throw new Error('i2v: 이미지 URL 필요')
          setHlUsedSourceUrl(imageUrl)
        }
      }
      if (!hlModel.startsWith('i2v')) setHlUsedSourceUrl('')
      const body: {
        model: string
        task_type: string
        input: Record<string, unknown>
        config: Record<string, unknown>
      } = {
        model: 'hailuo',
        task_type: 'video_generation',
        input: {
          prompt: hlPrompt,
          model: hlModel,
          duration: hlDuration,
          resolution: parseInt(hlRes, 10),
          expand_prompt: hlExpand,
          ...(hlModel.startsWith('i2v') ? { image_url: imageUrl } : {}),
        },
        config: { service_mode: 'public' },
      }
      setHlStatus('태스크 생성 중...')
      const create = await fetch('/api/piapi-task', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-piapi-key': piapiKey },
        body: JSON.stringify(body),
      })
      const respText = await create.text()
      if (!create.ok) throw new Error(respText)

      const safeParse = (t: string): unknown => { try { return JSON.parse(t) } catch { return t } }
      const parsed = safeParse(respText)

      const extractTaskId = (data: unknown): string | undefined => {
        if (!data || typeof data !== 'object') return undefined
        const o = data as Record<string, unknown>
        const from = (v: unknown, k: string): unknown => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>)[k] : undefined)
        const candidates = [
          o['task_id'],
          o['taskId'],
          o['id'],
          from(o['data'], 'task_id'),
          from(o['data'], 'id'),
          from(o['result'], 'task_id'),
          from(o['result'], 'id'),
        ]
        const found = candidates.find((v) => typeof v === 'string')
        return found as string | undefined
      }

      const taskId = extractTaskId(parsed)
      if (!taskId) throw new Error(`task_id 없음 — 응답: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`)
      setHlStatus(`생성됨(${taskId}) — 진행상황 확인 중...`)

      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
      let done = false

      const pollOnce = async () => {
        const r = await fetch(`/api/piapi-task?id=${encodeURIComponent(taskId)}`, {
          headers: { 'x-user-piapi-key': piapiKey },
        })
        const respText = await r.text()
        if (!r.ok) throw new Error(respText)

        const safeParse = (t: string): unknown => { try { return JSON.parse(t) } catch { return t } }
        const parsed = safeParse(respText)

        const get = (obj: unknown, path: string[]): unknown => {
          let cur: unknown = obj
          for (const key of path) {
            if (typeof cur !== 'object' || cur === null) return undefined
            cur = (cur as Record<string, unknown>)[key]
          }
          return cur
        }
        const extractStatus = (obj: unknown): string | undefined => {
          const candidates = [
            get(obj, ['status']),
            get(obj, ['data', 'status']),
            get(obj, ['result', 'status']),
            get(obj, ['output', 'status']),
            get(obj, ['data', 'output', 'status']),
          ]
          const v = candidates.find((x) => typeof x === 'string' || typeof x === 'number')
          if (typeof v === 'string') return v
          if (typeof v === 'number') return v === 2 ? 'completed' : v === -1 ? 'failed' : 'processing'
          return undefined
        }
        const extractVideoUrl = (obj: unknown): string | undefined => {
          const candidates = [
            get(obj, ['result', 'video_url']),
            get(obj, ['result', 'url']),
            get(obj, ['data', 'result', 'video_url']),
            get(obj, ['data', 'output', 'video_url']),
            get(obj, ['data', 'output', 'download_url']),
          ]
          const v = candidates.find((x) => typeof x === 'string')
          return v as string | undefined
        }
        const extractCoverUrl = (obj: unknown): string | undefined => {
          const candidates = [
            get(obj, ['data', 'output', 'cover_url']),
            get(obj, ['result', 'cover_url']),
          ]
          const v = candidates.find((x) => typeof x === 'string')
          return v as string | undefined
        }
        const s = extractStatus(parsed)
        if (s === 'completed') {
          const url = extractVideoUrl(parsed)
          if (!url) throw new Error(`완료됐지만 영상 URL 없음 — 응답: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`)
          const cover = extractCoverUrl(parsed)
          if (cover) setHlCoverUrl(cover)
          setHlVideoUrl(url)
          setHlStatus('완료')
          done = true
          return
        }
        if (s === 'failed') {
          throw new Error(`태스크 실패 — 응답: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`)
        }
        setHlStatus(`상태: ${s || '대기 중'}...`)
      }

      // 초기 30초 간격 2회 폴링
      for (let i = 0; i < 2 && !done; i++) {
        await delay(30000)
        await pollOnce()
      }
      // 이후 10초 간격 50회 폴링
      for (let i = 0; i < 50 && !done; i++) {
        await delay(10000)
        await pollOnce()
      }
      if (!done) throw new Error('타임아웃')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setHlStatus('에러: ' + message)
    } finally {
      setHlLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 font-sans">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">GPT 이미지 편집 & Hailuo 영상 생성</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">프록시를 통해 키를 저장하지 않고 안전하게 중계합니다.</p>
      </div>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 shadow-sm backdrop-blur p-5 sm:p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">API 키</h2>
        <div className="grid gap-3">
          <label className="text-sm text-neutral-600 dark:text-neutral-300">OpenAI API Key</label>
          <input
            type="password"
            value={openaiKey}
            onChange={e => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="new-password"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
            name="openai_api_key"
          />
          <div className="flex gap-2">
            <button onClick={persistOpenaiKey} className="h-9 px-3 rounded-lg bg-neutral-800 text-white text-sm hover:bg-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600">저장</button>
            <button onClick={clearOpenaiKey} className="h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800">제거</button>
          </div>
          <label className="text-sm text-neutral-600 dark:text-neutral-300 mt-2">PIAPI Key (Hailuo)</label>
          <input
            type="password"
            value={piapiKey}
            onChange={e => setPiapiKey(e.target.value)}
            placeholder="piapi-..."
            autoComplete="new-password"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
            name="piapi_key"
          />
          <div className="flex gap-2">
            <button onClick={persistPiapiKey} className="h-9 px-3 rounded-lg bg-neutral-800 text-white text-sm hover:bg-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600">저장</button>
            <button onClick={clearPiapiKey} className="h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800">제거</button>
          </div>
          <p className="text-xs text-neutral-500">키는 sessionStorage에만 저장됩니다(탭 닫으면 삭제).</p>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 shadow-sm backdrop-blur p-5 sm:p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">GPT 이미지 편집</h2>
        <div className="grid gap-3">
          <label className="text-sm text-neutral-600 dark:text-neutral-300">원본 이미지</label>
          <div className="flex items-center gap-3">
            <input
              id="gpt-file"
              type="file"
              accept="image/*"
              onChange={e => setGptFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <label
              htmlFor="gpt-file"
              role="button"
              tabIndex={0}
              className="inline-flex items-center justify-center h-10 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100 dark:active:bg-neutral-600 focus:outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
            >
              파일 선택
            </label>
            <span className="text-sm text-neutral-600 dark:text-neutral-300 truncate max-w-[60%]">
              {gptFile?.name || '선택된 파일 없음'}
            </span>
          </div>
          <label className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">프롬프트</label>
          <textarea
            rows={3}
            value={gptPrompt}
            onChange={e => setGptPrompt(e.target.value)}
            placeholder="예) Create a chaotic logo with ..."
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 py-2 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
          />
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="grid gap-1">
              <label className="text-sm text-neutral-600 dark:text-neutral-300">background</label>
              <select
                value={gptBackground}
                onChange={e => setGptBackground(e.target.value as 'transparent' | 'opaque')}
                className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20">
                <option value="transparent">transparent</option>
                <option value="opaque">opaque</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm text-neutral-600 dark:text-neutral-300">size</label>
              <select
                value={gptSize}
                onChange={e => setGptSize(e.target.value as '1024x1536' | '1536x1024' | '1024x1024')}
                className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20">
                <option value="1024x1536">1024x1536</option>
                <option value="1536x1024">1536x1024</option>
                <option value="1024x1024">1024x1024</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm text-neutral-600 dark:text-neutral-300">quality</label>
              <select
                value={gptQuality}
                onChange={e => setGptQuality(e.target.value as 'low' | 'medium' | 'high')}
                className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20">
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={runGpt}
              disabled={gptLoading}
              className={`h-11 px-4 rounded-xl text-white font-medium transition-colors ${gptLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'}`}
            >
              {gptLoading ? '이미지 생성 중...' : '이미지 생성'}
            </button>
            <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              {gptLoading && <span className="inline-block size-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
              {gptStatus}
            </p>
          </div>
          {gptImg && (
            <img
              src={gptImg}
              alt="result"
              className="mt-2 max-w-full rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm"
            />
          )}
          {gptImg && (
            <div className="mt-2">
              <button onClick={saveCurrentGpt} disabled={gptSaved} className={`h-10 px-3 rounded-xl border text-sm ${gptSaved ? 'cursor-not-allowed opacity-60 border-neutral-300 dark:border-neutral-700' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>현재 생성물 저장</button>
            </div>
          )}
          <p className="text-xs text-neutral-500">프록시가 <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">/v1/images/edits</code>로 스트림을 그대로 중계합니다.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 shadow-sm backdrop-blur p-5 sm:p-6">
        <h2 className="text-lg font-medium mb-4">Hailuo 영상 생성</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm text-neutral-600 dark:text-neutral-300">모델</label>
            <select value={hlModel} onChange={e => setHlModel(e.target.value)} className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20">
              <option value="i2v-02">i2v-02 (이미지→비디오)</option>
              <option value="t2v-01">t2v-01 (텍스트→비디오)</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-neutral-600 dark:text-neutral-300">해상도</label>
            <select value={hlRes} onChange={e => setHlRes(e.target.value)} className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20">
              <option value="768">768</option>
              <option value="720">720</option>
              <option value="1080">1080</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 mt-3">
          <label className="text-sm text-neutral-600 dark:text-neutral-300">프롬프트</label>
          <textarea
            rows={3}
            value={hlPrompt}
            onChange={e => setHlPrompt(e.target.value)}
            placeholder="예) fast, neo, hipster"
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 py-2 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
          />

        {hlModel.startsWith('i2v') && (
            <div className="grid gap-2 mt-1">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={usePreupload} onChange={e => setUsePreupload(e.target.checked)} className="size-4" />
                이미지 파일을 사전 업로드로 URL 만들기
            </label>
            {usePreupload ? (
              <>
                  <div className="flex items-center gap-3">
                    <input
                      id="hl-preupload-file"
                      type="file"
                      accept="image/*"
                      onChange={e => setPreuploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label
                      htmlFor="hl-preupload-file"
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center justify-center h-10 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100 dark:active:bg-neutral-600 focus:outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
                    >
                      파일 선택
                    </label>
                    <span className="text-sm text-neutral-600 dark:text-neutral-300 truncate max-w-[60%]">
                      {preuploadFile?.name || '선택된 파일 없음'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">버킷이 퍼블릭 읽기여야 Hailuo가 접근할 수 있습니다.</p>
              </>
            ) : (
              <>
                  <label className="text-sm text-neutral-600 dark:text-neutral-300">이미지 URL</label>
                  <input
                    type="url"
                    value={hlImageUrl}
                    onChange={e => setHlImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
                  />
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="grid gap-2">
              <label className="text-sm text-neutral-600 dark:text-neutral-300">길이(초)</label>
              <input
                type="number"
                min={2}
                max={10}
                value={hlDuration}
                onChange={e => setHlDuration(parseInt(e.target.value || '6', 10))}
                className="h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 px-3 outline-none focus:ring-4 focus:ring-blue-200/60 dark:focus:ring-blue-400/20"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={hlExpand} onChange={e => setHlExpand(e.target.checked)} className="size-4" />
                expand_prompt
              </label>
              <p className="text-xs text-neutral-500 mt-1">입력 프롬프트를 모델이 더 자세히 확장해도 되는지 여부(Expand the input prompt).</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={runHailuo}
              disabled={hlLoading}
              className={`h-11 px-4 rounded-xl text-white font-medium transition-colors ${hlLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'}`}
            >
              {hlLoading ? '영상 생성 중...' : '영상 생성'}
            </button>
            {hlVideoUrl && (
              <button
                onClick={saveCurrentHailuo}
                disabled={hlSaved}
                className={`h-11 px-4 rounded-xl border text-sm ${hlSaved ? 'cursor-not-allowed opacity-60 border-neutral-300 dark:border-neutral-700' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                현재 생성물 저장
              </button>
            )}
            <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              {hlLoading && <span className="inline-block size-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
              {hlStatus}
            </p>
          </div>

          {hlVideoUrl && (
            <video src={hlVideoUrl} controls className="mt-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm" />
          )}
        </div>
      </section>

      {/* 요청 히스토리 */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 shadow-sm backdrop-blur p-5 sm:p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">요청 히스토리</h2>
          <button onClick={() => { refreshRequests() }} className="h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Refresh
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-sm font-semibold mb-2">OpenAI</div>
            <ul className="space-y-2 text-sm">
              {reqOpenai.map(item => (
                <li key={`o-${item.id}`} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">{formatKST(item.created_at)}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">{item.status}</span>
                  </div>
                  <div className="mt-1 truncate text-neutral-700 dark:text-neutral-200">{item.endpoint}</div>
                  {item.error_message && <div className="mt-1 text-xs text-red-500">{item.error_message}</div>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setReqOpenaiOffset(Math.max(0, reqOpenaiOffset - 10))}
                disabled={reqOpenaiOffset === 0}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${reqOpenaiOffset === 0 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Prev
              </button>
              <button
                onClick={() => setReqOpenaiOffset(reqOpenaiOffset + 10)}
                disabled={reqOpenai.length < 10}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${reqOpenai.length < 10 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Next
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Hailuo</div>
            <ul className="space-y-2 text-sm">
              {reqHailuo.map(item => (
                <li key={`h-${item.id}`} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">{formatKST(item.created_at)}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">{item.status}</span>
                  </div>
                  <div className="mt-1 truncate text-neutral-700 dark:text-neutral-200">{item.task_id || '-'}</div>
                  {item.error_message && <div className="mt-1 text-xs text-red-500">{item.error_message}</div>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setReqHailuoOffset(Math.max(0, reqHailuoOffset - 10))}
                disabled={reqHailuoOffset === 0}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${reqHailuoOffset === 0 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Prev
              </button>
              <button
                onClick={() => setReqHailuoOffset(reqHailuoOffset + 10)}
                disabled={reqHailuo.length < 10}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${reqHailuo.length < 10 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 저장한 생성물 */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 shadow-sm backdrop-blur p-5 sm:p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">저장한 생성물</h2>
          <button onClick={() => { refreshCreations() }} className="h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Refresh
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-sm font-semibold mb-2">OpenAI</div>
            <div className="grid grid-cols-3 gap-3">
              {creOpenai.map(c => (
                <button key={`co-${c.id}`} onClick={() => setModal(c)} className="group aspect-square rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800">
                  <img src={c.thumb_url || c.resource_url} alt="thumb" className="w-full h-full object-cover group-hover:opacity-90" />
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setCreOpenaiOffset(Math.max(0, creOpenaiOffset - 10))}
                disabled={creOpenaiOffset === 0}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${creOpenaiOffset === 0 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Prev
              </button>
              <button
                onClick={() => setCreOpenaiOffset(creOpenaiOffset + 10)}
                disabled={creOpenai.length < 10}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${creOpenai.length < 10 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Next
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Hailuo</div>
            <div className="grid grid-cols-3 gap-3">
              {creHailuo.map(c => (
                <button key={`ch-${c.id}`} onClick={() => setModal(c)} className="group aspect-square rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800">
                  {c.kind === 'video' ? (
                    <video src={c.resource_url} className="w-full h-full object-cover group-hover:opacity-90" muted />
                  ) : (
                    <img src={c.thumb_url || c.resource_url} alt="thumb" className="w-full h-full object-cover group-hover:opacity-90" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setCreHailuoOffset(Math.max(0, creHailuoOffset - 10))}
                disabled={creHailuoOffset === 0}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${creHailuoOffset === 0 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Prev
              </button>
              <button
                onClick={() => setCreHailuoOffset(creHailuoOffset + 10)}
                disabled={creHailuo.length < 10}
                className={`h-8 px-3 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors ${creHailuo.length < 10 ? 'opacity-60 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-5xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm text-neutral-600 dark:text-neutral-300">미리보기</div>
              <button onClick={() => setModal(null)} className="h-8 px-3 rounded border border-neutral-300 dark:border-neutral-700 text-sm">닫기</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                {modal.kind === 'image' ? (
                  <img src={modal.resource_url} alt="preview" className="w-full rounded-xl" />
                ) : (
                  <video src={modal.resource_url} controls className="w-full rounded-xl" />
                )}
              </div>
              <div className="text-xs">
                <div className="font-semibold mb-2">메타데이터</div>
                <pre className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">{JSON.stringify(modal, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

//


