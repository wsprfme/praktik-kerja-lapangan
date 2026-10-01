import { useEffect, useState } from "react"
import { Download, RefreshCw, Share, WifiOff } from "lucide-react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { ResponsiveSheet } from "@/components/mobile-ui"
import { Button } from "@/components/ui/button"

const POPUP_SESSION_KEY = "pkl_pwa_popup_shown"

/**
 * Popup ajakan pasang aplikasi (bottom-sheet di HP, dialog di desktop).
 * - Muncul otomatis sekali per sesi, 1,5 dtk setelah bisa dipasang.
 * - "Nanti" hanya menunda sesi ini; tidak nagging tiap pindah halaman.
 * - Tidak tampil bila sudah ter-install atau murid menutup permanen.
 */
export function PwaInstallPopup() {
  const { showBanner, showIOSGuide, installed, install, dismiss } = usePwaInstall()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const eligible = (showBanner || showIOSGuide) && !installed

  useEffect(() => {
    if (!eligible) return
    try {
      if (sessionStorage.getItem(POPUP_SESSION_KEY) === "1") return
    } catch {
      /* abaikan: mode privat */
    }
    const timer = window.setTimeout(() => {
      setOpen(true)
      try {
        sessionStorage.setItem(POPUP_SESSION_KEY, "1")
      } catch {
        /* abaikan */
      }
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [eligible])

  if (!eligible) return null

  const onInstall = async () => {
    setBusy(true)
    try {
      await install()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Pasang Aplikasi PKL"
      description={
        showIOSGuide
          ? "Ikuti 3 langkah cepat di bawah."
          : "Buka presensi & jurnal dari layar utama."
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3">
          <img
            src="/icon-192.png"
            alt="Ikon aplikasi PKL"
            className="size-14 shrink-0 rounded-2xl border"
          />
          <p className="text-sm text-muted-foreground">
            {showIOSGuide
              ? "Di iPhone, pemasangan lewat menu Share Safari."
              : "Tanpa Play Store — langsung dari browser, cepat dan ringan."}
          </p>
        </div>

        {showIOSGuide ? (
          <ol className="space-y-2.5 rounded-xl bg-muted/60 p-4 text-sm">
            <li className="flex gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
              Ketuk tombol <Share className="size-4 shrink-0 self-center" /> <strong>Share</strong> di Safari.
            </li>
            <li className="flex gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
              Pilih <strong>Add to Home Screen</strong>.
            </li>
            <li className="flex gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span>
              Buka aplikasi dari layar utama.
            </li>
          </ol>
        ) : null}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Nanti
          </Button>
          {showIOSGuide ? (
            <Button
              className="flex-1"
              onClick={() => {
                dismiss()
                setOpen(false)
              }}
            >
              Mengerti
            </Button>
          ) : (
            <Button className="flex-1" onClick={onInstall} disabled={busy}>
              <Download />
              {busy ? "Memproses..." : "Pasang Aplikasi"}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveSheet>
  )
}

/**
 * Prompt global saat service worker menemukan versi baru.
 * Dipasang sekali di App agar berlaku di semua halaman & role.
 */
export function PwaUpdatePrompt() {
  // Catatan: useRegisterSW mengembalikan tuple [nilai, setter].
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md items-center gap-3 rounded-xl border bg-card p-4 shadow-lg">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RefreshCw className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Versi baru tersedia</p>
          <p className="truncate text-xs text-muted-foreground">
            Muat ulang untuk memakai versi terbaru.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => updateServiceWorker(true)}>
          Muat Ulang
        </Button>
      </div>
    </div>
  )
}

/** Baris tipis penanda offline. Presensi & sinkron butuh koneksi. */
export function OfflineBar() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-1.5 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
      <WifiOff className="size-3.5" />
      Anda sedang offline. Data akan terkirim setelah koneksi kembali.
    </div>
  )
}
