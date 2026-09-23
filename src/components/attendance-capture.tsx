import { useCallback, useEffect, useRef, useState } from "react"
import {
  Camera,
  ImageOff,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { useGeopoint } from "@/hooks/use-geopoint"
import { formatCoordinate, formatDate, formatTime, todayISO } from "@/lib/format"
import type { Geopoint } from "@/lib/geolocation"

export interface AttendanceEvidence {
  blob: Blob
  dataUrl: string
  geopoint: Geopoint | null
}

export interface AttendanceCaptureProps {
  busy: boolean
  busyLabel: string
  onCancel: () => void
  onSubmit: (evidence: AttendanceEvidence) => void
  submitLabel?: string
}


function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  let truncated = false

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length >= maxLines) {
      truncated = true
      break
    }
  }

  if (!truncated && current) lines.push(current)
  if (truncated && lines.length > 0) lines[lines.length - 1] = `${lines[lines.length - 1]}...`
  return lines.slice(0, maxLines)
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
): void {
  const scale = width / 1000
  const fontSize = Math.max(13, Math.round(24 * scale))
  const lineHeight = Math.round(fontSize * 1.45)
  const pad = Math.round(18 * scale)

  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.textBaseline = "top"

  const maxTextWidth = width - pad * 4
  const wrapped = lines.flatMap((line, index) =>
    wrapLines(ctx, line, maxTextWidth, index === lines.length - 1 ? 3 : 1),
  )

  const textWidth = Math.max(...wrapped.map((line) => ctx.measureText(line).width))
  const boxWidth = Math.min(width - pad * 2, textWidth + pad * 2)
  const boxHeight = wrapped.length * lineHeight + pad * 2
  const originX = pad
  const originY = height - boxHeight - pad

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)"
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath()
    ctx.roundRect(originX, originY, boxWidth, boxHeight, Math.round(12 * scale))
    ctx.fill()
  } else {
    ctx.fillRect(originX, originY, boxWidth, boxHeight)
  }

  ctx.fillStyle = "#ffffff"
  wrapped.forEach((line, index) => {
    ctx.fillText(line, originX + pad, originY + pad + index * lineHeight)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal menyusun gambar"))),
      "image/jpeg",
      0.9,
    )
  })
}

export function AttendanceCapture({ busy, busyLabel, onCancel, onSubmit, submitLabel = "Kirim Presensi" }: AttendanceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [starting, setStarting] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AttendanceEvidence | null>(null)

  const { point, error: locationError, resolvingAddress } = useGeopoint(true)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startStream = useCallback(
    async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Perangkat ini tidak menyediakan akses kamera.")
        setStarting(false)
        return
      }
      setStarting(true)
      try {
        stopStream()
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setCameraError(null)
      } catch {
        setCameraError("Kamera depan tidak dapat dibuka. Periksa izin kamera pada browser Anda.")
      } finally {
        setStarting(false)
      }
    },
    [stopStream],
  )

  useEffect(() => {
    void startStream()
    return () => stopStream()
  }, [startStream, stopStream])

  if (preview) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Pratinjau bukti presensi</p>
          <p className="text-xs text-muted-foreground">
            Periksa kembali foto beserta keterangan lokasi dan waktu sebelum dikirim.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-muted">
          <img src={preview.dataUrl} alt="Pratinjau foto presensi" className="w-full object-contain" />
        </div>

        <GeoSummary point={point} locationError={locationError} resolvingAddress={resolvingAddress} />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>
            <RotateCcw />
            Ulangi Foto
          </Button>
          <Button onClick={() => onSubmit(preview)} disabled={busy || !point}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            {busy ? busyLabel : submitLabel}
          </Button>
        </div>
      </div>
    )
  }

  const copy = { title: "Foto wajah Anda", hint: "Pastikan wajah dan sekeliling lingkungan kerja terlihat jelas (kamera depan)." }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{copy.title}</p>
        <p className="text-xs text-muted-foreground">{copy.hint}</p>
      </div>

      <div className="relative overflow-hidden rounded-lg border bg-foreground/90">
        <AspectRatio ratio={4 / 3}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="size-full object-cover"
            data-facing={facing}
          />
          {starting || cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foreground/80 px-4 text-center text-background">
              {cameraError ? (
                <>
                  <ImageOff className="size-5" />
                  <p className="text-xs">{cameraError}</p>
                </>
              ) : (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <p className="text-xs">Menyiapkan kamera...</p>
                </>
              )}
            </div>
          ) : null}
        </AspectRatio>
      </div>

      <GeoSummary point={point} locationError={locationError} resolvingAddress={resolvingAddress} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={captureFrame} disabled={busy || starting || !!cameraError}>
          <Camera />
          Ambil Foto
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )

  async function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) {
      setCameraError("Kamera belum siap. Tunggu sebentar lalu coba lagi.")
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setCameraError("Gambar tidak dapat diproses di perangkat ini.")
      return
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const now = new Date()
    const stamp = `${formatDate(todayISO())} ${formatTime(now.toISOString())}`
    const coordinates = point
      ? formatCoordinate(point.latitude, point.longitude)
      : "Koordinat tidak tersedia"
    const address = point?.address ?? "Alamat tidak tersedia"

    drawWatermark(ctx, canvas.width, canvas.height, [stamp, coordinates, address])

    try {
      const blob = await canvasToBlob(canvas)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
      setPreview({ blob, dataUrl, geopoint: point })
    } catch {
      setCameraError("Gambar tidak dapat disimpan. Silakan coba lagi.")
    }
  }
}

function GeoSummary({
  point,
  locationError,
  resolvingAddress,
}: {
  point: Geopoint | null
  locationError: string | null
  resolvingAddress: boolean
}) {
  if (locationError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
        <MapPin className="mt-0.5 size-4" />
        <p className="text-xs">{locationError}</p>
      </div>
    )
  }

  if (!point) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <p className="text-xs">Membaca lokasi Anda...</p>
      </div>
    )
  }

  return (
    <dl className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
      <div className="space-y-0.5">
        <dt className="text-xs text-muted-foreground">Alamat</dt>
        <dd className="text-xs font-medium">
          {point.address ?? (resolvingAddress ? "Mencari alamat..." : "Alamat tidak tersedia")}
        </dd>
      </div>
      <div className="space-y-0.5">
        <dt className="text-xs text-muted-foreground">Koordinat</dt>
        <dd className="font-mono text-xs font-medium">
          {formatCoordinate(point.latitude, point.longitude)}
        </dd>
      </div>
      <div className="space-y-0.5">
        <dt className="text-xs text-muted-foreground">Waktu</dt>
        <dd className="text-xs font-medium">{formatTime(point.capturedAt)}</dd>
      </div>
    </dl>
  )
}
