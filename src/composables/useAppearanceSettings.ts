import { ref, computed, onMounted } from 'vue'
import { useSettingStore } from '@/stores/setting'

export interface AppearanceSettingsOptions {
  onThemeChange?: (theme: string) => void
  onFontScaleChange?: (scale: number) => void
  onLayoutChange?: (mode: string) => void
  onCompactChange?: (compact: boolean) => void
  onImageSizeChange?: (size: string) => void
}

export function useAppearanceSettings(options: AppearanceSettingsOptions = {}) {
  const settingStore = useSettingStore()
  const { themes } = settingStore

  // Theme
  const activeTheme = ref(themes.pattern)

  const toggleTheme = (code: string) => {
    if (code === activeTheme.value) return
    activeTheme.value = code
    settingStore.toggleTheme(code)
    options.onThemeChange?.(code)
  }

  // Font Scale
  const fontScale = computed({
    get: () => settingStore.page.fontScale,
    set: (val: number) => {
      settingStore.setFontScale(val)
      document.documentElement.style.fontSize = `${val}%`
      options.onFontScaleChange?.(val)
    }
  })

  const setFontScale = (val: number) => {
    fontScale.value = val
  }

  // Layout Mode (PC primarily, but shared store)
  const layoutMode = computed({
    get: () => settingStore.chat.layoutMode,
    set: (val: string) => {
      settingStore.setLayoutMode(val)
      options.onLayoutChange?.(val)
    }
  })

  // Compact Layout
  const compactLayout = computed({
    get: () => settingStore.chat.compactLayout,
    set: (val: boolean) => {
      settingStore.setCompactLayout(val)
      options.onCompactChange?.(val)
    }
  })

  // Image Size Limit
  const imageSizeLimit = computed({
    get: () => settingStore.chat.imageSizeLimit,
    set: (val: string) => {
      settingStore.setImageSizeLimit(val)
      options.onImageSizeChange?.(val)
    }
  })

  // Display Options (Local state for now, as seen in existing code)
  // TODO: Connect these to a store if they need persistence
  const autoplayGifs = ref(true)
  const autoplayVideos = ref(false)
  const showUrlPreviews = ref(true)
  const showBreadcrumbs = ref(true)

  // Initialize
  onMounted(() => {
    activeTheme.value = themes.pattern
    // Ensure font scale is applied on mount
    document.documentElement.style.fontSize = `${fontScale.value}%`
  })

  return {
    // State
    activeTheme,
    fontScale,
    layoutMode,
    compactLayout,
    imageSizeLimit,
    autoplayGifs,
    autoplayVideos,
    showUrlPreviews,
    showBreadcrumbs,

    // Actions
    toggleTheme,
    setFontScale,
    setLayoutMode: (val: string) => (layoutMode.value = val),
    setCompactLayout: (val: boolean) => (compactLayout.value = val),
    setImageSizeLimit: (val: string) => (imageSizeLimit.value = val)
  }
}
