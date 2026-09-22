import { useState } from "react"
import { CalendarCheck, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchHolidays } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { formatDate, formatDayName, todayISO } from "@/lib/format"
import type { Holiday } from "@/lib/types"

export function AdminHolidaysPage() {
  const data = useAsyncData(fetchHolidays, [] as Holiday[])
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!date || !name.trim()) {
      toast.error("Tanggal dan nama hari libur wajib diisi.")
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from("holidays")
      .upsert({ date, name: name.trim() }, { onConflict: "date" })
    setSaving(false)

    if (error) {
      toast.error("Gagal menyimpan hari libur.")
      return
    }
    toast.success("Hari libur disimpan.")
    setOpen(false)
    setName("")
    data.reload()
  }

  const remove = async (holiday: Holiday) => {
    const { error } = await supabase.from("holidays").delete().eq("id", holiday.id)
    if (error) {
      toast.error("Gagal menghapus hari libur.")
      return
    }
    toast.success("Hari libur dihapus.")
    data.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kalender Hari Libur" description="Hari libur tidak dihitung sebagai hari wajib presensi.">
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Tambah Hari Libur
        </Button>
      </PageHeader>

      {data.loading ? (
        <LoadingState rows={4} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Belum ada hari libur"
          description="Tambahkan tanggal libur sekolah atau libur nasional selama periode PKL."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daftar Hari Libur</CardTitle>
            <CardDescription>{data.data.length} tanggal tercatat.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Hari</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">{formatDate(holiday.date)}</TableCell>
                    <TableCell>{formatDayName(holiday.date)}</TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => remove(holiday)}>
                        <Trash2 />
                        <span className="sr-only">Hapus</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Hari Libur</DialogTitle>
            <DialogDescription>
              Jika tanggal sudah ada, keterangannya akan diperbarui.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <Field>
              <FieldLabel htmlFor="tanggal-libur">Tanggal</FieldLabel>
              <Input id="tanggal-libur" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="nama-libur">Keterangan</FieldLabel>
              <Input
                id="nama-libur"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Libur Nasional"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
