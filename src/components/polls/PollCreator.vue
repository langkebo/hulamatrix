<template>
  <n-modal v-model:show="visible" :mask-closable="false" class="rounded-8px" transform-origin="center">
    <div class="poll-creator">
      <!-- Title -->
      <div class="poll-creator-header">
        <h3>{{ t('message.poll.create_title') }}</h3>
        <svg class="size-14px cursor-pointer" @click="handleClose">
          <use href="#close"></use>
        </svg>
      </div>

      <div class="poll-creator-body">
        <!-- Question Input -->
        <n-form-item :label="t('message.poll.question_label')" :show-label="true" required>
          <n-input
            v-model:value="question"
            type="textarea"
            :placeholder="t('message.poll.question_placeholder')"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :maxlength="300"
            show-count />
        </n-form-item>

        <!-- Answers -->
        <n-form-item :label="t('message.poll.answers_label')" :show-label="true" required>
          <div class="poll-answers-list">
            <div v-for="(answer, index) in answers" :key="index" class="poll-answer-input">
              <n-input
                v-model:value="answers[index]"
                :placeholder="`${t('message.poll.answer_placeholder')} ${index + 1}`"
                :maxlength="100">
                <template #suffix>
                  <n-button
                    v-if="answers.length > 2"
                    text
                    size="small"
                    @click="removeAnswer(index)">
                    <svg class="size-14px color-#d5304f">
                      <use href="#close"></use>
                    </svg>
                  </n-button>
                </template>
              </n-input>
            </div>
            <n-button
              v-if="answers.length < 20"
              dashed
              block
              @click="addAnswer">
              <template #icon>
                <svg class="size-14px">
                  <use href="#plus"></use>
                </svg>
              </template>
              {{ t('message.poll.add_answer') }}
            </n-button>
          </div>
        </n-form-item>

        <!-- Options -->
        <n-form-item :label="t('message.poll.options_label')" :show-label="true">
          <n-space vertical>
            <!-- Max Selections -->
            <n-form-item :label="t('message.poll.max_selections_label')" :show-label="false">
              <n-slider
                v-model:value="maxSelections"
                :min="1"
                :max="answers.length"
                :marks="{ 1: '1', [answers.length]: answers.length.toString() }" />
              <n-input-number
                v-model:value="maxSelections"
                :min="1"
                :max="answers.length"
                size="small"
                class="poll-max-selection-input" />
            </n-form-item>

            <!-- Poll Kind -->
            <n-form-item :show-label="false">
              <n-checkbox v-model:checked="isDisclosed">
                {{ t('message.poll.show_results') }}
              </n-checkbox>
            </n-form-item>
          </n-space>
        </n-form-item>
      </div>

      <!-- Footer -->
      <div class="poll-creator-footer">
        <n-button @click="handleClose">
          {{ t('message.poll.cancel') }}
        </n-button>
        <n-button
          type="primary"
          :loading="loading"
          :disabled="!isValid"
          @click="handleCreate">
          {{ t('message.poll.create') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMatrixPolls } from '@/hooks/useMatrixPolls'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

interface Props {
  visible?: boolean
  roomId?: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'created', pollId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  roomId: ''
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

// State
const question = ref('')
const answers = ref<string[]>(['', ''])
const maxSelections = ref(1)
const isDisclosed = ref(true)
const loading = ref(false)

// Poll hook
const { createPoll } = useMatrixPolls({ roomId: props.roomId, autoLoad: false })

// Computed
const localVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const isValid = computed(() => {
  return question.value.trim().length > 0 && answers.value.filter((a) => a.trim().length > 0).length >= 2
})

// Watch answers length to update maxSelections
watch(
  () => answers.value.length,
  (newLength) => {
    if (maxSelections.value > newLength) {
      maxSelections.value = newLength
    }
  }
)

// Watch visible to reset form
watch(localVisible, (newValue) => {
  if (newValue) {
    resetForm()
  }
})

// Methods
const resetForm = () => {
  question.value = ''
  answers.value = ['', '']
  maxSelections.value = 1
  isDisclosed.value = true
  loading.value = false
}

const addAnswer = () => {
  if (answers.value.length < 20) {
    answers.value.push('')
  }
}

const removeAnswer = (index: number) => {
  if (answers.value.length > 2) {
    answers.value.splice(index, 1)
  }
}

const handleClose = () => {
  localVisible.value = false
}

const handleCreate = async () => {
  if (!props.roomId) {
    msg.error(t('message.poll.no_room'))
    return
  }

  if (!isValid.value) {
    msg.warning(t('message.poll.invalid_input'))
    return
  }

  // Filter out empty answers
  const validAnswers = answers.value.filter((a) => a.trim().length > 0)

  if (validAnswers.length < 2) {
    msg.warning(t('message.poll.min_answers'))
    return
  }

  loading.value = true

  try {
    logger.info('[PollCreator] Creating poll', {
      roomId: props.roomId,
      question: question.value,
      answersCount: validAnswers.length,
      maxSelections: maxSelections.value,
      disclosed: isDisclosed.value
    })

    const pollId = await createPoll(props.roomId, {
      question: question.value.trim(),
      answers: validAnswers.map((a) => a.trim()),
      maxSelections: maxSelections.value,
      disclosed: isDisclosed.value
    })

    if (pollId) {
      msg.success(t('message.poll.created_success'))
      emit('created', pollId)
      handleClose()
    } else {
      msg.error(t('message.poll.create_failed'))
    }
  } catch (error) {
    logger.error('[PollCreator] Failed to create poll:', error)
    msg.error(t('message.poll.create_failed'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.poll-creator {
  width: 100%;
  max-width: 500px;
  background: var(--bg-edit);
  border-radius: 8px;
  padding: 20px;
}

.poll-creator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
  }
}

.poll-creator-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;

  :deep(.n-form-item) {
    margin-bottom: 0;
  }

  :deep(.n-form-item .n-form-item-label) {
    font-size: 13px;
    font-weight: 500;
  }
}

.poll-answers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.poll-answer-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.poll-max-selection-input {
  width: 80px;
  margin-left: 12px;
}

.poll-creator-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line-color);
}

@media (max-width: 600px) {
  .poll-creator {
    max-width: calc(100vw - 40px);
    padding: 16px;
  }
}
</style>
