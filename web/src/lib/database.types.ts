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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          client_id: string | null
          confidence: string | null
          content: string
          created_at: string
          id: string
          insight_type: string
          organization_id: string
          property_id: string | null
          showing_id: string | null
          structured_data: Json | null
        }
        Insert: {
          client_id?: string | null
          confidence?: string | null
          content: string
          created_at?: string
          id?: string
          insight_type: string
          organization_id?: string
          property_id?: string | null
          showing_id?: string | null
          structured_data?: Json | null
        }
        Update: {
          client_id?: string | null
          confidence?: string | null
          content?: string
          created_at?: string
          id?: string
          insight_type?: string
          organization_id?: string
          property_id?: string | null
          showing_id?: string | null
          structured_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_invites: {
        Row: {
          accepted_at: string | null
          client_member_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          client_member_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          client_member_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_invites_client_member_id_fkey"
            columns: ["client_member_id"]
            isOneToOne: false
            referencedRelation: "client_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_ratings: {
        Row: {
          backyard: number | null
          bedrooms: number | null
          client_id: string
          client_member_id: string
          comment: string | null
          condition: number | null
          created_at: string
          decision: string | null
          id: string
          kitchen: number | null
          location: number | null
          organization_id: string
          overall: number | null
          property_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          backyard?: number | null
          bedrooms?: number | null
          client_id: string
          client_member_id: string
          comment?: string | null
          condition?: number | null
          created_at?: string
          decision?: string | null
          id?: string
          kitchen?: number | null
          location?: number | null
          organization_id: string
          overall?: number | null
          property_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          backyard?: number | null
          bedrooms?: number | null
          client_id?: string
          client_member_id?: string
          comment?: string | null
          condition?: number | null
          created_at?: string
          decision?: string | null
          id?: string
          kitchen?: number | null
          location?: number | null
          organization_id?: string
          overall?: number | null
          property_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_ratings_client_member_id_fkey"
            columns: ["client_member_id"]
            isOneToOne: false
            referencedRelation: "client_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_ratings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_ratings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_reactions: {
        Row: {
          client_id: string
          client_member_id: string | null
          created_at: string
          feature: string
          id: string
          organization_id: string
          property_id: string
          reaction: string
          sentiment: string | null
          showing_id: string | null
          source: string
          strength: number | null
        }
        Insert: {
          client_id: string
          client_member_id?: string | null
          created_at?: string
          feature: string
          id?: string
          organization_id?: string
          property_id: string
          reaction: string
          sentiment?: string | null
          showing_id?: string | null
          source?: string
          strength?: number | null
        }
        Update: {
          client_id?: string
          client_member_id?: string | null
          created_at?: string
          feature?: string
          id?: string
          organization_id?: string
          property_id?: string
          reaction?: string
          sentiment?: string | null
          showing_id?: string | null
          source?: string
          strength?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_reactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_reactions_client_member_id_fkey"
            columns: ["client_member_id"]
            isOneToOne: false
            referencedRelation: "client_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_reactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_reactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_reactions_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_feeds: {
        Row: {
          created_at: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          token?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_name: string | null
          organization_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          last_name?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_preferences: {
        Row: {
          category: string
          client_id: string
          confidence: string
          confirmed_by_buyer: boolean
          confirmed_by_realtor: boolean
          created_at: string
          evidence_count: number
          id: string
          organization_id: string
          preference_type: string
          source: string
          status: string
          updated_at: string
          value: string
          weight: number
        }
        Insert: {
          category: string
          client_id: string
          confidence?: string
          confirmed_by_buyer?: boolean
          confirmed_by_realtor?: boolean
          created_at?: string
          evidence_count?: number
          id?: string
          organization_id?: string
          preference_type: string
          source?: string
          status?: string
          updated_at?: string
          value: string
          weight?: number
        }
        Update: {
          category?: string
          client_id?: string
          confidence?: string
          confirmed_by_buyer?: boolean
          confirmed_by_realtor?: boolean
          created_at?: string
          evidence_count?: number
          id?: string
          organization_id?: string
          preference_type?: string
          source?: string
          status?: string
          updated_at?: string
          value?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_preferences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agent_id: string | null
          buying_timeline: string | null
          created_at: string
          down_payment_amount: number | null
          email: string | null
          first_name: string
          id: string
          is_demo: boolean
          last_name: string | null
          lender_name: string | null
          loan_type: string | null
          min_baths: number | null
          min_beds: number | null
          notes: string | null
          offer_readiness: string
          organization_id: string
          phone: string | null
          preapproval_amount: number | null
          preapproval_status: string | null
          preferred_monthly_payment: number | null
          property_types: string[]
          status: string
          target_areas: string[]
          target_price_max: number | null
          target_price_min: number | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          buying_timeline?: string | null
          created_at?: string
          down_payment_amount?: number | null
          email?: string | null
          first_name: string
          id?: string
          is_demo?: boolean
          last_name?: string | null
          lender_name?: string | null
          loan_type?: string | null
          min_baths?: number | null
          min_beds?: number | null
          notes?: string | null
          offer_readiness?: string
          organization_id?: string
          phone?: string | null
          preapproval_amount?: number | null
          preapproval_status?: string | null
          preferred_monthly_payment?: number | null
          property_types?: string[]
          status?: string
          target_areas?: string[]
          target_price_max?: number | null
          target_price_min?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          buying_timeline?: string | null
          created_at?: string
          down_payment_amount?: number | null
          email?: string | null
          first_name?: string
          id?: string
          is_demo?: boolean
          last_name?: string | null
          lender_name?: string | null
          loan_type?: string | null
          min_baths?: number | null
          min_beds?: number | null
          notes?: string | null
          offer_readiness?: string
          organization_id?: string
          phone?: string | null
          preapproval_amount?: number | null
          preapproval_status?: string | null
          preferred_monthly_payment?: number | null
          property_types?: string[]
          status?: string
          target_areas?: string[]
          target_price_max?: number | null
          target_price_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comparison_properties: {
        Row: {
          comparison_id: string
          created_at: string
          id: string
          organization_id: string
          property_id: string
          rank: number | null
        }
        Insert: {
          comparison_id: string
          created_at?: string
          id?: string
          organization_id?: string
          property_id: string
          rank?: number | null
        }
        Update: {
          comparison_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string
          rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comparison_properties_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          agent_id: string | null
          client_id: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          agent_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string
        }
        Update: {
          agent_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          account_label: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          organization_id: string
          profile_id: string
          provider: string
          secret_id: string | null
          settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id: string
          profile_id: string
          provider: string
          secret_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id?: string
          profile_id?: string
          provider?: string
          secret_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_links: {
        Row: {
          entity_id: string
          entity_type: string
          external_id: string
          id: string
          organization_id: string
          provider: string
          synced_at: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          external_id: string
          id?: string
          organization_id: string
          provider: string
          synced_at?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          external_id?: string
          id?: string
          organization_id?: string
          provider?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_id: string | null
          channel: string
          client_id: string | null
          content: string
          created_at: string
          id: string
          organization_id: string
          property_id: string | null
          sender: string
          status: string
          type: string
        }
        Insert: {
          agent_id?: string | null
          channel?: string
          client_id?: string | null
          content: string
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string | null
          sender?: string
          status?: string
          type?: string
        }
        Update: {
          agent_id?: string | null
          channel?: string
          client_id?: string | null
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string | null
          sender?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      mortgage_scenarios: {
        Row: {
          client_id: string | null
          created_at: string
          down_payment: number
          hoa_monthly: number
          id: string
          insurance_monthly: number
          interest_rate: number
          loan_amount: number
          loan_term_years: number
          organization_id: string
          pmi_monthly: number
          principal_interest: number
          property_id: string | null
          purchase_price: number
          taxes_monthly: number
          total_monthly_payment: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          down_payment: number
          hoa_monthly?: number
          id?: string
          insurance_monthly?: number
          interest_rate: number
          loan_amount: number
          loan_term_years: number
          organization_id?: string
          pmi_monthly?: number
          principal_interest: number
          property_id?: string | null
          purchase_price: number
          taxes_monthly?: number
          total_monthly_payment: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          down_payment?: number
          hoa_monthly?: number
          id?: string
          insurance_monthly?: number
          interest_rate?: number
          loan_amount?: number
          loan_term_years?: number
          organization_id?: string
          pmi_monthly?: number
          principal_interest?: number
          property_id?: string | null
          purchase_price?: number
          taxes_monthly?: number
          total_monthly_payment?: number
        }
        Relationships: [
          {
            foreignKeyName: "mortgage_scenarios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortgage_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortgage_scenarios_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          organization_id: string
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          agent_id: string | null
          ai_status: string
          analyzed_at: string | null
          analysis: Json | null
          client_id: string
          created_at: string
          id: string
          inputs: Json
          notes: string | null
          organization_id: string
          potential_price: number | null
          property_id: string
          selected_scenario: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          ai_status?: string
          analyzed_at?: string | null
          analysis?: Json | null
          client_id: string
          created_at?: string
          id?: string
          inputs?: Json
          notes?: string | null
          organization_id?: string
          potential_price?: number | null
          property_id: string
          selected_scenario?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          ai_status?: string
          analyzed_at?: string | null
          analysis?: Json | null
          client_id?: string
          created_at?: string
          id?: string
          inputs?: Json
          notes?: string | null
          organization_id?: string
          potential_price?: number | null
          property_id?: string
          selected_scenario?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          organization_id: string
          revoked_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          organization_id?: string
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          organization_id?: string
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          logo_url: string | null
          name: string
          primary_market: string | null
          state_code: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: string
          subscription_status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_market?: string | null
          state_code?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string
          subscription_status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_market?: string | null
          state_code?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string
          subscription_status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_shares: {
        Row: {
          client_id: string
          created_at: string
          id: string
          note: string | null
          organization_id: string
          property_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          property_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_shares_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_shares_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          brokerage_name: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          license_number: string | null
          license_state: string | null
          onboarding_completed: boolean
          organization_id: string | null
          phone: string | null
          primary_market: string | null
          role: string
          team_id: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          brokerage_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          onboarding_completed?: boolean
          organization_id?: string | null
          phone?: string | null
          primary_market?: string | null
          role?: string
          team_id?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          brokerage_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          onboarding_completed?: boolean
          organization_id?: string | null
          phone?: string | null
          primary_market?: string | null
          role?: string
          team_id?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_line1: string
          baths: number | null
          beds: number | null
          city: string
          created_at: string
          days_on_market: number | null
          hoa_fee: number | null
          id: string
          is_demo: boolean
          latitude: number | null
          listing_agent_name: string | null
          listing_brokerage: string | null
          listing_price: number | null
          longitude: number | null
          lot_size: string | null
          mls_number: string | null
          organization_id: string
          primary_photo: string | null
          property_tax: number | null
          property_type: string | null
          square_feet: number | null
          state: string
          status: string
          updated_at: string
          year_built: number | null
          zip_code: string | null
        }
        Insert: {
          address_line1: string
          baths?: number | null
          beds?: number | null
          city: string
          created_at?: string
          days_on_market?: number | null
          hoa_fee?: number | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          listing_agent_name?: string | null
          listing_brokerage?: string | null
          listing_price?: number | null
          longitude?: number | null
          lot_size?: string | null
          mls_number?: string | null
          organization_id?: string
          primary_photo?: string | null
          property_tax?: number | null
          property_type?: string | null
          square_feet?: number | null
          state?: string
          status?: string
          updated_at?: string
          year_built?: number | null
          zip_code?: string | null
        }
        Update: {
          address_line1?: string
          baths?: number | null
          beds?: number | null
          city?: string
          created_at?: string
          days_on_market?: number | null
          hoa_fee?: number | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          listing_agent_name?: string | null
          listing_brokerage?: string | null
          listing_price?: number | null
          longitude?: number | null
          lot_size?: string | null
          mls_number?: string | null
          organization_id?: string
          primary_photo?: string | null
          property_tax?: number | null
          property_type?: string | null
          square_feet?: number | null
          state?: string
          status?: string
          updated_at?: string
          year_built?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_intelligence: {
        Row: {
          category: string
          confidence: string | null
          created_at: string
          id: string
          organization_id: string
          property_id: string
          retrieved_at: string | null
          source: string
          source_url: string | null
          title: string
          value: string | null
          verified: boolean
        }
        Insert: {
          category: string
          confidence?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          property_id: string
          retrieved_at?: string | null
          source?: string
          source_url?: string | null
          title: string
          value?: string | null
          verified?: boolean
        }
        Update: {
          category?: string
          confidence?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string
          retrieved_at?: string | null
          source?: string
          source_url?: string | null
          title?: string
          value?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "property_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_intelligence_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          organization_id: string
          photo_url: string
          property_id: string
          room_type: string | null
          showing_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          photo_url: string
          property_id: string
          room_type?: string | null
          showing_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          photo_url?: string
          property_id?: string
          room_type?: string | null
          showing_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_scores: {
        Row: {
          ai_reasoning: string | null
          client_id: string
          condition_score: number | null
          created_at: string
          emotional_score: number | null
          financial_score: number | null
          id: string
          location_score: number | null
          must_have_score: number | null
          organization_id: string
          overall_score: number | null
          price_score: number | null
          property_id: string
          size_score: number | null
          updated_at: string
        }
        Insert: {
          ai_reasoning?: string | null
          client_id: string
          condition_score?: number | null
          created_at?: string
          emotional_score?: number | null
          financial_score?: number | null
          id?: string
          location_score?: number | null
          must_have_score?: number | null
          organization_id?: string
          overall_score?: number | null
          price_score?: number | null
          property_id: string
          size_score?: number | null
          updated_at?: string
        }
        Update: {
          ai_reasoning?: string | null
          client_id?: string
          condition_score?: number | null
          created_at?: string
          emotional_score?: number | null
          financial_score?: number | null
          id?: string
          location_score?: number | null
          must_have_score?: number | null
          organization_id?: string
          overall_score?: number | null
          price_score?: number | null
          property_id?: string
          size_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_consents: {
        Row: {
          confirmed_at: string
          consent_confirmed: boolean
          created_at: string
          id: string
          organization_id: string
          property_id: string
          showing_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          consent_confirmed: boolean
          created_at?: string
          id?: string
          organization_id?: string
          property_id: string
          showing_id: string
          user_id?: string
        }
        Update: {
          confirmed_at?: string
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string
          showing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_consents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_consents_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          audio_url: string
          created_at: string
          duration_seconds: number | null
          id: string
          organization_id: string
          showing_id: string
          transcription_status: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          organization_id?: string
          showing_id: string
          transcription_status?: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          organization_id?: string
          showing_id?: string
          transcription_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
        ]
      }
      showing_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          note_type: string
          organization_id: string
          room_type: string | null
          sentiment: string | null
          showing_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          note_type?: string
          organization_id?: string
          room_type?: string | null
          sentiment?: string | null
          showing_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          note_type?: string
          organization_id?: string
          room_type?: string | null
          sentiment?: string | null
          showing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showing_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showing_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showing_notes_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
        ]
      }
      showings: {
        Row: {
          agent_id: string | null
          ai_analysis: Json | null
          ai_status: string
          ai_summary: string | null
          buyer_interest_level: string | null
          buyer_interest_score: number | null
          client_id: string
          created_at: string
          ended_at: string | null
          id: string
          organization_id: string
          property_id: string
          recording_consent: boolean
          started_at: string
          status: string
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          ai_analysis?: Json | null
          ai_status?: string
          ai_summary?: string | null
          buyer_interest_level?: string | null
          buyer_interest_score?: number | null
          client_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          organization_id?: string
          property_id: string
          recording_consent?: boolean
          started_at?: string
          status?: string
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          ai_analysis?: Json | null
          ai_status?: string
          ai_summary?: string | null
          buyer_interest_level?: string | null
          buyer_interest_score?: number | null
          client_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          organization_id?: string
          property_id?: string
          recording_consent?: boolean
          started_at?: string
          status?: string
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          organization_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_id: string | null
          ai_generated: boolean
          client_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: string
          property_id: string | null
          showing_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          ai_generated?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string
          property_id?: string | null
          showing_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          ai_generated?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string
          property_id?: string | null
          showing_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_properties: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          property_id: string
          scheduled_time: string | null
          sequence_number: number
          status: string
          tour_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string
          property_id: string
          scheduled_time?: string | null
          sequence_number?: number
          status?: string
          tour_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string
          scheduled_time?: string | null
          sequence_number?: number
          status?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_properties_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          agent_id: string | null
          client_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          status: string
          tour_date: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id?: string
          status?: string
          tour_date: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          status?: string
          tour_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tours_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          recording_id: string | null
          showing_id: string
          speaker_data: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id?: string
          recording_id?: string | null
          showing_id: string
          speaker_data?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          recording_id?: string | null
          showing_id?: string
          speaker_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_showing_id_fkey"
            columns: ["showing_id"]
            isOneToOne: false
            referencedRelation: "showings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_buyer_invite: { Args: { p_token: string }; Returns: string }
      accept_team_invite: {
        Args: { p_first_name: string; p_last_name: string; p_token: string }
        Returns: string
      }
      admin_metrics: { Args: never; Returns: Json }
      can_access_org: { Args: { org: string }; Returns: boolean }
      complete_onboarding: {
        Args: {
          p_brokerage: string
          p_first_name: string
          p_last_name: string
          p_license_number: string
          p_license_state: string
          p_phone: string
          p_primary_market: string
        }
        Returns: string
      }
      create_buyer_invite: { Args: { p_member_id: string }; Returns: string }
      create_team_invite: {
        Args: { p_email: string; p_role: string }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      get_buyer_invite: { Args: { p_token: string }; Returns: Json }
      get_calendar_token: { Args: never; Returns: string }
      get_team_invite: { Args: { p_token: string }; Returns: Json }
      integration_delete: {
        Args: { p_profile: string; p_provider: string }
        Returns: undefined
      }
      integration_save: {
        Args: {
          p_label: string
          p_profile: string
          p_provider: string
          p_secret: string
          p_settings: Json
        }
        Returns: string
      }
      integration_secret: {
        Args: { p_profile: string; p_provider: string }
        Returns: string
      }
      is_org_manager: { Args: never; Returns: boolean }
      is_org_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      notify_client_agent: {
        Args: {
          p_body: string
          p_client: string
          p_kind: string
          p_link: string
          p_title: string
        }
        Returns: undefined
      }
      org_seat_limit: { Args: { p_org: string }; Returns: number }
      portal_data: { Args: never; Returns: Json }
      portal_property_ids: { Args: never; Returns: string[] }
      portal_rate_property: {
        Args: {
          p_comment: string
          p_decision: string
          p_property_id: string
          p_ratings: Json
        }
        Returns: undefined
      }
      portal_send_message: { Args: { p_content: string }; Returns: undefined }
      remove_demo_data: { Args: never; Returns: undefined }
      remove_team_member: { Args: { p_profile_id: string }; Returns: undefined }
      revoke_team_invite: { Args: { p_invite_id: string }; Returns: undefined }
      rotate_calendar_token: { Args: never; Returns: string }
      seed_demo_data: { Args: never; Returns: string }
      set_member_role: {
        Args: { p_profile_id: string; p_role: string }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
