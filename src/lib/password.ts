export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_HINT =
  "Minimal 8 karakter, serta memuat huruf besar, huruf kecil, angka, dan simbol."

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`
  }
  if (!/[a-z]/.test(password)) {
    return "Kata sandi harus memuat minimal satu huruf kecil."
  }
  if (!/[A-Z]/.test(password)) {
    return "Kata sandi harus memuat minimal satu huruf besar."
  }
  if (!/[0-9]/.test(password)) {
    return "Kata sandi harus memuat minimal satu angka."
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Kata sandi harus memuat minimal satu simbol, misalnya ! atau #."
  }
  return null
}

/** Mengubah pesan kesalahan teknis dari layanan autentikasi menjadi bahasa Indonesia. */
export function translateAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("weak") || lower.includes("easy to guess") || lower.includes("pwned")) {
    return `Kata sandi terlalu lemah. ${PASSWORD_HINT}`
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Email sudah digunakan oleh akun lain."
  }
  if (lower.includes("invalid login")) {
    return "Email atau kata sandi salah."
  }
  if (lower.includes("banned")) {
    return "Akun ini sedang dinonaktifkan. Hubungi Admin."
  }
  if (lower.includes("email not confirmed")) {
    return "Email belum terverifikasi. Hubungi Admin."
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
  }
  if (lower.includes("database error")) {
    return "Layanan login sedang bermasalah. Hubungi Admin."
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("load failed")) {
    return "Gagal menghubungi server. Periksa koneksi internet Anda lalu coba lagi."
  }
  return message
}
