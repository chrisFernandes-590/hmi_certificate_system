import { useEffect, useState } from 'react'

export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** Next page number for paged API responses ({ total, page, pageSize }), or undefined when done. */
export function nextPageParam(last: { total: number; page: number; pageSize: number }): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined
}
