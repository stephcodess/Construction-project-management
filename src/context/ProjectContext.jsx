import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
  const [activeProject, setActiveProjectState] = useState(null)
  const [hydrating, setHydrating] = useState(true)

  // On mount, restore the last active project from sessionStorage
  useEffect(() => {
    async function restore() {
      try {
        const stored = sessionStorage.getItem('active_project_id')
        if (stored) {
          const { data } = await supabase.from('projects').select('*').eq('id', stored).single()
          if (data) setActiveProjectState(data)
        }
      } catch {}
      setHydrating(false)
    }
    restore()
  }, [])

  function setActiveProject(project) {
    setActiveProjectState(project)
    try {
      if (project) sessionStorage.setItem('active_project_id', project.id)
      else sessionStorage.removeItem('active_project_id')
    } catch {}
  }

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject, hydrating }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  return useContext(ProjectContext)
}
