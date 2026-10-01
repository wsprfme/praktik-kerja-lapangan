/**
 * Reverse geocoding koordinat → alamat lengkap gaya Indonesia.
 *
 * Sumber: **Mapbox Geocoding v6** (https://docs.mapbox.com/api/search/geocoding/).
 * Nominatim (OpenStreetMap) hanya dipakai sebagai jaring pengaman kalau Mapbox
 * gagal dihubungi — bukan untuk melengkapi atau menimpa hasil Mapbox.
 *
 * Contoh hasil terverifikasi (OKU Timur, Sumatera Selatan):
 *   (-4.100296, 104.621634) → "Bangsa Negara, Belitang Madang Raya,
 *                             Ogan Komering Ulu Timur, Sumatera Selatan, 32363"
 *   (-4.108967, 104.645586) → "Gumawang, Belitang, Ogan Komering Ulu Timur,
 *                             Sumatera Selatan, 32382"
 *
 * Token Mapbox dibaca dari VITE_MAPBOX_TOKEN (file .env, tidak di-commit).
 *
 * ── Catatan kepatuhan lisensi Mapbox ────────────────────────────────────────
 * Docs: "Temporary results are not allowed to be cached, while Permanent results
 * are allowed to be cached and stored indefinitely. ... To use Permanent
 * geocoding, set the optional `permanent` parameter to `true`."
 *
 * Kita mengirim `permanent=false` secara eksplisit, jadi hasilnya berstatus
 * temporary dan **tidak boleh disimpan**. Karena itu modul ini sengaja TIDAK
 * melakukan cache hasil.
 * Pembatas laju request adalah `useGeopoint` yang hanya memanggil reverseGeocode
 * saat koordinat bergerak > 20 m — cukup 1 request per sesi absen.
 * Bila `permanent=true` diaktifkan (butuh kartu kredit), cache boleh ditambahkan.
 * ────────────────────────────────────────────────────────────────────────────
 */

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim() ?? ""
const MAPBOX_ENABLED = MAPBOX_TOKEN.length > 20

const REQUEST_TIMEOUT_MS = 8000
/** Batas request geocoding yang boleh berjalan bersamaan. */
const IN_FLIGHT_MAX = 20
/** Nominatim: kebijakan publik = maksimal 1 request/detik. */
const NOMINATIM_MIN_INTERVAL_MS = 1100

/** Komponen alamat Indonesia, dari paling spesifik ke paling umum. */
export interface AddressParts {
  jalan: string | null
  desa: string | null
  kecamatan: string | null
  kabupaten: string | null
  provinsi: string | null
  kodePos: string | null
}

type MapboxFeature = {
  properties?: {
    feature_type?: string
    name?: string
    name_preferred?: string
    full_address?: string
    context?: Record<string, { name?: string } | undefined>
  }
}

type NominatimAddress = Record<string, string | undefined>

// ---------------------------------------------------------------------------
// Pembatas laju
// ---------------------------------------------------------------------------

/** Hanya menggabungkan request yang sedang berjalan; hasil dibuang setelah selesai. */
const inFlight = new Map<string, Promise<string | null>>()

/** Antrean sederhana untuk menjaga jeda ≥1 detik antar-request Nominatim. */
let nominatimQueue: Promise<unknown> = Promise.resolve()
let nominatimLastCall = 0

function scheduleNominatim<T>(task: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(async () => {
    const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - nominatimLastCall)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    nominatimLastCall = Date.now()
    return task()
  })
  // Jaga agar rantai tidak menolak bila ada task yang gagal.
  nominatimQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// ---------------------------------------------------------------------------
// Mapbox
// ---------------------------------------------------------------------------

/**
 * Satu request ke Mapbox reverse v6. Tanpa `types`/`limit` supaya API mengembalikan
 * satu feature per tingkat hierarki (paling spesifik lebih dulu).
 */
async function fetchMapbox(latitude: number, longitude: number): Promise<MapboxFeature[] | null> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse")
  url.searchParams.set("access_token", MAPBOX_TOKEN)
  url.searchParams.set("longitude", String(longitude))
  url.searchParams.set("latitude", String(latitude))
  url.searchParams.set("language", "id")
  // Hasil temporary (tidak di-cache di mana pun) sesuai catatan lisensi di atas.
  url.searchParams.set("permanent", "false")

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Mapbox HTTP ${response.status}`)
  const payload = (await response.json()) as { features?: MapboxFeature[] }
  return Array.isArray(payload.features) ? payload.features : []
}

/** Ambil nama dari `context` (objek hierarki) pada feature mana pun. */
function mapboxContext(features: MapboxFeature[], key: string): string | null {
  for (const feature of features) {
    const name = feature?.properties?.context?.[key]?.name
    if (name) return name
  }
  return null
}

/** Ambil feature Mapbox dengan `feature_type` tertentu. */
function mapboxType(features: MapboxFeature[], type: string): MapboxFeature | null {
  return features.find((f) => f?.properties?.feature_type === type) ?? null
}

// ---------------------------------------------------------------------------
// Nominatim
// ---------------------------------------------------------------------------

async function fetchNominatim(
  latitude: number,
  longitude: number,
): Promise<NominatimAddress | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("lat", String(latitude))
  url.searchParams.set("lon", String(longitude))
  url.searchParams.set("zoom", "18")
  url.searchParams.set("addressdetails", "1")

  const response = await scheduleNominatim(() =>
    fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "PKL-Management/1.0" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  )
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`)
  const payload = (await response.json()) as { address?: NominatimAddress }
  return payload.address ?? null
}

