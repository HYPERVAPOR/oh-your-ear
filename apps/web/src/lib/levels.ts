import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import type { ExerciseKind } from '@/components/ui/orb'

/**
 * Levels used to be a hardcoded array here. They are product content that has to
 * grow and be curated (collections hang off them), so the catalog now comes from
 * the API and this module only holds the types and the pure decisions.
 */
export interface LevelConfig {
  whiteKeys?: boolean
  blackKeys?: boolean
  range?: string
  intervals?: string[]
  types?: string[]
  length?: number
  speed?: string
  patternLength?: number
  durations?: number[]
}

export interface LocalizedText {
  zh: string
  en: string
}

export interface Level {
  slug: string
  position: number
  title: LocalizedText
  questions: number
  passMark: number
  config?: LevelConfig
}

export interface LevelSet {
  slug: string
  module: ExerciseKind
  title: LocalizedText
  description?: LocalizedText
  levels: Level[]
}

export interface LevelProgressEntry {
  levelId: string
  passed: boolean
  bestAccuracy: number
}

/** The official catalog. Public, so guests see the ladder too. */
export function useLevelCatalog() {
  return useQuery({
    queryKey: ['level-sets'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.GET('/levels/sets')
      return (data ?? []) as LevelSet[]
    },
  })
}

/** Copy in the reader's language. */
export function pickText(text: LocalizedText | undefined, language: string): string {
  if (!text) return ''
  return language.startsWith('zh') ? text.zh : text.en
}

/** The chain for one module, in play order. */
export function levelsFor(sets: LevelSet[], module: ExerciseKind): Level[] {
  return sets.find((set) => set.module === module)?.levels ?? []
}

/** The level to continue a chain with: the first one not passed yet. */
export function currentLevel(
  sets: LevelSet[],
  module: ExerciseKind,
  progress: Map<string, LevelProgressEntry>,
): Level | undefined {
  const chain = levelsFor(sets, module)
  return chain.find((level) => !progress.get(level.slug)?.passed) ?? chain[chain.length - 1]
}

/**
 * Whether this screen was opened as a question set. Read from the URL rather than from
 * the catalogue, so the answer is the same before the catalogue has loaded: a level
 * fixes the configuration and the round size, and its screen must not offer to change
 * them — not even for the moment before the level itself arrives.
 */
export function useLevelRequested(): boolean {
  return useSearchParams()[0].has('level')
}

/**
 * The level the current screen was opened with, if any. A level pins the exercise
 * configuration and the round size, which is what lets a question set run through
 * the normal practice screen.
 */
export function useActiveLevel(sets: LevelSet[], module: ExerciseKind): Level | undefined {
  const slug = useSearchParams()[0].get('level')
  if (!slug) return undefined

  const level = levelsFor(sets, module).find((item) => item.slug === slug)
  return level
}
