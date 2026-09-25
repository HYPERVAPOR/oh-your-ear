import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { AppHeader } from '@/components/app-header'
import { AvatarPicker } from '@/components/avatar-picker'
import { PracticeStats } from '@/components/practice-stats'
import { StudyPlanForm } from '@/components/study-plan-form'
import { useAuthStore } from '@/stores/auth-store'
import { iconKey } from '@oh-your-ear/shared/pref-controls'

/** Account page: who you are, your plan, your progress, your mistake notebook. */
export function Me() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 px-6 py-12 sm:py-16">
        {/* Gutter outside the 1200px box and the same width as the header: with the
            padding inside, this column sat 300px inboard of the bar above it. */}
        <div className="mx-auto w-full max-w-[1200px]">
          {/* Where you came from, at the top left of the content and not in the bar: the bar
              is identical on every page and stays that way. A 32px square, the size and
              shape of the keys up there. */}
          <Link
            to="/"
            className={`${iconKey} mb-5 no-underline`}
            aria-label={t('actions.back')}
            title={t('actions.back')}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </Link>

          <header className="flex flex-wrap items-start gap-4">
            <div className="flex items-center gap-4">
              <AvatarPicker />
              <div>
                <p className="badge-label text-muted">{t('auth.account')}</p>
                <h1 className="mt-2 font-display text-[28px] font-medium leading-tight sm:text-[32px]">
                  {user?.name || t('auth.account')}
                </h1>
                <p className="mt-1.5 text-[15px] text-muted">{user?.email}</p>
              </div>
            </div>
          </header>

          <div className="mt-10 space-y-6">
            <StudyPlanForm />

            <PracticeStats />

            <Link
              to="/collections"
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
        </div>
      </main>
    </div>
  )
}
