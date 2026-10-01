import { useEffect, useRef, useState } from "react"
import {
  clearWatch,
  getCurrentPosition,
  watchPosition,
  type Geopoint,
} from "@/lib/geolocation"
import { reverseGeocode } from "@/lib/geocode"

/** Jarak dua titik (meter) dengan pendekatan haversine. */
function distanceMeters(a: Geopoint, b: Geopoint): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Radius minimum agar reverse geocoding dipanggil lagi. */
const REGEOCODE_MIN_MOVE_M = 20

/**
 * Membaca GPS untuk halaman presensi.
 *
 * Catatan kuota: `watchPosition` bisa firing puluhan kali per menit. Kami hanya
 * memanggil reverse geocoding bila koordinat bergerak > 20 m dari hasil terakhir,
 * sehingga satu sesi absen memakai 1–2 request, bukan puluhan.
 */
export function useGeopoint(active: boolean) {
  const [point, setPoint] = useState<Geopoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolvingAddress, setResolvingAddress] = useState(false)

  // Ref (bukan state) agar tidak memicu effect ulang.
  const lastGeocoded = useRef<Geopoint | null>(null)
  const geocodeInFlight = useRef(false)
  // Titik terbaru yang request-nya ter-skip karena ada request lain berjalan.
  const pendingGeocode = useRef<Geopoint | null>(null)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    lastGeocoded.current = null
    geocodeInFlight.current = false
    pendingGeocode.current = null

    const maybeGeocode = (target: Geopoint) => {
      const previous = lastGeocoded.current
      if (previous && distanceMeters(previous, target) < REGEOCODE_MIN_MOVE_M) return
      if (geocodeInFlight.current) {
        // Jangan buang: coba lagi setelah request yang berjalan selesai.
        pendingGeocode.current = target
        return
      }

      lastGeocoded.current = target
      geocodeInFlight.current = true
      setResolvingAddress(true)
      void reverseGeocode(target.latitude, target.longitude)
        .then((address) => {
          if (cancelled) return
          if (address) {
            setPoint((prev) => {
              if (!prev) return prev
              // Alamat masih valid selama titik kini tidak jauh dari titik
              // yang di-geocode (tidak harus sama persis — GPS selalu drift).
              if (distanceMeters(prev, target) > REGEOCODE_MIN_MOVE_M) return prev
              return { ...prev, address }
            })
          }
        })
        .finally(() => {
          geocodeInFlight.current = false
          if (!cancelled) setResolvingAddress(false)
          // Selesaikan antrean yang tadi ter-skip.
          const pending = pendingGeocode.current
          pendingGeocode.current = null
          if (!cancelled && pending) maybeGeocode(pending)
        })
    }

    const apply = (next: Geopoint) => {
      if (cancelled) return
      setPoint((prev) => {
        // Terima fix yang pertama, atau yang lebih akurat, atau yang jauh bergeser.
        // Alamat sebelumnya dipertahankan (titik masih berdekatan) supaya tidak
        // berkedip jadi "Alamat tidak tersedia" setiap GPS update.
        if (!prev) return next
        if (next.accuracy < prev.accuracy) return { ...next, address: prev.address }
        if (distanceMeters(prev, next) > 5) return { ...next, address: prev.address }
        return prev
      })
      setError(null)
      maybeGeocode(next)
    }

    void getCurrentPosition()
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
