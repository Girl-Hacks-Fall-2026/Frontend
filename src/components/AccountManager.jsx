import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AccountManager.css'

export default function AccountManager() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [authOpen, setAuthOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authMode, setAuthMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [accountUsername, setAccountUsername] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const signupUsername = session?.user.user_metadata?.username

  useEffect(() => {
    if (!supabase) return undefined

    let mounted = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset-password')
        setAuthOpen(true)
        setNewPassword('')
        setConfirmPassword('')
        setMessage('')
        setError('')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user.id) return undefined

    let mounted = true
    supabase
      .from('User_Profile')
      .select('username')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(async ({ data, error: profileError }) => {
        if (!mounted) return
        if (profileError) {
          setError(`Unable to load username: ${profileError.message}`)
          return
        }

        if (data?.username) {
          setAccountUsername(data.username)
          return
        }

        const initialUsername = signupUsername?.trim()
        if (!initialUsername) {
          setAccountUsername('')
          return
        }

        const { error: insertError } = await supabase
          .from('User_Profile')
          .insert({ user_id: session.user.id, username: initialUsername })
        if (!mounted) return
        if (insertError?.code === '23505') {
          setError('That username is already taken. Choose another in Account settings.')
          setAccountUsername('')
          return
        }
        if (insertError) {
          setError(`Unable to save username: ${insertError.message}`)
          return
        }
        setAccountUsername(initialUsername)
      })
      .catch((profileError) => {
        if (mounted) {
          setError(profileError instanceof Error ? profileError.message : 'Unable to load username.')
        }
      })

    return () => {
      mounted = false
    }
  }, [session?.user.id, signupUsername])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (authMode === 'forgot-password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (resetError) throw resetError
        setMessage('If an account exists for that email, a password reset link has been sent.')
        return
      }

      if (authMode === 'reset-password') {
        if (newPassword !== confirmPassword) throw new Error('The new passwords do not match.')
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
        if (updateError) throw updateError
        setPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setAuthOpen(false)
        setMessage('Password updated. You can sign in with your new password.')
        return
      }

      const result = authMode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { username: username.trim() },
            },
          })

      if (result.error) throw result.error
      if (result.data.session) {
        setAuthOpen(false)
        setPassword('')
      } else if (authMode === 'sign-up') {
        setMessage('Check your email to confirm your account, then sign in.')
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to complete the request.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return

    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.')
    }
  }

  async function openSettings() {
    if (!supabase || !session) return

    setError('')
    setMessage('')
    setDeleteConfirmation('')
    setSettingsLoading(true)
    setSettingsOpen(true)

    try {
      const { data, error: profileError } = await supabase
        .from('User_Profile')
        .select('username')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (profileError) throw profileError
      setUsername(data?.username || '')
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : 'Unable to load account settings.')
    } finally {
      setSettingsLoading(false)
    }
  }

  async function saveUsername(event) {
    event.preventDefault()
    if (!supabase || !session) return

    const value = username.trim()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: updateError } = await supabase
        .from('User_Profile')
        .update({ username: value })
        .eq('user_id', session.user.id)
        .select('user_id')
        .maybeSingle()

      if (updateError?.code === '23505') throw new Error('That username is already taken.')
      if (updateError) throw updateError

      if (!data) {
        const { error: insertError } = await supabase
          .from('User_Profile')
          .insert({ user_id: session.user.id, username: value })

        if (insertError?.code === '23505') {
          throw new Error('That username is already taken.')
        }
        if (insertError) throw insertError
      }

      setAccountUsername(value)
      setMessage('Username updated.')
    } catch (updateError) {
      const detail =
        updateError instanceof Error
          ? updateError.message
          : updateError?.message || 'Unable to update username.'
      if (detail.includes('User_Profile') || detail.includes('username')) {
        setError(`${detail} Check that User_Profile is exposed in the Supabase API and your user can update their own row.`)
      } else {
        setError(detail)
      }
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    if (!supabase) return
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update password.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount() {
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      })
      if (deleteError) {
        const details = await readFunctionError(deleteError)
        throw new Error(details || deleteError.message)
      }

      setSettingsOpen(false)
      setMessage('Account deleted.')
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signOutError) setError(`Account deleted, but local sign-out failed: ${signOutError.message}`)
      } catch (signOutError) {
        setError(
          `Account deleted, but local sign-out failed: ${
            signOutError instanceof Error ? signOutError.message : 'Unknown error.'
          }`,
        )
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete the account.')
    } finally {
      setBusy(false)
    }
  }

  async function readFunctionError(functionError) {
    if (functionError.context instanceof Response) {
      try {
        const body = await functionError.context.clone().json()
        if (typeof body.error === 'string') return body.error
        if (typeof body.message === 'string') return body.message
      } catch {
        return functionError.message
      }
    }
    return functionError.message
  }

  function openAuth(mode = 'sign-in') {
    setAuthMode(mode)
    setMessage('')
    setError('')
    setAuthOpen(true)
  }

  return (
    <div className="account-manager">
      <div aria-live="polite" className="account-notices">
        {error && !authOpen && !settingsOpen && <p className="account-error">{error}</p>}
        {message && !authOpen && !settingsOpen && <p className="account-message">{message}</p>}
      </div>

      {!supabase ? (
        <p className="account-status">Add Supabase environment variables to enable accounts.</p>
      ) : authLoading ? (
        <p className="account-status" role="status">Checking session…</p>
      ) : session ? (
        <div className="account-controls">
          <span className="account-username" title={session.user.email}>
            {accountUsername ? `@${accountUsername}` : 'Choose username'}
          </span>
          <button className="account-button secondary" onClick={openSettings} type="button">
            Account settings
          </button>
          <button className="account-button secondary" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      ) : (
        <button className="account-button" onClick={() => openAuth()} type="button">Sign in</button>
      )}

      {authOpen && supabase && (
        <div className="account-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAuthOpen(false)
        }}>
          <section aria-labelledby="auth-title" aria-modal="true" className="account-dialog" role="dialog">
            <button aria-label="Close" className="account-close" onClick={() => setAuthOpen(false)} type="button">×</button>
            <h1 id="auth-title">
              {authMode === 'sign-in'
                ? 'Sign in'
                : authMode === 'sign-up'
                  ? 'Create account'
                  : authMode === 'forgot-password'
                    ? 'Reset your password'
                    : 'Choose a new password'}
            </h1>
            <form className="account-form" onSubmit={handleAuthSubmit}>
              {authMode === 'sign-up' && (
                <label>
                  Username
                  <span className="field-hint">3–24 letters, numbers, or underscores. Capitalization is preserved.</span>
                  <input
                    autoComplete="username"
                    maxLength={24}
                    minLength={3}
                    onChange={(event) => setUsername(event.target.value)}
                    pattern="[a-zA-Z0-9_]{3,24}"
                    required
                    value={username}
                  />
                </label>
              )}
              {authMode !== 'reset-password' && <label>
                Email
                <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>}
              {authMode === 'sign-in' || authMode === 'sign-up' ? (
                <label>
                  Password
                  <input autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'} minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
                </label>
              ) : authMode === 'reset-password' ? (
                <>
                  <label>
                    New password
                    <input autoComplete="new-password" minLength={6} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
                  </label>
                  <label>
                    Confirm new password
                    <input autoComplete="new-password" minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
                  </label>
                </>
              ) : null}
              {error && <p aria-live="polite" className="account-error">{error}</p>}
              {message && <p aria-live="polite" className="account-message">{message}</p>}
              <button className="account-button submit" disabled={busy} type="submit">
                {busy ? 'Please wait…' : authMode === 'sign-in' ? 'Sign in' : authMode === 'sign-up' ? 'Create account' : authMode === 'forgot-password' ? 'Send reset link' : 'Update password'}
              </button>
            </form>
            {authMode === 'sign-in' && (
              <p className="account-switch">
                <button className="account-link" onClick={() => {
                  setAuthMode('forgot-password')
                  setMessage('')
                  setError('')
                }} type="button">Forgot password?</button>
              </p>
            )}
            {(authMode === 'sign-in' || authMode === 'sign-up') && (
              <p className="account-switch">
                {authMode === 'sign-in' ? 'New here?' : 'Already have an account?'}{' '}
                <button className="account-link" onClick={() => {
                  setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')
                  setError('')
                  setMessage('')
                }} type="button">
                  {authMode === 'sign-in' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            )}
            {authMode === 'forgot-password' && (
              <p className="account-switch">
                Remembered it?{' '}
                <button className="account-link" onClick={() => {
                  setAuthMode('sign-in')
                  setError('')
                  setMessage('')
                }} type="button">Back to sign in</button>
              </p>
            )}
          </section>
        </div>
      )}

      {settingsOpen && session && supabase && (
        <div className="account-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false)
        }}>
          <section aria-labelledby="settings-title" aria-modal="true" className="account-dialog settings-dialog" role="dialog">
            <button aria-label="Close account settings" className="account-close" onClick={() => setSettingsOpen(false)} type="button">×</button>
            <h1 id="settings-title">Account settings</h1>
            {settingsLoading ? (
              <p className="account-status" role="status">Loading account…</p>
            ) : (
              <div className="settings-content">
                <form className="account-form settings-section" onSubmit={saveUsername}>
                  <label>
                    Username
                    <span className="field-hint">3–24 letters, numbers, or underscores. Capitalization is preserved.</span>
                    <input autoComplete="username" maxLength={24} minLength={3} onChange={(event) => setUsername(event.target.value)} pattern="[a-zA-Z0-9_]{3,24}" required value={username} />
                  </label>
                  <button className="account-button submit" disabled={busy} type="submit">Save username</button>
                </form>
                <form className="account-form settings-section" onSubmit={savePassword}>
                  <label>
                    New password
                    <input autoComplete="new-password" minLength={6} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
                  </label>
                  <label>
                    Confirm new password
                    <input autoComplete="new-password" minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
                  </label>
                  <button className="account-button submit" disabled={busy} type="submit">Change password</button>
                </form>
                {error && <p aria-live="polite" className="account-error">{error}</p>}
                {message && <p aria-live="polite" className="account-message">{message}</p>}
                <section aria-labelledby="delete-title" className="delete-section">
                  <h2 id="delete-title">Delete account</h2>
                  <p>This permanently deletes your account and cannot be undone.</p>
                  <label>
                    Type DELETE to confirm
                    <input autoComplete="off" onChange={(event) => setDeleteConfirmation(event.target.value)} value={deleteConfirmation} />
                  </label>
                  <button className="account-button delete-button" disabled={busy || deleteConfirmation !== 'DELETE'} onClick={deleteAccount} type="button">
                    Permanently delete account
                  </button>
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
