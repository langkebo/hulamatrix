<template>
  <div class="rich-text-toolbar">
    <n-flex :size="4">
      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('bold') }"
            @click="execCommand('bold')">
            <svg class="w-16px h-16px">
              <use href="#bold"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.bold') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('italic') }"
            @click="execCommand('italic')">
            <svg class="w-16px h-16px">
              <use href="#italic"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.italic') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('underline') }"
            @click="execCommand('underline')">
            <svg class="w-16px h-16px">
              <use href="#underline"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.underline') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('strikethrough') }"
            @click="execCommand('strikethrough')">
            <svg class="w-16px h-16px">
              <use href="#strikethrough"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.strikethrough') }}
      </n-tooltip>

      <div class="toolbar-divider"></div>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('insertUnorderedList') }"
            @click="execCommand('insertUnorderedList')">
            <svg class="w-16px h-16px">
              <use href="#list-ul"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.bullet_list') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('insertOrderedList') }"
            @click="execCommand('insertOrderedList')">
            <svg class="w-16px h-16px">
              <use href="#list-ol"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.numbered_list') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('justifyLeft') }"
            @click="execCommand('justifyLeft')">
            <svg class="w-16px h-16px">
              <use href="#align-left"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.align_left') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('justifyCenter') }"
            @click="execCommand('justifyCenter')">
            <svg class="w-16px h-16px">
              <use href="#align-center"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.align_center') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('justifyRight') }"
            @click="execCommand('justifyRight')">
            <svg class="w-16px h-16px">
              <use href="#align-right"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.align_right') }}
      </n-tooltip>

      <div class="toolbar-divider"></div>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isCodeBlock }"
            @click="toggleCodeBlock">
            <svg class="w-16px h-16px">
              <use href="#code"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.code_block') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            :class="{ active: isFormatActive('insertHorizontalRule') }"
            @click="execCommand('insertHorizontalRule')">
            <svg class="w-16px h-16px">
              <use href="#minus"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.horizontal_rule') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            @click="insertQuote">
            <svg class="w-16px h-16px">
              <use href="#quote"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.quote') }}
      </n-tooltip>

      <div class="toolbar-divider"></div>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            @click="insertLink">
            <svg class="w-16px h-16px">
              <use href="#link"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.link') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            @click="insertImage">
            <svg class="w-16px h-16px">
              <use href="#image"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.image') }}
      </n-tooltip>

      <div class="toolbar-divider"></div>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn translate-btn"
            :class="{ translating: isTranslating }"
            @click="handleTranslate">
            <svg class="w-16px h-16px">
              <use href="#translation"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.translation.translate') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            @click="handleEmojiPicker">
            <svg class="w-16px h-16px">
              <use href="#emoji"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.emoji') }}
      </n-tooltip>

      <n-tooltip trigger="hover">
        <template #trigger>
          <div
            class="toolbar-btn"
            @click="handleMention">
            <svg class="w-16px h-16px">
              <use href="#at"></use>
            </svg>
          </div>
        </template>
        {{ t('editor.format.mention') }}
      </n-tooltip>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTranslationStore } from '@/stores/translation'

const { t } = useI18n()
const translationStore = useTranslationStore()

const isTranslating = ref(false)

const emit = defineEmits<{
  (e: 'format-change'): void
  (e: 'translate', text: string): void
}>()

const execCommand = (command: string) => {
  document.execCommand(command, false, undefined)
  emit('format-change')
}

const isFormatActive = (command: string): boolean => {
  return document.queryCommandState(command)
}

const isCodeBlock = ref(false)

const toggleCodeBlock = () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const selectedText = range.toString()

  if (isCodeBlock.value) {
    const codeElement = range.commonAncestorContainer.parentElement?.closest('code')
    if (codeElement) {
      const textNode = document.createTextNode(codeElement.textContent || '')
      codeElement.parentNode?.replaceChild(textNode, codeElement)
    }
    isCodeBlock.value = false
  } else {
    const codeElement = document.createElement('code')
    codeElement.className = 'inline-code'
    codeElement.textContent = selectedText
    range.deleteContents()
    range.insertNode(codeElement)

    range.setStartAfter(codeElement)
    range.setEndAfter(codeElement)
    selection.removeAllRanges()
    selection.addRange(range)
    isCodeBlock.value = true
  }

  emit('format-change')
}

const insertLink = () => {
  const url = window.prompt(t('editor.format.enter_url'))
  if (url) {
    execCommand('createLink')
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const link = range.commonAncestorContainer.parentElement?.closest('a')
      if (link) {
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
      }
    }
  }
}

const insertImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = `<img src="${event.target?.result}" alt="${file.name}" style="max-width: 100%; height: auto;" />`
        document.execCommand('insertHTML', false, img)
        emit('format-change')
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const insertQuote = () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const quoteElement = document.createElement('blockquote')
  quoteElement.className = 'quote'
  quoteElement.textContent = range.toString()

  range.deleteContents()
  range.insertNode(quoteElement)

  range.setStartAfter(quoteElement)
  range.setEndAfter(quoteElement)
  selection.removeAllRanges()
  selection.addRange(range)

  emit('format-change')
}

const handleEmojiPicker = () => {
  emit('format-change')
}

const handleMention = () => {
  const selection = window.getSelection()
  if (!selection) return

  const mention = '@'
  document.execCommand('insertText', false, mention)
  emit('format-change')
}

const checkCodeBlockState = () => {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    isCodeBlock.value = !!range.commonAncestorContainer.parentElement?.closest('code')
  }
}

const handleTranslate = async () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
    window.$message?.warning?.(t('editor.translation.select_text_warning'))
    return
  }

  const selectedText = selection.toString().trim()
  isTranslating.value = true

  try {
    const result = await translationStore.translateMessage(`toolbar-${Date.now()}`, selectedText)

    if (result) {
      emit('translate', result.translatedText)
      window.$message?.success?.(t('editor.translation.success'))
    } else {
      window.$message?.error?.(t('editor.translation.failed'))
    }
  } catch (error) {
    console.error('[RichTextToolbar] Translation error:', error)
    window.$message?.error?.(t('editor.translation.failed'))
  } finally {
    isTranslating.value = false
  }
}

defineExpose({
  checkCodeBlockState
})
</script>

<style scoped lang="scss">
.rich-text-toolbar {
  padding: 4px 8px;
  background: var(--bg-setting-item);
  border-top: 1px solid var(--line-color);
  display: flex;
  align-items: center;

  .toolbar-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-color);
    transition: all 0.2s ease;

    &:hover {
      background: var(--bg-left-menu-hover);
    }

    &.active {
      background: var(--bg-active-msg);
      color: var(--bg-active-msg);
    }
  }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    background: var(--line-color);
    margin: 0 4px;
  }

  .translate-btn {
    &.translating {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}
</style>
