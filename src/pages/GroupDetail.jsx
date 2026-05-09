import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, UserPlus, RefreshCw, CheckCircle, Clock, XCircle } from 'lucide-react'

const LANG_LABEL = { ht: 'Kreyòl', fr: 'Français', en: 'English' }

function StatusBadge({ status }) {
  const map = {
    verified: 'bg-green-100 text-green-700',
    pending:  'bg-amber-100 text-amber-700',
    disputed: 'bg-red-100 text-red-700',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

function MemberStatusBadges({ member }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.invitation_sent_at ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
        Invited
      </span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.accepted_terms ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
        Terms
      </span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.onboarded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
        Onboarded
      </span>
    </div>
  )
}

export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group,    setGroup]    = useState(null)
  const [members,  setMembers]  = useState([])
  const [payments, setPayments] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: g }, { data: m }, { data: p }] = await Promise.all([
        supabase.from('sol_groups').select('*').eq('id', id).single(),
        supabase.from('sol_members').select('*').eq('group_id', id).order('rotation_position'),
        supabase.from('sol_payments').select('*, sender:sender_id(full_name), recipient:recipient_id(full_name)')
          .eq('group_id', id).order('cycle_number'),
      ])
      setGroup(g)
      setMembers(m ?? [])
      setPayments(p ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!group)  return <p className="text-sm text-red-500">Group not found.</p>

  const currentPayments = payments.filter(p => p.cycle_number === group.current_cycle)

  return (
    <div className="space-y-8 max-w-4xl">
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
            const member = members.find(m => m.rotation_position === cycle)
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

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Members</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['#', 'Name', 'Phone', 'Language', 'Platform', 'Progress'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(m => (
                <tr key={m.id} className={m.rotation_position === group.current_cycle ? 'bg-brand-50' : ''}>
                  <td className="px-4 py-3 font-medium text-gray-700">{m.rotation_position}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{m.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{m.phone_number}</td>
                  <td className="px-4 py-3 text-gray-500">{LANG_LABEL[m.preferred_language] ?? m.preferred_language}</td>
                  <td className="px-4 py-3 text-gray-500">{m.p2p_platform ? `${m.p2p_platform} ${m.p2p_handle ?? ''}` : '—'}</td>
                  <td className="px-4 py-3"><MemberStatusBadges member={m} /></td>
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
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
