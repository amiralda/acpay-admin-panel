import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react'

export default function CycleAdvance() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group,      setGroup]      = useState(null)
  const [pendingCount, setPending]  = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [advancing,  setAdvancing]  = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: g }, { count: pc }] = await Promise.all([
        supabase.from('sol_groups').select('*').eq('id', id).single(),
        supabase
          .from('sol_payments')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', id)
          .eq('status', 'pending'),
      ])
      setGroup(g)
      setPending(pc ?? 0)
      setLoading(false)
    }
    load()
  }, [id])

  async function advance() {
    setError('')
    setAdvancing(true)
    const nextCycle = (group.current_cycle ?? 1) + 1

    if (nextCycle > group.total_cycles) {
      const { error: err } = await supabase
        .from('sol_groups')
        .update({ status: 'completed' })
        .eq('id', id)
      setAdvancing(false)
      if (err) { setError(err.message); return }
      setDone(true)
      return
    }

    const { error: err } = await supabase
      .from('sol_groups')
      .update({ current_cycle: nextCycle })
      .eq('id', id)
    setAdvancing(false)
    if (err) { setError(err.message); return }
    setGroup(g => ({ ...g, current_cycle: nextCycle }))
    setDone(true)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!group)  return <p className="text-sm text-red-500">Group not found.</p>

  const isLastCycle = group.current_cycle >= group.total_cycles

  return (
    <div className="max-w-md">
      <button onClick={() => navigate(`/groups/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={15} /> Back to Group
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Advance Cycle — {group.name}</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500 text-xs">Current Cycle</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{group.current_cycle}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500 text-xs">Total Cycles</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{group.total_cycles}</p>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{pendingCount} payment{pendingCount > 1 ? 's' : ''} still pending this cycle. Advancing anyway will leave them unresolved.</span>
          </div>
        )}

        {isLastCycle && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <RefreshCw size={15} className="flex-shrink-0 mt-0.5" />
            <span>This is the final cycle. Advancing will mark the group as <strong>completed</strong>.</span>
          </div>
        )}

        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 text-center">
            {isLastCycle ? 'Group completed!' : `Advanced to cycle ${group.current_cycle}.`}
            <br />
            <button onClick={() => navigate(`/groups/${id}`)} className="mt-2 text-green-700 underline text-xs">
              Return to group
            </button>
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={advance}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
            >
              <RefreshCw size={15} />
              {advancing ? 'Advancing…' : isLastCycle ? 'Complete Group' : `Advance to Cycle ${(group.current_cycle ?? 1) + 1}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
