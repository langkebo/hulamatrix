declare module '../matrix-js-sdk-39.1.3/lib/models/room' {
  interface Room {
    getLiveTimeline(): { getEvents(): unknown[] } | null
    getMember(userId: string): { userId: string; name?: string } | null
    getCreationTimestamp(): number
  }
}

declare module '../matrix-js-sdk-39.1.3/lib/client' {
  interface MatrixClient {
    getUserId(): string
    getAccountData(eventType: string): { getContent(): unknown } | null
    removeListener(event: string, handler: (...args: unknown[]) => void): void
  }
}

declare module '../matrix-js-sdk-39.1.3/lib/@types/requests' {
  type Preset = 'private_chat' | 'public_chat' | 'trusted_private_chat'
  type Visibility = 'private' | 'public'
}

declare module '../matrix-js-sdk-39.1.3/lib/@types/events' {
  interface TimelineEvents {
    'm.room.message': Record<string, unknown>
  }
  interface StateEvents {
    'm.message_ttl': Record<string, unknown>
  }
}
