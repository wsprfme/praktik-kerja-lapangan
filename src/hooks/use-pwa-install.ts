import { useCallback, useEffect, useState } from "react"

/** Event Chrome `beforeinstallprompt` — belum ada di lib DOM bawaan. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "pkl_pwa_install_dismissed"

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return true
  // iPadOS 13+ melaporkan diri sebagai Mac.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(display-mode: standalone)").matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Status instalasi PWA.
 *
 * - Chrome/Android: tangkap `beforeinstallprompt`, tampilkan tombol sendiri,
 *   panggil `install()` saat diklik.
 * - iOS/Safari: tidak ada event install — tampilkan panduan manual
 *   (Share → Add to Home Screen) via `showIOSGuide`.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => detectStandalone())
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1"
    } catch {
      return false
    }
  })
  const [isIOS] = useState<boolean>(detectIOS)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Cegah banner bawaan browser; kita tampilkan tombol sendiri.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    const onDisplayChange = () => {
      if (detectStandalone()) {
        setInstalled(true)
        setDeferred(null)
      }
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    const media = window.matchMedia("(display-mode: standalone)")
    media.addEventListener("change", onDisplayChange)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
      media.removeEventListener("change", onDisplayChange)
    }
  }, [])

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable"
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === "accepted") setDeferred(null)
    return choice.outcome
  }, [deferred])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* abaikan: privat mode */
    }
  }, [])

  const canInstall = deferred !== null && !installed

  return {
    /** Event install siap dipanggil (Chrome/Android). */
    canInstall,
    /** Tampilkan banner install (belum di-dismiss murid). */
    showBanner: canInstall && !dismissed,
    /** Tampilkan panduan manual (iOS Safari). */
    showIOSGuide: isIOS && !installed && !dismissed,
    installed,
    isIOS,
    install,
    dismiss,
  }
}
