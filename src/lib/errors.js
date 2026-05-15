// Converts raw Supabase / PostgREST errors to user-safe messages.
// Never show err.message directly — it leaks table names, column names,
// and constraint names that could aid SQL injection or reconnaissance.

const GENERIC = 'Something went wrong. Please try again. / Yon bagay mal pase. Tanpri eseye ankò.'

const CODE_MAP = {
  // PostgreSQL error codes
  '23505': 'This record already exists.',
  '23503': 'A required linked record is missing.',
  '23502': 'A required field is empty.',
  '23514': 'A value is outside the allowed range.',
  '42501': 'You do not have permission for this action.',
  '42P01': 'Database configuration error — please contact support.',
  // PostgREST codes
  'PGRST116': 'Record not found.',
  'PGRST301': 'You do not have permission for this action.',
  'PGRST204': 'No content returned.',
}

const PATTERN_MAP = [
  [/duplicate|unique/i,              CODE_MAP['23505']],
  [/permission|denied|rls|policy/i,  CODE_MAP['42501']],
  [/not.found|no rows/i,             CODE_MAP['PGRST116']],
  [/network|fetch|failed to fetch/i, 'Network error — check your connection.'],
  [/timeout/i,                       'The request timed out. Please try again.'],
]

/**
 * Returns a user-safe error string from a Supabase error object.
 * Never call err.message directly in UI — always pass through this function.
 */
export function friendlyError(err) {
  console.log('[friendlyError input]:', err)
  if (!err) return GENERIC
  if (CODE_MAP[err.code]) return CODE_MAP[err.code]
  const msg = err.message ?? ''
  for (const [pattern, friendly] of PATTERN_MAP) {
    if (pattern.test(msg)) return friendly
  }
  return GENERIC
}
