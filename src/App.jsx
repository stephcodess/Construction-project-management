import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProjectProvider } from './context/ProjectContext'
import { CompanyProvider } from './context/CompanyContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Journal from './pages/Journal'
import Tax from './pages/Tax'
import Team from './pages/Team'
import Documents from './pages/Documents'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import ProjectSummary from './pages/ProjectSummary'
import InvoicePublic from './pages/InvoicePublic'
import Expenses from './pages/Expenses'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F2F8]">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <Routes>
      <Route path="/login"     element={user ? <Navigate to="/projects" replace /> : <Login />} />
      <Route path="/"          element={<Navigate to="/projects" replace />} />
      <Route path="/overview"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/projects"  element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      <Route path="/cashflow"  element={<ProtectedRoute><Journal /></ProtectedRoute>} />
      <Route path="/tax"       element={<ProtectedRoute><Tax /></ProtectedRoute>} />
      <Route path="/team"      element={<ProtectedRoute><Team /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/invoices"  element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/expenses"  element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><ProjectSummary /></ProtectedRoute>} />
      {/* Public routes — no auth required */}
      <Route path="/invoice/:token" element={<InvoicePublic />} />
      {/* Legacy redirects */}
      <Route path="/journal"    element={<Navigate to="/cashflow" replace />} />
      <Route path="/contracts"  element={<Navigate to="/projects" replace />} />
      <Route path="/vat"        element={<Navigate to="/tax" replace />} />
      <Route path="/payroll"    element={<Navigate to="/tax" replace />} />
      <Route path="/compliance" element={<Navigate to="/tax" replace />} />
      <Route path="*"           element={<Navigate to="/projects" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <ProjectProvider>
            <AppRoutes />
          </ProjectProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
