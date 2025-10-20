import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import {
  AiFrameTemplate,
  getAllTemplates,
  upsertStyle,
  createFrame,
  deleteFrame,
  deleteStyle,
  StyleType,
  ImageUploadInfoType,
  TemplateStyle,
} from '../src/lib/mijiTemplateClient'
import { computeDiff, FrameDiff, buildGptHailuoFromDev } from '../src/lib/mijiDiff'

// 공통 UI 스타일
const ui = {
  label: { display: 'grid', gap: 4 } as React.CSSProperties,
  input: {
    padding: '8px 10px',
    border: '1px solid #2a2f3a',
    borderRadius: 8,
    background: '#0f1218',
    color: '#e6e6e6',
  } as React.CSSProperties,
  select: {
    padding: '8px 10px',
    border: '1px solid #2a2f3a',
    borderRadius: 8,
    background: '#0f1218',
    color: '#e6e6e6',
  } as React.CSSProperties,
  textarea: {
    padding: '8px 10px',
    border: '1px solid #2a2f3a',
    borderRadius: 8,
    background: '#0f1218',
    color: '#e6e6e6',
    minHeight: 88,
  } as React.CSSProperties,
  button: {
    padding: '8px 12px',
    border: '1px solid #2a2f3a',
    borderRadius: 8,
    background: '#1a73e8',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  buttonGhost: {
    padding: '8px 12px',
    border: '1px solid #2a2f3a',
    borderRadius: 8,
    background: 'transparent',
    color: '#e6e6e6',
    cursor: 'pointer',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
  } as React.CSSProperties,
  th: {
    textAlign: 'left',
    padding: 8,
    background: '#0b0f15',
    borderBottom: '1px solid #222a35',
    position: 'sticky',
    top: 0,
  } as React.CSSProperties,
  td: {
    padding: 8,
    borderBottom: '1px solid #1b2430',
  } as React.CSSProperties,
  card: {
    border: '1px solid #1b2430',
    borderRadius: 12,
    padding: 12,
    background: '#0a0e14',
  } as React.CSSProperties,
}

type EnvType = 'dev' | 'prod'

export default function TemplateAdminPage() {
  const [env, setEnv] = useState<EnvType>('dev')
  const [baseUrl, setBaseUrl] = useState<string>('')
  const [data, setData] = useState<AiFrameTemplate[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [devSnapshot, setDevSnapshot] = useState<AiFrameTemplate[] | null>(null)
  const [diff, setDiff] = useState<FrameDiff | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const dev = process.env.NEXT_PUBLIC_MIJi_DEV_BASE || process.env.NEXT_PUBLIC_MIIJ_DEV_BASE || ''
    const prod = process.env.NEXT_PUBLIC_MIJi_PROD_BASE || process.env.NEXT_PUBLIC_MIIJ_PROD_BASE || ''
    setBaseUrl(env === 'prod' ? prod : dev)
  }, [env])

  useEffect(() => {
    if (!baseUrl) return
    setLoading(true)
    setError('')
    getAllTemplates(baseUrl)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [baseUrl])

  // dev 스냅샷 로컬스토리지 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem('miji_dev_snapshot')
      if (raw) setDevSnapshot(JSON.parse(raw))
    } catch {}
  }, [])

  return (
    <>
      <Head>
        <title>Template Admin</title>
      </Head>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
        <header style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>/template</h2>
          <select style={ui.select} value={env} onChange={(e) => setEnv(e.target.value as EnvType)}>
            <option value="dev">dev</option>
            <option value="prod">prod</option>
          </select>
          {env === 'prod' && (
            <span style={{ color: '#b00020', fontWeight: 700 }}>주의: PROD 환경</span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <small style={{ opacity: 0.7 }}>Base: {baseUrl || '-'}</small>
          </div>
          <button style={{ ...ui.buttonGhost, marginLeft: 8 }} onClick={() => setShowHelp(true)}>사용법?</button>
        </header>

        <section style={{ marginBottom: 16 }}>
          <FrameCreator baseUrl={baseUrl} onCreated={() => {
            setLoading(true)
            getAllTemplates(baseUrl).then(setData).finally(() => setLoading(false))
          }} />
        </section>

        <section style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <button style={ui.button} onClick={() => { setDevSnapshot(data); try { localStorage.setItem('miji_dev_snapshot', JSON.stringify(data)) } catch {} }}>dev 스냅샷 저장</button>
          <button style={ui.button} onClick={() => {
            if (!devSnapshot) {
              alert('먼저 dev 스냅샷을 저장하세요')
              return
            }
            if (env !== 'prod') {
              alert('prod 환경에서 비교하세요')
              return
            }
            const d = computeDiff(devSnapshot, data)
            setDiff(d)
          }}>스냅샷과 PROD 비교</button>
        </section>

        {loading && <p>불러오는 중…</p>}
        {error && (
          <p style={{ color: 'crimson' }}>에러: {error}</p>
        )}

        <section style={{ display: 'grid', gap: 16 }}>
          {data.map((f) => (
            <FrameCard key={f.dbId} frame={f} env={env} baseUrl={baseUrl} onChanged={() => {
              setLoading(true)
              getAllTemplates(baseUrl).then(setData).finally(() => setLoading(false))
            }} />
          ))}
        </section>

        {diff && (
          <DiffPanel diff={diff} baseUrl={baseUrl} onApplyFrames={async () => {
            // 프레임 추가만 자동 적용 (스타일은 필드 불명확성으로 미리보기만)
            for (const f of diff.addFrames) {
              await createFrame(baseUrl, { frameName: f.name, event: f.event, sampleImageUrl: f.sampleImageUrl })
            }
            setLoading(true)
            const refreshed = await getAllTemplates(baseUrl)
            setData(refreshed)
            setDiff(null)
            setLoading(false)
          }} onApplyStyleAdd={async (frameName, styleName) => {
            try {
              const devFrame = devSnapshot?.find((f) => f.name === frameName)
              const s = devFrame?.styleList.find((x) => x.name === styleName)
              if (!s) throw new Error('dev 스냅샷에서 스타일 정보를 찾을 수 없습니다')
              const params = buildGptHailuoFromDev(frameName, s)
              await upsertStyle(baseUrl, params)
              const refreshed = await getAllTemplates(baseUrl)
              setData(refreshed)
            } catch (e) {
              alert((e as Error).message)
            }
          }} onApplyStyleRemove={async (frameName, styleName) => {
            try {
              await deleteStyle(baseUrl, frameName, styleName)
              const refreshed = await getAllTemplates(baseUrl)
              setData(refreshed)
            } catch (e) {
              alert((e as Error).message)
            }
          }} />
        )}
        {showHelp && (
          <HelpModal onClose={() => setShowHelp(false)} />)
        }
      </main>
    </>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
      <div style={{ ...ui.card, width: 'min(820px, 92vw)', maxHeight: '84vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>템플릿 어드민 사용법</h3>
          <button style={ui.buttonGhost} onClick={onClose}>닫기</button>
        </div>
        <ol style={{ lineHeight: 1.7 }}>
          <li>상단에서 환경(dev/prod)을 선택합니다. prod는 실제 운영 반영이므로 주의하세요.</li>
          <li>프레임 생성 섹션에서 frameName, event, sampleImageUrl을 입력하고 업로드 버튼으로 이미지를 올린 뒤 생성합니다.</li>
          <li>프레임 카드에서 스타일 목록을 확인하고, 각 행의 수정 버튼으로 스타일을 편집/업서트합니다.</li>
          <li>styleType이 GPT_HAILUO인 경우 gptPromptList, gptSampleImageUrlList, hailuoPromptList를 키-값 편집기로 입력해야 합니다.</li>
          <li>dev 스냅샷 저장 후 prod에서 “스냅샷과 PROD 비교”를 누르면 차이를 확인하고, 프레임 추가/스타일 업서트를 빠르게 적용할 수 있습니다.</li>
          <li>업로드는 사전 서명 URL을 사용합니다. 업로드 후 생성된 URL이 입력 칸에 자동 주입됩니다.</li>
        </ol>
        <div style={{ marginTop: 8 }}>
          <small>TIP: 변경 전 페이지 새로고침을 통해 최신 데이터를 다시 받아 충돌을 줄이세요.</small>
        </div>
      </div>
    </div>
  )
}

function FrameCreator({ baseUrl, onCreated }: { baseUrl: string; onCreated: () => void }) {
  const [frameName, setFrameName] = useState('')
  const [event, setEvent] = useState(false)
  const [sampleImageUrl, setSampleImageUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    if (!frameName || !sampleImageUrl) {
      alert('frameName, sampleImageUrl 필수')
      return
    }
    setBusy(true)
    try {
      await createFrame(baseUrl, { frameName, event, sampleImageUrl })
      setFrameName('')
      setEvent(false)
      setSampleImageUrl('')
      onCreated()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={ui.card}>
      <h4 style={{ marginTop: 0 }}>프레임 생성</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={ui.label}>
          <span>frameName</span>
          <input style={ui.input} value={frameName} onChange={(e) => setFrameName(e.target.value)} placeholder="예: BirthdayFrame" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={event} onChange={(e) => setEvent(e.target.checked)} />
          <span>event</span>
        </label>
        <label style={{ ...ui.label, minWidth: 280 }}>
          <span>sampleImageUrl</span>
          <input style={ui.input} value={sampleImageUrl} onChange={(e) => setSampleImageUrl(e.target.value)} placeholder="https://..." />
        </label>
        <Uploader label="이미지 업로드" accept="image/*" onUploaded={(url) => setSampleImageUrl(url)} />
        <button style={ui.button} onClick={handleCreate} disabled={busy}>프레임 생성</button>
      </div>
    </div>
  )
}

function DiffPanel({ diff, baseUrl, onApplyFrames, onApplyStyleAdd, onApplyStyleRemove }: { diff: FrameDiff; baseUrl: string; onApplyFrames: () => void; onApplyStyleAdd: (frameName: string, styleName: string) => void; onApplyStyleRemove: (frameName: string, styleName: string) => void }) {
  return (
    <div style={ui.card}>
      <h3 style={{ marginTop: 0 }}>dev→prod 계획 미리보기</h3>
      <ul>
        <li>프레임 추가: {diff.addFrames.length}개</li>
        <li>프레임 제거: {diff.removeFrames.length}개</li>
        <li>스타일 추가: {diff.styleAdditions.length}개</li>
        <li>스타일 제거: {diff.styleRemovals.length}개</li>
        <li>스타일 변경: {diff.styleChanges.length}개</li>
      </ul>
      <details>
        <summary>상세 보기</summary>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {diff.addFrames.length > 0 && (
            <div>
              <strong>프레임 추가</strong>
              <ul>
                {diff.addFrames.map((f) => (<li key={`af-${f.name}`}>{f.name}</li>))}
              </ul>
              <button style={ui.button} onClick={onApplyFrames}>프레임 추가 자동 적용</button>
            </div>
          )}
          {diff.removeFrames.length > 0 && (
            <div>
              <strong>프레임 제거</strong>
              <ul>
                {diff.removeFrames.map((f) => (<li key={`rf-${f.name}`}>{f.name}</li>))}
              </ul>
            </div>
          )}
          {diff.styleAdditions.length > 0 && (
            <div>
              <strong>스타일 추가</strong>
              <ul>
                {diff.styleAdditions.map((s, i) => (
                  <li key={`sa-${s.frame}-${s.style.name}-${i}`}>
                    {s.frame} / {s.style.name}
                    <button style={{ ...ui.button, marginLeft: 8 }} onClick={() => onApplyStyleAdd(s.frame, s.style.name)}>이 스타일 생성(단순 업서트)</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.styleRemovals.length > 0 && (
            <div>
              <strong>스타일 제거</strong>
              <ul>
                {diff.styleRemovals.map((s, i) => (
                  <li key={`sr-${s.frame}-${s.style.name}-${i}`}>
                    {s.frame} / {s.style.name}
                    <button style={{ ...ui.buttonGhost, marginLeft: 8 }} onClick={() => onApplyStyleRemove(s.frame, s.style.name)}>이 스타일 삭제</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.styleChanges.length > 0 && (
            <div>
              <strong>스타일 변경</strong>
              <ul>
                {diff.styleChanges.map((c, i) => (
                  <li key={`sc-${c.frame}-${c.styleName}-${i}`}>
                    {c.frame} / {c.styleName} → {c.changedFields.join(', ')}
                    <button style={{ ...ui.button, marginLeft: 8 }} onClick={() => onApplyStyleAdd(c.frame, c.styleName)}>변경 내용 반영(단순 업서트)</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

function FrameCard({ frame, baseUrl, env, onChanged }: { frame: AiFrameTemplate; baseUrl: string; env: EnvType; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)

  async function handleDeleteFrame() {
    if (!confirm(`${frame.name} 프레임을 삭제할까요? (스타일까지 함께 삭제)`)) return
    setBusy(true)
    try {
      await deleteFrame(baseUrl, frame.name)
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={ui.card}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong>{frame.name}</strong>
        <span>order: {frame.order}</span>
        {frame.event && <span style={{ color: '#2962ff' }}>event</span>}
        {!frame.available && <span style={{ color: '#b00020' }}>unavailable</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={ui.buttonGhost} onClick={handleDeleteFrame} disabled={busy}>프레임 삭제</button>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <img src={frame.sampleImageUrl} alt={`${frame.name} 샘플`} style={{ maxHeight: 120 }} />
      </div>
      <StyleTable frameName={frame.name} styles={frame.styleList} baseUrl={baseUrl} onChanged={onChanged} />
    </div>
  )
}

function StyleTable({ frameName, styles, baseUrl, onChanged }: { frameName: string; styles: AiFrameTemplate['styleList']; baseUrl: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<TemplateStyle | null>(null)

  async function handleDeleteStyle(styleName: string) {
    if (!confirm(`${styleName} 스타일을 삭제할까요?`)) return
    setBusy(true)
    try {
      await deleteStyle(baseUrl, frameName, styleName)
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <table style={ui.table}>
        <thead>
          <tr>
            <th style={ui.th}>styleName</th>
            <th style={ui.th}>imageUploadInfoType</th>
            <th style={ui.th}>styleImage</th>
            <th style={ui.th}>styleVideo</th>
            <th style={ui.th}>actions</th>
          </tr>
        </thead>
        <tbody>
          {styles.map((s, idx) => (
            <tr key={`${frameName}:${s.name}:${s.styleImageUrl}:${s.styleVideoUrl}:${idx}`}>
              <td style={ui.td}>{s.name}</td>
              <td style={ui.td}>{s.imageUploadInfoType}</td>
              <td style={ui.td}><a href={s.styleImageUrl} target="_blank" rel="noreferrer">image</a></td>
              <td style={ui.td}><a href={s.styleVideoUrl} target="_blank" rel="noreferrer">video</a></td>
              <td style={ui.td}>
                <button style={ui.buttonGhost} onClick={() => setEditing(s)} disabled={busy}>수정</button>
                <button style={{ ...ui.buttonGhost, marginLeft: 8 }} onClick={() => handleDeleteStyle(s.name)} disabled={busy}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <StyleEditor
        frameName={frameName}
        baseUrl={baseUrl}
        onSaved={() => { setEditing(null); onChanged() }}
        initial={editing ? {
          styleName: editing.name,
          imageUploadInfoType: editing.imageUploadInfoType,
          styleImageUrl: editing.styleImageUrl,
          styleVideoUrl: editing.styleVideoUrl,
          displayPrompt: editing.displayPrompt || '',
          // 서버 응답 확장 필드
          prompt: editing.prompt || '',
          gptPrompt: Array.isArray(editing.gptPrompt) ? editing.gptPrompt : undefined,
          gptSampleImageUrlList: Array.isArray(editing.gptSampleImageUrlList) ? editing.gptSampleImageUrlList : undefined,
          hailuoPrompt: Array.isArray(editing.hailuoPrompt) ? editing.hailuoPrompt : undefined,
        } : undefined}
        onCancelEdit={() => setEditing(null)}
      />
    </div>
  )
}

function StyleEditor({ frameName, baseUrl, onSaved, initial, onCancelEdit }: { frameName: string; baseUrl: string; onSaved: () => void; initial?: { styleName: string; imageUploadInfoType: ImageUploadInfoType; styleImageUrl: string; styleVideoUrl: string; displayPrompt: string; prompt?: string; gptPrompt?: { name?: string | null; prompt: string }[]; gptSampleImageUrlList?: { imageUrl: string[]; sampleCount: number; name?: string | null }[]; hailuoPrompt?: { name?: string | null; prompt: string }[] }; onCancelEdit?: () => void }) {
  const [styleName, setStyleName] = useState('')
  const [styleType, setStyleType] = useState<StyleType>('GPT_HAILUO')
  const [imageUploadInfoType, setImageUploadInfoType] = useState<ImageUploadInfoType>('DEFAULT')
  const [styleImageUrl, setStyleImageUrl] = useState('')
  const [styleVideoUrl, setStyleVideoUrl] = useState('')
  const [displayPrompt, setDisplayPrompt] = useState('')
  const [prompt, setPrompt] = useState('')
  const [gptPromptList, setGptPromptList] = useState<{ name?: string; prompt: string }[]>([])
  const [gptSampleImageUrlList, setGptSampleImageUrlList] = useState<{ name?: string; imageUrl: string[]; sampleCount: number }[]>([])
  const [hailuoPromptList, setHailuoPromptList] = useState<{ name?: string; prompt: string }[]>([])
  const [busy, setBusy] = useState(false)

  // 초기값이 바뀌면 편집 모드로 필드 채우기
  useEffect(() => {
    if (!initial) return
    setStyleName(initial.styleName)
    setImageUploadInfoType(initial.imageUploadInfoType)
    setStyleImageUrl(initial.styleImageUrl)
    setStyleVideoUrl(initial.styleVideoUrl)
    setDisplayPrompt(initial.displayPrompt)
    setPrompt(initial.prompt || '')
    if (initial.gptPrompt) setGptPromptList(initial.gptPrompt.map((x) => ({ name: (x.name || undefined), prompt: x.prompt })))
    if (initial.gptSampleImageUrlList) setGptSampleImageUrlList(initial.gptSampleImageUrlList.map((x) => ({ name: (x.name || undefined), imageUrl: x.imageUrl, sampleCount: x.sampleCount })))
    if (initial.hailuoPrompt) setHailuoPromptList(initial.hailuoPrompt.map((x) => ({ name: (x.name || undefined), prompt: x.prompt })))
  }, [initial])

  const requiresGptFields = styleType === 'GPT_HAILUO'
  const requiresPrompt = styleType === 'PIXVERSE' || styleType === 'PIXVERSE_IMAGE_TO_VIDEO'

  async function handleSave() {
    setBusy(true)
    try {
      const gptPromptArr = gptPromptList.length ? gptPromptList.map((x) => ({ name: x.name, prompt: x.prompt })) : undefined
      const gptSampleArr = gptSampleImageUrlList.length ? gptSampleImageUrlList.map((x) => ({ name: x.name, imageUrl: x.imageUrl, sampleCount: x.sampleCount })) : undefined
      const hailuoArr = hailuoPromptList.length ? hailuoPromptList.map((x) => ({ name: x.name, prompt: x.prompt })) : undefined

      await upsertStyle(baseUrl, {
        frameName,
        styleName,
        styleType,
        imageUploadInfoType,
        styleImageUrl,
        styleVideoUrl,
        displayPrompt: displayPrompt || undefined,
        prompt: prompt || undefined,
        gptPromptList: gptPromptArr,
        gptSampleImageUrlList: gptSampleArr,
        hailuoPromptList: hailuoArr,
      })
      onSaved()
      setStyleName('')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={ui.card}>
      <h4 style={{ marginTop: 0 }}>{initial ? `스타일 수정: ${initial.styleName}` : '스타일 생성/업서트'}</h4>
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={ui.label}>
          <span>styleName</span>
          <input style={ui.input} value={styleName} onChange={(e) => setStyleName(e.target.value)} placeholder="예: PixelBirthday" />
        </label>
        <label style={ui.label}>
          <span>styleType</span>
          <select style={ui.select} value={styleType} onChange={(e) => setStyleType(e.target.value as StyleType)}>
            <option value="GPT_HAILUO">GPT_HAILUO</option>
            <option value="PIXVERSE">PIXVERSE</option>
            <option value="PIXVERSE_IMAGE_TO_VIDEO">PIXVERSE_IMAGE_TO_VIDEO</option>
          </select>
        </label>
        <label style={ui.label}>
          <span>imageUploadInfoType</span>
          <select style={ui.select} value={imageUploadInfoType} onChange={(e) => setImageUploadInfoType(e.target.value as ImageUploadInfoType)}>
            <option value="DEFAULT">DEFAULT</option>
            <option value="PIXEL">PIXEL</option>
          </select>
        </label>
        <label style={ui.label}>
          <span>styleImageUrl</span>
          <input style={ui.input} value={styleImageUrl} onChange={(e) => setStyleImageUrl(e.target.value)} placeholder="https://..." />
        </label>
        <Uploader label="이미지 업로드" accept="image/*" onUploaded={(url) => setStyleImageUrl(url)} />
        <label style={ui.label}>
          <span>styleVideoUrl</span>
          <input style={ui.input} value={styleVideoUrl} onChange={(e) => setStyleVideoUrl(e.target.value)} placeholder="https://..." />
        </label>
        <Uploader label="비디오 업로드" accept="video/*" onUploaded={(url) => setStyleVideoUrl(url)} />
        <label style={ui.label}>
          <span>displayPrompt</span>
          <input style={ui.input} value={displayPrompt} onChange={(e) => setDisplayPrompt(e.target.value)} />
        </label>
        {requiresPrompt && (
          <label style={ui.label}>
            <span>prompt (PIXVERSE*, I2V*)</span>
            <textarea style={ui.textarea} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          </label>
        )}
        {requiresGptFields && (
          <div style={{ display: 'grid', gap: 8 }}>
            <KVArrayEditor
              label="gptPromptList"
              rows={gptPromptList}
              onChange={setGptPromptList}
              renderRow={(row: { name?: string; prompt: string }, onRowChange) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...ui.input, width: 140 }} placeholder="name(옵션)" value={row.name || ''} onChange={(e) => onRowChange({ ...row, name: e.target.value || undefined })} />
                  <input style={{ ...ui.input, flex: 1 }} placeholder="prompt" value={row.prompt} onChange={(e) => onRowChange({ ...row, prompt: e.target.value })} />
                </div>
              )}
              createEmpty={() => ({ name: undefined, prompt: '' })}
            />
            <KVArrayEditor
              label="gptSampleImageUrlList"
              rows={gptSampleImageUrlList}
              onChange={setGptSampleImageUrlList}
              renderRow={(row: { name?: string; imageUrl: string[]; sampleCount: number }, onRowChange) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...ui.input, width: 140 }} placeholder="name(옵션)" value={row.name || ''} onChange={(e) => onRowChange({ ...row, name: e.target.value || undefined })} />
                  <input style={{ ...ui.input, flex: 1 }} placeholder="imageUrl(콤마구분)" value={row.imageUrl.join(', ')} onChange={(e) => onRowChange({ ...row, imageUrl: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                  <input style={{ ...ui.input, width: 100 }} type="number" placeholder="sampleCount" value={row.sampleCount} onChange={(e) => onRowChange({ ...row, sampleCount: Number(e.target.value || 0) })} />
                </div>
              )}
              createEmpty={() => ({ imageUrl: [], sampleCount: 1 })}
            />
            <KVArrayEditor
              label="hailuoPromptList"
              rows={hailuoPromptList}
              onChange={setHailuoPromptList}
              renderRow={(row: { name?: string; prompt: string }, onRowChange) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...ui.input, width: 140 }} placeholder="name(옵션)" value={row.name || ''} onChange={(e) => onRowChange({ ...row, name: e.target.value || undefined })} />
                  <input style={{ ...ui.input, flex: 1 }} placeholder="prompt" value={row.prompt} onChange={(e) => onRowChange({ ...row, prompt: e.target.value })} />
                </div>
              )}
              createEmpty={() => ({ name: undefined, prompt: '' })}
            />
          </div>
        )}
        <div>
          <button style={ui.button} onClick={handleSave} disabled={busy}>저장</button>
          {initial && (
            <button style={{ ...ui.buttonGhost, marginLeft: 8 }} onClick={() => onCancelEdit && onCancelEdit()} disabled={busy}>취소</button>
          )}
        </div>
      </div>
    </div>
  )
}

type KVEditorProps<T> = {
  label: string
  rows: T[]
  onChange: (rows: T[]) => void
  renderRow: (row: T, onRowChange: (next: T) => void) => React.ReactNode
  createEmpty: () => T
}

function KVArrayEditor<T>({ label, rows, onChange, renderRow, createEmpty }: KVEditorProps<T>) {
  return (
    <div style={ui.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>{label}</strong>
        <button style={ui.button} onClick={() => onChange([...rows, createEmpty()])}>추가</button>
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {renderRow(row, (next) => onChange(rows.map((r, idx) => (idx === i ? next : r))))}
            <button style={ui.buttonGhost} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>삭제</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Uploader({ label, accept, onUploaded }: { label: string; accept: string; onUploaded: (url: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function handleUpload() {
    if (!file) return
    setBusy(true)
    try {
      const res = await fetch('/api/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!res.ok) throw new Error('presign 실패')
      const { uploadUrl, objectUrl } = await res.json()
      const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!put.ok) throw new Error('업로드 실패')
      onUploaded(objectUrl)
      setFile(null)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <input ref={inputRef} type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
      <button style={ui.buttonGhost} type="button" onClick={() => inputRef.current?.click()}>파일 선택</button>
      <span style={{ minWidth: 160, color: file ? '#e6e6e6' : '#8a94a6' }}>{file ? file.name : '선택된 파일 없음'}</span>
      <button style={ui.button} onClick={handleUpload} disabled={busy || !file}>{label}</button>
    </span>
  )
}


