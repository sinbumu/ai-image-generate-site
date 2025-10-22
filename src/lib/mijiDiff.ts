import { AiFrameTemplate, TemplateStyle, UpsertStyleParams } from './mijiTemplateClient'

export type FrameKey = string // frame name
export type StyleKey = string // style name

export interface FrameDiff {
  addFrames: AiFrameTemplate[]
  removeFrames: AiFrameTemplate[]
  styleAdditions: { frame: string; style: TemplateStyle }[]
  styleRemovals: { frame: string; style: TemplateStyle }[]
  styleChanges: { frame: string; styleName: string; changedFields: string[]; from: TemplateStyle; to: TemplateStyle }[]
}

function byNameMap<T extends { name: string }>(list: T[]): Record<string, T> {
  return list.reduce<Record<string, T>>((acc, cur) => {
    acc[cur.name] = cur
    return acc
  }, {})
}

export function computeDiff(dev: AiFrameTemplate[], prod: AiFrameTemplate[]): FrameDiff {
  const devMap = byNameMap(dev)
  const prodMap = byNameMap(prod)

  const addFrames: AiFrameTemplate[] = []
  const removeFrames: AiFrameTemplate[] = []
  const styleAdditions: { frame: string; style: TemplateStyle }[] = []
  const styleRemovals: { frame: string; style: TemplateStyle }[] = []
  const styleChanges: { frame: string; styleName: string; changedFields: string[]; from: TemplateStyle; to: TemplateStyle }[] = []

  // frames to add/remove
  for (const [name, f] of Object.entries(devMap)) {
    if (!prodMap[name]) addFrames.push(f)
  }
  for (const [name, f] of Object.entries(prodMap)) {
    if (!devMap[name]) removeFrames.push(f)
  }

  // styles diff per common frame
  const commonFrames = Object.keys(devMap).filter((n) => !!prodMap[n])
  for (const frameName of commonFrames) {
    const devStyles = byNameMap(devMap[frameName].styleList || [])
    const prodStyles = byNameMap(prodMap[frameName].styleList || [])

    // additions
    for (const [sName, s] of Object.entries(devStyles)) {
      if (!prodStyles[sName]) styleAdditions.push({ frame: frameName, style: s })
    }
    // removals
    for (const [sName, s] of Object.entries(prodStyles)) {
      if (!devStyles[sName]) styleRemovals.push({ frame: frameName, style: s })
    }
    // changes
    for (const sName of Object.keys(devStyles)) {
      const a = devStyles[sName]
      const b = prodStyles[sName]
      if (!b) continue
      const changed: string[] = []
      // prompt 배열 비교
      const aPrompt = Array.isArray((a as any).prompt) ? (a as any).prompt as string[] : (a as any).prompt ? [String((a as any).prompt)] : []
      const bPrompt = Array.isArray((b as any).prompt) ? (b as any).prompt as string[] : (b as any).prompt ? [String((b as any).prompt)] : []
      if (aPrompt.length !== bPrompt.length || aPrompt.some((v, i) => v !== bPrompt[i])) changed.push('prompt')
      if (a.displayPrompt !== b.displayPrompt) changed.push('displayPrompt')
      if (a.imageUploadInfoType !== b.imageUploadInfoType) changed.push('imageUploadInfoType')
      if (a.styleImageUrl !== b.styleImageUrl) changed.push('styleImageUrl')
      if (a.styleVideoUrl !== b.styleVideoUrl) changed.push('styleVideoUrl')
      if ((a.styleType || '') !== (b.styleType || '')) changed.push('styleType')
      if ((a.order || 0) !== (b.order || 0)) changed.push('order')
      // back/background url도 포함
      if (a.backImageUrl !== b.backImageUrl) changed.push('backImageUrl')
      if (a.backgroundImageUrl !== b.backgroundImageUrl) changed.push('backgroundImageUrl')
      if (changed.length) styleChanges.push({ frame: frameName, styleName: sName, changedFields: changed, from: b, to: a })
    }
  }

  return { addFrames, removeFrames, styleAdditions, styleRemovals, styleChanges }
}

// dev 스타일 정보를 기반으로 GPT_HAILUO 업서트 파라미터를 최대한 추정
export function buildGptHailuoFromDev(
  frameName: string,
  devStyle: TemplateStyle
): Pick<UpsertStyleParams, 'frameName' | 'styleName' | 'styleType' | 'imageUploadInfoType' | 'styleImageUrl' | 'styleVideoUrl' | 'displayPrompt' | 'gptPromptList' | 'gptSampleImageUrlList' | 'hailuoPromptList' | 'order'> {
  const display = devStyle.displayPrompt || ''
  const guessedPrompts = display
    ? display
        .split(/\n|[.;] /)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((p) => ({ prompt: p }))
    : [{ prompt: 'Describe the scene for Hailuo in Korean.' }]

  const sampleList = devStyle.styleImageUrl
    ? [{ imageUrl: [devStyle.styleImageUrl], sampleCount: 1 }]
    : []

  const hailuoList = guessedPrompts.slice(0, 3)

  return {
    frameName,
    styleName: devStyle.name,
    styleType: 'GPT_HAILUO',
    imageUploadInfoType: devStyle.imageUploadInfoType,
    styleImageUrl: devStyle.styleImageUrl,
    styleVideoUrl: devStyle.styleVideoUrl,
    displayPrompt: devStyle.displayPrompt,
    gptPromptList: guessedPrompts,
    gptSampleImageUrlList: sampleList,
    hailuoPromptList: hailuoList,
    order: devStyle.order ?? 0,
  }
}


