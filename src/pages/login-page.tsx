import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarCheck,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  NotebookPen,
  ShieldCheck,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { ModeToggle } from "@/components/mode-toggle"
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

const HIGHLIGHTS = [
  {
    icon: CalendarCheck,
    title: "Presensi berfoto",
    description: "Kehadiran tercatat lengkap dengan waktu dan lokasi.",
  },
  {
    icon: NotebookPen,
    title: "Jurnal harian",
    description: "Kegiatan PKL direkap rapi dan siap dinilai.",
  },
  {
    icon: Users,
    title: "Pemantauan pembimbing",
    description: "Pembimbing dan Admin memantau perkembangan siswa.",
  },
]

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
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,--alpha(var(--primary-foreground)/14%),transparent_55%),radial-gradient(circle_at_85%_85%,--alpha(var(--primary-foreground)/10%),transparent_50%)]"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/20">
            <GraduationCap className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-semibold">Manajemen PKL</p>
            <p className="text-xs text-primary-foreground/70">
              Sistem Informasi Praktik Kerja Lapangan
            </p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
              Selamat datang kembali.
            </h2>
            <p className="text-sm text-primary-foreground/75">
              Masuk untuk melanjutkan kegiatan Praktik Kerja Lapangan Anda.
            </p>
          </div>

          <ul className="space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/12 ring-1 ring-primary-foreground/15">
                  <item.icon className="size-4" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-primary-foreground/70">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          Akun dibuat dan dikelola oleh Admin sekolah.
        </p>
      </div>

      <div className="relative flex items-center justify-center bg-muted/40 p-6">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="font-semibold">Manajemen PKL</p>
              <p className="text-xs text-muted-foreground">
                Sistem Informasi Praktik Kerja Lapangan
              </p>
            </div>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Masuk ke akun Anda</CardTitle>
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
                Akses terbatas untuk siswa, pembimbing, dan Admin.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
