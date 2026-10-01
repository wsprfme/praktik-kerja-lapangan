import { useCallback, useEffect, useState } from "react"
import { getCurrentPosition } from "@/lib/geolocation"

export type PermissionState = "unknown" | "prompt" | "granted" | "denied"

async function queryPermission(name: "camera" | "geolocation"): Promise<PermissionState> {
  try {
    if (!navigator.permissions?.query) return "unknown"
    const status = await navigator.permissions.query({ name } as PermissionDescriptor)
    return status.state as PermissionState
  } catch {
    return "unknown"
  }
}

export function useCapturePermissions() {
  const [camera, setCamera] = useState<PermissionState>("unknown")
  const [location, setLocation] = useState<PermissionState>("unknown")
  const [requesting, setRequesting] = useState(false)
  const [step, setStep] = useState<"idle" | "camera" | "location">("idle")

  const refresh = useCallback(async () => {
    const [cameraState, locationState] = await Promise.all([
      queryPermission("camera"),
      queryPermission("geolocation"),
    ])
    if (cameraState !== "unknown") setCamera(cameraState)
    if (locationState !== "unknown") setLocation(locationState)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requestCamera = useCallback(async () => {
    setRequesting(true)
    setStep("camera")
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("denied")
        return
      }
      // (m9) Minta kamera depan secara eksplisit agar izin tidak jatuh ke kamera belakang.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      })
      stream.getTracks().forEach((track) => track.stop())
      setCamera("granted")
    } catch {
      setCamera("denied")
    } finally {
      setRequesting(false)
      setStep("idle")
    }
  }, [])

  const requestLocation = useCallback(async () => {
    setRequesting(true)
    setStep("location")
    try {
      await getCurrentPosition()
      setLocation("granted")
    } catch {
      setLocation("denied")
    } finally {
      setRequesting(false)
      setStep("idle")
    }
  }, [])

  const requestAll = useCallback(async () => {
    setRequesting(true)
    try {
      setStep("camera")
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("denied")
      } else {
        try {
          // (m9) Kamera depan eksplisit, sama seperti requestCamera.
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          })
          stream.getTracks().forEach((track) => track.stop())
          setCamera("granted")
        } catch {
          setCamera("denied")
        }
      }

      await new Promise((r) => setTimeout(r, 300))

      setStep("location")
      try {
        await getCurrentPosition()
        setLocation("granted")
      } catch {
        setLocation("denied")
      }
    } finally {
      setRequesting(false)
      setStep("idle")
    }
  }, [])

  return {
    camera,
    location,
    requesting,
    step,
    requestCamera,
    requestLocation,
    request: requestAll,
    refresh,
  }
}
