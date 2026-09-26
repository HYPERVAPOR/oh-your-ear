import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Deleting the account, at the bottom of the account page.
 *
 * **Dev only for now**, and the gate is the page's (`import.meta.env.DEV`), so this component
 * is the whole surface wherever it is drawn. Deleting an account with nothing but the session
 * behind it is fine while the only person who can reach it is a developer on their own
 * machine; production is meant to put the email-code step in front of it first (PRD 5.10,
 * M38.2). Until then the API is the same as it will be then: `DELETE /me`.
 */
export function DangerZone() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const clearSession = useAuthStore((s) => s.clearSession)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function deleteAccount() {
    setBusy(true)
    setFailed(false)
    const { response } = await apiClient.DELETE('/me')
    setBusy(false)

    if (!response.ok) {
      setFailed(true)
      return
    }

    // The account is gone: no session left to keep, and nothing left to keep cached for it.
    // Leaving the tokens in hand would leave the app drawing a dashboard for a row that is
    // not there any more.
    clearSession()
    navigate('/', { replace: true })
  }

  return (
    // Not the hairline card the blocks above it use: the border takes the error hue and the
    // surface takes a 5% wash of it, so the block reads as an area marked off from the rest
    // of the page instead of one more settings card. That plus the heading and the outlined
    // red button are the whole of the danger vocabulary — ink stays the only filled action
    // colour (DESIGN.md).
    <section className="rounded-xl border border-error/40 bg-error/5 px-6 py-5">
      <h2 className="text-[20px] leading-tight font-medium text-error-text">
        {t('account.dangerTitle')}
      </h2>
      <p className="mt-1 max-w-prose text-[14px] text-muted">{t('account.dangerBody')}</p>

      <Button
        variant="destructive"
        className="mt-4"
        disabled={busy}
        onClick={() => setAsking(true)}
      >
        {t('account.dangerDelete')}
      </Button>

      {/* Its line is held open, the way `Field` does it: a message that appears after the
          click must not move the button that was just clicked. */}
      <p className="mt-2 min-h-[18px] text-[13px] leading-[18px] text-error-text">
        {failed ? t('account.dangerFailed') : ''}
      </p>

      <ConfirmDialog
        open={asking}
        title={t('account.dangerConfirmTitle')}
        description={t('account.dangerConfirmBody')}
        confirmLabel={t('account.dangerConfirmLabel')}
        destructive
        onConfirm={deleteAccount}
        onDismiss={() => setAsking(false)}
      />
    </section>
  )
}
