import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [organisation, setOrganisation] = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setOrganisation(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, attempt = 0) {
    const { data } = await supabase
      .from('profiles')
      .select('*, organisations(*)')
      .eq('id', userId)
      .single()

    // Trigger may not have fired yet — retry up to 3 times with backoff
    if (!data && attempt < 3) {
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
      return fetchProfile(userId, attempt + 1)
    }

    setProfile(data ?? null)
    setOrganisation(data?.organisations ?? null)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // Create auth user — the handle_new_user trigger creates the profile automatically
  async function signUp({ email, password, fullName }) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'admin' } },
    })
    return { error: error ?? null }
  }

  // Called from Onboarding — calls a security-definer RPC that bypasses RLS
  async function completeOnboarding({ orgName, companyDetails }) {
    if (!user) return { error: new Error('Not authenticated') }

    const { error } = await supabase.rpc('create_organisation', {
      org_name:       orgName,
      p_email:        companyDetails.email        || null,
      p_phone:        companyDetails.phone        || null,
      p_address:      companyDetails.address      || null,
      p_rc_number:    companyDetails.rc_number    || null,
      p_tin:          companyDetails.tin          || null,
      p_bank_name:    companyDetails.bank_name    || null,
      p_account_name: companyDetails.account_name || null,
      p_account_number: companyDetails.account_number || null,
    })
    if (error) return { error }

    // Refresh profile so the rest of the app sees organisation_id
    await fetchProfile(user.id)
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, organisation, loading, signIn, signUp, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
