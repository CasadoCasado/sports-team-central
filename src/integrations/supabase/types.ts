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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      chat_channel_members: {
        Row: {
          added_at: string
          channel_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          channel_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          channel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_token: string | null
          nombre: string
          scope: Database["public"]["Enums"]["channel_scope"]
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_token?: string | null
          nombre: string
          scope?: Database["public"]["Enums"]["channel_scope"]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_token?: string | null
          nombre?: string
          scope?: Database["public"]["Enums"]["channel_scope"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel_id: string
          contenido: string
          created_at: string
          edited: boolean
          id: string
          reply_to_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          contenido: string
          created_at?: string
          edited?: boolean
          id?: string
          reply_to_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          contenido?: string
          created_at?: string
          edited?: boolean
          id?: string
          reply_to_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_registrations: {
        Row: {
          category_id: string
          competition_id: string
          created_at: string
          created_by: string | null
          division_id: string
          id: string
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          team_id: string
          temporada: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          competition_id: string
          created_at?: string
          created_by?: string | null
          division_id: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_id: string
          temporada?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          competition_id?: string
          created_at?: string
          created_by?: string | null
          division_id?: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_id?: string
          temporada?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "official_competition_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_registrations_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "official_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_registrations_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "official_competition_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string
          created_by: string
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          nombre: string
          team_id: string
          temporada: string | null
          tipo: Database["public"]["Enums"]["competition_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre: string
          team_id: string
          temporada?: string | null
          tipo?: Database["public"]["Enums"]["competition_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre?: string
          team_id?: string
          temporada?: string | null
          tipo?: Database["public"]["Enums"]["competition_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          team_id: string
          uploader_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          team_id: string
          uploader_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          team_id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders_sent: {
        Row: {
          event_id: string
          hours_before: number
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          hours_before: number
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          hours_before?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_sent_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_responses: {
        Row: {
          created_at: string
          es_convocado: boolean
          event_id: string
          id: string
          notas: string | null
          padel_pista: number | null
          responded_at: string | null
          status: Database["public"]["Enums"]["response_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          es_convocado?: boolean
          event_id: string
          id?: string
          notas?: string | null
          padel_pista?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          es_convocado?: boolean
          event_id?: string
          id?: string
          notas?: string | null
          padel_pista?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          competition_id: string | null
          convocatoria_cierra_en: string | null
          created_at: string
          created_by: string
          descripcion: string | null
          es_local: boolean | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          padel_num_pistas: number | null
          registration_id: string | null
          requiere_convocatoria: boolean
          resultado_local: number | null
          resultado_visitante: number | null
          rival: string | null
          team_id: string
          tipo: Database["public"]["Enums"]["event_type"]
          titulo: string
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          competition_id?: string | null
          convocatoria_cierra_en?: string | null
          created_at?: string
          created_by: string
          descripcion?: string | null
          es_local?: boolean | null
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          padel_num_pistas?: number | null
          registration_id?: string | null
          requiere_convocatoria?: boolean
          resultado_local?: number | null
          resultado_visitante?: number | null
          rival?: string | null
          team_id: string
          tipo?: Database["public"]["Enums"]["event_type"]
          titulo: string
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          competition_id?: string | null
          convocatoria_cierra_en?: string | null
          created_at?: string
          created_by?: string
          descripcion?: string | null
          es_local?: boolean | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          padel_num_pistas?: number | null
          registration_id?: string | null
          requiere_convocatoria?: boolean
          resultado_local?: number | null
          resultado_visitante?: number | null
          rival?: string | null
          team_id?: string
          tipo?: Database["public"]["Enums"]["event_type"]
          titulo?: string
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "competition_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          created_at: string
          fee_id: string
          id: string
          notas: string | null
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fee_id: string
          id?: string
          notas?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fee_id?: string
          id?: string
          notas?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "team_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string | null
          id: string
          storage_path: string
          team_id: string
          uploader_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          storage_path: string
          team_id: string
          uploader_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          storage_path?: string
          team_id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_positions: {
        Row: {
          created_at: string
          es_titular: boolean
          id: string
          lineup_id: string
          orden: number
          posicion: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          es_titular?: boolean
          id?: string
          lineup_id: string
          orden?: number
          posicion?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          es_titular?: boolean
          id?: string
          lineup_id?: string
          orden?: number
          posicion?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_positions_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          formacion: string | null
          id: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          formacion?: string | null
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          formacion?: string | null
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participations: {
        Row: {
          created_at: string
          event_ganado: boolean | null
          event_id: string
          fecha: string
          ganado: boolean | null
          id: string
          jugado: boolean
          pista: number | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_ganado?: boolean | null
          event_id: string
          fecha: string
          ganado?: boolean | null
          id?: string
          jugado?: boolean
          pista?: number | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_ganado?: boolean | null
          event_id?: string
          fecha?: string
          ganado?: boolean | null
          id?: string
          jugado?: boolean
          pista?: number | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          event_id: string
          id: string
          pista: number
          set1_local: number | null
          set1_visitante: number | null
          set2_local: number | null
          set2_visitante: number | null
          set3_local: number | null
          set3_visitante: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          pista?: number
          set1_local?: number | null
          set1_visitante?: number | null
          set2_local?: number | null
          set2_visitante?: number | null
          set3_local?: number | null
          set3_visitante?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          pista?: number
          set1_local?: number | null
          set1_visitante?: number | null
          set2_local?: number | null
          set2_visitante?: number | null
          set3_local?: number | null
          set3_visitante?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          cuerpo: string | null
          data: Json | null
          id: string
          link: string | null
          read: boolean
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cuerpo?: string | null
          data?: Json | null
          id?: string
          link?: string | null
          read?: boolean
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          cuerpo?: string | null
          data?: Json | null
          id?: string
          link?: string | null
          read?: boolean
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      official_competition_categories: {
        Row: {
          code: string
          competition_id: string
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          code: string
          competition_id: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          code?: string
          competition_id?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "official_competition_categories_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "official_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      official_competition_divisions: {
        Row: {
          code: string
          competition_id: string
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          code: string
          competition_id: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          code?: string
          competition_id?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "official_competition_divisions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "official_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      official_competitions: {
        Row: {
          activa: boolean
          code: string
          created_at: string
          descripcion: string | null
          id: string
          inscripciones_abiertas: boolean
          nombre: string
          orden: number
          reglas: string | null
          temporada_actual: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          code: string
          created_at?: string
          descripcion?: string | null
          id?: string
          inscripciones_abiertas?: boolean
          nombre: string
          orden?: number
          reglas?: string | null
          temporada_actual?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          code?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          inscripciones_abiertas?: boolean
          nombre?: string
          orden?: number
          reglas?: string | null
          temporada_actual?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          posicion: number
          texto: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          posicion?: number
          texto: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          posicion?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          anonymous: boolean
          closed: boolean
          closes_at: string | null
          created_at: string
          created_by: string
          descripcion: string | null
          id: string
          multi_select: boolean
          pregunta: string
          team_id: string
          updated_at: string
        }
        Insert: {
          anonymous?: boolean
          closed?: boolean
          closes_at?: string | null
          created_at?: string
          created_by: string
          descripcion?: string | null
          id?: string
          multi_select?: boolean
          pregunta: string
          team_id: string
          updated_at?: string
        }
        Update: {
          anonymous?: boolean
          closed?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string
          descripcion?: string | null
          id?: string
          multi_select?: boolean
          pregunta?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellidos: string
          avatar_url: string | null
          ciudad: string | null
          created_at: string
          deporte: string | null
          descripcion: string | null
          email: string
          fecha_nacimiento: string | null
          id: string
          idioma: string
          mano_dominante: string | null
          nivel: string | null
          nombre: string
          onboarding_completed: boolean
          posicion: string | null
          preferred_role: Database["public"]["Enums"]["preferred_role"] | null
          reminder_hours: number[]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellidos?: string
          avatar_url?: string | null
          ciudad?: string | null
          created_at?: string
          deporte?: string | null
          descripcion?: string | null
          email: string
          fecha_nacimiento?: string | null
          id: string
          idioma?: string
          mano_dominante?: string | null
          nivel?: string | null
          nombre?: string
          onboarding_completed?: boolean
          posicion?: string | null
          preferred_role?: Database["public"]["Enums"]["preferred_role"] | null
          reminder_hours?: number[]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellidos?: string
          avatar_url?: string | null
          ciudad?: string | null
          created_at?: string
          deporte?: string | null
          descripcion?: string | null
          email?: string
          fecha_nacimiento?: string | null
          id?: string
          idioma?: string
          mano_dominante?: string | null
          nivel?: string | null
          nombre?: string
          onboarding_completed?: boolean
          posicion?: string | null
          preferred_role?: Database["public"]["Enums"]["preferred_role"] | null
          reminder_hours?: number[]
          telefono?: string | null
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
      team_fees: {
        Row: {
          amount: number
          concepto: string
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          concepto: string
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          id?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          concepto?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_fees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          es_solicitud: boolean
          id: string
          invited_by: string
          invited_user_id: string
          mensaje: string | null
          responded_at: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          team_id: string
        }
        Insert: {
          created_at?: string
          es_solicitud?: boolean
          id?: string
          invited_by: string
          invited_user_id: string
          mensaje?: string | null
          responded_at?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id: string
        }
        Update: {
          created_at?: string
          es_solicitud?: boolean
          id?: string
          invited_by?: string
          invited_user_id?: string
          mensaje?: string | null
          responded_at?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_invited_by_profiles_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_user_id_profiles_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["member_status"]
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          categoria: string | null
          ciudad: string | null
          color_primario: string | null
          color_secundario: string | null
          created_at: string
          deporte: string | null
          descripcion: string | null
          id: string
          inscripciones_abiertas: boolean
          instalacion: string | null
          logo_url: string | null
          nombre: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          ciudad?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          created_at?: string
          deporte?: string | null
          descripcion?: string | null
          id?: string
          inscripciones_abiertas?: boolean
          instalacion?: string | null
          logo_url?: string | null
          nombre: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          ciudad?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          created_at?: string
          deporte?: string | null
          descripcion?: string | null
          id?: string
          inscripciones_abiertas?: boolean
          instalacion?: string | null
          logo_url?: string | null
          nombre?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      player_match_stats: {
        Row: {
          convocado: number | null
          derrotas: number | null
          disputados: number | null
          team_id: string | null
          ultima_convocatoria: string | null
          ultimo_partido: string | null
          user_id: string | null
          victorias: number | null
          win_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_participations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_stats: {
        Row: {
          diferencia_pistas: number | null
          ganados: number | null
          jugados: number | null
          perdidos: number | null
          pistas_ganadas: number | null
          pistas_perdidas: number | null
          racha: number | null
          racha_victorias: boolean | null
          team_id: string | null
          win_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_manager: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      join_channel_by_token: { Args: { _token: string }; Returns: string }
      padel_set_winner: { Args: { a: number; b: number }; Returns: number }
      recalc_event_result: { Args: { _event_id: string }; Returns: undefined }
      send_event_reminders: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
      channel_scope: "general" | "staff" | "custom"
      competition_type: "liga" | "copa" | "torneo" | "amistoso"
      event_type: "entrenamiento" | "partido" | "reunion" | "otro" | "torneo"
      invitation_status: "pendiente" | "aceptada" | "rechazada"
      member_status: "pendiente" | "activo" | "expulsado"
      preferred_role: "capitan" | "jugador"
      registration_status: "abierta" | "activa" | "cerrada" | "rechazada"
      response_status: "convocado" | "confirmado" | "rechazado" | "duda"
      team_role:
        | "capitan"
        | "entrenador"
        | "delegado"
        | "jugador"
        | "co_capitan"
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
      channel_scope: ["general", "staff", "custom"],
      competition_type: ["liga", "copa", "torneo", "amistoso"],
      event_type: ["entrenamiento", "partido", "reunion", "otro", "torneo"],
      invitation_status: ["pendiente", "aceptada", "rechazada"],
      member_status: ["pendiente", "activo", "expulsado"],
      preferred_role: ["capitan", "jugador"],
      registration_status: ["abierta", "activa", "cerrada", "rechazada"],
      response_status: ["convocado", "confirmado", "rechazado", "duda"],
      team_role: ["capitan", "entrenador", "delegado", "jugador", "co_capitan"],
    },
  },
} as const
