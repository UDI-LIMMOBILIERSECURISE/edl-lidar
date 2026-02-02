import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Client côté navigateur
export const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Client côté serveur (API routes, Server Components)
export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient<Database>(supabaseUrl, supabaseServiceKey)
}

// Singleton pour le client navigateur
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export const getSupabase = () => {
  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}
