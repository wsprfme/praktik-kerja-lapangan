import { useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { validatePassword } from "@/lib/password"

export function ForcePasswordDialog() {
  const { profile, refresh } = useAuth()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!profile?.must_change_password) return null

  const pwError = password ? validatePassword(password) : null
  const mismatch = confirm && password !== confirm ? "Konfirmasi tidak cocok." : null
  const canSubmit = password.length >= 8 && !pwError && !mismatch && password === confirm

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    try {
      await api.changePassword(password)
      toast.success("Kata sandi berhasil diubah! Selamat datang di portal PKL.")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah kata sandi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md [&>[data-slot=dialog-close]]:hidden"
      >
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="size-6" />
          </div>
          <DialogTitle className="text-center">Ubah Kata Sandi</DialogTitle>
          <DialogDescription className="text-center">
            Ini adalah login pertama Anda. Demi keamanan, silakan buat kata sandi baru sebelum
            melanjutkan.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="new-pw">Kata Sandi Baru</FieldLabel>
            <div className="relative">
              <Input
                id="new-pw"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldDescription>
              Gunakan huruf besar, kecil, angka, dan simbol.
            </FieldDescription>
            {pwError ? <FieldError errors={[{ message: pwError }]} /> : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="confirm-pw">Konfirmasi Kata Sandi</FieldLabel>
            <div className="relative">
              <Input
                id="confirm-pw"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Ketik ulang kata sandi baru"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
            {mismatch ? <FieldError errors={[{ message: mismatch }]} /> : null}
          </Field>

          <Button type="submit" className="w-full" disabled={!canSubmit || saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
