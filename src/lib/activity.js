import { supabase } from './supabase'

// Log an activity event. Fire-and-forget — never throws.
export async function logActivity({ action, entity_type, entity_id = null, entity_name = null, meta = null }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_log').insert([{
      user_id:     user?.id ?? null,
      action,
      entity_type,
      entity_id,
      entity_name,
      meta,
    }])
  } catch {}
}
