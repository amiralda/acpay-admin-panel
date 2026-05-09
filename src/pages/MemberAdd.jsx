import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft } from 'lucide-react'

const N8N_WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK_URL

export default function MemberAdd() {
  const { id: groupId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name:         '',
    phone_number:      '',
    preferred_language:'ht',
    rotation_position: '',
  })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const phone = form.phone_number.startsWith('+') ? form.phone_number : '+' + form.phone_number

    const invitationSentAt = new Date().toISOString()

    const { data: member, error: insertErr } = await supabase
      .from('sol_members')
      .insert({
        group_id:            groupId,
        full_name:           form.full_name,
        phone_number:        phone,
        preferred_language:  form.preferred_language,
        rotation_position:   parseInt(form.rotation_position, 10),
        onboarded:           false,
        onboarding_step:     0,
        accepted_terms:      false,
        invitation_sent_at:  invitationSentAt,
      })
      .select()
      .single()

    if (insertErr) {
      setLoading(false)
      setError(insertErr.message)
      return
    }

    // Fetch group details for the full webhook payload
    const { data: group } = await supabase
      .from('sol_groups')
      .select('name, contribution_amount, frequency, total_cycles')
      .eq('id', groupId)
      .single()

    // Trigger n8n T&C invitation via Sarah
    try {
      await fetch(N8N_WEBHOOK, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id:           member.id,
          phone_number:        phone,
          full_name:           form.full_name,
          preferred_language:  form.preferred_language,
          group_name:          group?.name ?? '',
          contribution_amount: group?.contribution_amount ?? 0,
          frequency:           group?.frequency ?? '',
          rotation_position:   parseInt(form.rotation_position, 10),
          total_cycles:        group?.total_cycles ?? 0,
          terms_url:           'https://acpay.net/terms',
        }),
      })
    } catch (_) {
      // webhook failure is non-fatal — member is already in DB
    }

    setLoading(false)
    navigate(`/groups/${groupId}`)
  }

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={15} /> Back
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Add Member</h1>
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <Field label="Full Name">
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)}
            className={inputCls} placeholder="Marie Augustin" />
        </Field>
        <Field label="WhatsApp Phone Number">
          <input required value={form.phone_number} onChange={e => set('phone_number', e.target.value)}
            className={inputCls} placeholder="+15551234567" />
          <p className="text-xs text-gray-400 mt-1">Include country code (e.g. +1 for US/Canada)</p>
        </Field>
        <Field label="Preferred Language">
          <select value={form.preferred_language} onChange={e => set('preferred_language', e.target.value)} className={inputCls}>
            <option value="ht">Kreyòl Ayisyen</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label="Rotation Position">
          <input required type="number" min="1" value={form.rotation_position}
            onChange={e => set('rotation_position', e.target.value)} className={inputCls} placeholder="3" />
          <p className="text-xs text-gray-400 mt-1">Which cycle does this member receive the pot?</p>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60">
          {loading ? 'Adding…' : 'Add Member & Send Welcome'}
        </button>
      </form>
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
