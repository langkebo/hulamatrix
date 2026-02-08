import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import translationService, { type TranslationResult } from '@/services/translation'

interface TranslatedMessage {
  id: string
  originalText: string
  translatedText: string
  sourceLang: string
  targetLang: string
  timestamp: number
}

export const useTranslationStore = defineStore('translation', () => {
  const autoTranslate = ref(false)
  const targetLanguage = ref('zh-CN')
  const provider = ref('google')
  const translatedMessages = ref<Map<string, TranslatedMessage>>(new Map())
  const translating = ref(false)

  const availableProviders = computed(() => translationService.getAvailableProviders())

  const supportedLanguages = [
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' }
  ]

  function setAutoTranslate(enabled: boolean): void {
    autoTranslate.value = enabled
  }

  function setTargetLanguage(lang: string): void {
    targetLanguage.value = lang
  }

  function setProvider(providerId: string): boolean {
    const result = translationService.setProvider(providerId)
    if (result) {
      provider.value = providerId
    }
    return result
  }

  async function translateMessage(
    messageId: string,
    text: string,
    sourceLang?: string
  ): Promise<TranslationResult | null> {
    if (!text.trim()) return null

    translating.value = true
    try {
      const result = await translationService.translate(text, targetLanguage.value, sourceLang)

      const translatedMsg: TranslatedMessage = {
        id: messageId,
        originalText: text,
        translatedText: result.translatedText,
        sourceLang: result.sourceLanguage,
        targetLang: result.targetLanguage,
        timestamp: Date.now()
      }

      translatedMessages.value.set(messageId, translatedMsg)
      return result
    } catch (error) {
      console.error('[TranslationStore] Translation failed:', error)
      return null
    } finally {
      translating.value = false
    }
  }

  function getTranslatedMessage(messageId: string): TranslatedMessage | undefined {
    return translatedMessages.value.get(messageId)
  }

  function clearTranslation(messageId: string): void {
    translatedMessages.value.delete(messageId)
  }

  function clearAllTranslations(): void {
    translatedMessages.value.clear()
  }

  return {
    autoTranslate,
    targetLanguage,
    provider,
    translating,
    availableProviders,
    supportedLanguages,
    setAutoTranslate,
    setTargetLanguage,
    setProvider,
    translateMessage,
    getTranslatedMessage,
    clearTranslation,
    clearAllTranslations
  }
})
