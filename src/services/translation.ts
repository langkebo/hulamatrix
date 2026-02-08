export interface TranslationResult {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  originalText: string
}

export interface TranslationProvider {
  id: string
  name: string
  translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult>
}

class TranslationService {
  private providers: Map<string, TranslationProvider> = new Map()
  private currentProvider: string = 'google'

  constructor() {
    this.registerProvider({
      id: 'google',
      name: 'Google Translate',
      translate: this.googleTranslate.bind(this)
    })
  }

  registerProvider(provider: TranslationProvider): void {
    this.providers.set(provider.id, provider)
  }

  setProvider(providerId: string): boolean {
    if (this.providers.has(providerId)) {
      this.currentProvider = providerId
      return true
    }
    return false
  }

  getProvider(): TranslationProvider | undefined {
    return this.providers.get(this.currentProvider)
  }

  async translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    const provider = this.getProvider()
    if (!provider) {
      throw new Error(`Translation provider '${this.currentProvider}' not found`)
    }
    return provider.translate(text, targetLang, sourceLang)
  }

  private async googleTranslate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    if (import.meta.env.DEV) {
      console.log(`[TranslationService] Translating to ${targetLang}`)
    }

    return {
      originalText: text,
      translatedText: `[Translated to ${targetLang}] ${text}`,
      sourceLanguage: sourceLang || 'auto',
      targetLanguage: targetLang
    }
  }

  async detectLanguage(_text: string): Promise<string> {
    if (import.meta.env.DEV) {
      console.log('[TranslationService] Detecting language')
    }
    return 'zh-CN'
  }

  getAvailableProviders(): Array<{ id: string; name: string }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name
    }))
  }
}

export const translationService = new TranslationService()
export default translationService
