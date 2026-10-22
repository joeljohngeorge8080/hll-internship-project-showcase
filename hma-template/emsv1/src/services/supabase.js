import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// createClient() throws synchronously (e.g. "supabaseKey is required.") when
// either value is missing, and it does so at module-evaluation time — before
// React has mounted anything — so no error boundary further down the tree
// can ever catch it; the whole app renders blank instead. Fall back to a
// placeholder so the client can always be constructed; anything that
// actually talks to Supabase already has its own error handling (falling
// back to the local/offline data path) and will surface a real error there.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
      'The app will still render, but anything that talks to Supabase will fail until this is set.',
  )
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)

export default supabase
