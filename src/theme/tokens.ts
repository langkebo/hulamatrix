export type ThemeMode = 'light' | 'dark'

const lightVars: Record<string, string> = {
  '--bg-setting-item': '#ffffff',
  '--line-color': '#e5e7eb',
  '--hover-color': '#f7f7f7',
  '--border-active-color': '#13987f',
  '--scrollbar-thumb-color': '#c7c7c7',
  '--text-color': '#1f2937',
  '--font-size-12': '12px',
  '--font-size-14': '14px',
  '--space-8': '8px',
  '--space-12': '12px',
  '--shadow-main': '0 4px 12px rgba(0,0,0,0.08)'
}

const darkVars: Record<string, string> = {
  '--bg-setting-item': '#151515',
  '--line-color': '#2a2a2a',
  '--hover-color': '#1f1f1f',
  '--border-active-color': '#20c997',
  '--scrollbar-thumb-color': '#3a3a3a',
  '--text-color': '#e5e7eb',
  '--font-size-12': '12px',
  '--font-size-14': '14px',
  '--space-8': '8px',
  '--space-12': '12px',
  '--shadow-main': '0 4px 12px rgba(0,0,0,0.25)'
}

export function applyThemeTokens(mode: ThemeMode) {
  const vars = mode === 'dark' ? darkVars : lightVars
  const el = document.documentElement
  Object.entries(vars).forEach(([k, v]) => {
    el.style.setProperty(k, v)
  })
}
