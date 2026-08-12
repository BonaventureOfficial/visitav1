export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_stats: {
        Row: {
          avg_completion: number
          followers: number
          quality_score: number
          updated_at: string
          user_id: string
          videos_count: number
        }
        Insert: {
          avg_completion?: number
          followers?: number
          quality_score?: number
          updated_at?: string
          user_id: string
          videos_count?: number
        }
        Update: {
          avg_completion?: number
          followers?: number
          quality_score?: number
          updated_at?: string
          user_id?: string
          videos_count?: number
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      member_identity: {
        Row: {
          birth_date: string | null
          birth_place: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          marital_status: string | null
          nationality: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          marital_status?: string | null
          nationality?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          marital_status?: string | null
          nationality?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          bio_updated_at: string | null
          channel_name: string
          channel_name_updated_at: string | null
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          bio_updated_at?: string | null
          channel_name: string
          channel_name_updated_at?: string | null
          created_at?: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          bio_updated_at?: string | null
          channel_name?: string
          channel_name_updated_at?: string | null
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_affinity: {
        Row: {
          category: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_negative_feedback: {
        Row: {
          created_at: string
          creator_id: string | null
          id: string
          kind: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          id?: string
          kind?: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          id?: string
          kind?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_negative_feedback_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          likes_count: number
          parent_id: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_id?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_id?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_events: {
        Row: {
          category: string | null
          completion: number
          created_at: string
          creator_id: string | null
          duration_ms: number
          event_type: string
          id: number
          position_ms: number
          session_id: string | null
          user_id: string | null
          video_id: string
          watch_ms: number
        }
        Insert: {
          category?: string | null
          completion?: number
          created_at?: string
          creator_id?: string | null
          duration_ms?: number
          event_type: string
          id?: number
          position_ms?: number
          session_id?: string | null
          user_id?: string | null
          video_id: string
          watch_ms?: number
        }
        Update: {
          category?: string | null
          completion?: number
          created_at?: string
          creator_id?: string | null
          duration_ms?: number
          event_type?: string
          id?: number
          position_ms?: number
          session_id?: string | null
          user_id?: string | null
          video_id?: string
          watch_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_scores: {
        Row: {
          exploration_boost: number
          final_score: number
          freshness: number
          quality_score: number
          trending_score: number
          updated_at: string
          video_id: string
        }
        Insert: {
          exploration_boost?: number
          final_score?: number
          freshness?: number
          quality_score?: number
          trending_score?: number
          updated_at?: string
          video_id: string
        }
        Update: {
          exploration_boost?: number
          final_score?: number
          freshness?: number
          quality_score?: number
          trending_score?: number
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_scores_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_shares: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_shares_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_stats: {
        Row: {
          avg_completion: number
          completions: number
          follows_gained: number
          impressions: number
          negatives: number
          replays: number
          skips: number
          updated_at: string
          video_id: string
          watch_seconds: number
          watch_seconds_24h: number
          watch_seconds_prev_24h: number
        }
        Insert: {
          avg_completion?: number
          completions?: number
          follows_gained?: number
          impressions?: number
          negatives?: number
          replays?: number
          skips?: number
          updated_at?: string
          video_id: string
          watch_seconds?: number
          watch_seconds_24h?: number
          watch_seconds_prev_24h?: number
        }
        Update: {
          avg_completion?: number
          completions?: number
          follows_gained?: number
          impressions?: number
          negatives?: number
          replays?: number
          skips?: number
          updated_at?: string
          video_id?: string
          watch_seconds?: number
          watch_seconds_24h?: number
          watch_seconds_prev_24h?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_stats_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_supavs: {
        Row: {
          created_at: string
          day_hash: string
          day_key: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          day_hash: string
          day_key?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          day_hash?: string
          day_key?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_supavs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
          view_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
          view_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
          view_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          category: string
          channel_name: string | null
          comments_count: number
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_reel: boolean
          likes: number
          reposts: number
          shares: number
          supav_count: number
          thumbnail_url: string | null
          title: string
          user_id: string | null
          video_url: string | null
          views: number
        }
        Insert: {
          category?: string
          channel_name?: string | null
          comments_count?: number
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_reel?: boolean
          likes?: number
          reposts?: number
          shares?: number
          supav_count?: number
          thumbnail_url?: string | null
          title: string
          user_id?: string | null
          video_url?: string | null
          views?: number
        }
        Update: {
          category?: string
          channel_name?: string | null
          comments_count?: number
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_reel?: boolean
          likes?: number
          reposts?: number
          shares?: number
          supav_count?: number
          thumbnail_url?: string | null
          title?: string
          user_id?: string | null
          video_url?: string | null
          views?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_supav: { Args: { _video_id: string }; Returns: Json }
      get_ranked_feed: {
        Args: { _is_reel?: boolean; _limit?: number; _user_id: string }
        Returns: {
          category: string
          channel_name: string
          comments_count: number
          created_at: string
          description: string
          duration_seconds: number
          id: string
          is_reel: boolean
          likes: number
          score: number
          shares: number
          supav_count: number
          thumbnail_url: string
          title: string
          user_id: string
          video_url: string
          views: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_ranking: { Args: never; Returns: undefined }
      record_video_event: {
        Args: {
          _duration_ms?: number
          _event_type: string
          _position_ms?: number
          _session_id?: string
          _video_id: string
          _watch_ms?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
