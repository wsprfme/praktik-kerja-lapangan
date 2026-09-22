import { useState } from "react"
import { GraduationCap, Search } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StudentDetail } from "@/components/student-detail"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchStudentOverviews } from "@/lib/queries"
import { formatDate } from "@/lib/format"

export function PembimbingStudentsPage() {
  const { profile } = useAuth()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | null>(null)

  const data = useAsyncData(() => fetchStudentOverviews(), [], [profile?.id])

  const filtered = data.data.filter((row) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return (
      row.profile.full_name.toLowerCase().includes(term) ||
      (row.detail?.class_name ?? "").toLowerCase().includes(term) ||
      (row.company?.name ?? "").toLowerCase().includes(term)
    )
  })

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
      <PageHeader title="Siswa Bimbingan Saya" description="Hanya siswa yang ditugaskan kepada Anda." />

      <div className="relative w-full sm:w-80">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama, kelas, atau perusahaan..."
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
              : "Hubungi Admin untuk menugaskan siswa kepada Anda."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <Card key={row.profile.id}>
              <CardHeader>
                <CardTitle className="text-base">{row.profile.full_name}</CardTitle>
                <CardDescription>
                  {row.detail?.class_name ?? "Kelas belum diisi"} - {row.detail?.nis ?? "NIS belum diisi"}
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
    </div>
  )
}
