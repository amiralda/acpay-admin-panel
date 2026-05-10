import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'
import { ArrowLeft } from 'lucide-react'

export default function GroupNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: '',
    contribution_amount: '',
    frequency: 'monthly',
    start_date: '',
    total_cycles: '',
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const name = form.name.trim()
    if (!name) { setError('Group name is required.'); return }

    setLoading(true)
    const { error: err } = await supabase.from('sol_groups').insert({
      name,
      contribution_amount: parseFloat(form.contribution_amount),
      frequency:           form.frequency,
      start_date:          form.start_date || null,
      total_cycles:        parseInt(form.total_cycles, 10),
      status:              'active',
      current_cycle:       1,
      created_by:          user.id,
    })
    setLoading(false)
    if (err) { setError(friendlyError(err)); return }
    navigate('/dashboard')
  }

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={15} /> Back
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Create Group</h1>
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <Field label="Group Name">
          <input required value={form.name} onChange={e => set('name', e.target.value)}
            className={inputCls} placeholder="Sòl Fanmi Augustin" />
        </Field>
        <Field label="Contribution Amount (USD)">
          <input required type="number" min="1" step="0.01" value={form.contribution_amount}
            onChange={e => set('contribution_amount', e.target.value)} className={inputCls} placeholder="200" />
        </Field>
        <Field label="Frequency">
          <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className={inputCls}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Start Date">
          <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Total Cycles (= number of members)">
          <input required type="number" min="2" value={form.total_cycles}
            onChange={e => set('total_cycles', e.target.value)} className={inputCls} placeholder="8" />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60">
          {loading ? 'Creating…' : 'Create Group'}
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
