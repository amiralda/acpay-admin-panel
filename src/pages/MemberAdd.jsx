import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateName, validatePhone } from '../lib/validation'
import { P2P_PLATFORMS, validateHandle, getHint, getPlaceholder, isHandleDisabled } from '../lib/p2pPlatforms'
import { friendlyError } from '../lib/errors'
import { LANGUAGES } from '../lib/languages'
import { ArrowLeft } from 'lucide-react'

const N8N_WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK_URL

const EMPTY_ERRORS = { full_name: '', phone_number: '', p2p_handle: '' }

export default function MemberAdd() {
  const { id: groupId } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    full_name:          '',
    phone_number:       '',
    preferred_language: 'ht',
    rotation_position:  '',
    p2p_platform:       '',
    p2p_handle:         '',
  })
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS)
  const [submitError, setSubmitError] = useState('')
  const [loading,     setLoading]     = useState(false)

  function setField(k, v) {
    if (submitError) setSubmitError('') // Clear stale submit error on any edit
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
    form.rotation_position !== '' &&
    !fieldErrors.full_name &&
    !fieldErrors.phone_number &&
    !fieldErrors.p2p_handle

  async function handleSubmit(e) {
    e.preventDefault()

    // Final validation pass
    const nameErr   = validateName(form.full_name)
    const phoneErr  = validatePhone(form.phone_number)
    const handleErr = validateHandle(form.p2p_platform, form.p2p_handle)
    if (nameErr || phoneErr || handleErr) {
      setFieldErrors({ full_name: nameErr, phone_number: phoneErr, p2p_handle: handleErr })
      return
    }

    setSubmitError('')
    setLoading(true)

    const invitationSentAt = new Date().toISOString()

    const insertPayload = {
      group_id:           groupId,
      full_name:          form.full_name.trim(),
      phone_number:       form.phone_number,
      preferred_language: form.preferred_language,
      rotation_position:  parseInt(form.rotation_position, 10),
      p2p_platform:       form.p2p_platform || null,
      p2p_handle:         form.p2p_handle   || null,
      onboarded:          false,
      onboarding_step:    0,
      accepted_terms:     false,
      invitation_sent_at: invitationSentAt,
    }

    // Safety net: convert any remaining empty strings to null
    const cleanInsertPayload = Object.fromEntries(
      Object.entries(insertPayload).map(([k, v]) => [k, v === '' ? null : v])
    )

    const { data: member, error: insertErr } = await supabase
      .from('sol_members')
      .insert(cleanInsertPayload)
      .select()
      .single()

    if (insertErr) {
      setLoading(false)
      setSubmitError(friendlyError(insertErr))
      return
    }

    const { data: group } = await supabase
      .from('sol_groups')
      .select('name, contribution_amount, frequency, total_cycles')
      .eq('id', groupId)
      .single()

    try {
      await fetch(N8N_WEBHOOK, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id:           member.id,
          phone_number:        form.phone_number,
          full_name:           form.full_name.trim(),
          preferred_language:  form.preferred_language,
          p2p_platform:        form.p2p_platform || null,
          p2p_handle:          form.p2p_handle   || null,
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

        <div>
          <label className={labelCls}>Full Name</label>
          <input
            required
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
            required
            value={form.phone_number}
            onChange={e => setField('phone_number', e.target.value)}
            className={inputCls(fieldErrors.phone_number)}
            placeholder="+18565038895"
          />
          {fieldErrors.phone_number
            ? <p className={errCls}>{fieldErrors.phone_number}</p>
            : <p className="text-xs text-gray-400 mt-1">Include country code (e.g. +1 for US/Canada)</p>
          }
        </div>

        <div>
          <label className={labelCls}>Preferred Language</label>
          <select
            value={form.preferred_language}
            onChange={e => setField('preferred_language', e.target.value)}
            className={inputCls('')}
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Rotation Position</label>
          <input
            required
            type="number"
            min="1"
            value={form.rotation_position}
            onChange={e => setField('rotation_position', e.target.value)}
            className={inputCls('')}
            placeholder="3"
          />
          <p className="text-xs text-gray-400 mt-1">Which cycle does this member receive the pot?</p>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">P2P Payment Info (optional)</p>

          <div>
            <label className={labelCls}>P2P Platform</label>
            <select
              value={form.p2p_platform}
              onChange={e => setField('p2p_platform', e.target.value)}
              className={inputCls('')}
            >
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
                type="text"
                autoComplete="off"
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
        </div>

        {submitError && <p className={errCls}>{submitError}</p>}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding…' : 'Add Member & Send Welcome'}
        </button>
      </form>
    </div>
  )
}

const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const errCls   = 'text-xs text-red-600 mt-1'

function inputCls(err) {
  return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
    err ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-brand-500'
  }`
}
