// DEPRECATED: backend sudah pindah ke SQLite REST API (src/lib/api.ts + server/).
// File ini dipertahankan agar impor lama tidak crash, tapi seluruh fungsi
// Supabase sudah dihapus. Gunakan `api` dari "@/lib/api" dan `callAdminUsers` dari sana.
export { api, callAdminUsers } from "@/lib/api"
