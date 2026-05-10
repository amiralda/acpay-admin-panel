export const LANGUAGES = [
  { value: 'ht', label: 'Kreyòl Ayisyen' },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

/** Convert a stored code to its display label. Falls back to the raw value. */
export function langLabel(code) {
  return LANGUAGES.find(l => l.value === code)?.label ?? code ?? '—'
}
