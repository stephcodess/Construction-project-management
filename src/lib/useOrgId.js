import { useAuth } from '../context/AuthContext'

// Returns the current user's organisation_id — use this in every insert/upsert
export function useOrgId() {
  const { profile } = useAuth()
  return profile?.organisation_id ?? null
}
