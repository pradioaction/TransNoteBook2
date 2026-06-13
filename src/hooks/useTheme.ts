import { useMemo } from 'react'
import { useThemeStore } from '@/store/themeStore'

export function useTheme() {
  const { colors, setTheme, theme } = useThemeStore()

  const cssVars = useMemo(
    () =>
      ({
        '--foreground': colors.foreground,
        '--background': colors.background,
        '--editor-background': colors.editorBackground,
        '--editor-foreground': colors.editorForeground,
        '--border': colors.border,
        '--sidebar-background': colors.sidebarBackground,
        '--sidebar-header': colors.sidebarHeader,
        '--sidebar-border': colors.sidebarBorder,
        '--activity-bar-background': colors.activityBarBackground,
        '--status-bar-background': colors.statusBarBackground,
        '--status-bar-foreground': colors.statusBarForeground,
        '--cell-background': colors.cellBackground,
        '--cell-selected-background': colors.cellSelectedBackground,
        '--cell-border': colors.cellBorder,
        '--cell-output-background': colors.cellOutputBackground,
        '--cell-output-border': colors.cellOutputBorder,
        '--cell-gutter': colors.cellGutter,
        '--toolbar-background': colors.toolbarBackground,
        '--toolbar-hover': colors.toolbarHover,
        '--primary-button': colors.primaryButton,
        '--primary-button-hover': colors.primaryButtonHover,
        '--scrollbar': colors.scrollbar,
        '--panel-background': colors.panelBackground,
        '--panel-border': colors.panelBorder,
      } as React.CSSProperties),
    [colors]
  )

  return { theme, colors, setTheme, cssVars }
}
