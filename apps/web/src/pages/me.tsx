import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { AppHeader } from '@/components/app-header'
import { PracticeStats } from '@/components/practice-stats'
import { StudyPlanForm } from '@/components/study-plan-form'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

/** Account page: who you are, your plan, your progress, your mistake notebook. */
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
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="badge-label text-muted">{t('auth.account')}</p>
            <h1 className="mt-2 font-display text-[28px] font-medium leading-tight sm:text-[32px]">
              {user?.name || t('auth.account')}
            </h1>
            <p className="mt-1.5 text-[15px] text-muted">{user?.email}</p>
          </div>

          <Button variant="outline" size="sm" onClick={handleLogout}>
            {t('actions.logout')}
          </Button>
        </header>

        <div className="mt-10 space-y-6">
          <StudyPlanForm />

          <PracticeStats />

          <Link
            to="/bookmarks"
            className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-6 py-5 transition-colors hover:border-hairline-strong"
          >
            <div>
              <h2 className="text-[20px] font-medium leading-tight">{t('collections.title')}</h2>
              <p className="mt-1 text-[14px] text-muted">{t('collections.openHint')}</p>
            </div>
            <span className="text-[15px] font-medium underline underline-offset-4">
              {t('collections.open')}
            </span>
          </Link>

          <Link
            to="/mistakes"
            className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-6 py-5 transition-colors hover:border-hairline-strong"
          >
            <div>
              <h2 className="font-display text-[20px] font-medium leading-tight">
                {t('mistakes.title')}
              </h2>
              <p className="mt-1 text-[14px] text-muted">{t('mistakes.openHint')}</p>
            </div>
            <span className="text-[15px] font-medium underline underline-offset-4">
              {t('mistakes.open')}
            </span>
          </Link>
        </div>
      </main>
    </div>
  )
}
