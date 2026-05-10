import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateName, validatePhone } from '../lib/validation'
import { P2P_PLATFORMS, validateHandle, getHint, getPlaceholder, isHandleDisabled } from '../lib/p2pPlatforms'
import { friendlyError } from '../lib/errors'
import ImportMembersModal from '../components/ImportMembersModal'
import { ArrowLeft, UserPlus, RefreshCw, Pencil, X, Trash2, AlertTriangle, Upload, CheckCircle2 } from 'lucide-react'

const LANG_LABEL = { ht: 'Kreyòl', fr: 'Français', en: 'English' }

// ─── Payment status badge ────────────────────────────────────────────────────
function PaymentBadge({ status }) {
  const map = {
    verified: 'bg-green-100 text-green-700',
    pending:  'bg-amber-100 text-amber-700',
    disputed: 'bg-red-100 text-red-700',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

// ─── Three-step onboarding progress badges ───────────────────────────────────
function MemberStatusBadges({ member }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.invitation_sent_at ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>Invited</span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.accepted_terms    ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>Terms</span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.onboarded         ? 'bg-green-100 text-green-700'  : 'bg-gray-100 text-gray-400'}`}>Onboarded</span>
    </div>
  )
}

// ─── Edit / Delete modal ─────────────────────────────────────────────────────
function EditMemberModal({ member, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    full_name:          member.full_name          ?? '',
    phone_number:       member.phone_number       ?? '',
    preferred_language: member.preferred_language ?? 'ht',
    p2p_platform:       member.p2p_platform       ?? '',
    p2p_handle:         member.p2p_handle         ?? '',
  })
  const [fieldErrors,    setFieldErrors]    = useState({
    full_name:    '',
    phone_number: '',
    p2p_handle:   validateHandle(member.p2p_platform ?? '', member.p2p_handle ?? ''),
  })
  const [saveError,      setSaveError]      = useState('')
  const [saving,         setSaving]         = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)

  function setField(k, v) {
    // Platform change clears handle and its error immediately
    if (k === 'p2p_platform') {
      setForm(f => ({ ...f, p2p_platform: v, p2p_handle: '' }))
      setFieldErrors(e => ({ ...e, p2p_handle: '' }))
      return
    }
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'full_name')    setFieldErrors(e => ({ ...e, full_name:    validateName(v) }))
    if (k === 'phone_number') setFieldErrors(e => ({ ...e, phone_number: validatePhone(v) }))
    if (k === 'p2p_handle')   setFieldErrors(e => ({ ...e, p2p_handle:   validateHandle(form.p2p_platform, v) }))
  }

  const isValid =
    form.full_name.trim().length >= 2 &&
    form.phone_number.length > 0 &&
    !fieldErrors.full_name &&
    !fieldErrors.phone_number &&
    !fieldErrors.p2p_handle

  async function handleSave() {
    const nameErr  = validateName(form.full_name)
    const phoneErr = validatePhone(form.phone_number)
    if (nameErr || phoneErr) { setFieldErrors({ full_name: nameErr, phone_number: phoneErr }); return }

    setSaveError('')
    setSaving(true)
    const { error: err } = await supabase
      .from('sol_members')
      .update({
        full_name:          form.full_name.trim(),
        phone_number:       form.phone_number,
        preferred_language: form.preferred_language,
        p2p_platform:       form.p2p_platform  || null,
        p2p_handle:         form.p2p_handle    || null,
      })
      .eq('id', member.id)
    setSaving(false)
    if (err) { setSaveError(friendlyError(err)); return }
    onSaved({ ...member, ...form, full_name: form.full_name.trim() })
  }

  async function handleDelete() {
    setDeleting(true)
    const { error: err } = await supabase.from('sol_members').delete().eq('id', member.id)
    setDeleting(false)
    if (err) { setSaveError(err.message); setConfirmDelete(false); return }
    onDeleted(member.id)
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      {/* Panel — stop click from closing when inside */}
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Edit Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          <div>
            <label className={labelCls}>Full Name</label>
            <input
              value={form.full_name}
              onChange={e => setField('full_name', e.target.value)}
              className={inputCls(fieldErrors.full_name)}
              placeholder="Marie Augustin"
            />
            {fieldErrors.full_name && <p className={errCls}>{fieldErrors.full_name}</p>}
          </div>

          <div>
            <label className={labelCls}>WhatsApp Phone Number</label>
            <input
              value={form.phone_number}
              onChange={e => setField('phone_number', e.target.value)}
              className={inputCls(fieldErrors.phone_number)}
              placeholder="+18565038895"
            />
            {fieldErrors.phone_number && <p className={errCls}>{fieldErrors.phone_number}</p>}
          </div>

          <div>
            <label className={labelCls}>Preferred Language</label>
            <select value={form.preferred_language} onChange={e => setField('preferred_language', e.target.value)} className={inputCls('')}>
              <option value="ht">Kreyòl Ayisyen</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>P2P Platform</label>
            <select value={form.p2p_platform} onChange={e => setField('p2p_platform', e.target.value)} className={inputCls('')}>
              {P2P_PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {form.p2p_platform !== '' && (
            <div>
              <label className={labelCls}>
                P2P Handle
                {!isHandleDisabled(form.p2p_platform) && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                value={form.p2p_handle}
                onChange={e => setField('p2p_handle', e.target.value)}
                disabled={isHandleDisabled(form.p2p_platform)}
                placeholder={getPlaceholder(form.p2p_platform)}
                className={`${inputCls(fieldErrors.p2p_handle)} disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`}
              />
              {fieldErrors.p2p_handle
                ? <p className={errCls}>{fieldErrors.p2p_handle}</p>
                : <p className="text-xs text-gray-400 mt-1">{getHint(form.p2p_platform)}</p>
              }
            </div>
          )}

          {saveError && <p className={errCls}>{saveError}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          {confirmDelete ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
                <AlertTriangle size={15} />
                Delete {member.full_name ?? 'this member'}?
              </div>
              <p className="text-xs text-red-600">This cannot be undone. All their payment records will remain for audit purposes.</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
              <button
                onClick={handleSave}
                disabled={!isValid || saving}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group,         setGroup]         = useState(null)
  const [members,       setMembers]       = useState([])
  const [payments,      setPayments]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [editingMember, setEditingMember] = useState(null)
  const [showImport,    setShowImport]    = useState(false)
  const [toast,         setToast]         = useState(null)   // { count, skipped } | null
  const toastTimer                        = useRef(null)

  useEffect(() => {
    async function load() {
      const [{ data: g }, { data: m }, { data: p }] = await Promise.all([
        supabase.from('sol_groups').select('*').eq('id', id).single(),
        supabase.from('sol_members').select('*').eq('group_id', id).order('rotation_position'),
        supabase.from('sol_payments')
          .select('*, sender:sender_id(full_name), recipient:recipient_id(full_name)')
          .eq('group_id', id).order('cycle_number'),
      ])
      setGroup(g)
      setMembers(m ?? [])
      setPayments(p ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  function handleMemberSaved(updated) {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
    setEditingMember(null)
  }

  function handleMemberDeleted(deletedId) {
    setMembers(prev => prev.filter(m => m.id !== deletedId))
    setEditingMember(null)
  }

  async function handleImported(count, skipped) {
    setShowImport(false)
    // Refetch members to get DB-assigned IDs for the imported rows
    const { data } = await supabase
      .from('sol_members').select('*').eq('group_id', id).order('rotation_position')
    setMembers(data ?? [])
    // Show toast and auto-dismiss after 6 s
    clearTimeout(toastTimer.current)
    setToast({ count, skipped })
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!group)  return <p className="text-sm text-red-500">Group not found.</p>

  const currentPayments = payments.filter(p => p.cycle_number === group.current_cycle)

  return (
    <>
      <div className="space-y-8 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-700">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
              <p className="text-sm text-gray-500">${group.contribution_amount} · {group.frequency} · Cycle {group.current_cycle}/{group.total_cycles}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 border border-gray-300 hover:border-brand-400 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload size={15} /> Import Members
            </button>
            <Link to={`/groups/${id}/members/add`}
              className="flex items-center gap-2 border border-gray-300 hover:border-brand-400 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <UserPlus size={15} /> Add Member
            </Link>
            <Link to={`/groups/${id}/cycle`}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw size={15} /> Advance Cycle
            </Link>
          </div>
        </div>

        {/* Rotation timeline */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Rotation Timeline</h2>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: group.total_cycles }, (_, i) => i + 1).map(cycle => {
              const member    = members.find(m => m.rotation_position === cycle)
              const isCurrent = cycle === group.current_cycle
              const isPast    = cycle < group.current_cycle
              return (
                <div key={cycle}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs font-medium min-w-[72px] text-center
                    ${isCurrent ? 'border-brand-500 bg-brand-50 text-brand-700' :
                      isPast    ? 'border-gray-200 bg-gray-50 text-gray-400' :
                                  'border-gray-200 text-gray-600'}`}>
                  <span className="font-bold">#{cycle}</span>
                  <span className="mt-0.5 truncate max-w-[64px]">{member?.full_name?.split(' ')[0] ?? '—'}</span>
                  {isCurrent && <span className="mt-1 text-[10px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full">Current</span>}
                  {isPast     && <span className="mt-1 text-[10px]">Done</span>}
                </div>
              )
            })}
          </div>
        </section>

        {/* Members table */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Members</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['#', 'Name', 'Phone', 'Language', 'Platform', 'Progress', ''].map((h, i) => (
                    <th key={i} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map(m => (
                  <tr key={m.id} className={m.rotation_position === group.current_cycle ? 'bg-brand-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-700">{m.rotation_position}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{m.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.phone_number}</td>
                    <td className="px-4 py-3 text-gray-500">{LANG_LABEL[m.preferred_language] ?? m.preferred_language}</td>
                    <td className="px-4 py-3 text-gray-500">{m.p2p_platform ? `${m.p2p_platform} ${m.p2p_handle ?? ''}` : '—'}</td>
                    <td className="px-4 py-3"><MemberStatusBadges member={m} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingMember(m)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Edit member"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Current cycle payments */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Cycle {group.current_cycle} Payments</h2>
          {currentPayments.length === 0 ? (
            <p className="text-sm text-gray-400">No payment records yet for this cycle.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Sender', 'Recipient', 'Amount', 'Status'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentPayments.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">{p.sender?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">{p.recipient?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">${p.amount}</td>
                      <td className="px-4 py-3"><PaymentBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>

      {/* Edit modal */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={handleMemberSaved}
          onDeleted={handleMemberDeleted}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportMembersModal
          groupId={id}
          existingPhones={members.map(m => m.phone_number)}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-white border border-gray-200 shadow-lg rounded-xl px-5 py-4 max-w-sm">
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-gray-900">
              {toast.count} member{toast.count !== 1 ? 's' : ''} imported successfully
            </p>
            {toast.skipped > 0 && (
              <p className="text-gray-500 mt-0.5">
                {toast.skipped} row{toast.skipped !== 1 ? 's' : ''} skipped due to validation errors
              </p>
            )}
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  )
}

const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const errCls   = 'text-xs text-red-600 mt-1'

function inputCls(err) {
  return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
    err ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-brand-500'
  }`
}
