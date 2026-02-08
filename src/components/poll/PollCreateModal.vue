<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('poll.create_poll')"
    style="width: 500px"
    :mask-closable="false"
  >
    <div class="poll-create-form">
      <div class="form-item">
        <label class="form-label">{{ t('poll.question') }}</label>
        <n-input
          v-model:value="question"
          :placeholder="t('poll.question_placeholder')"
          maxlength="500"
          show-count
        />
      </div>

      <div class="form-item">
        <label class="form-label">{{ t('poll.answers') }}</label>
        <div class="answers-list">
          <div
            v-for="(answer, index) in answers"
            :key="index"
            class="answer-item"
          >
            <n-input
              v-model:value="answer.content"
              :placeholder="t('poll.answer_placeholder', { index: index + 1 })"
              maxlength="200"
            />
            <n-button
              v-if="answers.length > 2"
              quaternary
              circle
              @click="removeAnswer(index)"
            >
              <template #icon>
                <svg class="size-16px text-[--error-color]">
                  <use href="#close"></use>
                </svg>
              </template>
            </n-button>
          </div>
        </div>
        <n-button
          v-if="answers.length < 20"
          quaternary
          block
          @click="addAnswer"
        >
          <template #icon>
            <svg class="size-16px">
              <use href="#add"></use>
            </svg>
          </template>
          {{ t('poll.add_answer') }}
        </n-button>
      </div>

      <div class="form-item">
        <label class="form-label">{{ t('poll.poll_type') }}</label>
        <n-radio-group v-model:value="kind">
          <n-radio value="disclosed">
            {{ t('poll.type_disclosed') }}
            <span class="type-hint">{{ t('poll.type_disclosed_hint') }}</span>
          </n-radio>
          <n-radio value="undisclosed">
            {{ t('poll.type_undisclosed') }}
            <span class="type-hint">{{ t('poll.type_undisclosed_hint') }}</span>
          </n-radio>
        </n-radio-group>
      </div>

      <div class="form-item">
        <label class="form-label">
          {{ t('poll.max_selections') }}
          <span class="selection-count">{{ maxSelections }}</span>
        </label>
        <n-slider
          v-model:value="maxSelections"
          :min="1"
          :max="Math.min(answers.length, 10)"
          :step="1"
        />
      </div>
    </div>

    <template #footer>
      <n-flex justify="flex-end" :size="12">
        <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
        <n-button
          type="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ t('poll.create') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixPollService from '@/services/matrix/MatrixPollService'
import type { PollKind } from '@/types/poll'

const props = defineProps<{
  roomId: string
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'created', value: { pollId: string }): void
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const question = ref('')
const answers = ref<{ content: string }[]>([{ content: '' }, { content: '' }])
const kind = ref<PollKind>('disclosed')
const maxSelections = ref(1)
const submitting = ref(false)

const canSubmit = computed(() => {
  const questionValid = question.value.trim().length > 0
  const answersValid = answers.value.filter((a) => a.content.trim().length > 0).length >= 2
  return questionValid && answersValid
})

const addAnswer = () => {
  if (answers.value.length < 20) {
    answers.value.push({ content: '' })
    if (maxSelections.value > answers.value.length) {
      maxSelections.value = answers.value.length
    }
  }
}

const removeAnswer = (index: number) => {
  if (answers.value.length > 2) {
    answers.value.splice(index, 1)
    if (maxSelections.value > answers.value.length) {
      maxSelections.value = answers.value.length
    }
  }
}

const handleCancel = () => {
  resetForm()
  visible.value = false
}

const resetForm = () => {
  question.value = ''
  answers.value = [{ content: '' }, { content: '' }]
  kind.value = 'disclosed'
  maxSelections.value = 1
}

const handleSubmit = async () => {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const validAnswers = answers.value
      .filter((a) => a.content.trim().length > 0)
      .map((a, index) => ({
        id: `answer_${index}`,
        content: a.content.trim()
      }))

    const pollId = await MatrixPollService.getInstance().createPoll({
      roomId: props.roomId,
      question: question.value.trim(),
      answers: validAnswers,
      kind: kind.value,
      maxSelections: maxSelections.value
    })

    emit('created', { pollId: pollId })
    handleCancel()
  } catch (error) {
    console.error('[PollCreateModal] Failed to create poll:', error)
  } finally {
    submitting.value = false
  }
}

watch(
  () => answers.value.length,
  (newLength) => {
    if (maxSelections.value > newLength) {
      maxSelections.value = newLength
    }
  }
)
</script>

<script lang="ts">
export interface PollCreatedData {
  pollId: string
}
</script>

<style scoped lang="scss">
.poll-create-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.answers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.answer-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.answer-item > :deep(.n-input) {
  flex: 1;
}

.type-hint {
  font-size: 12px;
  color: var(--info-text-color);
  margin-left: 8px;
}

.selection-count {
  font-weight: 600;
  color: var(--primary-color);
}
</style>
