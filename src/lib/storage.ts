import { api } from "@/lib/api"

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

/**
 * File disimpan di server pada `uploads/siswa/<studentId>/<folder>/`.
 * Server menegakkan ACL: siswa hanya milik sendiri, pembimbing hanya bimbingannya.
 */
export async function uploadStudentFile(
  studentId: string,
  folder: "jurnal" | "izin",
  file: File,
): Promise<{ path: string; name: string }> {
  const res = await api.upload(folder, file, undefined, studentId)
  return { path: res.path, name: res.name || safeName(file.name) }
}

/** Foto presensi (sudah diberi cap lokasi & waktu) untuk siswa tertentu. */
export async function uploadAttendancePhoto(
  studentId: string,
  photo: Blob,
): Promise<{ path: string; name: string }> {
  const res = await api.upload("presensi", photo, `presensi-${Date.now()}.jpg`, studentId)
  return { path: res.path, name: "Foto presensi" }
}

/** Ambil URL sementara (object URL) untuk file privat. */
export async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  try {
    return await api.fetchFile(path)
  } catch {
    return null
  }
}
