export type PollKind = 'disclosed' | 'undclosed' | string

export interface PollAnswer {
  id: string
  text: string
  voteCount?: number
}

export interface PollOption {
  id: string
  content: string
}

export interface PollCreateParams {
  roomId: string
  question: string
  answers: PollOption[]
  kind?: PollKind
  maxSelections?: number
}

export interface PollVoteParams {
  roomId: string
  pollId: string
  answers: string[]
}

export interface PollEndParams {
  roomId: string
  pollId: string
}

export interface PollDetail {
  pollId: string
  roomId: string
  question: string
  kind: PollKind
  maxSelections: number
  answers: PollAnswer[]
  isEnded: boolean
  endTime?: number
  creatorId: string
  createdAt: number
  totalVotes?: number
}

export interface PollVoteRecord {
  userId: string
  answers: string[]
  timestamp: number
}

export interface PollStatistics {
  pollId: string
  totalVotes: number
  answerStats: {
    answerId: string
    answerText: string
    voteCount: number
    percentage: number
  }[]
  votedUsers: string[]
  isEnded: boolean
}

export type PollEventType = 'created' | 'updated' | 'ended' | 'vote'

export interface PollEventData {
  type: PollEventType
  pollId: string
  roomId: string
  data?: any
}
