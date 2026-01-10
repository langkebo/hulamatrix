<template>
  <div class="poll-message" :class="{ 'poll-ended': poll?.isEnded }">
    <!-- Poll Question -->
    <div class="poll-question">{{ pollData.question }}</div>

    <!-- Poll Kind Badge -->
    <div class="poll-meta">
      <n-tag v-if="poll?.kind === 'm.poll.undisclosed'" size="small" :bordered="false">
        {{ t('message.poll.kind.hidden') }}
      </n-tag>
      <n-tag v-else size="small" type="info" :bordered="false">
        {{ t('message.poll.kind.disclosed') }}
      </n-tag>
      <span v-if="poll?.isEnded" class="poll-ended-badge">{{ t('message.poll.ended') }}</span>
    </div>

    <!-- Poll Answers -->
    <div class="poll-answers">
      <div
        v-for="answer in pollData.answers"
        :key="answer.id"
        class="poll-answer"
        :class="{
          'poll-answer-selected': userVote?.includes(answer.id),
          'poll-answer-most-selected': isMostSelected(answer.id)
        }"
        @click="handleAnswerClick(answer.id)">
        <!-- Answer Text -->
        <div class="poll-answer-text">{{ answer.text }}</div>

        <!-- Progress Bar (shown after voting or when poll is ended) -->
        <div v-if="showResults || poll?.isEnded" class="poll-answer-bar">
          <div class="poll-answer-fill" :style="{ width: `${getAnswerPercentage(answer.id)}%` }" />
        </div>

        <!-- Vote Count / Percentage -->
        <div v-if="showResults || poll?.isEnded" class="poll-answer-stats">
          <span>{{ getAnswerCount(answer.id) }} {{ t('message.poll.votes') }}</span>
          <span>{{ getAnswerPercentage(answer.id).toFixed(1) }}%</span>
        </div>

        <!-- Radio/Checkbox Indicator -->
        <div v-else class="poll-answer-indicator">
          <div v-if="poll?.maxSelections === 1" class="poll-radio" :class="{ checked: userVote?.includes(answer.id) }">
            <div v-if="userVote?.includes(answer.id)" class="poll-radio-dot" />
          </div>
          <div v-else class="poll-checkbox" :class="{ checked: userVote?.includes(answer.id) }">
            <svg v-if="userVote?.includes(answer.id)" class="size-12px">
              <use href="#check"></use>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Total Votes -->
    <div v-if="showResults || poll?.isEnded" class="poll-total">
      {{ t('message.poll.total_votes', { count: pollResults?.totalVotes || 0 }) }}
    </div>

    <!-- Vote/End Button (for poll creator) -->
    <div v-if="!poll?.isEnded && !userVote" class="poll-actions">
      <n-button
        v-if="canSubmitVote"
        type="primary"
        secondary
        size="small"
        :disabled="selectedAnswers.length === 0 || selectedAnswers.length > (poll?.maxSelections || 1)"
        @click.stop="handleSubmitVote">
        {{ t('message.poll.submit') }}
      </n-button>
      <n-button v-if="isPollCreator" size="small" tertiary @click.stop="handleEndPoll">
        {{ t('message.poll.end') }}
      </n-button>
    </div>

    <!-- Change Vote Button -->
    <div v-if="!poll?.isEnded && userVote && !pollData.kind?.includes('undisclosed')" class="poll-actions">
      <n-button size="small" tertiary @click.stop="handleChangeVote">
        {{ t('message.poll.change_vote') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixPollService, type Poll, type PollResults } from '@/services/matrixPollService'
import { useUserStore } from '@/stores/user'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

interface Props {
  body: {
    pollStartEvent?: string
    roomId?: string
    pollData?: {
      question: string
      kind: 'm.poll.disclosed' | 'm.poll.undisclosed'
      maxSelections: number
      answers: Array<{ id: string; text: string }>
    }
  }
  message?: {
    roomId: string
    fromUser?: {
      uid: string
    }
  }
}

const props = defineProps<Props>()

const { t } = useI18n()
const userStore = useUserStore()

// State
const selectedAnswers = ref<string[]>([])
const showResults = ref(false)

// Computed
const pollId = computed(() => props.body.pollStartEvent || '')
const roomId = computed(() => props.body.roomId || props.message?.roomId || '')

const poll = computed((): Poll | undefined => {
  if (!pollId.value || !roomId.value) return undefined
  const polls = matrixPollService.getRoomPolls(roomId.value)
  return polls.find((p) => p.id === pollId.value)
})

const pollResults = computed((): PollResults | undefined => {
  if (!pollId.value || !roomId.value) return undefined
  return matrixPollService.getPollResults(roomId.value, pollId.value)
})

const userVote = computed((): string[] | null => {
  if (!pollId.value || !roomId.value) return null
  return matrixPollService.getUserVote(roomId.value, pollId.value)
})

const isPollCreator = computed(() => {
  return poll.value?.senderId === userStore.userInfo?.uid
})

const canSubmitVote = computed(() => {
  const max = poll.value?.maxSelections || 1
  return selectedAnswers.value.length > 0 && selectedAnswers.value.length <= max
})

const pollData = computed(() => {
  return (
    props.body.pollData || {
      question: poll.value?.question || '',
      kind: poll.value?.kind || 'm.poll.disclosed',
      maxSelections: poll.value?.maxSelections || 1,
      answers: poll.value?.answers || []
    }
  )
})

// Methods
const getAnswerCount = (answerId: string): number => {
  return pollResults.value?.results[answerId] || 0
}

const getAnswerPercentage = (answerId: string): number => {
  const total = pollResults.value?.totalVotes || 0
  if (total === 0) return 0
  return (getAnswerCount(answerId) / total) * 100
}

const isMostSelected = (answerId: string): boolean => {
  const results = pollResults.value?.results || {}
  const maxCount = Math.max(...Object.values(results), 0)
  return results[answerId] === maxCount && maxCount > 0
}

const handleAnswerClick = (answerId: string) => {
  if (poll.value?.isEnded || userVote.value) return

  const maxSelections = poll.value?.maxSelections || 1

  if (maxSelections === 1) {
    // Single selection: replace current selection
    selectedAnswers.value = [answerId]
  } else {
    // Multiple selection: toggle
    const index = selectedAnswers.value.indexOf(answerId)
    if (index >= 0) {
      selectedAnswers.value.splice(index, 1)
    } else if (selectedAnswers.value.length < maxSelections) {
      selectedAnswers.value.push(answerId)
    }
  }
}

const handleSubmitVote = async () => {
  if (!roomId.value || !pollId.value) return

  try {
    await matrixPollService.respondToPoll(roomId.value, pollId.value, selectedAnswers.value)
    showResults.value = true
    msg.success(t('message.poll.vote_submitted'))
  } catch (error) {
    logger.error('[Poll] Failed to submit vote:', error)
    msg.error(t('message.poll.vote_failed'))
  }
}

const handleEndPoll = async () => {
  if (!roomId.value || !pollId.value) return

  try {
    await matrixPollService.endPoll(roomId.value, pollId.value)
    msg.success(t('message.poll.ended'))
  } catch (error) {
    logger.error('[Poll] Failed to end poll:', error)
    msg.error(t('message.poll.end_failed'))
  }
}

const handleChangeVote = () => {
  showResults.value = false
  selectedAnswers.value = []
}

// Watch for user vote changes
watch(
  userVote,
  (newVote) => {
    if (newVote) {
      selectedAnswers.value = newVote
      showResults.value = true
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.poll-message {
  min-width: 240px;
  max-width: 320px;
  padding: var(--hula-spacing-sm);
  border-radius: var(--hula-radius-sm);
  background: var(--poll-bg, var(--hula-brand-primary));

  .dark & {
    background: var(--poll-bg, var(--hula-brand-primary));
  }
}

.poll-question {
  font-size: var(--hula-text-sm);
  font-weight: 600;
  margin-bottom: var(--hula-spacing-xs);
  color: var(--text-color);
}

.poll-meta {
  display: flex;
  align-items: center;
  gap: var(--hula-spacing-xs);
  margin-bottom: var(--hula-spacing-sm);
  font-size: var(--hula-text-xs);
}

.poll-ended-badge {
  padding: calc(var(--hula-spacing-xs) * 0.5) var(--hula-spacing-xs);
  border-radius: var(--hula-radius-xs);
  background: var(--n-border-color);
  color: var(--text-color-3);
}

.poll-answers {
  display: flex;
  flex-direction: column;
  gap: var(--hula-spacing-xs);
}

.poll-answer {
  position: relative;
  padding: var(--hula-spacing-sm) var(--hula-spacing-sm);
  border-radius: var(--hula-radius-md);
  background: var(--bg-color);
  border: var(--hula-border-thin) solid var(--n-border-color);
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover:not(.poll-ended) {
    background: var(--n-hover-color);
    border-color: var(--n-border-color-hover);
  }

  &.poll-answer-selected {
    border-color: var(--hula-brand-primary);
    background: rgba(var(--hula-success-rgb), 0.1);
  }

  &.poll-answer-most-selected {
    border-color: var(--hula-brand-primary);
    border-width: var(--hula-border-base);
  }
}

.poll-answer-text {
  font-size: var(--hula-text-sm);
  margin-bottom: var(--hula-spacing-sm);
  color: var(--text-color);
}

.poll-answer-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--n-border-color);
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}

.poll-answer-fill {
  height: 100%;
  background: var(--hula-brand-primary);
  transition: width 0.3s ease;
}

.poll-answer-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-color-3);
  margin-top: 4px;
}

