import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, KeyRound, Save, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { ScreenHeader } from "@/components/mobile-ui"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { ROLE_LABEL, formatDateTime, initials } from "@/lib/format"
import { PASSWORD_HINT, validatePassword } from "@/lib/password"
import type { StudentOverview } from "@/lib/types"

interface ProfilePageProps {
  overview?: StudentOverview | null
}

export function ProfilePage({ overview }: ProfilePageProps) {
  const { profile, refresh } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [address, setAddress] = useState(profile?.address ?? "")
  const [savingProfile, setSavingProfile] = useState(false)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  if (!profile) return null

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!fullName.trim()) {
      toast.error("Nama lengkap wajib diisi.")
      return
    }
    setSavingProfile(true)
    try {
      await api.updateMe({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
    } catch (err) {
      setSavingProfile(false)
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan.")
      return
    }
    setSavingProfile(false)
    toast.success("Profil berhasil diperbarui.")
    await refresh()
  }

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    const issue = validatePassword(password)
    if (issue) {
      toast.error(issue)
      return
    }
    if (password !== confirmPassword) {
      toast.error("Konfirmasi kata sandi tidak sama.")
      return
    }
    setSavingPassword(true)
    try {
      await api.changePassword(password)
    } catch (err) {
      setSavingPassword(false)
      toast.error(err instanceof Error ? err.message : "Gagal mengubah kata sandi.")
      return
    }
    setSavingPassword(false)
    setPassword("")
    setConfirmPassword("")
    toast.success("Kata sandi berhasil diubah. Silakan masuk kembali dengan kata sandi baru.")
    await refresh()
    navigate("/masuk", { replace: true })
  }

  return (
    <div className="space-y-5">
      <ScreenHeader title="Profil & Kata Sandi" description="Perbarui data diri dan kata sandi akun Anda." />

      <Card className="gap-0 py-0">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{initials(profile.full_name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-semibold">{profile.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-xs text-muted-foreground">
              Peran: {ROLE_LABEL[profile.role]} - Akun dibuat {formatDateTime(profile.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      {overview ? (
        <Card className="gap-0 py-0">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base">Data PKL Saya</CardTitle>
            <CardDescription>Data berikut hanya dapat diubah oleh Admin.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <ReadOnly label="NIS" value={overview.detail?.nis} />
              <ReadOnly label="Kelas" value={overview.detail?.class_name} />
              <ReadOnly label="Jurusan" value={overview.detail?.major} />
              <ReadOnly label="Perusahaan" value={overview.company?.name} />
              <ReadOnly label="Pembimbing" value={overview.supervisor?.full_name} />
              <ReadOnly label="Periode PKL" value={overview.period?.name} />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4" /> Data Diri
            </CardTitle>
            <CardDescription>Perubahan langsung tersimpan ke akun Anda.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form className="space-y-4" onSubmit={saveProfile}>
              <Field>
                <FieldLabel htmlFor="nama">Nama Lengkap</FieldLabel>
                <Input id="nama" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="telepon">Nomor Telepon</FieldLabel>
                <Input
                  id="telepon"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="alamat">Alamat</FieldLabel>
                <Input id="alamat" value={address} onChange={(event) => setAddress(event.target.value)} />
              </Field>
              <Button type="submit" disabled={savingProfile}>
                <Save />
                {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Ubah Kata Sandi
            </CardTitle>
            <CardDescription>Gunakan kata sandi yang kuat dan mudah Anda ingat.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form className="space-y-4" onSubmit={savePassword}>
              <Field>
                <FieldLabel htmlFor="sandi-baru">Kata Sandi Baru</FieldLabel>
                <div className="relative">
                  <Input
                    id="sandi-baru"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FieldDescription>{PASSWORD_HINT}</FieldDescription>
              </Field>
              <Separator />
              <Field>
                <FieldLabel htmlFor="sandi-ulang">Konfirmasi Kata Sandi</FieldLabel>
                <div className="relative">
                  <Input
                    id="sandi-ulang"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
              <Button type="submit" variant="secondary" disabled={savingPassword}>
                {savingPassword ? "Menyimpan..." : "Ubah Kata Sandi"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "-"}</dd>
    </div>
  )
}
