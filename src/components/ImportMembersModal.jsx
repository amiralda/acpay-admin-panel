import { useState, useRef, useEffect } from 'react'
import Papa from 'papaparse'
import { validateName, validatePhone } from '../lib/validation'
import { normPlatform } from '../lib/p2pPlatforms'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import {
  X, Upload, Users, ClipboardList, FileText,
  Download, Search, AlertTriangle, CheckCircle2, ChevronLeft,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'csv',    label: 'CSV / Excel',     icon: Upload },
  { id: 'google', label: 'Google Contacts', icon: Users },
  { id: 'paste',  label: 'Bulk Paste',      icon: ClipboardList },
  { id: 'vcard',  label: 'vCard',           icon: FileText },
]

const TEMPLATE_CSV = [
  'name,phone,language,platform',
  'Marie Augustin,+18091234567,ht,MonCash',
  'Jean Baptiste,+15551234567,fr,CashApp',
  'Pierre Louis,+13055678901,en,Zelle',
  '# Supported platforms: MonCash | Natcash | Lajan Cash | CashApp | Zelle | Venmo | PayPal | Remitly | Cash in Hand',
].join('\n') + '\n'

const LANG_MAP = {
  // Haitian Creole variants
  ht: 'ht', 'kreyòl': 'ht', 'kreyol': 'ht', creole: 'ht',
  haitian: 'ht', 'haitian creole': 'ht', 'kreyòl ayisyen': 'ht',
  'kreyol ayisyen': 'ht', ayisyen: 'ht',
  // French variants
  fr: 'fr', 'français': 'fr', 'francais': 'fr', french: 'fr',
  // English variants
  en: 'en', english: 'en',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normLang(v) {
  return LANG_MAP[(v ?? '').toLowerCase().trim()] ?? 'ht'
}
// normPlatform is imported from p2pPlatforms.js

function tagRow(row, existingPhones) {
  const nameErr  = validateName(row.name)
  const isDupe   = existingPhones.has(row.phone)
  const phoneErr = isDupe ? 'Phone already exists in this group' : validatePhone(row.phone)
  return { ...row, nameErr, phoneErr, ok: !nameErr && !phoneErr }
}

function downloadTemplate() {
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }))
  a.download = 'acpay_template.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

// vCard: unfold RFC 6350 line continuations, then parse each card block
function parseVCards(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  return unfolded
    .split(/BEGIN:VCARD/i).slice(1)
    .map(block => {
      const fn  = block.match(/^FN(?:;[^:]*)?:(.+)$/im)?.[1]?.trim() ?? ''
      const raw = block.match(/^TEL(?:;[^:]*)?:(.+)$/im)?.[1]?.trim() ?? ''
      // Strip formatting chars; prepend + if missing but has digits
      const digits = raw.replace(/[\s()\-\.]/g, '')
      const phone  = digits.startsWith('+') ? digits : digits ? '+' + digits : ''
      return { name: fn, phone, language: 'ht', platform: null }
    })
    .filter(r => r.name || r.phone)
}

// Bulk paste: detect phone token by + prefix or long digit sequence
function parseBulkLine(line) {
  line = line.trim()
  if (!line) return null
  if (line.includes(',')) {
    const [a, b] = line.split(',').map(s => s.trim())
    const aIsPhone = /^\+?\d{6,}$/.test(a.replace(/\s/g, ''))
    return { name: aIsPhone ? b : a, phone: aIsPhone ? a : b, language: 'ht', platform: null }
  }
  const tokens  = line.split(/\s+/)
  const pi      = tokens.findIndex(t => /^\+\d{6,}$/.test(t))
  if (pi !== -1) {
    return { name: tokens.filter((_, i) => i !== pi).join(' '), phone: tokens[pi], language: 'ht', platform: null }
  }
  return { name: line, phone: '', language: 'ht', platform: null }
}

// Normalise CSV/XLSX row — accept various header casings
function normaliseRow(r) {
  return {
    name:     String(r.name ?? r.Name ?? r.full_name ?? r['Full Name'] ?? '').trim(),
    phone:    String(r.phone ?? r.Phone ?? r.phone_number ?? r['Phone Number'] ?? '').trim(),
    language: normLang(r.language ?? r.Language ?? ''),
    platform: normPlatform(r.platform ?? r.Platform ?? ''),
  }
}

