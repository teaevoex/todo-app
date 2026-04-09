import { colorTokens } from './colors'
import { priorityTokens } from './priority'
import { semanticTokens } from './semantic'
import { spacingTokens } from './spacing'
import { typographyTokens } from './typography'
import { borderTokens } from './borders'
import { tagDefaultPalette } from './tags'

export {
  colorTokens,
  priorityTokens,
  semanticTokens,
  spacingTokens,
  typographyTokens,
  borderTokens,
  tagDefaultPalette,
}

function toCSS(prefix: string, tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([key, value]) => `  --${prefix}${key}: ${value};`)
    .join('\n')
}

function toCSSNoPrefix(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n')
}

export function generateCSSProperties(mode: 'light' | 'dark'): string {
  const colors = colorTokens[mode]
  const priority = priorityTokens[mode]
  const semantic = semanticTokens[mode]

  return [
    toCSSNoPrefix(colors as unknown as Record<string, string>),
    toCSSNoPrefix(priority as unknown as Record<string, string>),
    toCSSNoPrefix(semantic as unknown as Record<string, string>),
    toCSSNoPrefix(spacingTokens as unknown as Record<string, string>),
    toCSSNoPrefix(typographyTokens as unknown as Record<string, string>),
    toCSSNoPrefix(borderTokens as unknown as Record<string, string>),
  ].join('\n')
}
