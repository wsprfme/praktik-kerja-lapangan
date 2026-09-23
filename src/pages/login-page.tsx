import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { ModeToggle } from "@/components/mode-toggle"
import { SchoolLogo } from "@/components/school-logo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { ROLE_HOME } from "@/lib/format"
import { translateAuthError } from "@/lib/password"
import type { Profile } from "@/lib/types"

async function findEmailByNisn(nisn: string): Promise<string | null> {
  const { data } = await supabase
    .from("siswa_profiles")
    .select("profile_id")
    .eq("nisn", nisn)
    .maybeSingle()
  if (!data) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", data.profile_id)
    .maybeSingle()
  return profile?.email ?? null
}

export function LoginPage() {
  const navigate = useNavigate()
  const { profile, loading: authLoading } = useAuth()
  const [identity, setIdentity] = useState("")
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

    const trimmed = identity.trim()
    if (!trimmed || !password) {
      setFormError("NISN/Email dan kata sandi wajib diisi.")
      return
    }

    setSubmitting(true)

    let email = trimmed
    const isNisn = /^\d{10}$/.test(trimmed)
    if (isNisn) {
      const resolved = await findEmailByNisn(trimmed)
      if (!resolved) {
        setSubmitting(false)
        setFormError("NISN tidak terdaftar dalam sistem. Hubungi pembimbing atau Admin.")
        return
      }
      email = resolved
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
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
      .select("role, is_active, full_name, must_change_password")
      .eq("id", userId)
      .maybeSingle<Pick<Profile, "role" | "is_active" | "full_name" | "must_change_password">>()

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
    <div className="relative flex min-h-svh flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div aria-hidden className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center space-y-5 text-center">
            <SchoolLogo className="size-20 object-contain drop-shadow-sm" />
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight">
                Portal Manajemen PKL
              </h1>
              <p className="text-sm text-muted-foreground">
                Sistem Informasi Praktik Kerja Lapangan
              </p>
            </div>
          </div>

          <Card className="gap-0 border-border/60 py-0 shadow-md">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-lg">Masuk ke akun Anda</CardTitle>
              <CardDescription>
                Siswa gunakan NISN sebagai username dan kata sandi awal.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form className="space-y-4" onSubmit={handleSubmit}>
                {formError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Tidak dapat masuk</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="identity">NISN atau Email</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <UserRound />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="identity"
                      type="text"
                      autoComplete="username"
                      placeholder="Masukkan NISN atau email"
                      value={identity}
                      onChange={(event) => setIdentity(event.target.value)}
                    />
                  </InputGroup>
                  <FieldDescription>
                    Siswa masuk dengan NISN 10 digit. Admin/Pembimbing masuk dengan email.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <LockKeyhole />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </InputGroup>
                  <FieldDescription>
                    Login pertama siswa: kata sandi sama dengan NISN.
                  </FieldDescription>
                  <FieldError
                    errors={
                      submitting && !password
                        ? [{ message: "Kata sandi wajib diisi." }]
                        : undefined
                    }
                  />
                </Field>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  {submitting ? "Memproses..." : "Masuk"}
                </Button>
              </form>

              <Separator className="my-4" />

              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Akses terbatas untuk siswa, pembimbing, dan admin
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Sistem Informasi Manajemen PKL
          </p>
        </div>
      </div>
    </div>
  )
}
