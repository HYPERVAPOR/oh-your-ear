import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { PracticeStats } from '@/components/practice-stats'
import { StudyPlanForm } from '@/components/study-plan-form'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

/** Account page. Study plans, stats and the mistake notebook land here in M8–M10. */
export function Me() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-bold">{t('auth.account')}</h1>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t('auth.backHome')}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-12">
        <dl className="space-y-4 rounded-md border border-border p-6">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{t('auth.email')}</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          {user?.name && (
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{t('auth.name')}</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
          )}
        </dl>

        <StudyPlanForm />

        <PracticeStats />

        <Link
          to="/mistakes"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('mistakes.open')}
        </Link>

        <Button variant="outline" onClick={handleLogout}>
          {t('actions.logout')}
        </Button>
      </main>
    </div>
  )
}
