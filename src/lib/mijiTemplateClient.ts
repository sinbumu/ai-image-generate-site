// 타입 정의와 API 래퍼: miji 템플릿/스타일 어드민 연동

export type ImageUploadInfoType = 'DEFAULT' | 'PIXEL'

// 주의: 스펙의 주석에 따라 PIXVERSE_IMAGE_TO_VIDEO 도 허용
export type StyleType = 'GPT_HAILUO' | 'PIXVERSE' | 'PIXVERSE_IMAGE_TO_VIDEO' | 'HAILUO_IMAGE_TO_VIDEO' | 'NANOBANANA_PIXVERSE'

export interface GptPromptDto {
  name?: string
  prompt: string
}

export interface GptSampleImageDto {
  imageUrl: string[]
  name?: string
  sampleCount: number
}

export interface HailuoPromptDto {
  name?: string
  prompt: string
}

export interface TemplateStyle {
  backImageUrl: string
  backgroundImageUrl: string
  displayPrompt?: string
  imageUploadInfoType: ImageUploadInfoType
  name: string
  styleImageUrl: string
  styleVideoUrl: string
  // 응답 추가 필드
  styleType?: StyleType
  order?: number
  // 서버 응답에 포함될 수 있는 확장 필드들 (GET 전용)
  prompt?: string | string[]
  gptPrompt?: { name?: string | null; prompt: string }[]
  gptSampleImageUrlList?: { imageUrl: string[]; sampleCount: number; name?: string | null }[]
  hailuoPrompt?: { name?: string | null; prompt: string }[]
}

export interface AiFrameTemplate {
  available: boolean
  createdAt: string
  dbId: string
  event: boolean
  id?: string
  // 응답 확장 필드(스펙 업데이트)
  styleType?: string
  keyword: string[]
  lockVersion: number
  name: string
  order: number
  sampleImageUrl: string
  schemaVersion: string
  styleList: TemplateStyle[]
  updatedAt: string
}

export interface AiFrameTemplateAdminRetrieveResponseDto {
  data: AiFrameTemplate[]
}

export interface CreateFrameParams {
  frameName: string
  event: boolean
  sampleImageUrl: string
  order?: number
}

export interface UpsertStyleParams {
  frameName: string
  styleName: string
  styleType: StyleType
  imageUploadInfoType: ImageUploadInfoType
  styleImageUrl: string
  styleVideoUrl: string
  order?: number
  // 선택 필드
  displayPrompt?: string
  prompt?: string[]
  gptPromptList?: GptPromptDto[]
  gptSampleImageUrlList?: GptSampleImageDto[]
  hailuoPromptList?: HailuoPromptDto[]
}

type JsonHeaders = { [key: string]: string }

const defaultHeaders: JsonHeaders = {
  'Content-Type': 'application/json',
}

function buildUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/$/, '')
  const trimmedPath = path.replace(/^\//, '')
  return `${trimmedBase}/${trimmedPath}`
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

// GET 응답을 UI에서 쓰기 좋게 정규화
// - NANOBANANA_PIXVERSE 특이 케이스: nanoBananaPrompt → gptPrompt, nanoBananaSampleImageUrlList → gptSampleImageUrlList, pixversePrompt → hailuoPrompt
// - prompt: string | string[] 유지 (UI에서 처리), order 기본값 보정
function normalizeGetTemplatesForUi(input: AiFrameTemplate[]): AiFrameTemplate[] {
  return (input || []).map((t) => {
    const nextStyleList = (t.styleList || []).map((s) => {
      const styleUnknown = s as unknown as { [k: string]: unknown }
      const styleType = s.styleType
      let gptPrompt = s.gptPrompt
      let gptSample = s.gptSampleImageUrlList
      let hailuoPrompt = s.hailuoPrompt

      if (styleType === 'NANOBANANA_PIXVERSE') {
        const nbPrompt = styleUnknown['nanoBananaPrompt'] as { name?: string | null; prompt: string }[] | undefined
        const nbSample = styleUnknown['nanoBananaSampleImageUrlList'] as { imageUrl: string[]; sampleCount: number; name?: string | null }[] | undefined
        const pvPrompt = styleUnknown['pixversePrompt'] as { name?: string | null; prompt: string }[] | undefined
        if (Array.isArray(nbPrompt)) gptPrompt = nbPrompt.map((x) => ({ name: x.name ?? undefined, prompt: x.prompt }))
        if (Array.isArray(nbSample)) gptSample = nbSample.map((x) => ({ imageUrl: x.imageUrl, sampleCount: x.sampleCount, name: x.name ?? undefined }))
        if (Array.isArray(pvPrompt)) hailuoPrompt = pvPrompt.map((x) => ({ name: x.name ?? undefined, prompt: x.prompt }))
      }

      const hasNumberOrder = typeof (s as unknown as { order?: unknown }).order === 'number'
      const fixedOrder: number = hasNumberOrder ? ((s as unknown as { order: number }).order) : 0

      return {
        ...s,
        gptPrompt,
        gptSampleImageUrlList: gptSample,
        hailuoPrompt,
        order: fixedOrder,
      }
    })

    const hasNumberOrder = typeof (t as unknown as { order?: unknown }).order === 'number'
    const fixedOrder: number = hasNumberOrder ? ((t as unknown as { order: number }).order) : 0

    return { ...t, order: fixedOrder, styleList: nextStyleList }
  })
}

// styleType 별 유효성:
// - GPT_HAILUO: gptPromptList, gptSampleImageUrlList, hailuoPromptList 필수
// - NANOBANANA_PIXVERSE: gptPromptList(나나바나나), hailuoPromptList(픽버스 I2V) 필수
// - PIXVERSE | PIXVERSE_IMAGE_TO_VIDEO | HAILUO_IMAGE_TO_VIDEO: prompt[] 필수
function validateUpsertStyle(params: UpsertStyleParams): void {
  assert(!!params.frameName, 'frameName is required')
  assert(!!params.styleName, 'styleName is required')
  assert(!!params.styleImageUrl, 'styleImageUrl is required')
  assert(!!params.styleVideoUrl, 'styleVideoUrl is required')
  if (params.styleType === 'GPT_HAILUO') {
    assert(!!params.gptPromptList && params.gptPromptList.length > 0, 'gptPromptList is required for GPT_HAILUO')
    assert(
      !!params.gptSampleImageUrlList && params.gptSampleImageUrlList.length > 0,
      'gptSampleImageUrlList is required for GPT_HAILUO'
    )
    assert(!!params.hailuoPromptList && params.hailuoPromptList.length > 0, 'hailuoPromptList is required for GPT_HAILUO')
  } else if (params.styleType === 'NANOBANANA_PIXVERSE') {
    assert(!!params.gptPromptList && params.gptPromptList.length > 0, 'gptPromptList is required for NANOBANANA_PIXVERSE')
    assert(!!params.hailuoPromptList && params.hailuoPromptList.length > 0, 'hailuoPromptList is required for NANOBANANA_PIXVERSE')
  } else if (
    params.styleType === 'PIXVERSE' ||
    params.styleType === 'PIXVERSE_IMAGE_TO_VIDEO' ||
    params.styleType === 'HAILUO_IMAGE_TO_VIDEO'
  ) {
    assert(!!params.prompt && params.prompt.length > 0, 'prompt[] is required for PIXVERSE/PIXVERSE_IMAGE_TO_VIDEO/HAILUO_IMAGE_TO_VIDEO')
  }
}

export async function getAllTemplates(baseUrl: string, init?: RequestInit): Promise<AiFrameTemplate[]> {
  const url = buildUrl(baseUrl, '/v1/api/photo-card/template/admin/ai-frame-template')
  const res = await fetch(url, { method: 'GET', ...(init || {}) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`getAllTemplates failed: ${res.status} ${text}`)
  }
  const json = (await res.json()) as AiFrameTemplateAdminRetrieveResponseDto
  const data = json.data || []
  return normalizeGetTemplatesForUi(data)
}

export async function createFrame(
  baseUrl: string,
  params: CreateFrameParams,
  init?: RequestInit
): Promise<{ id: string }> {
  const url = buildUrl(baseUrl, '/v1/api/photo-card/template/admin/ai-frame-template')
  assert(!!params.frameName, 'frameName is required')
  assert(typeof params.event === 'boolean', 'event is required')
  assert(!!params.sampleImageUrl, 'sampleImageUrl is required')

  const body = {
    event: params.event,
    sampleImageUrl: params.sampleImageUrl,
    // 스펙 변경: frameName 필드 사용
    frameName: params.frameName,
    order: params.order ?? 0,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...defaultHeaders, ...(init?.headers as JsonHeaders) },
    body: JSON.stringify(body),
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createFrame failed: ${res.status} ${text}`)
  }
  return (await res.json()) as { id: string }
}

export async function deleteFrame(baseUrl: string, frameName: string, init?: RequestInit): Promise<void> {
  const url = buildUrl(baseUrl, '/v1/api/photo-card/template/admin/ai-frame-template')
  assert(!!frameName, 'frameName is required')
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...defaultHeaders, ...(init?.headers as JsonHeaders) },
    // 스펙 변경: frameName 필드 사용
    body: JSON.stringify({ frameName }),
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`deleteFrame failed: ${res.status} ${text}`)
  }
}

export async function upsertStyle(
  baseUrl: string,
  params: UpsertStyleParams,
  init?: RequestInit
): Promise<{ id: string }> {
  validateUpsertStyle(params)
  const url = buildUrl(baseUrl, '/v1/api/photo-card/template/admin/ai-frame-template/style')
  const body = {
    displayPrompt: params.displayPrompt,
    frameName: params.frameName,
    gptPromptList: params.gptPromptList,
    gptSampleImageUrlList: params.gptSampleImageUrlList,
    hailuoPromptList: params.hailuoPromptList,
    imageUploadInfoType: params.imageUploadInfoType,
    prompt: params.prompt,
    styleImageUrl: params.styleImageUrl,
    styleName: params.styleName,
    styleType: params.styleType,
    styleVideoUrl: params.styleVideoUrl,
    order: params.order ?? 0,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...defaultHeaders, ...(init?.headers as JsonHeaders) },
    body: JSON.stringify(body),
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`upsertStyle failed: ${res.status} ${text}`)
  }
  return (await res.json()) as { id: string }
}

export async function deleteStyle(
  baseUrl: string,
  frameName: string,
  styleName: string,
  init?: RequestInit
): Promise<void> {
  assert(!!frameName, 'frameName is required')
  assert(!!styleName, 'styleName is required')
  const url = buildUrl(baseUrl, '/v1/api/photo-card/template/admin/ai-frame-template/style')
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...defaultHeaders, ...(init?.headers as JsonHeaders) },
    // 스펙 변경: frameName, styleName 사용
    body: JSON.stringify({ frameName, styleName }),
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`deleteStyle failed: ${res.status} ${text}`)
  }
}


