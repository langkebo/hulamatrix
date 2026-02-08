<template>
  <div class="poll-card" :class="{ 'poll-ended': poll.isEnded }">
    <div class="poll-header">
      <div class="poll-question">{{ poll.question }}</div>
      <div class="poll-meta">
        <n-tag v-if="poll.isEnded" type="warning" size="small">
          {{ t('poll.ended') }}
        </n-tag>
        <span class="poll-vote-count">
          {{ t('poll.votes_count', { count: totalVotes }) }}
        </span>
      </div>
    </div>

    <div class="poll-answers">
      <div
        v-for="answer in poll.answers"
        :key="answer.id"
        class="poll-answer"
        :class="{
          'answer-selected': isAnswerSelected(answer.id),
          'answer-disabled': poll.isEnded || hasVoted
        }"
        @click="handleAnswerClick(answer.id)"
      >
        <div class="answer-radio">
          <n-radio
            :checked="isAnswerSelected(answer.id)"
            :disabled="poll.isEnded || hasVoted || (poll.maxSelections === 1 && hasVoted)"
          />
        </div>
        <div class="answer-content">
          <div class="answer-text">{{ answer.text }}</div>
          <div v-if="showStats" class="answer-stats">
            <div class="stats-bar">
              <div
                class="stats-fill"
                :style="{ width: getAnswerPercentage(answer.id) + '%' }"
              ></div>
            </div>
            <span class="stats-text">
              {{ getAnswerPercentage(answer.id) }}% ({{ answer.voteCount || 0 }} {{ t('poll.votes') }})
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!poll.isEnded" class="poll-actions">
      <n-button
        v-if="!hasVoted"
        type="primary"
        :disabled="selectedAnswers.length === 0"
        :loading="submitting"
        @click="handleSubmitVote"
      >
        {{ t('poll.vote') }}
      </n-button>
      <n-button v-else @click="handleChangeVote">
        {{ t('poll.change_vote') }}
      </n-button>
    </div>

    <div v-if="poll.isEnded" class="poll-result-link">
      <n-button text type="primary" @click="showStats = !showStats">
        {{ showStats ? t('poll.hide_results') : t('poll.show_results') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixPollService from '@/services/matrix/MatrixPollService'
import { useUserStore } from '@/stores/user'
import type { PollDetail } from '@/types/poll'

const props = defineProps<{
  poll: PollDetail
  roomId: string
  showStats?: boolean
}>()

const emit = defineEmits<(e: 'vote', data: { pollId: string; answers: string[] }) => void>()

const { t } = useI18n()
const userStore = useUserStore()

const selectedAnswers = ref<string[]>([])
const hasVoted = ref(false)
const submitting = ref(false)
const showStats = ref(props.showStats || props.poll.isEnded)
const totalVotes = ref(0)

const isAnswerSelected = (answerId: string): boolean => {
  return selectedAnswers.value.includes(answerId)
}

const getAnswerPercentage = (answerId: string): number => {
  const answer = props.poll.answers.find((a) => a.id === answerId)
  if (!answer || !answer.voteCount || totalVotes.value === 0) return 0
  return Math.round((answer.voteCount / totalVotes.value) * 100)
}

const handleAnswerClick = (answerId: string) => {
  if (props.poll.isEnded || hasVoted.value) return

  const maxSelections = props.poll.maxSelections || 1

  if (maxSelections === 1) {
    selectedAnswers.value = [answerId]
  } else {
    const index = selectedAnswers.value.indexOf(answerId)
    if (index > -1) {
      selectedAnswers.value.splice(index, 1)
    } else if (selectedAnswers.value.length < maxSelections) {
      selectedAnswers.value.push(answerId)
    }
  }
}

const handleSubmitVote = async () => {
  if (selectedAnswers.value.length === 0) return

  submitting.value = true
  try {
    await MatrixPollService.getInstance().vote({
      roomId: props.roomId,
      pollId: props.poll.pollId,
      answers: selectedAnswers.value
    })
    hasVoted.value = true
    emit('vote', { pollId: props.poll.pollId, answers: selectedAnswers.value })
  } catch (error) {
    console.error('[PollCard] Failed to submit vote:', error)
  } finally {
    submitting.value = false
  }
}

const handleChangeVote = () => {
  selectedAnswers.value = []
  hasVoted.value = false
}

const loadUserVote = async () => {
  const userId = userStore.userInfo?.uid
  if (!userId) return

  try {
    const vote = await MatrixPollService.getInstance().getUserVote(props.roomId, props.poll.pollId, userId)
    if (vote && vote.length > 0) {
      selectedAnswers.value = vote
      hasVoted.value = true
    }
  } catch (error) {
    console.error('[PollCard] Failed to load user vote:', error)
  }
}

const loadStatistics = async () => {
  try {
    const stats = await MatrixPollService.getInstance().getPollStatistics(props.roomId, props.poll.pollId)
    if (stats) {
      totalVotes.value = stats.totalVotes
      stats.answerStats.forEach((stat) => {
        const answer = props.poll.answers.find((a) => a.id === stat.answerId)
        if (answer) {
          answer.voteCount = stat.voteCount
        }
      })
    }
  } catch (error) {
    console.error('[PollCard] Failed to load statistics:', error)
  }
}

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  await loadUserVote()
  await loadStatistics()

  unsubscribe = MatrixPollService.getInstance().subscribeToPoll(props.poll.pollId, (event) => {
    if (event.type === 'vote' || event.type === 'updated') {
      loadStatistics()
    }
  })
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped lang="scss">
.poll-card {
  background: var(--bg-secondary-color);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-hover-color);
  }

  &.poll-ended {
    opacity: 0.85;
  }
}

.poll-header {
  margin-bottom: 16px;
}

.poll-question {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 8px;
}

.poll-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.poll-vote-count {
  font-size: 12px;
  color: var(--info-text-color);
}

.poll-answers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-answer {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--divider-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.answer-disabled) {
    border-color: var(--primary-color);
    background: var(--bg-hover-color);
  }

  &.answer-selected {
    border-color: var(--primary-color);
    background: var(--primary-color-opaque);
  }

  &.answer-disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
}

.answer-radio {
  flex-shrink: 0;
  padding-top: 2px;
}

.answer-content {
  flex: 1;
  min-width: 0;
}

.answer-text {
  font-size: 14px;
  color: var(--text-color);
  word-break: break-word;
}

.answer-stats {
  margin-top: 8px;
}

.stats-bar {
  height: 6px;
  background: var(--divider-color);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.stats-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.stats-text {
  font-size: 12px;
  color: var(--info-text-color);
}

.poll-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.poll-result-link {
  margin-top: 12px;
  text-align: center;
}
</style>
