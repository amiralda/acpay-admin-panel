// Single source of truth for P2P platform definitions, validation, and hints.
// Used by EditMemberModal, MemberAdd, and ImportMembersModal.

export const P2P_PLATFORMS = [
  { value: '',             label: '— None —' },
  { value: 'MonCash',      label: 'MonCash (Haiti)' },
  { value: 'Natcash',      label: 'Natcash (Haiti)' },
  { value: 'Lajan Cash',   label: 'Lajan Cash (Haiti)' },
  { value: 'CashApp',      label: 'CashApp (US)' },
  { value: 'Zelle',        label: 'Zelle (US)' },
  { value: 'Venmo',        label: 'Venmo (US)' },
  { value: 'PayPal',       label: 'PayPal (Global)' },
  { value: 'Remitly',      label: 'Remitly (International)' },
  { value: 'Cash in Hand', label: 'Cash in Hand (physical)' },
]

// Lookup map: value → rule definition
const RULES = {
  MonCash: {
    placeholder: '+509 XXXX XXXX',
    hint:        'Nimewo MonCash ou (ex: +50912345678)',
    disabled:    false,
    validate: h => /^\+509\d{8}$/.test(h.replace(/\s/g, ''))
      ? '' : 'Must start with +509 followed by exactly 8 digits',
  },
  Natcash: {
    placeholder: '+509 XXXX XXXX',
    hint:        'Nimewo Natcash ou (ex: +50912345678)',
    disabled:    false,
    validate: h => /^\+509\d{8}$/.test(h.replace(/\s/g, ''))
      ? '' : 'Must start with +509 followed by exactly 8 digits',
  },
  'Lajan Cash': {
    placeholder: '+509 XXXX XXXX',
    hint:        'Nimewo Lajan Cash ou (ex: +50912345678)',
    disabled:    false,
    validate: h => /^\+509\d{8}$/.test(h.replace(/\s/g, ''))
      ? '' : 'Must start with +509 followed by exactly 8 digits',
  },
  CashApp: {
    placeholder: '$cashtag',
    hint:        'Your $Cashtag (ex: $DanyAug)',
    disabled:    false,
    validate: h => h.startsWith('$') && h.length >= 3 && !/\s/.test(h)
      ? '' : 'Must start with $ with no spaces (ex: $DanyAug)',
  },
  Zelle: {
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
  Venmo: {
    placeholder: '@username',
    hint:        'Your Venmo handle (ex: @dany-aug)',
    disabled:    false,
    validate: h => h.startsWith('@') && !/\s/.test(h)
      ? '' : 'Must start with @ with no spaces (ex: @dany-aug)',
  },
  PayPal: {
    placeholder: 'Email address',
    hint:        'PayPal email (ex: dany@gmail.com)',
    disabled:    false,
    validate: h => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h)
      ? '' : 'Must be a valid email address',
  },
  Remitly: {
    placeholder: 'Email address',
    hint:        'Remitly email (ex: dany@gmail.com)',
    disabled:    false,
    validate: h => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h)
      ? '' : 'Must be a valid email address',
  },
  'Cash in Hand': {
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

/** Returns true when the handle field should be disabled (e.g. Cash in Hand). */
export function isHandleDisabled(platform) {
  return RULES[platform]?.disabled ?? false
}

/**
 * Maps a raw string (from CSV/paste) to a canonical platform value.
 * Case-insensitive. Returns null if unrecognised.
 */
export function normPlatform(raw) {
  if (!raw) return null
  const s = raw.toLowerCase().trim()
  // Exact match first
  const exact = P2P_PLATFORMS.find(p => p.value && p.value.toLowerCase() === s)
  if (exact) return exact.value
  // Fuzzy keyword matching
  if (s.includes('moncash') || s.includes('mon cash')) return 'MonCash'
  if (s.includes('natcash') || s.includes('nat cash')) return 'Natcash'
  if (s.includes('lajan'))                              return 'Lajan Cash'
  if (s.includes('cashapp') || s.includes('cash app')) return 'CashApp'
  if (s.includes('zelle'))                              return 'Zelle'
  if (s.includes('venmo'))                              return 'Venmo'
  if (s.includes('paypal') || s.includes('pay pal'))   return 'PayPal'
  if (s.includes('remitly'))                            return 'Remitly'
  if (s.includes('hand') || s.includes('physical') || s.includes('cash in')) return 'Cash in Hand'
  return null
}
