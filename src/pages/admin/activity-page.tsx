import { ScrollText } from "lucide-react"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncData } from "@/hooks/use-async-data"
import { supabase } from "@/lib/supabase"
import { ROLE_LABEL, formatDateTime } from "@/lib/format"
import type { ActivityLog, Role } from "@/lib/types"

async function fetchLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as ActivityLog[]
}

export function AdminActivityPage() {
  const data = useAsyncData(fetchLogs, [] as ActivityLog[])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catatan Aktivitas"
        description="Jejak tindakan penting yang dilakukan di sistem, untuk keperluan audit."
      />

      {data.loading ? (
        <LoadingState rows={6} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Belum ada aktivitas tercatat"
          description="Catatan akan muncul setelah ada pembuatan akun, perubahan penempatan, atau keputusan pengajuan."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Terbaru</CardTitle>
            <CardDescription>{data.data.length} catatan terakhir.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {data.data.map((log) => (
              <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{log.action}</p>
                    {log.actor_role ? (
                      <StatusBadge
                        label={ROLE_LABEL[log.actor_role as Role] ?? log.actor_role}
                        className="bg-muted text-muted-foreground border-border"
                      />
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{log.description ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">Oleh {log.actor_name ?? "Sistem"}</p>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
