import { create } from 'zustand'
import type { ThemeConfig, ThemeStore } from '@/types/notebook'
import { lightTheme, darkTheme } from '@/styles/themes'

const themes: Record<'light' | 'dark', ThemeConfig> = {
  light: lightTheme,
  dark: darkTheme,
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'dark',
  colors: darkTheme,
  setTheme: (theme) => set({ theme, colors: themes[theme] }),
  getColors: () => get().colors,
}))
