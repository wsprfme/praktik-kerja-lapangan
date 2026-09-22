import { Megaphone } from "lucide-react"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchAnnouncements } from "@/lib/queries"
import { formatDateTime } from "@/lib/format"
import type { Announcement } from "@/lib/types"

const AUDIENCE_LABEL: Record<string, string> = {
  semua: "Semua Pengguna",
  pembimbing: "Pembimbing",
  siswa: "Siswa",
}

export function AnnouncementsPage() {
  const data = useAsyncData(fetchAnnouncements, [] as Announcement[])

  return (
    <div className="space-y-6">
      <PageHeader title="Pengumuman" description="Informasi terbaru dari Admin sekolah." />

      {data.loading ? (
        <LoadingState rows={3} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Belum ada pengumuman"
          description="Pengumuman dari Admin akan muncul di halaman ini."
        />
      ) : (
        <div className="space-y-4">
          {data.data.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <CardTitle className="text-base">{announcement.title}</CardTitle>
                <CardDescription>
                  {AUDIENCE_LABEL[announcement.audience] ?? announcement.audience} -{" "}
                  {formatDateTime(announcement.created_at)}
                  {announcement.created_by_name ? ` - oleh ${announcement.created_by_name}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{announcement.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
