import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const CompanyContext = createContext(null)

const DEFAULTS = {
  name:         'Eldesign Construction',
  tagline:      'Construction & Project Management',
  email:        'info@eldesign.ng',
  phone:        '',
  address:      'Lagos, Nigeria',
  website:      '',
  rc_number:    '',
  tin:          '',
  vat_number:   '',
  bank_name:    'First Bank of Nigeria',
  account_name: 'Eldesign Construction Ltd',
  account_number: '',
  logo_url:     '/unnamed.jpg',
}

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState(DEFAULTS)
  const [loading, setLoading]      = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
    if (data?.[0]) setCompanyState({ ...DEFAULTS, ...data[0] })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveCompany(updates) {
    const merged = { ...company, ...updates }
    setCompanyState(merged)
    // upsert — always row id=1
    const { error } = await supabase
      .from('company_settings')
      .upsert({ id: 1, ...merged }, { onConflict: 'id' })
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
