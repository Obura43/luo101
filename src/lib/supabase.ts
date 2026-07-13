declare const process: {
  env?: Record<string, string | undefined>;
};

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env?.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'anon-key', {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});
