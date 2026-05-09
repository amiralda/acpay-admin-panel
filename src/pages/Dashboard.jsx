import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Users, RefreshCw, Clock, AlertTriangle, Plus } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [groups, setGroups]           = useState([])
  const [pendingCount, setPending]    = useState(0)
  const [disputeCount, setDisputes]   = useState(0)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: grps }, { count: pc }, { count: dc }] = await Promise.all([
        supabase
          .from('sol_groups')
          .select('*')
          .eq('created_by', user.id)
          .eq('status', 'active'),
        supabase
          .from('sol_payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('sol_disputes')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'under_review']),
      ])
      setGroups(grps ?? [])
      setPending(pc ?? 0)
      setDisputes(dc ?? 0)
      setLoading(false)
    }
    load()
  }, [user.id])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/groups/new"
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Group
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users}         label="Active Groups"    value={groups.length}  color="bg-brand-500" />
        <StatCard icon={Clock}         label="Pending Payments" value={pendingCount}   color="bg-amber-500" />
        <StatCard icon={AlertTriangle} label="Open Disputes"    value={disputeCount}   color="bg-red-500" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your Groups</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-400">No active groups yet. <Link to="/groups/new" className="text-brand-600 underline">Create one</Link>.</p>
        ) : (
          <div className="grid gap-3">
            {groups.map(g => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-brand-300 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-900">{g.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Cycle {g.current_cycle} / {g.total_cycles} · ${g.contribution_amount} {g.frequency}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">active</span>
                  <RefreshCw size={14} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