// ---------------------------------------------------------------------------
// Penyusun alamat
// ---------------------------------------------------------------------------

function firstString(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const text = typeof value === "string" ? value.trim() : ""
    if (text) return text
  }
  return null
}

/** Buang komponen berulang berurutan (mis. kecamatan == kabupaten). */
function dedupe(parts: (string | null)[]): (string | null)[] {
  const out: (string | null)[] = []
  for (const part of parts) {
    if (!part) continue
    if (out.length > 0 && out[out.length - 1] === part) continue
    out.push(part)
  }
  return out
}

/**
 * Susun alamat Indonesia.
 *
 * ⚠️  ATURAN PRIORITAS — Mapbox adalah sumber otoritatif.
 *
 * Di daerah pedesaan Indonesia, data OpenStreetMap sering salah atau tertukar
 * pada nama desa. Contoh terverifikasi (OKU Timur, Sumatera Selatan):
 *   (-4.100296, 104.621634) → Mapbox: "Bangsa Negara"  | OSM: "Gumawang"   ✗
 *   (-4.108967, 104.645586) → Mapbox: "Gumawang"       | OSM: "Sukarami"   ✗
 *
 * Karena itu SETIAP komponen diambil dari Mapbox lebih dulu. Data OSM hanya
 * dipakai sebagai jaring pengaman **bila Mapbox tidak sama sekali bisa
 * dihubungi** (kuota habis / jaringan mati) **atau bila hasil Mapbox kosong
 * sama sekali** (titik tanpa data context, umum di pedesaan) — tidak pernah
 * menimpa nilai Mapbox yang ada.
 *
 * Konsekuensinya: nama jalan hanya muncul bila Mapbox punya data street/address.
 * Di titik-titik pedesaan Mapbox sering tidak memilikinya, jadi kolom jalan
 * dibiarkan kosong daripada menampilkan nama jalan yang belum tentu benar.
 */
export function composeAddress(
  mapboxFeatures: MapboxFeature[] | null,
  nominatimAddress: NominatimAddress | null,
): AddressParts {
  const features = mapboxFeatures ?? []
  const hasMapbox = features.length > 0
  const n = nominatimAddress ?? {}

  if (hasMapbox) {
    const mapboxStreet =
      mapboxType(features, "street")?.properties?.name ??
      mapboxType(features, "address")?.properties?.name_preferred ??
      mapboxType(features, "address")?.properties?.name ??
      null
    return {
      jalan: mapboxStreet,
      desa: mapboxContext(features, "neighborhood"),
      kecamatan: mapboxContext(features, "locality"),
      kabupaten: mapboxContext(features, "place"),
      provinsi: mapboxContext(features, "region"),
      kodePos: mapboxContext(features, "postcode"),
    }
  }

  // Fallback murni OSM — hanya saat Mapbox tidak bisa dihubungi.
  return {
    jalan: firstString(n.road, n.pedestrian, n.footway, n.path, n.cycleway, n.residential),
    desa: firstString(n.village, n.hamlet),
    kecamatan: firstString(n.suburb, n.city_district, n.district),
    kabupaten: firstString(n.city, n.town, n.municipality, n.county),
    provinsi: firstString(n.state),
    kodePos: firstString(n.postcode),
  }
}

/** Rakit label satu baris dari komponen alamat. */
export function formatAddress(parts: AddressParts): string {
  return dedupe([
    parts.jalan,
    parts.desa,
    parts.kecamatan,
    parts.kabupaten,
    parts.provinsi,
    parts.kodePos,
  ]).join(", ")
}

/** Bentuk singkat untuk tampilan cramped (mis. kartu statis). */
export function formatAddressShort(parts: AddressParts): string {
  return dedupe([parts.desa ?? parts.jalan, parts.kecamatan, parts.kabupaten]).join(", ")
}

async function resolveAddressParts(
  latitude: number,
  longitude: number,
): Promise<AddressParts> {
  if (MAPBOX_ENABLED) {
    try {
      const features = await fetchMapbox(latitude, longitude)
      // Mapbox adalah sumber otoritatif — kalau datanya ada, jangan panggil OSM.
      // Tapi kalau hasil Mapbox kosong (tanpa context), lengkapi via OSM
      // daripada menampilkan "Alamat tidak tersedia".
      if (features && features.length > 0) {
        const parts = composeAddress(features, null)
        if (formatAddress(parts).trim()) return parts
        try {
          const fallback = await fetchNominatim(latitude, longitude)
          if (fallback) {
            const merged = composeAddress(null, fallback)
            if (formatAddress(merged).trim()) return merged
          }
        } catch {
          /* OSM ikut gagal → kembalikan hasil Mapbox (kosong) */
        }
        return parts
      }
    } catch {
      /* Mapbox gagal → jaring pengsafety ke OSM */
    }
  }
  try {
    return composeAddress(null, await fetchNominatim(latitude, longitude))
  } catch {
    return composeAddress(null, null)
  }
}

/**
 * Ubah koordinat menjadi alamat lengkap.
 * Mengembalikan `null` bila kedua service gagal (jaringan mati / koordinat tak valid).
 */
export function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return Promise.resolve(null)
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Promise.resolve(null)
  }

  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = resolveAddressParts(latitude, longitude)
    .then((parts) => {
      const label = formatAddress(parts).trim()
      return label ? label : null
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(key)
    })

  if (inFlight.size < IN_FLIGHT_MAX) inFlight.set(key, promise)
  return promise
}

/** True bila token Mapbox terpasang — berguna untuk diagnostics. */
export function isMapboxEnabled(): boolean {
  return MAPBOX_ENABLED
}
