import { createClient } from '@supabase/supabase-js'

// Vercel environment values can accidentally contain the next variable when
// several KEY=VALUE lines are pasted into one field. Keep the first non-empty
// line so a valid Supabase key still works, while preventing a newline from
// reaching the browser's Headers implementation.
const cleanEnvValue = (value: unknown) => {
  if (typeof value !== 'string') return ''
  const firstLine = value.split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
  return firstLine.replace(/^['"]|['"]$/g, '').trim()
}

const getCleanEnv = (viteVal: unknown, nodeKey: string): string => {
  const fromVite = cleanEnvValue(viteVal)
  if (fromVite) return fromVite
  const g = typeof globalThis !== 'undefined' ? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }) : undefined
  const fromNode = g?.process?.env?.[nodeKey]
  if (typeof fromNode === 'string') {
    return cleanEnvValue(fromNode)
  }
  return ''
}

const supabaseUrl =
  getCleanEnv(import.meta.env?.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL') ||
  getCleanEnv(import.meta.env?.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')

const supabaseAnonKey =
  getCleanEnv(import.meta.env?.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY') ||
  getCleanEnv(import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
  getCleanEnv(import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key'
