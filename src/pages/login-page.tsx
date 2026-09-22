import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { GraduationCap, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { ROLE_HOME } from "@/lib/format"
import { translateAuthError } from "@/lib/password"
import type { Profile } from "@/lib/types"

export function LoginPage() {
  const navigate = useNavigate()
  const { profile, loading: authLoading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && profile) {
      navigate(ROLE_HOME[profile.role], { replace: true })
    }
  }, [authLoading, profile, navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setFormError("Email dan kata sandi wajib diisi.")
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (error) {
      setSubmitting(false)
      setFormError(translateAuthError(error.message))
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setSubmitting(false)
      setFormError("Gagal masuk. Silakan coba lagi.")
      return
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active, full_name")
      .eq("id", userId)
      .maybeSingle<Pick<Profile, "role" | "is_active" | "full_name">>()

    if (profileError || !userProfile) {
      await supabase.auth.signOut()
      setSubmitting(false)
      setFormError("Data akun tidak ditemukan. Hubungi Admin.")
      return
    }

    if (!userProfile.is_active) {
      await supabase.auth.signOut()
      setSubmitting(false)
      setFormError("Akun ini sedang dinonaktifkan. Hubungi Admin.")
      return
    }

    toast.success(`Selamat datang, ${userProfile.full_name}`)
    navigate(ROLE_HOME[userProfile.role], { replace: true })
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-semibold">Manajemen PKL</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            Satu tempat untuk presensi, jurnal, dan pemantauan PKL.
          </h2>
          <p className="max-w-md text-sm text-primary-foreground/80">
            Siswa mencatat kehadiran dan kegiatan harian, pembimbing memantau dan menilai,
            Admin mengelola seluruh data program PKL.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          Praktik Kerja Lapangan - Sistem Informasi Manajemen
        </p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm border-none shadow-none">
          <CardHeader className="px-0">
            <CardTitle className="text-2xl">Masuk ke akun Anda</CardTitle>
            <CardDescription>
              Gunakan email dan kata sandi yang diberikan sekolah.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Tidak dapat masuk</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@sekolah.sch.id"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <FieldError
                  errors={submitting && !password ? [{ message: "Kata sandi wajib diisi." }] : undefined}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {submitting ? "Memproses..." : "Masuk"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Belum punya akun? Akun dibuat oleh Admin sekolah, bukan melalui pendaftaran mandiri.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
