import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public by design: the anon/publishable key only allows what the row-level security rules in
// supabase/schema.sql allow (visitors read public rows; only the owner can write).
const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

let browserClient: SupabaseClient | undefined;
let anonClient: SupabaseClient | undefined;

/** signed-in client for /studio (keeps the session in the browser) */
export function studioClient(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Supabase is not configured');
  return (browserClient ??= createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } }));
}

/** anonymous client for public pages: sees only public / published rows */
export function publicClient(): SupabaseClient | undefined {
  if (!supabaseConfigured) return undefined;
  return (anonClient ??= createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } }));
}
