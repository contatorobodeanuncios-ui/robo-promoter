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
      access_requests: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_email: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          asaas_event_id: string
          created_at: string
          event_type: string
          external_reference: string | null
          id: string
          payment_id: string | null
          processed_at: string
          raw_payload: Json
        }
        Insert: {
          asaas_event_id: string
          created_at?: string
          event_type: string
          external_reference?: string | null
          id?: string
          payment_id?: string | null
          processed_at?: string
          raw_payload: Json
        }
        Update: {
          asaas_event_id?: string
          created_at?: string
          event_type?: string
          external_reference?: string | null
          id?: string
          payment_id?: string | null
          processed_at?: string
          raw_payload?: Json
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          budget: number
          city: string
          clicks: number
          copy: string
          cpc: number
          created_at: string
          ctr: number
          days: number
          funding_type: string
          headline: string
          id: string
          image: string
          impressions: number
          link: string
          meta_ad_account_id: string | null
          meta_campaign_id: string | null
          meta_pixel_id: string | null
          metrics_last_error: string | null
          metrics_last_synced_at: string | null
          name: string
          neighborhood: string
          pix_remaining_budget: number | null
          pix_total_budget: number | null
          radius: number
          spent: number
          status: Database["public"]["Enums"]["campaign_status"]
          total_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number
          city?: string
          clicks?: number
          copy?: string
          cpc?: number
          created_at?: string
          ctr?: number
          days?: number
          funding_type?: string
          headline?: string
          id?: string
          image?: string
          impressions?: number
          link?: string
          meta_ad_account_id?: string | null
          meta_campaign_id?: string | null
          meta_pixel_id?: string | null
          metrics_last_error?: string | null
          metrics_last_synced_at?: string | null
          name: string
          neighborhood?: string
          pix_remaining_budget?: number | null
          pix_total_budget?: number | null
          radius?: number
          spent?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          total_paid?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          city?: string
          clicks?: number
          copy?: string
          cpc?: number
          created_at?: string
          ctr?: number
          days?: number
          funding_type?: string
          headline?: string
          id?: string
          image?: string
          impressions?: number
          link?: string
          meta_ad_account_id?: string | null
          meta_campaign_id?: string | null
          meta_pixel_id?: string | null
          metrics_last_error?: string | null
          metrics_last_synced_at?: string | null
          name?: string
          neighborhood?: string
          pix_remaining_budget?: number | null
          pix_total_budget?: number | null
          radius?: number
          spent?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          approved_at: string | null
          asaas_link: string | null
          asaas_payment_id: string | null
          created_at: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["payment_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          asaas_link?: string | null
          asaas_payment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          asaas_link?: string | null
          asaas_payment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          balance: number
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_active_at: string | null
          notification_prefs: Json
          phone: string | null
          status: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          balance?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_active_at?: string | null
          notification_prefs?: Json
          phone?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          balance?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_active_at?: string | null
          notification_prefs?: Json
          phone?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          unread_by_admin: boolean
          unread_by_client: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          unread_by_admin?: boolean
          unread_by_client?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          unread_by_admin?: boolean
          unread_by_client?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
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
      wipe_events: {
        Row: {
          active_count: number
          campaigns_snapshot: Json
          created_at: string
          id: string
          total_count: number
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          active_count?: number
          campaigns_snapshot?: Json
          created_at?: string
          id?: string
          total_count?: number
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          active_count?: number
          campaigns_snapshot?: Json
          created_at?: string
          id?: string
          total_count?: number
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_status:
        | "running"
        | "analyzing"
        | "paused"
        | "aguardando_vinculo_meta"
        | "rodando"
        | "encerrada_saldo_consumido"
      payment_request_status: "pending" | "approved" | "rejected" | "paid"
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
      app_role: ["admin", "user"],
      campaign_status: [
        "running",
        "analyzing",
        "paused",
        "aguardando_vinculo_meta",
        "rodando",
        "encerrada_saldo_consumido",
      ],
      payment_request_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
