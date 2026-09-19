import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppHeader } from '@/components/app-header'
import { PlayButton } from '@/components/play-button'
import { TodayProgress } from '@/components/today-progress'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Orb } from '@/components/ui/orb'
import { useAuthStore } from '@/stores/auth-store'

const modules = [
  { key: 'singleNote', route: '/exercise/single-note' },
  { key: 'interval', route: '/exercise/interval' },
  { key: 'chord', route: '/exercise/chord' },
  { key: 'melody', route: '/exercise/melody' },
  { key: 'rhythm', route: '/exercise/rhythm' },
] as const

export function Home() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1">
        {/* Hero: the first thing a visitor meets is the sound itself, and the one
            action we want them to take. */}
        <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:pb-28 sm:pt-32">
          <Orb kind="ambient" size="lg" className="-top-28 left-1/2 -translate-x-1/2" />
          <div className="relative mx-auto flex max-w-[720px] flex-col items-center text-center">
            <h1 className="max-w-[24ch] text-balance text-[40px] font-light leading-[1.08] tracking-[-0.03em] sm:text-[60px]">
              {t('tagline')}
            </h1>
            <p className="mt-6 text-[17px] leading-[1.7] text-body">
              <span className="block">{t('home.heroLine1')}</span>
              <span className="block">{t('home.heroLine2')}</span>
            </p>

            <Link
              to="/exercise/single-note"
              className={`${buttonVariants({ size: 'hero' })} mt-10`}
            >
              {t('home.startCta')}
            </Link>

            <div className="mt-9 flex items-center gap-3 text-muted">
              <PlayButton note="C4" className="h-11 w-11" />
              <span className="text-[15px]">{t('actions.playNote', { note: 'C4' })}</span>
            </div>

            {!user && <p className="mt-6 text-[14px] text-muted">{t('home.guestNote')}</p>}
          </div>
        </section>

        {user && (
          <section className="px-6 pb-4">
            <div className="mx-auto max-w-[1200px]">
              <TodayProgress />
            </div>
          </section>
        )}

        {/* The five modules, each carrying the orb colour it owns everywhere else. */}
        <section className="px-6 pb-24 sm:pb-32">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="font-display text-[26px] font-light sm:text-[32px]">
              {t('home.modulesHeading')}
            </h2>

            {/* Five modules in rows of three: the second row is centred, so there is
                no hole where a sixth card would have been. */}
            <div className="mt-8 flex flex-wrap justify-center gap-5">
              {modules.map(({ key, route }) => (
                <Link
                  key={key}
                  to={route}
                  className="group block w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
                >
                  <Card
                    interactive
                    className="relative h-full min-h-[132px] overflow-hidden p-5 transition-colors group-hover:border-hairline-strong"
                  >
                    <Orb
                      kind={key}
                      size="md"
                      className="-bottom-16 -right-12 transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="relative">
                      <h3 className="font-display text-[24px] font-light leading-tight">
                        {t(`modules.${key}`)}
                      </h3>
                      <p className="mt-2 max-w-[30ch] text-[15px] text-body">
                        {t(`moduleHints.${key}`)}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {user && (
          <section className="px-6 pb-4">
            <div className="mx-auto max-w-[1200px]">
              <Link to="/levels" className={buttonVariants({ size: 'lg' })}>
                {t('levels.entry')}
              </Link>
              <p className="mt-3 max-w-[46ch] text-[14px] text-muted">{t('levels.entryHint')}</p>
            </div>
          </section>
        )}

        {!user && (
          <section className="px-6 pb-24 sm:pb-28">
            <div className="mx-auto max-w-[1200px]">
              <Card className="relative overflow-hidden p-7 sm:p-9">
                <Orb kind="ambient" size="md" className="-right-10 -top-20" />
                <div className="relative flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <h2 className="font-display text-[24px] font-light leading-tight">
                      {t('home.loginHeading')}
                    </h2>
                    <p className="mt-2 max-w-[46ch] text-[15px] text-body">
                      {t('home.loginCtaHint')}
                    </p>
                  </div>
                  <Link to="/login" className={buttonVariants({ size: 'lg' })}>
                    {t('actions.login')}
                  </Link>
                </div>
              </Card>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
