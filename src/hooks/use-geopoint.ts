import { useEffect, useState } from "react"
import { clearWatch, getCurrentPosition, reverseGeocode, watchPosition, type Geopoint } from "@/lib/geolocation"

export function useGeopoint(active: boolean) {
  const [point, setPoint] = useState<Geopoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolvingAddress, setResolvingAddress] = useState(false)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const apply = (next: Geopoint) => {
      if (cancelled) return
      setPoint(next)
      setError(null)
      setResolvingAddress(true)
      void reverseGeocode(next.latitude, next.longitude).then((address) => {
        if (cancelled) return
        setResolvingAddress(false)
        if (!address) return
        setPoint((prev) => (prev ? { ...prev, address } : prev))
      })
    }

    getCurrentPosition()
      .then(apply)
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })

    const watchId = watchPosition(apply, (message) => {
      if (!cancelled) setError(message)
    })

    return () => {
      cancelled = true
      if (watchId !== null) clearWatch(watchId)
    }
  }, [active])

  return { point, error, resolvingAddress }
}
