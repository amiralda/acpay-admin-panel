const PHONE_ERROR = 'Nimewo telefòn dwe kòmanse ak + epi gen chif sèlman (ex: +18565038895)'

export function validatePhone(phone) {
  if (!phone || !phone.startsWith('+')) return PHONE_ERROR
  const digits = phone.slice(1)
  if (!/^\d+$/.test(digits)) return PHONE_ERROR
  if (digits.length < 10 || digits.length > 15) return PHONE_ERROR
  return ''
}

export function validateName(name) {
  if (!name || name.trim().length < 2) return 'Name must be at least 2 characters'
  if (/\d/.test(name)) return 'Name cannot contain numbers'
  if (/[^a-zA-ZÀ-ÖØ-öø-ÿ\s'\-]/.test(name)) return 'Name cannot contain special characters'
  return ''
}
