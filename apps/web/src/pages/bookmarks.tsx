import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'

import { apiClient } from '@/api/client'
import { AppHeader } from '@/components/app-header'
import { useCollections, type Collection } from '@/components/collect-menu'
import { modulePath } from '@/components/round-summary'
import { Button } from '@/components/ui/button'
import { Card, EmptyState } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { ModuleSwatch, type ExerciseKind } from '@/components/ui/orb'
import { pickText, useLevelCatalog, type LevelSet } from '@/lib/levels'
import { useAuthStore } from '@/stores/auth-store'

/** Levels are addressed by slug; this finds one in the catalog. */
function findLevel(sets: LevelSet[], slug: string) {
  for (const set of sets) {
    const level = set.levels.find((item) => item.slug === slug)
    if (level) return { set, level }
  }
  return undefined
}

/** The user's folders, each with the levels inside it, openable straight away. */
export function Bookmarks() {
  const { t, i18n } = useTranslation('common')
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { data: collections } = useCollections()
  const { data: catalog } = useLevelCatalog()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['collections'] })

  const remove = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      await apiClient.DELETE('/me/collections/{id}/levels/{levelId}', {
        params: { path: { id, levelId: slug } },
      })
    },
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.PATCH('/me/collections/{id}', { params: { path: { id } }, body: { name } })
    },
    onSuccess: invalidate,
  })

  const drop = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.DELETE('/me/collections/{id}', { params: { path: { id } } })
    },
    onSuccess: invalidate,
  })

  function folderName(collection: Collection) {
    return collection.isDefault ? t('collections.defaultName') : collection.name
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="text-[30px] font-medium leading-tight sm:text-[36px]">
          {t('collections.title')}
        </h1>
        <p className="mt-3 max-w-[54ch] text-[15px] text-body">{t('collections.intro')}</p>

        {!user && (
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-surface px-5 py-4">
            <p className="text-[15px] text-body">{t('collections.guestBanner')}</p>
            <Link
              to="/login"
              state={{ from: '/bookmarks' }}
              className="inline-flex h-10 items-center rounded-none bg-primary px-5 text-[15px] font-medium text-on-primary transition-opacity hover:opacity-90"
            >
              {t('actions.login')}
            </Link>
          </div>
        )}

        {user && (collections ?? []).length === 0 && (
          <EmptyState className="mt-8">{t('collections.empty')}</EmptyState>
        )}

        <div className="mt-8 space-y-6">
          {(collections ?? []).map((collection) => (
            <Card key={collection.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {collection.isDefault ? (
                  <h2 className="text-[20px] font-medium">{folderName(collection)}</h2>
                ) : (
                  <RenameField
                    value={collection.name}
                    onRename={(next) => rename.mutate({ id: collection.id, name: next })}
                  />
                )}

                {!collection.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted"
                    onClick={() => drop.mutate(collection.id)}
                    disabled={drop.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('collections.deleteFolder')}
                  </Button>
                )}
              </div>

              {collection.levels.length === 0 ? (
                <p className="mt-4 text-[14px] text-muted">{t('collections.folderEmpty')}</p>
              ) : (
                <ul className="mt-4 divide-y divide-hairline">
                  {collection.levels.map((slug) => {
                    const found = catalog ? findLevel(catalog, slug) : undefined
                    const kind = found?.set.module as ExerciseKind | undefined
                    const title = found ? pickText(found.level.title, i18n.language) : slug

                    return (
                      <li
                        key={slug}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <span className="flex items-center gap-3 text-[15px]">
                          {kind && <ModuleSwatch kind={kind} />}
                          <span className="font-medium">{title}</span>
                          <span className="text-[13px] text-muted">
                            {kind ? t(`modules.${kind}`) : ''}
                          </span>
                        </span>

                        <span className="flex items-center gap-4">
                          {kind && (
                            <Link
                              to={`/exercise/${modulePath(kind)}?level=${slug}`}
                              className="text-[15px] font-medium underline underline-offset-4"
                            >
                              {t('collections.practise')}
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted"
                            onClick={() => remove.mutate({ id: collection.id, slug })}
                          >
                            {t('collections.remove')}
                          </Button>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

/** Renaming in place: a folder name is short, and a dialog for it is overkill. */
function RenameField({ value, onRename }: { value: string; onRename: (name: string) => void }) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState(value)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (draft.trim() && draft.trim() !== value) onRename(draft.trim())
      }}
    >
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft.trim() && draft.trim() !== value && onRename(draft.trim())}
        aria-label={t('collections.rename')}
        className="h-10 w-56 text-[18px] font-medium"
      />
    </form>
  )
}
