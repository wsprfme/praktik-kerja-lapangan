import { useEffect, useState } from "react"
import { Download, FileWarning, Link2, Loader2 } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ResponsiveSheet } from "@/components/mobile-ui"

type PreviewKind = "image" | "pdf" | "unsupported"

/** Jenis pratinjau dari ekstensi path server (server selalu kirim octet-stream). */
function kindFromPath(path: string): PreviewKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "image"
  if (ext === "pdf") return "pdf"
  return "unsupported"
}

function kindLabel(kind: PreviewKind): string {
  if (kind === "image") return "Foto"
  if (kind === "pdf") return "Dokumen PDF"
  return "Berkas"
}

/** Pesan error jujur per status HTTP — bukan satu label untuk semua. */
function errorMessageFor(status: number | null): string {
  if (status === 404) return "File tidak ditemukan di server. Berkas mungkin sudah dihapus."
  if (status === 403) return "Anda tidak berhak mengakses berkas ini."
  if (status === 401 || status === 0)
    return "Sesi berakhir atau koneksi terputus. Coba lagi, atau login ulang bila berlanjut."
  if (status === 400) return "Format berkas lama tidak didukung. Hubungi admin."
  return "Gagal memuat berkas. Silakan coba lagi."
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error"
  url: string | null
  message: string | null
}

/**
 * Mengambil object URL privat hanya saat viewer dibuka, dan me-revoke saat
 * ditutup agar tidak bocor memori (bug versi lama: URL menumpuk tiap klik).
 */
function useFilePreview(path: string | null, open: boolean): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "idle", url: null, message: null })

  useEffect(() => {
    if (!open || !path) {
      setState((prev) => {
        if (prev.url) URL.revokeObjectURL(prev.url)
        return prev.url || prev.status !== "idle" ? { status: "idle", url: null, message: null } : prev
      })
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    setState({ status: "loading", url: null, message: null })
    void api
      .fetchFile(path)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setState({ status: "ready", url, message: null })
      })
      .catch((err) => {
        if (cancelled) return
        const status = err instanceof ApiError ? err.status : null
        setState({ status: "error", url: null, message: errorMessageFor(status) })
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, path])

  return state
}

function fileNameOf(path: string, fallback: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim()
  const base = path.split("/").pop() ?? "berkas"
  return base || "berkas"
}

function PreviewBody({
  path,
  name,
  preview,
}: {
  path: string
  name: string
  preview: PreviewState
}) {
  const kind = kindFromPath(path)

  if (preview.status === "loading" || preview.status === "idle") {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-xs">Memuat berkas...</p>
      </div>
    )
  }

  if (preview.status === "error" || !preview.url) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center">
        <FileWarning className="size-8 text-destructive" />
        <p className="text-sm font-medium">Berkas tidak dapat ditampilkan</p>
        <p className="max-w-sm text-xs text-muted-foreground">{preview.message}</p>
      </div>
    )
  }

  if (kind === "image") {
    return (
      <img
        src={preview.url}
        alt={name}
        className="max-h-[62svh] w-full rounded-lg border object-contain bg-muted"
      />
    )
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={preview.url}
        title={name}
        className="h-[62svh] w-full rounded-lg border bg-muted"
      />
    )
  }

  // HEIF iPhone & tipe lain: browser tidak bisa render → unduh saja.
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center">
      <FileWarning className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Pratinjau tidak didukung browser</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Format file ini (mis. HEIF dari iPhone) hanya bisa dibuka lewat unduhan. Gunakan tombol Unduh di
        bawah.
      </p>
      <Button asChild size="sm" className="mt-1">
        <a href={preview.url} download={name}>
          <Download />
          Unduh {name}
        </a>
      </Button>
    </div>
  )
}

function ViewerFooter({ url, name, onClose }: { url: string | null; name: string; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>
        Tutup
      </Button>
      <Button asChild disabled={!url}>
        <a href={url ?? "#"} download={name} onClick={(e) => !url && e.preventDefault()}>
          <Download />
          Unduh
        </a>
      </Button>
    </div>
  )
}

interface ViewerProps {
  path: string | null
  name: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Viewer berkas in-app untuk ADMIN & PEMBIMBING (Dialog desktop).
 * Tidak lagi membuka tab/URL baru.
 */
export function FileViewerDialog({ path, name, open, onOpenChange }: ViewerProps) {
  const title = fileNameOf(path ?? "berkas", name)
  const preview = useFilePreview(path, open)
  const kind = path ? kindFromPath(path) : "unsupported"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>
            {kindLabel(kind)} — pratinjau di dalam aplikasi.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          {path ? (
            <PreviewBody path={path} name={title} preview={preview} />
          ) : null}
        </div>
        <DialogFooter>
          <ViewerFooter url={preview.url} name={title} onClose={() => onOpenChange(false)} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Viewer berkas in-app untuk MURID (Sheet full-screen, ramah HP).
 * Logika fetch/error sama persis dengan versi admin — hanya kulitnya beda.
 */
export function StudentFileViewer({ path, name, open, onOpenChange }: ViewerProps) {
  const title = fileNameOf(path ?? "berkas", name)
  const preview = useFilePreview(path, open)
  const kind = path ? kindFromPath(path) : "unsupported"

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`${kindLabel(kind)} — pratinjau di dalam aplikasi.`}
    >
      <div className="space-y-4 pb-2">
        {path ? <PreviewBody path={path} name={title} preview={preview} /> : null}
        <ViewerFooter url={preview.url} name={title} onClose={() => onOpenChange(false)} />
      </div>
    </ResponsiveSheet>
  )
}

interface LinkProps {
  path: string | null
  name: string | null
  label?: string
}

/**
 * Tombol lampiran untuk ADMIN & PEMBIMBING — membuka FileViewerDialog in-app.
 * (Dipakai juga oleh review-lists & monitoring.)
 */
export function AttachmentLink({ path, name, label }: LinkProps) {
  const [open, setOpen] = useState(false)
  if (!path) return null
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 />
        {label ?? name ?? "Lihat lampiran"}
      </Button>
      <FileViewerDialog path={path} name={name ?? label ?? null} open={open} onOpenChange={setOpen} />
    </>
  )
}

/**
 * Tombol lampiran untuk MURID — membuka StudentFileViewer (Sheet) in-app.
 */
export function StudentAttachmentLink({ path, name, label }: LinkProps) {
  const [open, setOpen] = useState(false)
  if (!path) return null
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 />
        {label ?? name ?? "Lihat lampiran"}
      </Button>
      <StudentFileViewer path={path} name={name ?? label ?? null} open={open} onOpenChange={setOpen} />
    </>
  )
}