// ── Shared: PreviewTable ──────────────────────────────────────────────────────

function PreviewTable({ rows }) {
  const good = rows.filter(r => r.ok).length
  const bad  = rows.length - good
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-green-600 font-medium">
          <CheckCircle2 size={14} /> {good} ready to import
        </span>
        {bad > 0 && (
          <span className="flex items-center gap-1.5 text-red-500 font-medium">
            <AlertTriangle size={14} /> {bad} will be skipped
          </span>
        )}
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
              <tr>
                {['Name', 'Phone', 'Lang', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className={row.ok ? '' : 'bg-red-50'}>
                  <td className="px-3 py-2 max-w-[140px]">
                    <div className="font-medium truncate">{row.name || <i className="text-gray-400 not-italic">—</i>}</div>
                    {row.nameErr && <div className="text-red-500 text-[10px] leading-tight mt-0.5">{row.nameErr}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono max-w-[140px]">
                    <div className="truncate">{row.phone || <i className="text-gray-400 not-italic">—</i>}</div>
                    {row.phoneErr && <div className="text-red-500 text-[10px] leading-tight mt-0.5">{row.phoneErr}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{row.language}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.ok
                      ? <span className="text-green-600 font-medium">✓ Ready</span>
                      : <span className="text-red-500">✕ Skip</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab 1: CSV / Excel ────────────────────────────────────────────────────────

function CsvTab({ onParsed }) {
  const inputRef          = useRef()
  const [error,  setError]  = useState('')
  const [busy,   setBusy]   = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''           // allow re-selecting same file
    setError('')
    setBusy(true)
    try {
      let rows = []
      const isExcel = /\.(xlsx|xls)$/i.test(file.name)
      if (isExcel) {
        // Dynamic import keeps xlsx out of the initial bundle
        const XLSX = await import('xlsx')
        const buf  = await file.arrayBuffer()
        const wb   = XLSX.read(buf, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' }).map(normaliseRow)
      } else {
        const text = await file.text()
        const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
        rows = data.map(normaliseRow)
      }
      if (rows.length === 0) { setError('File is empty or has no data rows.'); return }
      onParsed(rows)
    } catch (err) {
      setError('Could not parse file: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 hover:border-brand-400 rounded-xl p-8 text-center cursor-pointer transition-colors group"
      >
        <Upload size={28} className="mx-auto text-gray-300 group-hover:text-brand-400 mb-3 transition-colors" />
        <p className="text-sm font-medium text-gray-700">Click to upload CSV or Excel file</p>
        <p className="text-xs text-gray-400 mt-1">Supported: .csv · .xlsx · .xls</p>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
      </div>

      {busy  && <p className="text-sm text-gray-400 text-center">Parsing…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={downloadTemplate}
        className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline"
      >
        <Download size={12} /> Download template CSV
      </button>

      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1.5">
        <p className="font-semibold text-gray-600">Expected columns</p>
        <p>
          <code className="bg-white border border-gray-200 px-1 rounded">name</code> required ·{' '}
          <code className="bg-white border border-gray-200 px-1 rounded">phone</code> required (E.164: +digits)
        </p>
        <p>
          <code className="bg-white border border-gray-200 px-1 rounded">language</code> optional (ht/fr/en, default: ht) ·{' '}
          <code className="bg-white border border-gray-200 px-1 rounded">platform</code> optional (Zelle/CashApp/Venmo)
        </p>
      </div>
    </div>
  )
}

// ── Tab 2: Google Contacts ────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function GoogleTab({ onParsed }) {
  const [contacts,  setContacts]  = useState([])
  const [selected,  setSelected]  = useState(new Set())
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [connected, setConnected] = useState(false)

  // Load Google Identity Services script once
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || document.getElementById('gsi-script')) return
    const s    = document.createElement('script')
    s.id       = 'gsi-script'
    s.src      = 'https://accounts.google.com/gsi/client'
    s.async    = true
    document.body.appendChild(s)
  }, [])

  async function fetchContacts(token) {
    setLoading(true)
    setError('')
    try {
      let all  = []
      let next = ''
      do {
        const url  = `https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=100${next ? '&pageToken=' + next : ''}`
        const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        const mapped = (data.connections ?? []).flatMap(c => {
          const name  = c.names?.[0]?.displayName ?? ''
          const phone = (c.phoneNumbers?.[0]?.canonicalForm ?? c.phoneNumbers?.[0]?.value ?? '').replace(/\s/g, '')
          return name || phone ? [{ name, phone }] : []
        })
        all  = [...all, ...mapped]
        next = data.nextPageToken ?? ''
      } while (next)
      setContacts(all)
      // Pre-select contacts that have a phone number
      setSelected(new Set(all.reduce((acc, c, i) => (c.phone ? [...acc, i] : acc), [])))
      setConnected(true)
    } catch (err) {
      setError('Could not load contacts: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function connectGoogle() {
    if (!window.google?.accounts?.oauth2) { setError('Google SDK not ready — please wait a moment and retry.'); return }
    window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope:     'https://www.googleapis.com/auth/contacts.readonly',
      callback:  resp => {
        if (resp.error) { setError(resp.error_description ?? resp.error); return }
        fetchContacts(resp.access_token)
      },
    }).requestAccessToken()
  }

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  function toggleAll() {
    const ids = filtered.map(c => contacts.indexOf(c))
    const allOn = ids.every(i => selected.has(i))
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(i => allOn ? next.delete(i) : next.add(i))
      return next
    })
  }

  function handlePreview() {
    const rows = [...selected].map(i => ({
      name: contacts[i].name, phone: contacts[i].phone, language: 'ht', platform: null,
    }))
    onParsed(rows)
  }

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2 text-sm text-amber-800">
        <p className="font-semibold">Google Contacts not configured</p>
        <p>
          Add <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> to your{' '}
          <code className="bg-amber-100 px-1 rounded">.env.local</code> and redeploy.
        </p>
        <p className="text-xs text-amber-600">
          Create a client ID at Google Cloud Console → APIs &amp; Services → Credentials.
          Enable the People API and add your domain to authorized JavaScript origins.
        </p>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
          <Users size={24} className="text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">Connect your Google account</p>
          <p className="text-xs text-gray-500 mt-1">Read-only access — we never store your Google token</p>
        </div>
        {loading
          ? <p className="text-sm text-gray-400">Fetching contacts…</p>
          : (
            <button
              onClick={connectGoogle}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <GoogleLogo /> Connect Google Contacts
            </button>
          )
        }
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button onClick={toggleAll} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
          Toggle all
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-52 divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No contacts found</p>
          )}
          {filtered.map(c => {
            const idx = contacts.indexOf(c)
            return (
              <label key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(idx)}
                  onChange={() => setSelected(prev => {
                    const next = new Set(prev)
                    next.has(idx) ? next.delete(idx) : next.add(idx)
                    return next
                  })}
                  className="rounded border-gray-300 accent-brand-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name || <i className="text-gray-400 not-italic font-normal">No name</i>}</p>
                  <p className="text-xs text-gray-500 font-mono">{c.phone || <i className="text-gray-300 not-italic">no phone</i>}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <button
        onClick={handlePreview}
        disabled={selected.size === 0}
        className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40"
      >
        Preview {selected.size} contact{selected.size !== 1 ? 's' : ''}
      </button>
    </div>
  )
}

// ── Tab 3: Bulk Paste ─────────────────────────────────────────────────────────

function BulkPasteTab({ onParsed }) {
  const [text,  setText]  = useState('')
  const [error, setError] = useState('')

  function handlePreview() {
    setError('')
    const rows = text.split('\n').map(parseBulkLine).filter(Boolean)
    if (rows.length === 0) { setError('No valid lines detected.'); return }
    onParsed(rows)
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600">Supported formats — one entry per line:</p>
        <p className="font-mono text-gray-600">Jean Pierre, +18091234567</p>
        <p className="font-mono text-gray-600">+18091234567, Jean Pierre</p>
        <p className="font-mono text-gray-600">Jean Pierre +18091234567</p>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'Marie Augustin, +18091234567\nJean Baptiste, +15551234567\nPierre Louis +13055678901'}
        rows={8}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={handlePreview}
        disabled={!text.trim()}
        className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40"
      >
        Parse &amp; Preview
      </button>
    </div>
  )
}

// ── Tab 4: vCard ──────────────────────────────────────────────────────────────

function VcardTab({ onParsed }) {
  const inputRef          = useRef()
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError('')
    try {
      const text = await file.text()
      const rows = parseVCards(text)
      if (rows.length === 0) { setError('No contacts found in this vCard file.'); return }
      onParsed(rows)
    } catch (err) {
      setError('Could not parse vCard: ' + err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 hover:border-brand-400 rounded-xl p-8 text-center cursor-pointer transition-colors group"
      >
        <FileText size={28} className="mx-auto text-gray-300 group-hover:text-brand-400 mb-3 transition-colors" />
        <p className="text-sm font-medium text-gray-700">Click to upload a .vcf file</p>
        <p className="text-xs text-gray-400 mt-1">Single or multi-contact vCard files supported</p>
        <input ref={inputRef} type="file" accept=".vcf,.vcard" className="hidden" onChange={handleFile} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
        <p>Parsed fields: <code className="font-mono">FN</code> (full name) · <code className="font-mono">TEL</code> (phone)</p>
        <p className="text-gray-400">Export from iPhone: Contacts app → Share Contact → AirDrop/Files → .vcf</p>
        <p className="text-gray-400">Export from Google Contacts: contacts.google.com → Export → vCard</p>
      </div>
    </div>
  )
}

// ── Google Logo ───────────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ImportMembersModal({ groupId, existingPhones, onClose, onImported }) {
  const [activeTab,    setActiveTab]    = useState(0)
  const [parsedRows,   setParsedRows]   = useState(null)   // null = input view
  const [importing,    setImporting]    = useState(false)
  const [importError,  setImportError]  = useState('')

  const existingSet = new Set(existingPhones)
  const taggedRows  = parsedRows ? parsedRows.map(r => tagRow(r, existingSet)) : null
  const validRows   = taggedRows?.filter(r => r.ok) ?? []

  function handleParsed(rows) {
    setImportError('')
    setParsedRows(rows)
  }

  function goBack() {
    setParsedRows(null)
    setImportError('')
  }

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setImportError('')

    const records = validRows.map(r => ({
      group_id:           groupId,
      full_name:          r.name.trim(),
      phone_number:       r.phone,
      preferred_language: r.language ?? 'ht',
      p2p_platform:       r.platform ?? null,
      rotation_position:  null,    // manager assigns via Edit after import
      onboarded:          false,
      onboarding_step:    0,
      accepted_terms:     false,
    }))

    const { error } = await supabase.from('sol_members').insert(records)
    setImporting(false)
    if (error) { setImportError(friendlyError(error)); return }

    const skipped = (parsedRows?.length ?? 0) - validRows.length
    onImported(validRows.length, skipped)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1">
            {parsedRows && (
              <button onClick={goBack} className="text-gray-400 hover:text-gray-700 p-1 -ml-1 rounded">
                <ChevronLeft size={18} />
              </button>
            )}
            <h2 className="text-base font-semibold text-gray-900">
              {parsedRows ? 'Preview Import' : 'Import Members'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab bar — hidden during preview */}
        {!parsedRows && (
          <div className="flex border-b border-gray-100 flex-shrink-0 px-2 overflow-x-auto">
            {TABS.map((tab, i) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === i
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">
          {parsedRows ? (
            <div className="space-y-4">
              <PreviewTable rows={taggedRows} />
              {importError && <p className="text-sm text-red-500">{importError}</p>}
            </div>
          ) : (
            <>
              {activeTab === 0 && <CsvTab       onParsed={handleParsed} />}
              {activeTab === 1 && <GoogleTab     onParsed={handleParsed} />}
              {activeTab === 2 && <BulkPasteTab  onParsed={handleParsed} />}
              {activeTab === 3 && <VcardTab      onParsed={handleParsed} />}
            </>
          )}
        </div>

        {/* Footer — only in preview step */}
        {parsedRows && (
          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing
                ? 'Importing…'
                : validRows.length === 0
                  ? 'No valid rows to import'
                  : `Import ${validRows.length} member${validRows.length !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
