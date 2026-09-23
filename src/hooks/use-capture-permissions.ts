import { useCallback, useEffect, useState } from "react"
import { getCurrentPosition } from "@/lib/geolocation"

export type PermissionState = "unknown" | "prompt" | "granted" | "denied"

async function queryPermission(name: PermissionName): Promise<PermissionState> {
  try {
    if (!navigator.permissions?.query) return "unknown"
    const status = await navigator.permissions.query({ name })
    return status.state as PermissionState
  } catch {
    return "unknown"
  }
}

/** Memantau izin kamera dan lokasi, serta memintanya satu per satu. */
export function useCapturePermissions() {
  const [camera, setCamera] = useState<PermissionState>("unknown")
  const [location, setLocation] = useState<PermissionState>("unknown")
  const [requesting, setRequesting] = useState(false)

  const refresh = useCallback(async () => {
    const [cameraState, locationState] = await Promise.all([
      queryPermission("camera" as PermissionName),
      queryPermission("geolocation"),
    ])
    if (cameraState !== "unknown") setCamera(cameraState)
    if (locationState !== "unknown") setLocation(locationState)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const request = useCallback(async () => {
    setRequesting(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("denied")
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach((track) => track.stop())
          setCamera("granted")
        } catch {
          setCamera("denied")
        }
      }

      try {
        await getCurrentPosition()
        setLocation("granted")
      } catch {
        setLocation("denied")
      }
    } finally {
      setRequesting(false)
    }
  }, [])

  return { camera, location, requesting, request, refresh }
}
