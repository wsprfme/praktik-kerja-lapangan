export const MAJORS = [
  "Teknik Sepeda Motor",
  "Teknik Kendaraan Ringan",
  "Teknik Jaringan Komputer",
  "Akuntansi & Keuangan",
  "Desain Komunikasi Visual",
  "Tata Boga / Kuliner",
] as const

export type Major = (typeof MAJORS)[number]

export const CLASS_OPTIONS = [
  "X",
  "XI",
  "XII",
  "XIII",
] as const

// Helper untuk dropdown kelas tingkat + contoh rombel.
// Pembimbing tetap bisa ketik manual via opsi "Lainnya" di UI jika perlu,
// tapi default memakai daftar ini agar konsisten.
export const CLASS_LEVELS = ["X", "XI", "XII"] as const
