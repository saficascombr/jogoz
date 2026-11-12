import type { Player } from './types'

export const STORAGE_KEY = 'jogoz-players'

export function loadPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPlayer)
  } catch {
    return []
  }
}

export function savePlayers(players: Player[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players))
}

function isPlayer(value: unknown): value is Player {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.chances === 'number' &&
    Number.isFinite(candidate.chances) &&
    candidate.chances >= 1
  )
}
