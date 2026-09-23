import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
    <div className="relative flex min-h-svh flex-col bg-muted/40">
      <div aria-hidden className="h-1.5 w-full bg-primary" />

      <div className="absolute top-5 right-5">
        <ModeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <span className="flex size-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-8 ring-primary/10 dark:bg-white/95">
              <SchoolLogo className="size-14 object-contain" />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                Portal Manajemen PKL
              </h1>
              <p className="text-sm text-muted-foreground">
                Praktik Kerja Lapangan
              </p>
            </div>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Masuk ke akun Anda</CardTitle>
              <CardDescription>
                Gunakan email dan kata sandi yang diberikan sekolah.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                {formError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Tidak dapat masuk</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Mail />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="nama@sekolah.sch.id"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </InputGroup>
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

              <Separator className="my-5" />

              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Akses terbatas untuk siswa
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Sistem Informasi Manajemen Praktik Kerja Lapangan
          </p>
        </div>
      </div>
    </div>
  )
}
