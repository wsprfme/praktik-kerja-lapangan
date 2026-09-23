import { Megaphone } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/page-states"
import { ScreenHeader } from "@/components/mobile-ui"
import { Card, CardContent } from "@/components/ui/card"
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
    <div className="space-y-5">
      <ScreenHeader title="Pengumuman" description="Informasi terbaru dari Admin sekolah." />

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
        <div className="space-y-3">
          {data.data.map((announcement) => (
            <Card key={announcement.id} className="gap-0 py-0">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Megaphone className="size-4" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {AUDIENCE_LABEL[announcement.audience] ?? announcement.audience} -{" "}
                      {formatDateTime(announcement.created_at)}
                      {announcement.created_by_name ? ` - oleh ${announcement.created_by_name}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{announcement.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
