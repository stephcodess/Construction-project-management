import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const CompanyContext = createContext(null)

const DEFAULTS = {
  name:           'My Company',
  tagline:        'Construction & Project Management',
  email:          '',
  phone:          '',
  address:        '',
  website:        '',
  rc_number:      '',
  tin:            '',
  vat_number:     '',
  bank_name:      '',
  account_name:   '',
  account_number: '',
  logo_url:       '/unnamed.jpg',
  payment_terms:  'Payment due within 30 days of invoice date.',
  invoice_notes:  '',
}

export function CompanyProvider({ children }) {
  const { organisation } = useAuth()
  const [company, setCompanyState] = useState(DEFAULTS)
  const [loading, setLoading]      = useState(true)

  const load = useCallback(async () => {
    if (!organisation?.id) { setLoading(false); return }
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('organisation_id', organisation.id)
      .single()
    if (data) setCompanyState({ ...DEFAULTS, ...data })
    setLoading(false)
  }, [organisation?.id])

  useEffect(() => { load() }, [load])

  async function saveCompany(updates) {
    if (!organisation?.id) throw new Error('No organisation')
    const merged = { ...company, ...updates }
    setCompanyState(merged)
    const { error } = await supabase
      .from('company_settings')
      .upsert(
        { ...merged, organisation_id: organisation.id },
        { onConflict: 'organisation_id' }
      )
    if (error) throw error
  }

  return (
    <CompanyContext.Provider value={{ company, loading, saveCompany, reload: load }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  return useContext(CompanyContext)
}
