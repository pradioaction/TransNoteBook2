import { useMemo } from 'react'
import { useThemeStore } from '@/store/themeStore'

/** camelCase 键名 → kebab-case CSS 变量名，如 quizCardBackground → --quiz-card-background */
const toCssVarName = (key: string) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

export function useTheme() {
  const { colors, setTheme, theme } = useThemeStore()

  // 全量导出 ThemeConfig 为 CSS 变量：新增字段时无需再手工登记，
  // 避免出现「代码在用、变量却没导出」的缺口
  const cssVars = useMemo(() => {
    const vars: Record<string, string> = {}
    for (const [key, value] of Object.entries(colors)) {
      vars[toCssVarName(key)] = value
    }
    return vars as unknown as React.CSSProperties
  }, [colors])

  return { theme, colors, setTheme, cssVars }
}
