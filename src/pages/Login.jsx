import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail } from 'lucide-react'

// TODO (Medium): move VITE_APP_URL to Vercel env vars so local dev redirects correctly
const BASE     = import.meta.env.VITE_APP_URL ?? 'https://acpay-admin-panel.vercel.app'
const REDIRECT = `${BASE}/dashboard`

export default function Login() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  async function handleMagicLink(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: REDIRECT },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  async function handleGoogle() {
    setError('')
    setOauthLoading(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT },
    })
    if (err) { setError(err.message); setOauthLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#DC2626]">AcPay</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-5">

          {sent ? (
            <div className="text-center space-y-3 py-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto">
                <Mail size={22} className="text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">Check your email</p>
              <p className="text-sm text-gray-500">
                We sent a magic link to <span className="font-medium text-gray-700">{email}</span>.<br />
                Click the link to sign in.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="text-xs text-[#DC2626] hover:underline mt-1"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loading ? 'Sending link…' : 'Send magic link'}
                </button>
              </form>

              <div className="flex items-center gap-3">
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <span className="flex-1 h-px bg-gray-200" />
              </div>

              <button
                onClick={handleGoogle}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60"
              >
                <GoogleIcon />
                {oauthLoading ? 'Redirecting…' : 'Sign in with Google'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
