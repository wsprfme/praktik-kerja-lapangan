import { useEffect, useState } from "react"

export interface AsyncState<T> {
  data: T
  loading: boolean
  error: string | null
  reload: () => void
}

/** Memuat data async dengan status memuat/gagal dan pemicu muat ulang. */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  initial: T,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    loader()
      .then((result) => {
        if (!active) return
        setData(result)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : "Gagal memuat data.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload: () => setTick((value) => value + 1) }
}
