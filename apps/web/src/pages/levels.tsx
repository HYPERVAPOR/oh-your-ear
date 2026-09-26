import { useQuery } from '@tanstack/react-query'
import { useTranslation, Trans } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Lock } from 'lucide-react'

import { apiClient } from '@/api/client'
import { loginHere, loginPath } from '@/lib/auth'
import { AppHeader } from '@/components/app-header'
import { EmptyState } from '@/components/ui/card'
import { CollectMenu } from '@/components/collect-menu'
import { ModuleSwatch, MODULE_SWATCH, type ExerciseKind } from '@/components/ui/orb'
import { useAuthStore } from '@/stores/auth-store'
import { pickText, useLevelCatalog, type Level } from '@/lib/levels'
import { modulePath } from '@/components/round-summary'
import { cn } from '@/lib/utils'
import { iconKey } from '@oh-your-ear/shared/pref-controls'

/**
 * All levels: one chain per module, easy to hard, for signed-in users. A level is locked
 * until the one before it is passed, so the page is really a picture of progress — one
 * picture at a time, chosen by a tab.
 */
export function Levels() {
  const { t, i18n } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  // Guests see the whole ladder — that is the invitation. Only their progress is
  // unknown, and the endpoint answers 401, so it is not asked for.
  const { data: catalog } = useLevelCatalog()

  const { data } = useQuery({
    queryKey: ['level-progress'],
    enabled: !!user,
    queryFn: async () => {
      const { data: progress } = await apiClient.GET('/me/levels')
      return progress
    },
  })

  const progressById = new Map((data ?? []).map((entry) => [entry.levelId, entry]))

  // One chain at a time: five chains stacked vertically meant scrolling past four of them
  // to reach the fifth. The tabs, their order and their names all come from the catalogue;
  // nothing here knows the five modules by name.
  //
  // Which tab you are on is in the URL, so the dashboard can link to one (PRD 7.1.4) and a
  // tab is shareable. An unknown or absent value falls back to the first one rather than
  // rendering nothing.
  const [params, setParams] = useSearchParams()
  const sets = catalog ?? []
  const modules = [...new Set(sets.map((set) => set.module))]
  const asked = params.get('module')
  const activeKind = modules.find((module) => module === asked) ?? modules[0]
  const shown = sets.filter((set) => set.module === activeKind)

  // replace: a tab is not a place you navigated to, so the back button keeps meaning
  // "leave this page" instead of walking back through the tabs you tried.
  function pick(module: ExerciseKind) {
    setParams({ module }, { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 px-6 py-12 sm:py-16">
        {/* Gutter outside the 1200px box and the same width as the header: with the
            padding inside, this column sat 300px inboard of the bar above it. */}
        <div className="mx-auto w-full max-w-[1200px]">
          {/* Where you came from, at the top left of the content and not in the bar: the bar is
              identical on every page and stays that way. The same 32px square the account page
              and its two subpages carry. */}
          <Link
            to="/"
            className={`${iconKey} mb-5 no-underline`}
            aria-label={t('actions.back')}
            title={t('actions.back')}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </Link>

          <h1 className="text-[30px] font-medium leading-tight sm:text-[36px]">
            {t('levels.title')}
          </h1>
          <p className="mt-3 max-w-[52ch] text-[15px] text-body">{t('levels.intro')}</p>

          {!user && (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-hairline bg-surface px-5 py-4">
              <p className="text-[15px] text-body">{t('levels.guestBanner')}</p>
              <Link
                to={loginHere()}
                className="inline-flex h-10 items-center rounded-none bg-primary px-5 text-[15px] font-medium text-on-primary transition-opacity hover:opacity-90"
              >
                {t('actions.login')}
              </Link>
              {/* The other answer, in the same place: the random tab needs no account at all,
                  which is the thing a guest looking at a locked chain most needs to hear. The
                  words around the link stay in the translation, so neither language has to be
                  assembled out of halves. */}
              <p className="text-[15px] text-body">
                <Trans
                  i18nKey="levels.guestTryRandom"
                  components={{
                    randomTest: (
                      <Link
                        to="/?mode=random"
                        className="font-medium text-ink underline underline-offset-4"
                      />
                    ),
                  }}
                />
              </p>
            </div>
          )}

          {/* Five siblings, not a switch. The welded group belongs to the dashboard's Learn /
              Random pair and the calendar's four magnifications — two or four answers to one
              question, cut out of a single plate. These are five modules, and each one already
              has a colour on the dashboard, so the tab carries that colour and the one you are
              on is underlined with it.

              Equal shares, because the English names are nothing like each other in length and
              a row that resizes as you click is a row that jumps. A floor under each one, so
              they stay wide enough to hit on a phone, where the row scrolls rather than wraps. */}
          <nav aria-label={t('levels.title')} className="mt-8 flex max-w-full overflow-x-auto">
            {modules.map((value) => {
              const active = activeKind === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pick(value)}
                  className={cn(
                    'relative flex min-w-28 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2.5 text-[15px] transition-colors',
                    active ? 'text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  <ModuleSwatch kind={value} />
                  {t(`modules.${value}`)}
                  {/* Only the one you are on, and absolutely placed so that having it or not
                      having it cannot change the height of the row. */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className={cn('absolute inset-x-0 bottom-0 h-0.5', MODULE_SWATCH[value])}
                    />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-8 space-y-10">
            {shown.map((set) => {
              const kind = set.module
              const chain: Level[] = set.levels
              // A level is open when it is the first, or the one before it is passed.
              const openIndex = chain.findIndex((level) => !progressById.get(level.slug)?.passed)

              return (
                <section key={set.slug}>
                  {/* The tab already names the module, so a heading only earns its line when
                      this module has more than one set to tell apart. */}
                  {shown.length > 1 && (
                    <div className="flex items-center gap-3">
                      <ModuleSwatch kind={kind} />
                      <h2 className="text-[20px] font-medium">
                        {pickText(set.title, i18n.language)}
                      </h2>
                    </div>
                  )}

                  <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {chain.map((level, index) => {
                      const progress = progressById.get(level.slug)
                      // A lock means "pass the level before it"; a guest is stopped by
                      // the sign-in step instead, so nothing is shown locked to them.
                      const locked = Boolean(user) && openIndex !== -1 && index > openIndex

                      return (
                        <li key={level.slug}>
                          {locked ? (
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline px-4 py-3.5 text-muted-soft">
                              <span className="flex items-center gap-3 text-[15px]">
                                <Lock className="h-4 w-4" />
                                {pickText(level.title, i18n.language)}
                              </span>
                              <span className="text-[13px]">
                                {t('levels.questions', { count: level.questions })}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Link
                                to={
                                  user
                                    ? `/exercise/${modulePath(kind)}?level=${level.slug}`
                                    : loginPath(`/exercise/${modulePath(kind)}?level=${level.slug}`)
                                }
                                className="flex flex-1 items-center justify-between gap-4 rounded-xl border border-hairline bg-surface px-4 py-3.5 transition-colors hover:border-hairline-strong hover:bg-canvas-soft"
                              >
                                <span className="flex items-center gap-3 text-[15px] font-medium">
                                  {progress?.passed ? (
                                    <Check className="h-4 w-4 text-success-text" />
                                  ) : (
                                    <span className="h-4 w-4 rounded-none border border-hairline-strong" />
                                  )}
                                  {pickText(level.title, i18n.language)}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="tabular text-[13px] text-muted">
                                    {!user
                                      ? t('levels.questions', { count: level.questions })
                                      : progress
                                        ? t('levels.best', {
                                            percent: Math.round(progress.bestAccuracy * 100),
                                          })
                                        : t('levels.questions', { count: level.questions })}
                                  </span>
                                </span>
                              </Link>
                              <CollectMenu levelSlug={level.slug} />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )
            })}
          </div>

          {data && data.length === 0 && (
            <EmptyState className="mt-8">{t('levels.empty')}</EmptyState>
          )}
        </div>
      </main>
    </div>
  )
}
