import type { LocationQueryValue } from 'vue-router'

/**
 * Один и тот же ключ в URL может прийти массивом: `?type=movie&type=tv`.
 * Берём первый.
 */
export function firstValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return raw ?? ''
}
