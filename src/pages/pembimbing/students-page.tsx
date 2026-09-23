import { useState } from "react"
import { GraduationCap, Loader2, Plus, Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StudentDetail } from "@/components/student-detail"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchStudentOverviews } from "@/lib/queries"
import { formatDate } from "@/lib/format"
import { supabase } from "@/lib/supabase"

interface CreateForm {
  full_name: string
  nisn: string
  nis: string
  class_name: string
  major: string
  email: string
  company_id: string
  period_id: string
  start_date: string
  end_date: string
}

const EMPTY_FORM: CreateForm = {
  full_name: "",
  nisn: "",
  nis: "",
  class_name: "",
  major: "",
  email: "",
  company_id: "",
  period_id: "",
  start_date: "",
  end_date: "",
}

async function callAdminUsers(payload: Record<string, unknown>, token: string) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json()
  if (!response.ok || body.error) {
    throw new Error(body.error ?? `Gagal (${response.status})`)
  }
  return body as { user_id: string; warning?: string }
}

export function PembimbingStudentsPage() {
  const { profile, session } = useAuth()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const data = useAsyncData(() => fetchStudentOverviews(), [], [profile?.id])

  const companies = useAsyncData(async () => {
    const { data: rows } = await supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
    return rows ?? []
  }, [])

  const periods = useAsyncData(async () => {
    const { data: rows } = await supabase
      .from("pkl_periods")
      .select("id, name, start_date, end_date")
      .eq("is_active", true)
      .order("start_date", { ascending: false })
    return rows ?? []
  }, [])

  const filtered = data.data.filter((row) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return (
      row.profile.full_name.toLowerCase().includes(term) ||
      (row.detail?.class_name ?? "").toLowerCase().includes(term) ||
      (row.detail?.nisn ?? "").includes(term) ||
      (row.company?.name ?? "").toLowerCase().includes(term)
    )
  })

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!session?.access_token) return

    if (!form.full_name.trim()) {
      toast.error("Nama lengkap siswa wajib diisi.")
      return
    }
    if (!form.nisn.trim() || !/^\d{10}$/.test(form.nisn.trim())) {
      toast.error("NISN harus berupa 10 digit angka.")
      return
    }

    const nisn = form.nisn.trim()
    const email = form.email.trim() || `${nisn}@siswa.pkl.sch.id`

    setSaving(true)
    try {
      const result = await callAdminUsers(
        {
          action: "create_with_placement",
          role: "siswa",
          full_name: form.full_name.trim(),
          email,
          password: nisn,
          nisn,
          nis: form.nis.trim() || null,
          class_name: form.class_name.trim() || null,
          major: form.major.trim() || null,
          company_id: form.company_id || null,
          period_id: form.period_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        },
        session.access_token,
      )

      let message = `Akun siswa ${form.full_name.trim()} berhasil dibuat.`
      if (result.warning) message += ` Catatan: ${result.warning}`
      toast.success(message)

      setCreateOpen(false)
      setForm(EMPTY_FORM)
      data.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat akun siswa.")
    } finally {
      setSaving(false)
    }
  }

  const selectPeriod = (periodId: string) => {
    const period = periods.data.find((p) => p.id === periodId)
    setForm((prev) => ({
      ...prev,
      period_id: periodId,
      start_date: period?.start_date?.slice(0, 10) ?? prev.start_date,
      end_date: period?.end_date?.slice(0, 10) ?? prev.end_date,
    }))
  }

  if (selected) {
    const student = data.data.find((row) => row.profile.id === selected)
    return (
      <div className="space-y-6">
        <PageHeader title={student?.profile.full_name ?? "Detail Siswa"} description="Riwayat lengkap siswa bimbingan.">
          <Button variant="outline" onClick={() => setSelected(null)}>
            Kembali ke Daftar
          </Button>
        </PageHeader>
        <StudentDetail studentId={selected} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Siswa Bimbingan Saya" description="Kelola dan pantau siswa PKL yang ditugaskan kepada Anda.">
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus />
          Tambah Siswa
        </Button>
      </PageHeader>

      <div className="relative w-full sm:w-80">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama, NISN, kelas, atau perusahaan..."
          className="pl-9"
        />
      </div>

      {data.loading ? (
        <LoadingState rows={4} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={query ? "Tidak ada hasil" : "Belum ada siswa bimbingan"}
          description={
            query
              ? "Coba kata kunci lain."
              : "Tambahkan siswa baru atau hubungi Admin untuk menugaskan siswa kepada Anda."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <Card key={row.profile.id}>
              <CardHeader>
                <CardTitle className="text-base">{row.profile.full_name}</CardTitle>
                <CardDescription>
                  {row.detail?.class_name ?? "Kelas belum diisi"}
                  {row.detail?.nisn ? ` — NISN ${row.detail.nisn}` : ""}
                  {row.detail?.nis ? ` — NIS ${row.detail.nis}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Perusahaan</dt>
                    <dd>{row.company?.name ?? "Belum ditempatkan"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Periode</dt>
                    <dd>{row.period?.name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Rentang PKL</dt>
                    <dd className="text-muted-foreground">
                      {row.placement?.start_date
                        ? `${formatDate(row.placement.start_date)} - ${formatDate(row.placement.end_date)}`
                        : "Belum diatur"}
                    </dd>
                  </div>
                </dl>
                <Button className="w-full" variant="outline" onClick={() => setSelected(row.profile.id)}>
                  Lihat Detail
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Siswa Baru</DialogTitle>
            <DialogDescription>
              Buat akun siswa dan langsung tempatkan ke perusahaan. Siswa akan masuk menggunakan NISN
              sebagai username dan kata sandi awal.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreate}>
            <Field>
              <FieldLabel htmlFor="cs-name">Nama Lengkap *</FieldLabel>
              <Input
                id="cs-name"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Contoh: Rina Maharani"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="cs-nisn">NISN *</FieldLabel>
                <Input
                  id="cs-nisn"
                  value={form.nisn}
                  onChange={(e) => setForm((prev) => ({ ...prev, nisn: e.target.value }))}
                  placeholder="10 digit"
                  maxLength={10}
                />
                <FieldDescription>Dipakai sebagai login dan kata sandi awal.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-nis">NIS</FieldLabel>
                <Input
                  id="cs-nis"
                  value={form.nis}
                  onChange={(e) => setForm((prev) => ({ ...prev, nis: e.target.value }))}
                  placeholder="Opsional"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="cs-class">Kelas</FieldLabel>
                <Input
                  id="cs-class"
                  value={form.class_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, class_name: e.target.value }))}
                  placeholder="Contoh: XII RPL 1"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-major">Jurusan</FieldLabel>
                <Input
                  id="cs-major"
                  value={form.major}
                  onChange={(e) => setForm((prev) => ({ ...prev, major: e.target.value }))}
                  placeholder="Contoh: RPL"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="cs-email">Email (opsional)</FieldLabel>
              <Input
                id="cs-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder={form.nisn ? `${form.nisn}@siswa.pkl.sch.id` : "Otomatis dari NISN"}
              />
              <FieldDescription>Jika dikosongkan, email akan diisi otomatis NISN@siswa.pkl.sch.id</FieldDescription>
            </Field>

            <div className="space-y-1 pt-2">
              <p className="text-sm font-semibold">Penempatan PKL</p>
              <p className="text-xs text-muted-foreground">
                Pilih perusahaan dan periode PKL. Anda akan otomatis menjadi pembimbing siswa ini.
              </p>
            </div>

            <Field>
              <FieldLabel htmlFor="cs-company">Perusahaan</FieldLabel>
              <NativeSelect
                id="cs-company"
                value={form.company_id}
                onChange={(e) => setForm((prev) => ({ ...prev, company_id: e.target.value }))}
              >
                <option value="">— Pilih perusahaan —</option>
                {companies.data.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="cs-period">Periode PKL</FieldLabel>
              <NativeSelect
                id="cs-period"
                value={form.period_id}
                onChange={(e) => selectPeriod(e.target.value)}
              >
                <option value="">— Pilih periode —</option>
                {periods.data.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </NativeSelect>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="cs-start">Tanggal Mulai</FieldLabel>
                <Input
                  id="cs-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-end">Tanggal Selesai</FieldLabel>
                <Input
                  id="cs-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                {saving ? "Membuat..." : "Buat Akun & Tempatkan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
