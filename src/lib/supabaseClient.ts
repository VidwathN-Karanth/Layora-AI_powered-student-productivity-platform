import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  supabaseUrl.length > 0 && 
  supabaseUrl !== 'your-supabase-url' && 
  supabaseAnonKey.length > 0 && 
  supabaseAnonKey !== 'your-supabase-anon-key';

// Initialize the real supabase client only if configured.
// This prevents errors on initial build/deploy if env variables aren't set yet.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables are missing. The productivity app will run in "Local Demo Mode" using Zustand state & localStorage persistence.'
  );
}
