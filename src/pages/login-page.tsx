import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { PwaInstallPopup } from "@/components/pwa"
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
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { api, setToken } from "@/lib/api"
import { ROLE_HOME } from "@/lib/format"

export function LoginPage() {
  const navigate = useNavigate()
  const { profile, loading: authLoading, refresh } = useAuth()
  const [identity, setIdentity] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
    try {
      // Backend menerima identity = NISN 10 digit ATAU email, tanpa lookup terpisah.
      const { token, user } = await api.login(trimmed, password)
      setToken(token)
      await refresh()
      toast.success(`Selamat datang, ${user.full_name}`)
      navigate(ROLE_HOME[user.role], { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal masuk. Silakan coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-muted/30">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-5 py-6">
        <div className="w-full max-w-md space-y-5">
          <div className="flex flex-col items-center space-y-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border bg-card p-2 shadow-sm">
              <SchoolLogo className="size-full object-contain" />
            </span>
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
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-lg">Masuk</CardTitle>
              <CardDescription>
                Gunakan akun PKL Anda untuk melanjutkan.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <form className="space-y-3" onSubmit={handleSubmit}>
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
                      autoFocus
                      placeholder="Masukkan NISN atau email"
                      value={identity}
                      disabled={submitting}
                      onChange={(event) => setIdentity(event.target.value)}
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
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Masukkan kata sandi"
                      value={password}
                      disabled={submitting}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
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
            </CardContent>
          </Card>

          <PwaInstallPopup />

          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Sistem Informasi Manajemen PKL
          </p>
        </div>
      </div>
    </div>
  )
}
