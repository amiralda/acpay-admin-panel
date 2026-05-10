# AcPay Admin Panel — Security Audit
**Date:** 2026-05-09  
**Scope:** src/, .gitignore, .env.example, rls_admin_policies.sql

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 | Fixed |
| High | 2 | Fixed |
| Medium | 3 | Fixed |
| Low | 2 | Noted (TODO comments) |

---

## Findings & Fixes

### CRITICAL — 1

#### C-1: `sol_audit_log` table had no RLS policies
**File:** `rls_admin_policies.sql`  
**Risk:** Any authenticated user could read or write audit log entries for groups they do not own. Audit trail could be tampered with or read by other managers on the same Supabase project.  
**Fix:** Added `ENABLE ROW LEVEL SECURITY` plus two policies:
- `manager_read_audit_log` — SELECT only, scoped to groups owned by `auth.uid()`
- `service_role_all_audit` — full access for `service_role` (n8n workflows)

```sql
ALTER TABLE sol_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY manager_read_audit_log ON sol_audit_log
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT id FROM sol_groups WHERE created_by = auth.uid()));

CREATE POLICY service_role_all_audit ON sol_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

### HIGH — 2

#### H-1: Raw Supabase error messages exposed to users
**Files:** `GroupNew.jsx`, `Disputes.jsx`, `CycleAdvance.jsx`, `GroupDetail.jsx` (EditMemberModal), `MemberAdd.jsx`, `ImportMembersModal.jsx`  
**Risk:** Supabase error messages contain table names, column names, constraint names, and foreign key relationships. Example raw error: `"duplicate key value violates unique constraint "sol_members_phone_number_key""` — this leaks the table name, column name, and constraint name to anyone who can read the DOM or network tab.  
**Fix:** Created `src/lib/errors.js` with `friendlyError(err)` that maps PostgreSQL error codes (`23505`, `23503`, `42501`, `PGRST116`, etc.) and message patterns to safe, user-facing strings. Applied across all 6 components.

```js
// Before (leaks schema):
if (err) { setError(err.message); return }

// After (safe):
if (err) { setError(friendlyError(err)); return }
```

#### H-2: `.gitignore` was UTF-16 LE encoded
**File:** `.gitignore`  
**Risk:** The file contained `.env` and `.env.local` entries but was encoded as UTF-16 with BOM. Some git versions on Linux/CI may fail to parse it, meaning `.env.local` could accidentally be committed and pushed, exposing the Supabase anon key and n8n webhook URL.  
**Fix:** Rewrote `.gitignore` in UTF-8 with a complete Vite project ignore list.

---

### MEDIUM — 3

#### M-1: Group name not trimmed before Supabase insert
**File:** `GroupNew.jsx`  
**Risk:** Leading/trailing whitespace stored in `name` column causes display inconsistencies and could cause duplicate group names that visually look identical.  
**Fix:** `form.name.trim()` applied before insert, with empty-after-trim guard.

#### M-2: Dispute resolution notes not trimmed before update
**File:** `Disputes.jsx`  
**Risk:** Blank or whitespace-only notes could be saved as "resolved" without meaningful content.  
**Fix:** `notes.trim()` applied before the update call and before the empty-check guard.

#### M-3: Magic link and OAuth redirect URL hardcoded
**File:** `src/pages/Login.jsx`  
**Risk:** `'https://acpay-admin-panel.vercel.app/dashboard'` was a string literal. If the app is deployed to a different URL, auth redirects silently break. Local development always redirected to production.  
**Fix:** Now reads `import.meta.env.VITE_APP_URL` with the Vercel URL as fallback. Added `VITE_APP_URL` to `.env.example`.

---

### LOW — 2

#### L-1: No guard on missing environment variables in Supabase client
**File:** `src/lib/supabase.js`  
**Risk:** If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are undefined (misconfigured deploy), the Supabase client silently initialises with `undefined` values, producing confusing "Failed to fetch" errors with no indication of the root cause.  
**Fix:** Added startup guard that throws a descriptive error during module load if either variable is missing. This surfaces immediately in the browser console during development.

#### L-2: Auth error messages shown verbatim on Login page
**File:** `src/pages/Login.jsx`  
**Risk:** Supabase auth errors like `"Email not confirmed"` or `"Invalid OTP"` are shown directly. These are intentional UX (users need to know why sign-in failed) and do not leak schema data, but they confirm whether an email address is registered.  
**Status:** Accepted — auth feedback is expected behaviour. No fix applied.  
**TODO:** If account enumeration becomes a concern (e.g., public-facing app), replace with a generic `"If an account exists, a link was sent."` message regardless of outcome.

---

## RLS Coverage — Final State

| Table | RLS Enabled | authenticated Policy | service_role Bypass |
|-------|------------|---------------------|---------------------|
| `sol_groups` | ✅ | `created_by = auth.uid()` | ✅ |
| `sol_members` | ✅ | `group_id IN (owned groups)` | ✅ |
| `sol_payments` | ✅ | `group_id IN (owned groups)` | ✅ |
| `sol_disputes` | ✅ | `payment_id IN (owned group payments)` | ✅ |
| `sol_audit_log` | ✅ **[Added]** | `group_id IN (owned groups)` — SELECT only | ✅ |

---

## Environment Variable Audit

| Variable | In src/? | In .env.example? | Value in .env.example |
|----------|----------|-----------------|----------------------|
| `VITE_SUPABASE_URL` | `import.meta.env` only | ✅ | Placeholder |
| `VITE_SUPABASE_ANON_KEY` | `import.meta.env` only | ✅ | Placeholder |
| `VITE_N8N_WEBHOOK_URL` | `import.meta.env` only | ✅ | Real webhook URL (non-secret) |
| `VITE_GOOGLE_CLIENT_ID` | `import.meta.env` only | ✅ | Placeholder |
| `VITE_APP_URL` | `import.meta.env` only | ✅ **[Added]** | Placeholder |

No secrets hardcoded in `src/`. The `VITE_N8N_WEBHOOK_URL` in `.env.example` is the real webhook URL — this is acceptable as n8n webhooks require no authentication token and the URL itself is not a secret.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/errors.js` | **Created** — `friendlyError()` helper |
| `src/lib/supabase.js` | Added env-var guard on init |
| `.gitignore` | **Rewritten** — UTF-8, full Vite ignore list |
| `.env.example` | Added `VITE_APP_URL`, replaced real Supabase URL with placeholder |
| `rls_admin_policies.sql` | Added `sol_audit_log` RLS policies |
| `src/pages/Login.jsx` | `REDIRECT` now from `VITE_APP_URL` env var |
| `src/pages/GroupNew.jsx` | `friendlyError` + trim group name |
| `src/pages/Disputes.jsx` | `friendlyError` + trim resolution notes |
| `src/pages/CycleAdvance.jsx` | `friendlyError` (2 call sites) |
| `src/pages/GroupDetail.jsx` | `friendlyError` in EditMemberModal (2 call sites) |
| `src/pages/MemberAdd.jsx` | `friendlyError` |
| `src/components/ImportMembersModal.jsx` | `friendlyError` |
