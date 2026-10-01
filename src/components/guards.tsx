import { Navigate, useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { ErrorState } from "@/components/page-states"
import { ROLE_HOME } from "@/lib/format"
import type { Role } from "@/lib/types"

export function FullPageLoader({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { profile, loading, error } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return <FullPageLoader label="Menyiapkan sesi..." />
  }

  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <ErrorState
          message={error ?? "Sesi Anda telah berakhir. Silakan masuk kembali."}
          onRetry={() => navigate("/masuk", { replace: true })}
        />
      </div>
    )
  }

  return <>{children}</>
}

export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return <FullPageLoader label="Memeriksa hak akses..." />
  }

  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <ErrorState
          message="Sesi Anda telah berakhir. Silakan masuk kembali."
          onRetry={() => navigate("/masuk", { replace: true })}
        />
      </div>
    )
  }

  if (profile.role !== role) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return <>{children}</>
}
