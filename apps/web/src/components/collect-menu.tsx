import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Bookmark, BookmarkCheck, Plus } from 'lucide-react'

import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import type { components } from '@/api/schema'

export type Collection = components['schemas']['Collection']

/** Folders of levels, with the level slugs in each. Signed-in only. */
export function useCollections() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['collections'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await apiClient.GET('/me/collections')
      return (data ?? []) as Collection[]
    },
  })
}

/**
 * Collect control for one level: a bookmark that opens the user's folders as
 * checkboxes, so a level can sit in several at once.
 */
export function CollectMenu({ levelSlug }: { levelSlug: string }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { data: collections } = useCollections()

  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['collections'] })

  const toggle = useMutation({
    mutationFn: async ({ id, present }: { id: string; present: boolean }) => {
      if (present) {
        await apiClient.PUT('/me/collections/{id}/levels/{levelId}', {
          params: { path: { id, levelId: levelSlug } },
        })
        return
      }
      await apiClient.DELETE('/me/collections/{id}/levels/{levelId}', {
        params: { path: { id, levelId: levelSlug } },
      })
    },
    onSuccess: invalidate,
  })

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { data: created } = await apiClient.POST('/me/collections', { body: { name } })
      void created
    },
    onSuccess: invalidate,
  })

  const saved = (collections ?? []).some((collection) => collection.levels.includes(levelSlug))

  function label(collection: Collection) {
    return collection.isDefault ? t('collections.defaultName') : collection.name
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('collections.collect')}
        aria-expanded={open}
        onClick={() => (user ? setOpen((prev) => !prev) : navigate('/login'))}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-none transition-colors hover:bg-surface-strong',
          saved ? 'text-ink' : 'text-muted',
        )}
      >
        {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-hairline bg-surface p-3 shadow-lift">
          <p className="badge-label px-1 pb-2 text-muted">{t('collections.collect')}</p>

          <ul className="space-y-1">
            {(collections ?? []).map((collection) => {
              const inside = collection.levels.includes(levelSlug)
              return (
                <li key={collection.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[15px] hover:bg-surface-strong">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={inside}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate({ id: collection.id, present: !inside })}
                    />
                    {label(collection)}
                  </label>
                </li>
              )
            })}
          </ul>

          <form
            className="mt-2 flex gap-2 border-t border-hairline pt-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!newName.trim()) return
              create.mutate(newName.trim(), { onSuccess: () => setNewName('') })
            }}
          >
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t('collections.newFolder')}
              aria-label={t('collections.newFolder')}
              className="h-9 py-0 text-[14px]"
            />
            <Button type="submit" size="sm" variant="outline" disabled={create.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
