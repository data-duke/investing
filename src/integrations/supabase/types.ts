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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_chat_history: {
        Row: {
          created_at: string | null
          id: string
          messages: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          current_price_eur: number
          current_value_eur: number
          dividend_annual_eur: number | null
          exchange_rate: number | null
          id: string
          portfolio_id: string
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          current_price_eur: number
          current_value_eur: number
          dividend_annual_eur?: number | null
          exchange_rate?: number | null
          id?: string
          portfolio_id: string
          snapshot_date?: string
        }
        Update: {
          created_at?: string
          current_price_eur?: number
          current_value_eur?: number
          dividend_annual_eur?: number | null
          exchange_rate?: number | null
          id?: string
          portfolio_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          auto_tag_date: string | null
          country: string
          created_at: string
          dividend_last_fetched: string | null
          exchange_suffix: string | null
          id: string
          manual_dividend_eur: number | null
          name: string
          original_investment_eur: number
          original_price_eur: number
          purchase_date: string
          quantity: number
          symbol: string
          tag: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_tag_date?: string | null
          country: string
          created_at?: string
          dividend_last_fetched?: string | null
          exchange_suffix?: string | null
          id?: string
          manual_dividend_eur?: number | null
          name: string
          original_investment_eur: number
          original_price_eur: number
          purchase_date?: string
          quantity: number
          symbol: string
          tag?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_tag_date?: string | null
          country?: string
          created_at?: string
          dividend_last_fetched?: string | null
          exchange_suffix?: string | null
          id?: string
          manual_dividend_eur?: number | null
          name?: string
          original_investment_eur?: number
          original_price_eur?: number
          purchase_date?: string
          quantity?: number
          symbol?: string
          tag?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_cache: {
        Row: {
          cached_at: string | null
          cagr_5y: number | null
          cagr_calculated_at: string | null
          current_price_eur: number
          current_price_usd: number
          dividend_usd: number | null
          exchange_rate: number | null
          name: string | null
          source: string | null
          symbol: string
        }
        Insert: {
          cached_at?: string | null
          cagr_5y?: number | null
          cagr_calculated_at?: string | null
          current_price_eur: number
          current_price_usd: number
          dividend_usd?: number | null
          exchange_rate?: number | null
          name?: string | null
          source?: string | null
          symbol: string
        }
        Update: {
          cached_at?: string | null
          cagr_5y?: number | null
          cagr_calculated_at?: string | null
          current_price_eur?: number
          current_price_usd?: number
          dividend_usd?: number | null
          exchange_rate?: number | null
          name?: string | null
          source?: string | null
          symbol?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          residence_country: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          residence_country?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          residence_country?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shared_views: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          name: string | null
          show_values: boolean | null
          tags: string[]
          token: string
          user_id: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          show_values?: boolean | null
          tags: string[]
          token?: string
          user_id: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          show_values?: boolean | null
          tags?: string[]
          token?: string
          user_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
      subscription_overrides: {
        Row: {
          created_at: string
          id: string
          is_premium: boolean
          override_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_premium?: boolean
          override_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_premium?: boolean
          override_reason?: string | null
          user_id?: string
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
    Enums: {},
  },
} as const
