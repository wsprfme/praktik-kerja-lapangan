import { useState } from "react"
import { MoreHorizontal, Pencil, Plus, RotateCcw, Search, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { AccountFormDialog } from "@/components/account-form-dialog"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAsyncData } from "@/hooks/use-async-data"
import {
  fetchPembimbingDetails,
  fetchProfilesByRole,
  fetchSiswaDetails,
  logActivity,
} from "@/lib/queries"
import { callAdminUsers } from "@/lib/supabase"
import { PASSWORD_HINT, validatePassword } from "@/lib/password"
import { formatDate } from "@/lib/format"
import type { PembimbingProfile, Profile, SiswaProfile } from "@/lib/types"

export function AdminAccountsPage() {
  const { profile: admin } = useAuth()
  const [role, setRole] = useState<"siswa" | "pembimbing">("siswa")
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const data = useAsyncData(
    async () => {
      const [students, supervisors, studentDetails, supervisorDetails] = await Promise.all([
        fetchProfilesByRole("siswa"),
        fetchProfilesByRole("pembimbing"),
        fetchSiswaDetails(),
        fetchPembimbingDetails(),
      ])
      return { students, supervisors, studentDetails, supervisorDetails }
    },
    { students: [], supervisors: [], studentDetails: [], supervisorDetails: [] },
  )

  const list = role === "siswa" ? data.data.students : data.data.supervisors
  const details = role === "siswa" ? data.data.studentDetails : data.data.supervisorDetails
  const detailMap = new Map(details.map((d) => [d.profile_id, d]))
  const filtered = list.filter((item) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return item.full_name.toLowerCase().includes(term) || item.email.toLowerCase().includes(term)
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (item: Profile) => {
    setEditing(item)
    setFormOpen(true)
  }

  const toggleActive = async (item: Profile) => {
    setBusy(true)
    try {
      await callAdminUsers({ action: "set_active", user_id: item.id, is_active: !item.is_active })
      if (admin) {
        await logActivity({
          action: item.is_active ? "Nonaktifkan Akun" : "Aktifkan Akun",
          description: `${item.is_active ? "Menonaktifkan" : "Mengaktifkan"} akun ${item.full_name}`,
          entityType: "profile",
          entityId: item.id,
          actor: admin,
        })
      }
      toast.success(item.is_active ? "Akun berhasil dinonaktifkan." : "Akun berhasil diaktifkan.")
      data.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status akun.")
    } finally {
      setBusy(false)
    }
  }

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!resetTarget) return
    const issue = validatePassword(newPassword)
    if (issue) {
      toast.error(issue)
      return
    }
    setBusy(true)
    try {
      await callAdminUsers({ action: "reset_password", user_id: resetTarget.id, password: newPassword })
      if (admin) {
        await logActivity({
          action: "Reset Kata Sandi",
          description: `Mereset kata sandi akun ${resetTarget.full_name}`,
          entityType: "profile",
          entityId: resetTarget.id,
          actor: admin,
        })
      }
      toast.success("Kata sandi berhasil direset.")
      setResetTarget(null)
      setNewPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mereset kata sandi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Akun Pengguna"
        description="Buat dan kelola akun Siswa dan Pembimbing. Tidak ada pendaftaran mandiri."
      >
        <Button onClick={openCreate}>
          <Plus />
          Buat Akun
        </Button>
      </PageHeader>

      <Tabs value={role} onValueChange={(value) => setRole(value as "siswa" | "pembimbing")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="siswa">Siswa ({data.data.students.length})</TabsTrigger>
            <TabsTrigger value="pembimbing">Pembimbing ({data.data.supervisors.length})</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau email..."
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value={role} className="mt-4">
          {data.loading ? (
            <LoadingState rows={5} />
          ) : data.error ? (
            <ErrorState message={data.error} onRetry={data.reload} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={role === "siswa" ? UserRoundCheck : ShieldCheck}
              title={query ? "Tidak ada hasil" : `Belum ada akun ${role}`}
              description={
                query
                  ? "Coba kata kunci lain."
                  : "Buat akun pertama dengan tombol Buat Akun di atas."
              }
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Daftar {role === "siswa" ? "Siswa" : "Pembimbing"}
                </CardTitle>
                <CardDescription>{filtered.length} akun ditemukan.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>{role === "siswa" ? "NIS / Kelas" : "NIP / Bidang"}</TableHead>
                      <TableHead>Kontak</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => {
                      const detail = detailMap.get(item.id) as
                        | (SiswaProfile & PembimbingProfile)
                        | undefined
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.full_name}</p>
                            <p className="text-xs text-muted-foreground">{item.email}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            {role === "siswa"
                              ? `${detail?.nis ?? "-"} / ${detail?.class_name ?? "-"}`
                              : `${detail?.nip ?? "-"} / ${detail?.department ?? "-"}`}
                          </TableCell>
                          <TableCell className="text-sm">{item.phone ?? "-"}</TableCell>
                          <TableCell>
                            <StatusBadge
                              label={item.is_active ? "Aktif" : "Nonaktif"}
                              className={
                                item.is_active
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border"
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm">
                                  <MoreHorizontal />
                                  <span className="sr-only">Menu akun</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(item)}>
                                  <Pencil />
                                  Ubah Data
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setResetTarget(item)
                                    setNewPassword("")
                                  }}
                                >
                                  <RotateCcw />
                                  Reset Kata Sandi
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={busy} onClick={() => toggleActive(item)}>
                                  {item.is_active ? <UserRoundX /> : <UserRoundCheck />}
                                  {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <p className="mt-4 text-xs text-muted-foreground">
                  Data terakhir diperbarui {formatDate(new Date().toISOString().slice(0, 10))}. Akun
                  nonaktif tetap menyimpan seluruh riwayat presensi, jurnal, dan nilainya.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AccountFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        onSaved={data.reload}
        editing={editing}
        editingExtra={editing ? (detailMap.get(editing.id) ?? null) as SiswaProfile | PembimbingProfile | null : null}
        defaultRole={role}
      />

      <Dialog open={resetTarget !== null} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Kata Sandi</DialogTitle>
            <DialogDescription>
              Tetapkan kata sandi baru untuk {resetTarget?.full_name}. Beritahukan kata sandi baru ini
              kepada yang bersangkutan.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitReset}>
            <Field>
              <FieldLabel htmlFor="sandi-baru-akun">Kata Sandi Baru</FieldLabel>
              <Input
                id="sandi-baru-akun"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <FieldDescription>{PASSWORD_HINT}</FieldDescription>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
