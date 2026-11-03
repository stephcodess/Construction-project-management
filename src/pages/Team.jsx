import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, X, Users, Shield, UserCheck, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import Pagination, { usePagination } from '../components/Pagination'

// ── Helpers ───────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 border-2 border-transparent focus:outline-none transition"
      onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
      onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
    />
  )
}

function SelectInput({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 border-2 border-transparent focus:outline-none transition"
      onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
      onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
    >
      {children}
    </select>
  )
}

const ROLE_OPTIONS = ['staff', 'accountant', 'admin']

function roleBadge(role) {
  if (role === 'admin')
    return { bg: '#CC0000', color: 'white', label: 'Admin' }
  if (role === 'accountant')
    return { bg: '#1C1C1C', color: 'white', label: 'Accountant' }
  return { bg: '#E5E5E5', color: '#1C1C1C', label: 'Staff' }
}

function avatarColor(role) {
  if (role === 'admin') return '#CC0000'
  if (role === 'accountant') return '#1C1C1C'
  return '#888888'
}

function getInitial(name) {
  if (!name) return '?'
  return name.trim()[0].toUpperCase()
}

// ── Invite Member Modal ───────────────────────────────────────
function InviteModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'staff', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError('')
    setSaving(true)

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name },
        },
      })

      if (signUpErr) throw signUpErr

      const userId = data?.user?.id
      if (userId) {
        const { error: profileErr } = await supabase.from('profiles').insert([{
          id: userId,
          full_name: form.full_name,
          role: form.role,
          email: form.email,
        }])
        if (profileErr && profileErr.code !== '23505') {
          // ignore duplicate key (profile may already exist from trigger)
          console.warn('Profile insert note:', profileErr.message)
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err?.message ?? 'An error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Dark gradient header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #1C1C1C, #2E2E2E)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#CC0000' }}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-black text-white">Invite Team Member</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info note */}
          <div className="rounded-xl px-4 py-3 text-xs text-gray-500 border flex items-start gap-2"
            style={{ background: '#F9FAFB', borderColor: '#E5E5E5' }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#CC0000' }} />
            <span>
              After creating the account, the user will receive an invitation email.
              Alternatively, create the user in the Supabase dashboard and they will appear here automatically.
            </span>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm border"
              style={{ background: '#FFF0F0', borderColor: '#CC0000', color: '#CC0000' }}>
              {error}
            </div>
          )}

          <Field label="Full Name *">
            <Input
              type="text"
              required
              placeholder="e.g. Amara Okafor"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
            />
          </Field>

          <Field label="Email *">
            <Input
              type="email"
              required
              placeholder="user@example.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </Field>

          <Field label="Role">
            <SelectInput value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="staff">Staff</option>
              <option value="accountant">Accountant</option>
              <option value="admin">Admin</option>
            </SelectInput>
          </Field>

          <Field label="Temporary Password *">
            <Input
              type="text"
              required
              minLength={8}
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={e => set('password', e.target.value)}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 text-white px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-60 transition"
              style={{ background: '#CC0000' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#CC0000' }}
            >
              {saving ? 'Creating…' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border-2 px-5 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Members Table Row ─────────────────────────────────────────
function MemberRow({ member, currentUserId, isAdmin, onRoleChange, onRemove }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [roleChanging, setRoleChanging] = useState(false)
  const isSelf = member.id === currentUserId
  const badge = roleBadge(member.role)

  async function handleRoleChange(newRole) {
    if (newRole === member.role) return
    setRoleChanging(true)
    await supabase.from('profiles').update({ role: newRole }).eq('id', member.id)
    setRoleChanging(false)
    onRoleChange()
  }

  async function handleRemove() {
    setRemoving(true)
    await supabase.from('profiles').delete().eq('id', member.id)
    setRemoving(false)
    setConfirmRemove(false)
    onRemove()
  }

  const joinedDate = member.created_at
    ? (() => { try { return format(new Date(member.created_at), 'dd MMM yyyy') } catch { return '—' } })()
    : '—'

  return (
    <tr className="hover:bg-gray-50/60 transition-colors">
      {/* Avatar */}
      <td className="px-5 py-3.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
          style={{ background: avatarColor(member.role) }}
        >
          {getInitial(member.full_name)}
        </div>
      </td>

      {/* Name */}
      <td className="px-5 py-3.5 font-bold" style={{ color: '#1C1C1C' }}>
        {member.full_name || '—'}
        {isSelf && (
          <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>
        )}
      </td>

      {/* Email */}
      <td className="px-5 py-3.5 text-gray-500 text-sm">
        {member.email || '—'}
      </td>

      {/* Role badge */}
      <td className="px-5 py-3.5">
        <span
          className="px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.label}
        </span>
      </td>

      {/* Joined */}
      <td className="px-5 py-3.5 text-gray-400 text-sm whitespace-nowrap">
        {joinedDate}
      </td>

      {/* Actions */}
      <td className="px-5 py-3.5">
        {isAdmin && !isSelf ? (
          <div className="flex items-center gap-2">
            {/* Role change dropdown */}
            <select
              value={member.role}
              disabled={roleChanging}
              onChange={e => handleRoleChange(e.target.value)}
              className="bg-gray-50 border-2 border-transparent rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none transition disabled:opacity-50 cursor-pointer"
              onFocus={e => e.currentTarget.style.borderColor = '#CC0000'}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>

            {/* Remove / confirm */}
            {confirmRemove ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-60"
                  style={{ background: '#CC0000' }}
                >
                  {removing ? '…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 hover:bg-gray-50 transition"
                  style={{ borderColor: '#E5E5E5', color: '#1C1C1C' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="p-1.5 rounded-lg transition hover:bg-red-50 text-gray-400 hover:text-red-600"
                title="Remove member"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <span className="text-gray-200 text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Team() {
  const { profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [removeWarning, setRemoveWarning] = useState(false)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (isAdmin) loadMembers()
    else setLoading(false)
  }, [isAdmin])

  async function loadMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    setMembers(data ?? [])
    setLoading(false)
  }

  // KPI counts
  const totalMembers = members.length
  const adminCount = useMemo(() => members.filter(m => m.role === 'admin').length, [members])
  const staffCount = useMemo(() => members.filter(m => m.role === 'staff' || m.role === 'accountant').length, [members])

  // Pagination
  const { page: mPage, setPage: setMPage, totalPages: mTotalPages, paginated: mPaginated, total: mTotal } = usePagination(members, 10)

  // ── Access Denied ─────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: '#FFF0F0' }}
          >
            <Shield className="w-8 h-8" style={{ color: '#CC0000' }} />
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: '#1C1C1C' }}>Access Denied</h2>
          <p className="text-sm text-gray-400">
            You don't have permission to view this page. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#CC0000' }}>
            Organisation
          </p>
          <h2 className="text-2xl font-black" style={{ color: '#1C1C1C' }}>Team</h2>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
          style={{ background: '#CC0000' }}
          onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
          onMouseLeave={e => e.currentTarget.style.background = '#CC0000'}
        >
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Members */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Total Members</p>
            <p className="text-3xl font-black" style={{ color: '#1C1C1C' }}>
              {loading ? '—' : totalMembers}
            </p>
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: '#FFF0F0' }}
          >
            <Users className="w-5 h-5" style={{ color: '#CC0000' }} />
          </div>
        </div>

        {/* Admins */}
        <div className="rounded-2xl shadow-sm p-5 flex items-center justify-between" style={{ background: '#1C1C1C' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Admins</p>
            <p className="text-3xl font-black text-white">
              {loading ? '—' : adminCount}
            </p>
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <Shield className="w-5 h-5 text-white/60" />
          </div>
        </div>

        {/* Staff */}
        <div className="rounded-2xl shadow-sm p-5 flex items-center justify-between" style={{ background: '#CC0000' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Staff</p>
            <p className="text-3xl font-black text-white">
              {loading ? '—' : staffCount}
            </p>
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <UserCheck className="w-5 h-5 text-white/70" />
          </div>
        </div>
      </div>

      {/* Remove warning banner (shown after first removal) */}
      {removeWarning && (
        <div
          className="flex items-start gap-3 rounded-xl px-5 py-4 border text-sm"
          style={{ background: '#FFF8E1', borderColor: '#FFB300', color: '#7A5200' }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#FF9800' }} />
          <div>
            <strong>Note:</strong> This only removes the profile record.
            To fully revoke access, also delete the user in the{' '}
            <strong>Supabase Auth dashboard</strong>.
          </div>
          <button
            onClick={() => setRemoveWarning(false)}
            className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <h3 className="font-bold text-gray-900">Members</h3>
          <span className="text-xs text-gray-400 font-medium">
            {loading ? 'Loading…' : `${totalMembers} member${totalMembers !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9FAFB' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                <th className="px-5 py-3.5 font-semibold text-left w-12"></th>
                <th className="px-5 py-3.5 font-semibold text-left">Name</th>
                <th className="px-5 py-3.5 font-semibold text-left">Email</th>
                <th className="px-5 py-3.5 font-semibold text-left">Role</th>
                <th className="px-5 py-3.5 font-semibold text-left">Joined</th>
                <th className="px-5 py-3.5 font-semibold text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                    Loading members…
                  </td>
                </tr>
              )}
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                      style={{ background: '#F5F5F5' }}
                    >
                      <Users className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium">No team members yet.</p>
                    <p className="text-xs mt-1 text-gray-300">Invite someone to get started.</p>
                  </td>
                </tr>
              )}
              {!loading && mPaginated.map(member => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentUserId={profile?.id}
                  isAdmin={isAdmin}
                  onRoleChange={loadMembers}
                  onRemove={() => {
                    setRemoveWarning(true)
                    loadMembers()
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-4">
          <Pagination page={mPage} totalPages={mTotalPages} total={mTotal} pageSize={10} onPageChange={setMPage} />
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSaved={loadMembers}
        />
      )}
    </div>
  )
}
