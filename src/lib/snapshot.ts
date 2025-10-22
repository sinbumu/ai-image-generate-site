import { AiFrameTemplate, TemplateStyle } from './mijiTemplateClient'

function normalizePrompt(value: unknown): string[] | undefined {
  if (value == null) return undefined
  if (Array.isArray(value)) return value.map((v) => String(v))
  return [String(value)]
}

function normalizeStyle(style: TemplateStyle): TemplateStyle {
  const prompt = normalizePrompt((style as any).prompt)
  return {
    ...style,
    // keep original prompt shape as string | string[] on type, but normalize to array
    prompt,
    order: style.order ?? 0,
  }
}

export function normalizeTemplates(input: AiFrameTemplate[]): AiFrameTemplate[] {
  return (input || []).map((f) => ({
    ...f,
    order: (f as any).order ?? 0,
    styleList: (f.styleList || []).map((s) => normalizeStyle(s as any)),
  }))
}


