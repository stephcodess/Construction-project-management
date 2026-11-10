import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, X, Users, Shield, UserCheck, AlertTriangle, Mail, Copy, Check, Clock } from 'lucide-react'
import { format } from 'date-fns'
import Pagination, { usePagination } from '../components/Pagination'

const RED  = '#CC0000'
const DARK = '#1C1C1C'

const ROLES = ['staff', 'accountant', 'admin']

function roleBadge(role) {
  if (role === 'admin')      return { bg: RED,     color: 'white',   label: 'Admin' }
  if (role === 'accountant') return { bg: DARK,    color: 'white',   label: 'Accountant' }
  return                            { bg: '#E5E5E5', color: DARK,     label: 'Staff' }
}

function avatarColor(role) {
  if (role === 'admin')      return RED
  if (role === 'accountant') return DARK
  return '#888888'
}

function getInitial(name) {
  return name?.trim()[0]?.toUpperCase() ?? '?'
}

// ── Invite Modal ──────────────────────────────────────────────
function InviteModal({ orgId, orgName, onClose, onSaved }) {
  const { profile } = useAuth()
  const [form,    setForm]    = useState({ email: '', role: 'staff' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied,  setCopied]  = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    // Check for existing pending invite for this email+org
    await supabase
      .from('organisation_invites')
      .delete()
      .eq('organisation_id', orgId)
      .eq('email', form.email)
      .is('accepted_at', null)

    const { data, error: invErr } = await supabase
      .from('organisation_invites')
      .insert({
        organisation_id: orgId,
        email: form.email,
        role: form.role,
        invited_by: profile?.id,
      })
      .select()
      .single()

    if (invErr) { setError(invErr.message); setSaving(false); return }

    const link = `${window.location.origin}/invite/${data.token}`
    setInviteLink(link)
    setSaving(false)
    onSaved()
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #1C1C1C, #2E2E2E)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: RED }}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-black text-white">Invite Team Member</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {inviteLink ? (
          /* ── Success: show invite link ── */
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F0FDF4' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#DCFCE7' }}>
                <Check className="w-4 h-4" style={{ color: '#16A34A' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: DARK }}>Invite created!</p>
                <p className="text-xs text-gray-500">Send this link to <strong>{form.email}</strong></p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500">Invite Link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-xs font-mono text-gray-700 truncate border" style={{ borderColor: '#E5E5E5' }}>
                  {inviteLink}
                </div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-bold text-white transition shrink-0"
                  style={{ background: copied ? '#16A34A' : RED }}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Link expires in 7 days. The invitee will set their own password.
            </p>

            <button
              onClick={onClose}
              className="w-full border-2 px-5 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              style={{ borderColor: '#E5E5E5', color: DARK }}
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="rounded-xl px-4 py-3 text-xs text-gray-500 border flex items-start gap-2"
              style={{ background: '#F9FAFB', borderColor: '#E5E5E5' }}>
              <Mail className="w-4 h-4 shrink-0 mt-0.5" style={{ color: RED }} />
              <span>
                An invite link will be generated. Send it to your colleague — they'll create their own password when they join.
              </span>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: '#FFF0F0', borderColor: RED, color: RED }}>
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500">Email Address *</label>
              <input
                type="email"
                required
                placeholder="colleague@company.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 border-2 border-transparent focus:outline-none transition"
                onFocus={e => e.currentTarget.style.borderColor = RED}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500">Role</label>
              <select
                value={form.role}
                onChange={e => set('role', e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 border-2 border-transparent focus:outline-none transition"
                onFocus={e => e.currentTarget.style.borderColor = RED}
                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 text-white px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-60 transition"
                style={{ background: RED }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#AA0000' }}
                onMouseLeave={e => { if (!saving) e.currentTarget.style.background = RED }}
              >
                {saving ? 'Generating…' : 'Generate Invite Link'}
              </button>
              <button type="button" onClick={onClose}
                className="border-2 px-5 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
                style={{ borderColor: '#E5E5E5', color: DARK }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Pending Invites Row ───────────────────────────────────────
function InviteRow({ invite, onRevoke }) {
  const [revoking, setRevoking] = useState(false)
  const [copied,   setCopied]   = useState(false)
  const badge = roleBadge(invite.role)
  const link  = `${window.location.origin}/invite/${invite.token}`

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevoke() {
    setRevoking(true)
    await supabase.from('organisation_invites').delete().eq('id', invite.id)
    setRevoking(false)
    onRevoke()
  }

  return (
    <tr className="hover:bg-gray-50/60 transition-colors">
      <td className="px-5 py-3.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0" style={{ background: '#D1D5DB' }}>
          <Mail className="w-4 h-4 text-gray-500" />
        </div>
      </td>
      <td className="px-5 py-3.5 font-bold text-gray-500 italic">{invite.email}</td>
      <td className="px-5 py-3.5">
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: '#FEF9C3', color: '#A16207' }}>
          <Clock className="w-3 h-3" /> Pending
        </span>
      </td>
      <td className="px-5 py-3.5 text-gray-400 text-sm whitespace-nowrap">
        {invite.expires_at ? format(new Date(invite.expires_at), 'dd MMM yyyy') : '—'}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white transition"
            style={{ background: copied ? '#16A34A' : DARK }}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button onClick={handleRevoke} disabled={revoking}
            className="p-1.5 rounded-lg transition hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
            title="Revoke invite">
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Member Row ────────────────────────────────────────────────
function MemberRow({ member, currentUserId, isAdmin, onRoleChange, onRemove }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing,      setRemoving]      = useState(false)
  const [roleChanging,  setRoleChanging]  = useState(false)
  const isSelf = member.id === currentUserId
  const badge  = roleBadge(member.role)

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

  return (
    <tr className="hover:bg-gray-50/60 transition-colors">
      <td className="px-5 py-3.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
          style={{ background: avatarColor(member.role) }}>
          {getInitial(member.full_name)}
        </div>
      </td>
      <td className="px-5 py-3.5 font-bold" style={{ color: DARK }}>
        {member.full_name || '—'}
        {isSelf && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}
      </td>
      <td className="px-5 py-3.5 text-gray-500 text-sm">{member.email || '—'}</td>
      <td className="px-5 py-3.5">
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: '#DCFCE7', color: '#16A34A' }}>
          <Check className="w-3 h-3" /> Active
        </span>
      </td>
      <td className="px-5 py-3.5 text-gray-400 text-sm whitespace-nowrap">
        {member.created_at ? format(new Date(member.created_at), 'dd MMM yyyy') : '—'}
      </td>
      <td className="px-5 py-3.5">
        {isAdmin && !isSelf ? (
          <div className="flex items-center gap-2">
            <select
              value={member.role}
              disabled={roleChanging}
              onChange={e => handleRoleChange(e.target.value)}
              className="bg-gray-50 border-2 border-transparent rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none transition disabled:opacity-50 cursor-pointer"
              onFocus={e => e.currentTarget.style.borderColor = RED}
              onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
            >
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            {confirmRemove ? (
              <div className="flex items-center gap-1.5">
                <button onClick={handleRemove} disabled={removing}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-60"
                  style={{ background: RED }}>
                  {removing ? '…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmRemove(false)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 hover:bg-gray-50 transition"
                  style={{ borderColor: '#E5E5E5', color: DARK }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmRemove(true)}
                className="p-1.5 rounded-lg transition hover:bg-red-50 text-gray-400 hover:text-red-600"
                title="Remove member">
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
  const { profile, organisation } = useAuth()
  const [members,  setMembers]  = useState([])
  const [invites,  setInvites]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (isAdmin) loadAll()
    else setLoading(false)
  }, [isAdmin])

  async function loadAll() {
    setLoading(true)
    const [membersRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('organisation_id', organisation?.id).order('created_at'),
      supabase.from('organisation_invites').select('*').eq('organisation_id', organisation?.id).is('accepted_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ])
    setMembers(membersRes.data ?? [])
    setInvites(invitesRes.data ?? [])
    setLoading(false)
  }

  const adminCount = useMemo(() => members.filter(m => m.role === 'admin').length, [members])
  const staffCount = useMemo(() => members.filter(m => m.role !== 'admin').length, [members])

  const { page: mPage, setPage: setMPage, totalPages: mTotalPages, paginated: mPaginated, total: mTotal } = usePagination(members, 10)

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#FFF0F0' }}>
            <Shield className="w-8 h-8" style={{ color: RED }} />
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: DARK }}>Access Denied</h2>
          <p className="text-sm text-gray-400">Only admins can manage team members.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: RED }}>Organisation</p>
          <h2 className="text-2xl font-black" style={{ color: DARK }}>
            Team
            {organisation?.name && (
              <span className="ml-2 text-sm font-semibold text-gray-400">— {organisation.name}</span>
            )}
          </h2>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
          style={{ background: RED }}
          onMouseEnter={e => e.currentTarget.style.background = '#AA0000'}
          onMouseLeave={e => e.currentTarget.style.background = RED}
        >
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between" style={{ border: '1px solid #EBEBEB' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Total Members</p>
            <p className="text-3xl font-black" style={{ color: DARK }}>{loading ? '—' : members.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#FFF0F0' }}>
            <Users className="w-5 h-5" style={{ color: RED }} />
          </div>
        </div>
        <div className="rounded-2xl shadow-sm p-5 flex items-center justify-between" style={{ background: DARK }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Admins</p>
            <p className="text-3xl font-black text-white">{loading ? '—' : adminCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <Shield className="w-5 h-5 text-white/60" />
          </div>
        </div>
        <div className="rounded-2xl shadow-sm p-5 flex items-center justify-between" style={{ background: RED }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Staff</p>
            <p className="text-3xl font-black text-white">{loading ? '—' : staffCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <UserCheck className="w-5 h-5 text-white/70" />
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
          <h3 className="font-bold text-gray-900">Active Members</h3>
          <span className="text-xs text-gray-400 font-medium">{loading ? 'Loading…' : `${members.length} member${members.length !== 1 ? 's' : ''}`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#F9FAFB' }}>
              <tr className="text-xs text-gray-400 uppercase tracking-widest">
                <th className="px-5 py-3.5 font-semibold text-left w-12"></th>
                <th className="px-5 py-3.5 font-semibold text-left">Name</th>
                <th className="px-5 py-3.5 font-semibold text-left">Email</th>
                <th className="px-5 py-3.5 font-semibold text-left">Role</th>
                <th className="px-5 py-3.5 font-semibold text-left">Status</th>
                <th className="px-5 py-3.5 font-semibold text-left">Joined</th>
                <th className="px-5 py-3.5 font-semibold text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Loading members…</td></tr>
              )}
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: '#F5F5F5' }}>
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
                  onRoleChange={loadAll}
                  onRemove={loadAll}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-4">
          <Pagination page={mPage} totalPages={mTotalPages} total={mTotal} pageSize={10} onPageChange={setMPage} />
        </div>
      </div>

      {/* Pending Invites Table */}
      {invites.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#F0F0F0' }}>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Pending Invites</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#FEF9C3', color: '#A16207' }}>
                {invites.length}
              </span>
            </div>
            <span className="text-xs text-gray-400 font-medium">Awaiting acceptance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F9FAFB' }}>
                <tr className="text-xs text-gray-400 uppercase tracking-widest">
                  <th className="px-5 py-3.5 font-semibold text-left w-12"></th>
                  <th className="px-5 py-3.5 font-semibold text-left">Email</th>
                  <th className="px-5 py-3.5 font-semibold text-left">Role</th>
                  <th className="px-5 py-3.5 font-semibold text-left">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-left">Expires</th>
                  <th className="px-5 py-3.5 font-semibold text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invites.map(invite => (
                  <InviteRow key={invite.id} invite={invite} onRevoke={loadAll} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          orgId={organisation?.id}
          orgName={organisation?.name}
          onClose={() => setShowInvite(false)}
          onSaved={loadAll}
        />
      )}
    </div>
  )
}
