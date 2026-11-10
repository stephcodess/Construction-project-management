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

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*, organisations(*)')
      .eq('id', userId)
      .single()
    setProfile(data)
    setOrganisation(data?.organisations ?? null)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // Create auth user + bare profile (org created during onboarding)
  async function signUp({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error }

    const userId = data?.user?.id
    if (!userId) return { error: null } // email confirmation required, no id yet

    // Create bare profile — no org yet, assigned during onboarding
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      email,
      role: 'admin',
    }, { onConflict: 'id' })

    return { error: null }
  }

  // Called from Onboarding — creates org, links profile, creates company_settings
  async function completeOnboarding({ orgName, companyDetails }) {
    if (!user) return { error: new Error('Not authenticated') }

    const { data: orgData, error: orgErr } = await supabase
      .from('organisations')
      .insert({ name: orgName })
      .select()
      .single()
    if (orgErr) return { error: orgErr }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ organisation_id: orgData.id })
      .eq('id', user.id)
    if (profileErr) return { error: profileErr }

    await supabase.from('company_settings').insert({
      organisation_id: orgData.id,
      name: orgName,
      ...companyDetails,
    })

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