.poll-answer-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
}

.poll-radio {
  width: var(--hula-spacing-md);
  height: var(--hula-spacing-md);
  border: 2px solid var(--n-border-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease;

  &.checked {
    border-color: var(--hula-brand-primary);
  }
}

.poll-radio-dot {
  width: var(--hula-spacing-xs);
  height: var(--hula-spacing-xs);
  background: var(--hula-brand-primary);
  border-radius: 50%;
}

.poll-checkbox {
  width: var(--hula-spacing-md);
  height: var(--hula-spacing-md);
  border: 2px solid var(--n-border-color);
  border-radius: var(--hula-radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;

  &.checked {
    border-color: var(--hula-brand-primary);
    background: var(--hula-brand-primary);
    color: var(--hula-white);
  }
}

.poll-total {
  margin-top: var(--hula-spacing-sm);
  font-size: var(--hula-text-xs);
  color: var(--text-color-3);
  text-align: center;
}

.poll-actions {
  display: flex;
  gap: var(--hula-spacing-xs);
  margin-top: var(--hula-spacing-sm);
  justify-content: flex-end;
}

.poll-ended {
  opacity: 0.8;
  cursor: default;

  .poll-answer {
    cursor: default;

    &:hover {
      background: var(--bg-color);
      border-color: var(--n-border-color);
    }
  }
}
</style>
