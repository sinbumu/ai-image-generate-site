import { AiFrameTemplate, TemplateStyle } from './mijiTemplateClient'

function normalizePrompt(value: unknown): string[] | undefined {
  if (value == null) return undefined
  if (Array.isArray(value)) return value.map((v) => String(v))
  return [String(value)]
}

function normalizeStyle(style: TemplateStyle): TemplateStyle {
  const prompt = normalizePrompt((style as unknown as { prompt?: unknown }).prompt)
  return {
    ...style,
    // keep original prompt shape as string | string[] on type, but normalize to array
    prompt,
    order: style.order ?? 0,
  }
}

export function normalizeTemplates(input: AiFrameTemplate[]): AiFrameTemplate[] {
  return (input || []).map((f) => {
    const hasNumberOrder = typeof (f as unknown as { order?: unknown }).order === 'number'
    const nextOrder: number = hasNumberOrder ? ((f as unknown as { order: number }).order) : 0
    const styles = (f.styleList || []).map((s) => normalizeStyle(s as unknown as TemplateStyle))
    return { ...f, order: nextOrder, styleList: styles }
  })
}


