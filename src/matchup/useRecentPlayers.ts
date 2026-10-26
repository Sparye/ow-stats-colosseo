import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { parseRecentPlayers, rememberPlayer } from '../domain/recentPlayers'
import type { SlotState } from './useSlots'

const STORAGE_KEY = 'recentPlayers'
const listeners = new Set<() => void>()

// Storage can be missing or blocked (private windows, blocked site data); then nothing is remembered.
function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function write(recent: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  } catch {
    return
  }
  listeners.forEach((listener) => listener())
}

// The storage event covers other tabs; `listeners` covers this one.
function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** Remembers every Player whose profile loaded, so their BattleTag can be offered next time. */
export function useRecentPlayers(slots: SlotState[]): string[] {
  const stored = useSyncExternalStore(subscribe, read)
  // A summary means the BattleTag is real, even if the profile is private or has no games.
  const foundKey = slots
    .filter((slot) => 'summary' in slot)
    .map((slot) => slot.playerId)
    .join(',')

  useEffect(() => {
    if (foundKey) write(foundKey.split(',').reduceRight(rememberPlayer, parseRecentPlayers(read())))
  }, [foundKey])

  return useMemo(() => parseRecentPlayers(stored), [stored])
}
