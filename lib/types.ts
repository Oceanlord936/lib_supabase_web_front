// Supabase table rows use snake_case column names

export type Library = {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  library_type: 'PUBLIC' | 'UNIVERSITY' | null
  opening_hours: string | null
  website: string | null
  average_rating: number | null
  rating_count: number | null
}

export type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export type Rating = {
  id: string
  library_id: string
  user_id: string
  score: number
  comment: string | null
  display_name: string | null
  created_at: string
}

export type Channel = {
  id: string
  library_id: string
  name: string
  channel_type: 'ANNOUNCEMENT' | 'GENERAL'
}

export type Message = {
  id: string
  channel_id: string
  user_id: string
  display_name: string
  content: string
  created_at: string
}

export type LibraryWithChannels = Library & { channels?: Channel[] }
