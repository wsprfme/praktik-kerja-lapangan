import { useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
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
import { supabase } from "@/lib/supabase"
import { validatePassword } from "@/lib/password"

export function ForcePasswordDialog() {
  const { profile, refresh } = useAuth()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)

  if (!profile?.must_change_password) return null

  const pwError = password ? validatePassword(password) : null
  const mismatch = confirm && password !== confirm ? "Konfirmasi tidak cocok." : null
  const canSubmit = password.length >= 8 && !pwError && !mismatch && password === confirm

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setSaving(false)
      toast.error("Gagal mengubah kata sandi: " + error.message)
      return
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id)
    if (profileError) {
      toast.error("Kata sandi sudah diubah, tetapi gagal memperbarui status akun.")
    }

    toast.success("Kata sandi berhasil diubah! Selamat datang di portal PKL.")
    setSaving(false)
    await refresh()
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
            <Input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription>
              Gunakan huruf besar, kecil, angka, dan simbol.
            </FieldDescription>
            {pwError ? <FieldError errors={[{ message: pwError }]} /> : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="confirm-pw">Konfirmasi Kata Sandi</FieldLabel>
            <Input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              placeholder="Ketik ulang kata sandi baru"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
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
