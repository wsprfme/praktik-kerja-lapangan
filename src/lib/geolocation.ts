export interface Geopoint {
  latitude: number
  longitude: number
  /** Radius akurasi dalam meter. <= ACCURACY_GOOD dianggap dapat diandalkan. */
  accuracy: number
  address: string | null
  /** Waktu pengambilan koordinat (ISO). */
  capturedAt: string
}

/** Ambang akurasi "baik" (meter) untukQD considers presensi dapat di trusting. */
export const ACCURACY_GOOD = 50
/** Ambang akurasi "buruk" (meter) di atas ini koordinat ditolak. */
export const ACCURACY_POOR = 200

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
}

function toGeopoint(position: GeolocationPosition): Geopoint {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    address: null,
    capturedAt: new Date().toISOString(),
  }
}

/**
 * Ambil koordinat terbaik yang tersedia.
 * -_memprioritaskan fix dengan accuracy <= ACCURACY_GOOD
 * - Menunggu maks. 8 detik sambil rewatch
 * - Selalu membersihkan watch & timer di semua jalur keluar (m2: tidak ada leak)
 */
export function getCurrentPosition(options: PositionOptions = GEO_OPTIONS): Promise<Geopoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Perangkat tidak mendukung layanan lokasi."))
      return
    }

    let settled = false
    let watchId: number | null = null
    const attempts: GeolocationPosition[] = []

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer)
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId)
        } catch {
          /* abaikan */
        }
        watchId = null
      }
    }

    const finish = (point: Geopoint) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(point)
    }

    const fail = (message: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(message))
    }

    const timer = setTimeout(() => {
      if (attempts.length > 0) {
        // Ambil yang paling akurat meski belum ideal.
        attempts.sort((a, b) => a.coords.accuracy - b.coords.accuracy)
        finish(toGeopoint(attempts[0]))
      } else {
        // Fallback low-accuracy sekali lagi.
        try {
          navigator.geolocation.getCurrentPosition(
            (pos) => finish(toGeopoint(pos)),
            () => fail("Lokasi belum dapat dibaca. Pastikan GPS aktif dan coba di dekat jendela."),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
          )
        } catch {
          fail("Lokasi belum dapat dibaca. Pastikan GPS aktif dan coba di dekat jendela.")
        }
      }
    }, 8000)

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (settled) return
          attempts.push(pos)
          if (pos.coords.accuracy <= ACCURACY_GOOD) finish(toGeopoint(pos))
        },
        () => {
          /* biarkan: akan jatuh ke timeout/fallback */
        },
        options,
      )
    } catch {
      fail("Lokasi belum dapat dibaca. Pastikan GPS aktif.")
    }
  })
}

/** Watch berkelanjutan; mengembalikan handle untuk clearWatch(). */
export function watchPosition(
  onUpdate: (point: Geopoint) => void,
  onError?: (message: string) => void,
): number | null {
  if (!navigator.geolocation) {
    onError?.("Perangkat tidak mendukung layanan lokasi.")
    return null
  }
  return navigator.geolocation.watchPosition(
    (position) => onUpdate(toGeopoint(position)),
    () => onError?.("Lokasi belum dapat dibaca. Pastikan GPS aktif."),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
  )
}

export function clearWatch(watchId: number): void {
  try {
    navigator.geolocation?.clearWatch(watchId)
  } catch {
    /* abaikan */
  }
}

/** Deskripsi singkat akurasi untuk ditampilkan ke pengguna. */
export function accuracyLabel(accuracy: number): string {
  if (accuracy <= ACCURACY_GOOD) return "Sangat akurat"
  if (accuracy <= ACCURACY_POOR) return "Cukup akurat"
  return "Kurang akurat"
}
