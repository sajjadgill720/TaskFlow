export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "attendee" | "organizer" | "admin";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: AppRole;
          phone: string | null;
          company: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: AppRole;
          phone?: string | null;
          company?: string | null;
          preferences?: Json;
        };
        Update: {
          full_name?: string;
          role?: AppRole;
          phone?: string | null;
          company?: string | null;
          preferences?: Json;
        };
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          name: string;
          event_date: string;
          location: string;
          status: "Active" | "Upcoming" | "Closed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          name: string;
          event_date: string;
          location: string;
          status?: "Active" | "Upcoming" | "Closed";
        };
        Update: {
          name?: string;
          event_date?: string;
          location?: string;
          status?: "Active" | "Upcoming" | "Closed";
        };
      };
      ticket_tiers: {
        Row: {
          id: string;
          event_id: string;
          tier_name: string;
          price_cents: number;
          quantity: number;
          sold: number;
          enabled: boolean;
          listing_status: "On Sale" | "Sold Out" | "Paused";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          tier_name: string;
          price_cents?: number;
          quantity?: number;
          sold?: number;
          enabled?: boolean;
          listing_status?: "On Sale" | "Sold Out" | "Paused";
        };
        Update: {
          tier_name?: string;
          price_cents?: number;
          quantity?: number;
          sold?: number;
          enabled?: boolean;
          listing_status?: "On Sale" | "Sold Out" | "Paused";
        };
      };
      issued_tickets: {
        Row: {
          id: string;
          tier_id: string;
          booking_code: string;
          buyer_name: string;
          buyer_email: string;
          qr_payload: string;
          checked_in_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tier_id: string;
          booking_code: string;
          buyer_name: string;
          buyer_email: string;
          qr_payload: string;
          checked_in_at?: string | null;
        };
        Update: {
          checked_in_at?: string | null;
        };
      };
      organizer_subscriptions: {
        Row: {
          id: string;
          subscriber_id: string;
          organizer_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscriber_id: string;
          organizer_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      attendee_event_grants: {
        Row: {
          id: string;
          subscriber_id: string;
          event_id: string;
          source: "invite";
          created_at: string;
        };
        Insert: {
          id?: string;
          subscriber_id: string;
          event_id: string;
          source?: "invite";
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      event_invite_tokens: {
        Row: {
          id: string;
          event_id: string;
          token: string;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          token: string;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          expires_at?: string | null;
        };
      };
    };
  };
}
