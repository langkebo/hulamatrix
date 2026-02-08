export interface FriendRequest {
  id: string
  requester_id: string
  requester_name?: string
  requester_avatar?: string
  message: string
  created_at: string
  expires_at?: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface Friend {
  user_id: string
  display_name?: string
  avatar_url?: string
  category_id?: number
  category_name?: string
  category_color?: string
  created_at: string
  status: 'active' | 'blocked'
  online?: boolean
  last_active?: string
}

export interface FriendCategory {
  id: number
  name: string
  description?: string
  color: string
  friend_count: number
}

export interface FriendSearchResult {
  user_id: string
  display_name?: string
  avatar_url?: string
}

export interface UserProfile {
  user_id: string
  display_name?: string
  avatar_url?: string
  presence?: 'online' | 'offline' | 'unavailable'
  status_msg?: string
}

export interface FriendGroup {
  id: string
  name: string
  friends: Friend[]
  color?: string
}

export interface FriendStatistics {
  total_friends: number
  online_friends: number
  pending_requests: number
  blocked_users: number
}
