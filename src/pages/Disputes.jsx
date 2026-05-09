import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle } from 'lucide-react'

function StatusBadge({ status }) {
  const map = {
    open:         'bg-red-100 text-red-700',
    under_review: 'bg-amber-100 text-amber-700',
    resolved:     'bg-green-100 text-green-700',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>{status.replace('_', ' ')}</span>
}

function DisputeCard({ dispute, onResolved }) {
  const [notes,   setNotes]   = useState(dispute.resolution_notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function resolve() {
    if (!notes.trim()) { setError('Enter resolution notes before marking resolved.'); return }
    setLoading(true)
    const { error: err } = await supabase
      .from('sol_disputes')
      .update({ status: 'resolved', resolution_notes: notes })
      .eq('id', dispute.id)
    setLoading(false)
    if (err) { setError(err.message); return }
    onResolved(dispute.id)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Dispute #{dispute.id.slice(0, 8)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Payment: {dispute.payment_id?.slice(0, 8)} · Reporter: {dispute.reporter?.full_name ?? '—'}
            </p>
          </div>
        </div>
        <StatusBadge status={dispute.status} />
      </div>

      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100">
        {dispute.description || <span className="text-gray-400 italic">No description provided.</span>}
      </p>

      {dispute.status !== 'resolved' && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Resolution notes…"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={resolve}
            disabled={loading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <CheckCircle size={14} />
            {loading ? 'Resolving…' : 'Mark Resolved'}
          </button>
        </div>
      )}

      {dispute.status === 'resolved' && dispute.resolution_notes && (
        <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
          <span className="font-medium">Resolution:</span> {dispute.resolution_notes}
        </p>
      )}
    </div>
  )
}

export default function Disputes() {
  const [disputes, setDisputes] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('open')

  useEffect(() => {
    async function load() {
      const statuses = filter === 'all' ? ['open', 'under_review', 'resolved'] : [filter, 'under_review']
      const { data } = await supabase
        .from('sol_disputes')
        .select('*, reporter:reported_by(full_name)')
        .in('status', statuses)
        .order('created_at', { ascending: false })
      setDisputes(data ?? [])
      setLoading(false)
    }
    load()
  }, [filter])

  function handleResolved(id) {
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'resolved' } : d))
  }

  const open     = disputes.filter(d => d.status !== 'resolved')
  const resolved = disputes.filter(d => d.status === 'resolved')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Disputes</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-sm">
          {[['open', 'Open'], ['all', 'All']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${filter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : disputes.length === 0 ? (
        <p className="text-sm text-gray-400">No disputes found.</p>
      ) : (
        <div className="space-y-4">
          {open.length > 0 && open.map(d => (
            <DisputeCard key={d.id} dispute={d} onResolved={handleResolved} />
          ))}
          {resolved.length > 0 && filter === 'all' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Resolved</p>
              {resolved.map(d => (
                <DisputeCard key={d.id} dispute={d} onResolved={handleResolved} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
