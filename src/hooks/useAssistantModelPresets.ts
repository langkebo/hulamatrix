interface ModelPreset {
  id: string
  name: string
  description?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

interface ModelPresetMeta {
  modelKey?: string
  modelUrl?: string
  version?: string
  modelName?: string
}

export type AssistantModelPreset = ModelPreset & ModelPresetMeta

const defaultPresets: ModelPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Default model settings'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'More creative and imaginative responses',
    temperature: 0.9
  },
  {
    id: 'precise',
    name: 'Precise',
    description: 'More accurate and focused responses',
    temperature: 0.3
  }
]

async function fetchAssistantModelPresets(forceRefresh = false): Promise<void> {
  console.log('[useAssistantModelPresets] fetchAssistantModelPresets called, forceRefresh:', forceRefresh)
}

export function useAssistantModelPresets() {
  const presets = ref<AssistantModelPreset[]>(defaultPresets.map((p) => ({ ...p, modelName: p.name })))
  const currentPresetId = ref<string>('default')
  const metaMap = ref<Record<string, ModelPresetMeta>>({})

  const currentPreset = computed(() => {
    return presets.value.find((p) => p.id === currentPresetId.value) || presets.value[0]
  })

  function setPreset(presetId: string): void {
    if (presets.value.some((p) => p.id === presetId)) {
      currentPresetId.value = presetId
    }
  }

  function addPreset(preset: ModelPreset): void {
    if (!presets.value.some((p) => p.id === preset.id)) {
      presets.value.push(preset)
    }
  }

  function removePreset(presetId: string): void {
    if (presetId !== 'default') {
      presets.value = presets.value.filter((p) => p.id !== presetId)
      if (currentPresetId.value === presetId) {
        currentPresetId.value = 'default'
      }
    }
  }

  function updatePreset(presetId: string, updates: Partial<ModelPreset>): void {
    const index = presets.value.findIndex((p) => p.id === presetId)
    if (index !== -1) {
      presets.value[index] = { ...presets.value[index], ...updates }
    }
  }

  return {
    presets,
    currentPresetId,
    currentPreset,
    metaMap,
    fetchAssistantModelPresets,
    setPreset,
    addPreset,
    removePreset,
    updatePreset
  }
}
