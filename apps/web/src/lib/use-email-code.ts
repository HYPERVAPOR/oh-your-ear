import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'

const RESEND_SECONDS = 60

/**
 * Sending and re-sending an email verification code, with the one thing every caller needs:
 * whether it went out. The cooldown is the server's (`RequestEmailCode` refuses a second code
 * for the same address within a minute), mirrored here so the button can count it down instead
 * of failing.
 *
 * `send` answers true when the endpoint accepted the address. It answers 204 for any address
 * — that is what keeps it from being a way to ask who has an account — so a false only ever
 * means a bad address or a spent budget.
 */
export function useEmailCode() {
  const { t } = useTranslation('common')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const send = useCallback(
    async (email: string): Promise<boolean> => {
      setBusy(true)
      setError(undefined)
      const { response } = await apiClient.POST('/auth/code', { body: { email } })
      setBusy(false)

      if (response.status === 204) {
        setSent(true)
        setCooldown(RESEND_SECONDS)
        return true
      }
      setError(t(response.status === 429 ? 'auth.tooManyRequests' : 'auth.invalidEmail'))
      return false
    },
    [t],
  )

  /** Going back to the address step: a different address gets its own cooldown. */
  const restart = useCallback(() => {
    setSent(false)
    setCooldown(0)
    setError(undefined)
  }, [])

  const clearError = useCallback(() => setError(undefined), [])

  return { sent, cooldown, busy, error, send, restart, clearError }
}
