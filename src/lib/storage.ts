import { supabase } from "@/lib/supabase"

const BUCKET = "pkl-files"

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function uploadStudentFile(
  studentId: string,
  folder: "jurnal" | "izin",
  file: File,
): Promise<{ path: string; name: string }> {
  const path = `${studentId}/${folder}/${Date.now()}-${safeName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { path, name: file.name }
}

export async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data) return null
  return data.signedUrl
}
