// Types générés pour Supabase - EDL LIDAR Web
// À régénérer avec: npm run db:generate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      virtual_tours: {
        Row: {
          id: string
          edl_id: string | null
          title: string
          address: string
          property_type: 'apartment' | 'house' | 'commercial' | 'other'
          tour_type: 'sale' | 'rent' | 'edl'
          status: 'processing' | 'ready' | 'error'
          video_url: string | null
          video_duration_seconds: number | null
          thumbnail_url: string | null
          has_lidar: boolean
          total_surface_m2: number | null
          floor_plan_url: string | null
          point_cloud_url: string | null
          ai_indexed: boolean
          ai_index_version: string | null
          public_slug: string | null
          is_public: boolean
          created_at: string
          updated_at: string
          published_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          edl_id?: string | null
          title: string
          address: string
          property_type: 'apartment' | 'house' | 'commercial' | 'other'
          tour_type: 'sale' | 'rent' | 'edl'
          status?: 'processing' | 'ready' | 'error'
          video_url?: string | null
          video_duration_seconds?: number | null
          thumbnail_url?: string | null
          has_lidar?: boolean
          total_surface_m2?: number | null
          floor_plan_url?: string | null
          point_cloud_url?: string | null
          ai_indexed?: boolean
          ai_index_version?: string | null
          public_slug?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          published_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          edl_id?: string | null
          title?: string
          address?: string
          property_type?: 'apartment' | 'house' | 'commercial' | 'other'
          tour_type?: 'sale' | 'rent' | 'edl'
          status?: 'processing' | 'ready' | 'error'
          video_url?: string | null
          video_duration_seconds?: number | null
          thumbnail_url?: string | null
          has_lidar?: boolean
          total_surface_m2?: number | null
          floor_plan_url?: string | null
          point_cloud_url?: string | null
          ai_indexed?: boolean
          ai_index_version?: string | null
          public_slug?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          published_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tour_rooms: {
        Row: {
          id: string
          tour_id: string
          name: string
          room_type: string | null
          floor_number: number
          start_time: number
          end_time: number
          floor_surface_m2: number | null
          wall_surface_m2: number | null
          ceiling_surface_m2: number | null
          ceiling_height_m: number | null
          volume_m3: number | null
          detection_method: 'roomplan' | 'voice' | 'gemini' | 'manual' | null
          detection_confidence: number | null
          display_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          tour_id: string
          name: string
          room_type?: string | null
          floor_number?: number
          start_time: number
          end_time: number
          floor_surface_m2?: number | null
          wall_surface_m2?: number | null
          ceiling_surface_m2?: number | null
          ceiling_height_m?: number | null
          volume_m3?: number | null
          detection_method?: 'roomplan' | 'voice' | 'gemini' | 'manual' | null
          detection_confidence?: number | null
          display_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          tour_id?: string
          name?: string
          room_type?: string | null
          floor_number?: number
          start_time?: number
          end_time?: number
          floor_surface_m2?: number | null
          wall_surface_m2?: number | null
          ceiling_surface_m2?: number | null
          ceiling_height_m?: number | null
          volume_m3?: number | null
          detection_method?: 'roomplan' | 'voice' | 'gemini' | 'manual' | null
          detection_confidence?: number | null
          display_order?: number | null
          created_at?: string
        }
        Relationships: []
      }
      tour_annotations: {
        Row: {
          id: string
          tour_id: string
          room_id: string | null
          text: string
          annotation_type: 'observation' | 'defect' | 'feature' | null
          timecode: number
          position_x: number | null
          position_y: number | null
          position_z: number | null
          photo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tour_id: string
          room_id?: string | null
          text: string
          annotation_type?: 'observation' | 'defect' | 'feature' | null
          timecode: number
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          photo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tour_id?: string
          room_id?: string | null
          text?: string
          annotation_type?: 'observation' | 'defect' | 'feature' | null
          timecode?: number
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          photo_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      lia_sessions: {
        Row: {
          id: string
          tour_id: string
          visitor_id: string | null
          started_at: string
          ended_at: string | null
          message_count: number
          rooms_visited: string[] | null
          total_watch_time_seconds: number | null
        }
        Insert: {
          id?: string
          tour_id: string
          visitor_id?: string | null
          started_at?: string
          ended_at?: string | null
          message_count?: number
          rooms_visited?: string[] | null
          total_watch_time_seconds?: number | null
        }
        Update: {
          id?: string
          tour_id?: string
          visitor_id?: string | null
          started_at?: string
          ended_at?: string | null
          message_count?: number
          rooms_visited?: string[] | null
          total_watch_time_seconds?: number | null
        }
        Relationships: []
      }
      lia_messages: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          action_type: 'seek' | 'info' | 'staging' | null
          action_data: Json | null
          model_used: string | null
          tokens_used: number | null
          cost_usd: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          action_type?: 'seek' | 'info' | 'staging' | null
          action_data?: Json | null
          model_used?: string | null
          tokens_used?: number | null
          cost_usd?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'user' | 'assistant'
          content?: string
          action_type?: 'seek' | 'info' | 'staging' | null
          action_data?: Json | null
          model_used?: string | null
          tokens_used?: number | null
          cost_usd?: number | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Types utilitaires
export type VirtualTour = Database['public']['Tables']['virtual_tours']['Row']
export type TourRoom = Database['public']['Tables']['tour_rooms']['Row']
export type TourAnnotation = Database['public']['Tables']['tour_annotations']['Row']
export type LiaSession = Database['public']['Tables']['lia_sessions']['Row']
export type LiaMessage = Database['public']['Tables']['lia_messages']['Row']

// Types pour les insertions
export type NewVirtualTour = Database['public']['Tables']['virtual_tours']['Insert']
export type NewTourRoom = Database['public']['Tables']['tour_rooms']['Insert']
export type NewTourAnnotation = Database['public']['Tables']['tour_annotations']['Insert']

// Type pour l'index de visite (stocké en JSON)
export interface TourIndex {
  version: string
  tour_id: string
  created_at: string
  has_lidar: boolean
  property: {
    address: string
    type: string
    total_surface_m2?: number
  }
  video: {
    duration_seconds: number
    resolution: string
    codec: string
  }
  rooms: Array<{
    id: string
    name: string
    type: string
    start_time: number
    end_time: number
    surfaces?: {
      floor_m2: number
      walls_m2: number
      ceiling_m2: number
    }
  }>
  annotations: Array<{
    id: string
    room_id: string
    timecode: number
    text: string
    type: string
    position_3d?: [number, number, number]
    photo_url?: string
  }>
}

// Type pour les réponses de Lia
export interface LiaResponse {
  message: string
  action: 'seek' | 'info' | 'staging' | null
  timecode?: number
  data?: Record<string, unknown>
}
