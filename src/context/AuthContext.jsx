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

  // Create account + organisation in one flow
  async function signUp({ email, password, fullName, orgName }) {
    // 1. Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error }

    const userId = data?.user?.id
    if (!userId) return { error: new Error('Signup failed — no user ID returned.') }

    // 2. Create organisation
    const { data: orgData, error: orgErr } = await supabase
      .from('organisations')
      .insert({ name: orgName })
      .select()
      .single()
    if (orgErr) return { error: orgErr }

    // 3. Create profile as admin of this org
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        email,
        role: 'admin',
        organisation_id: orgData.id,
      }, { onConflict: 'id' })
    if (profileErr) return { error: profileErr }

    // 4. Create company_settings row for the org
    await supabase
      .from('company_settings')
      .insert({ organisation_id: orgData.id, name: orgName })

    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, organisation, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
