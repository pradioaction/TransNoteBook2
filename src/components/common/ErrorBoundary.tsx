import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import type { ThemeConfig } from '@/types/notebook'

// === v2.2 新增：分区错误边界 ===
// 此前渲染进程没有任何 error boundary，任一子组件抛错都会让 React 卸载整棵树
// （表现：整个应用变成空白/黑屏）。这里按区域隔离，把故障限制在单个面板内。

interface ErrorBoundaryProps {
  children: ReactNode
  /** 区域名称，用于错误提示与日志定位 */
  section: string
}

interface InnerProps extends ErrorBoundaryProps {
  colors: ThemeConfig
  title: string
  hint: string
  retryLabel: string
}

interface InnerState {
  error: Error | null
}

class ErrorBoundaryInner extends Component<InnerProps, InnerState> {
  state: InnerState = { error: null }

  static getDerivedStateFromError(error: Error): InnerState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.section}]`, error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { colors, title, hint, retryLabel } = this.props
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          backgroundColor: colors.errorBackground,
          border: `1px solid ${colors.errorBorder}`,
          color: colors.errorText,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{hint}</div>
        <pre
          style={{
            margin: 0,
            padding: 8,
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            backgroundColor: colors.background,
            color: colors.foreground,
            borderRadius: 3,
          }}
        >
          {error.message}
        </pre>
        <div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: `1px solid ${colors.border}`,
              borderRadius: 3,
              backgroundColor: colors.primaryButton,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {retryLabel}
          </button>
        </div>
      </div>
    )
  }
}

export function ErrorBoundary({ children, section }: ErrorBoundaryProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()

  return (
    <ErrorBoundaryInner
      section={section}
      colors={colors}
      title={t('errorBoundary.title', { section: t(`errorBoundary.section.${section}`) })}
      hint={t('errorBoundary.hint')}
      retryLabel={t('errorBoundary.retry')}
    >
      {children}
    </ErrorBoundaryInner>
  )
}
