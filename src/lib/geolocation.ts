export interface Geopoint {
  latitude: number
  longitude: number
  accuracy: number
  address: string | null
  capturedAt: string
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
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

export function getCurrentPosition(options: PositionOptions = GEO_OPTIONS): Promise<Geopoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Perangkat tidak mendukung layanan lokasi."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toGeopoint(position)),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Izin lokasi ditolak."
            : "Lokasi belum dapat dibaca. Pastikan GPS aktif."
        reject(new Error(message))
      },
      options,
    )
  })
}

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
  navigator.geolocation?.clearWatch(watchId)
}

const addressCache = new Map<string, string | null>()

/** Mengubah koordinat menjadi alamat memakai layanan peta gratis OpenStreetMap. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`
  if (addressCache.has(key)) return addressCache.get(key) ?? null

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("lat", String(latitude))
    url.searchParams.set("lon", String(longitude))
    url.searchParams.set("zoom", "18")
    url.searchParams.set("addressdetails", "1")

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } })
    if (!response.ok) throw new Error("Gagal membaca alamat")
    const payload = (await response.json()) as { display_name?: string }
    const address = payload.display_name?.trim() || null
    addressCache.set(key, address)
    return address
  } catch {
    addressCache.set(key, null)
    return null
  }
}
