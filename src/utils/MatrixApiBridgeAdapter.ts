import { searchGroup, searchFriend } from '@/utils/ImRequestUtils'

export async function requestWithFallback(options: { url: string; body?: unknown; params?: Record<string, unknown> }) {
  const { url, params } = options
  switch (url) {
    case 'search_group':
      return await searchGroup({ account: String(params?.account || '') })
    case 'search_friend':
      return await searchFriend({ key: String(params?.key || '') })
    default:
      return []
  }
}
