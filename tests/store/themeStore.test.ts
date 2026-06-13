import { describe, it, expect } from 'vitest'
import { useThemeStore } from '@/store/themeStore'

describe('ThemeStore', () => {
  it('should initialize with dark theme', () => {
    const state = useThemeStore.getState()
    expect(state.theme).toBe('dark')
  })

  it('should switch to light theme', () => {
    useThemeStore.getState().setTheme('light')
    const state = useThemeStore.getState()
    expect(state.theme).toBe('light')
    expect(state.colors.background).toBe('#f5f5f5')
  })

  it('should switch back to dark theme', () => {
    useThemeStore.getState().setTheme('light')
    useThemeStore.getState().setTheme('dark')
    const state = useThemeStore.getState()
    expect(state.theme).toBe('dark')
    expect(state.colors.background).toBe('#1e1e1e')
  })
})
