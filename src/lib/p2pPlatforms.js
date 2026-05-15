// Single source of truth for P2P platform definitions, validation, and hints.
// Used by EditMemberModal, MemberAdd, and ImportMembersModal.
//
// IMPORTANT: `value` fields are the exact strings stored in the Supabase
// `p2p_platform` column (lowercase, underscore-separated). The CHECK constraint
// on sol_members must match these values exactly. See migration_p2p_platform.sql.

export const P2P_PLATFORMS = [
  { value: '',             label: '— None —' },
  { value: 'moncash',      label: 'MonCash (Haiti)' },
  { value: 'natcash',      label: 'Natcash (Haiti)' },
  { value: 'lajan_cash',   label: 'Lajan Cash (Haiti)' },
  { value: 'cashapp',      label: 'CashApp (US)' },
  { value: 'zelle',        label: 'Zelle (US)' },
  { value: 'venmo',        label: 'Venmo (US)' },
  { value: 'paypal',       label: 'PayPal (Global)' },
  { value: 'remitly',      label: 'Remitly (International)' },
  { value: 'cash_in_hand', label: 'Cash in Hand (physical)' },
]

/** Convert a stored DB value to its display label. Falls back to the raw value. */
export function platformLabel(value) {
  return P2P_PLATFORMS.find(p => p.value === value)?.label ?? value ?? '—'
}

// Lookup map: DB value → rule definition
const RULES = {
  moncash: {
    placeholder: '+509 XXXX XXXX',
    hint:        'Nimewo MonCash ou (ex: +50912345678)',
    disabled:    false,
    validate: h => /^\+509\d{8}$/.test(h.replace(/\s/g, ''))
      ? '' : 'Must start with +509 followed by exactly 8 digits',
  },
  natcash: {
    placeholder: '+509 XXXX XXXX',
    hint:        'Nimewo Natcash ou (ex: +50912345678)',
    disabled:    false,
    validate: h => /^\+509\d{8}$/.test(h.replace(/\s/g, ''))
      ? '' : 'Must start with +509 followed by exactly 8 digits',
  },
  lajan_cash: {
    placeholder: '+509 XXXX XXXX',
    hint:        'Nimewo Lajan Cash ou (ex: +50912345678)',
    disabled:    false,
    validate: h => /^\+509\d{8}$/.test(h.replace(/\s/g, ''))
      ? '' : 'Must start with +509 followed by exactly 8 digits',
  },
  cashapp: {
    placeholder: '$cashtag',
    hint:        'Your $Cashtag (ex: $DanyAug)',
    disabled:    false,
    validate: h => h.startsWith('$') && h.length >= 3 && !/\s/.test(h)
      ? '' : 'Must start with $ with no spaces (ex: $DanyAug)',
  },
  zelle: {
    placeholder: 'Email or +1xxxxxxxxxx',
    hint:        'Email or US phone number (+1xxxxxxxxxx)',
    disabled:    false,
    validate: h => {
      const v       = h.replace(/\s/g, '')   // strip spaces before testing
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      const isPhone = /^\+1\d{10}$/.test(v)  // +1 then exactly 10 digits = 12 chars total
      return (isEmail || isPhone) ? '' : 'Must be a valid email or US phone (+1xxxxxxxxxx)'
    },
  },
  venmo: {
    placeholder: '@username',
    hint:        'Your Venmo handle (ex: @dany-aug)',
    disabled:    false,
    validate: h => h.startsWith('@') && !/\s/.test(h)
      ? '' : 'Must start with @ with no spaces (ex: @dany-aug)',
  },
  paypal: {
    placeholder: 'Email address',
    hint:        'PayPal email (ex: dany@gmail.com)',
    disabled:    false,
    validate: h => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h)
      ? '' : 'Must be a valid email address',
  },
  remitly: {
    placeholder: 'Email address',
    hint:        'Remitly email (ex: dany@gmail.com)',
    disabled:    false,
    validate: h => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h)
      ? '' : 'Must be a valid email address',
  },
  cash_in_hand: {
    placeholder: '—',
    hint:        'No handle needed',
    disabled:    true,
    validate:    () => '',
  },
}

/**
 * Returns an error string, or '' if valid.
 * An empty handle for a non-disabled platform is treated as required.
 */
export function validateHandle(platform, handle) {
  if (!platform) return ''
  const rule = RULES[platform]
  if (!rule || rule.disabled) return ''
  if (!handle?.trim()) return 'Handle is required for this platform'
  return rule.validate(handle.trim())
}

/** Returns the hint text for a given platform (empty string if none). */
export function getHint(platform) {
  return RULES[platform]?.hint ?? ''
}

/** Returns the input placeholder for a given platform. */
export function getPlaceholder(platform) {
  return RULES[platform]?.placeholder ?? ''
}

/** Returns true when the handle field should be disabled (e.g. cash_in_hand). */
export function isHandleDisabled(platform) {
  return RULES[platform]?.disabled ?? false
}

/**
 * Maps a raw string (from CSV/paste) to a canonical DB platform value.
 * Case-insensitive. Returns null if unrecognised.
 */
export function normPlatform(raw) {
  if (!raw) return null
  const s = raw.toLowerCase().trim()
  // Exact DB value match first
  const exact = P2P_PLATFORMS.find(p => p.value && p.value === s)
  if (exact) return exact.value
  // Fuzzy keyword matching → always returns a DB value (lowercase)
  if (s.includes('moncash') || s.includes('mon cash')) return 'moncash'
  if (s.includes('natcash') || s.includes('nat cash')) return 'natcash'
  if (s.includes('lajan'))                              return 'lajan_cash'
  if (s.includes('cashapp') || s.includes('cash app')) return 'cashapp'
  if (s.includes('zelle'))                              return 'zelle'
  if (s.includes('venmo'))                              return 'venmo'
  if (s.includes('paypal') || s.includes('pay pal'))   return 'paypal'
  if (s.includes('remitly'))                            return 'remitly'
  if (s.includes('hand') || s.includes('physical') || s.includes('cash in')) return 'cash_in_hand'
  return null
}
