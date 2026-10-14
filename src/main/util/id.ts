/** Tiny helpers for generating ids and timestamps used across repositories. */
import { randomUUID } from 'crypto'

/** Returns a new random UUID string for use as a primary key. */
export function newId(): string {
  return randomUUID()
}

/** Returns the current time as epoch milliseconds (our standard timestamp). */
export function now(): number {
  return Date.now()
}
