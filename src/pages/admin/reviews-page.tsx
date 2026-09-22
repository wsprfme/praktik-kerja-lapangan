import { useState } from "react"
import { PageHeader } from "@/components/page-states"
import { ErrorState, LoadingState } from "@/components/page-states"
import { buildNameMap, LeaveDecisionList } from "@/components/review-lists"
import { NativeSelect } from "@/components/ui/native-select"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchLeaveRequests, fetchProfilesByRole } from "@/lib/queries"
import type { LeaveRequest } from "@/lib/types"

export function AdminReviewsPage() {
  const [status, setStatus] = useState("menunggu")

  const data = useAsyncData(
    async () => {
      const [requests, students] = await Promise.all([
        fetchLeaveRequests(status === "semua" ? {} : { status }),
        fetchProfilesByRole("siswa"),
      ])
      return { requests, names: buildNameMap(students) }
    },
    { requests: [] as LeaveRequest[], names: {} as Record<string, string> },
    [status],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengajuan Izin, Sakit & Cuti"
        description="Seluruh pengajuan siswa beserta status keputusannya."
      >
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="menunggu">Menunggu</option>
          <option value="disetujui">Disetujui</option>
          <option value="ditolak">Ditolak</option>
          <option value="semua">Semua Status</option>
        </NativeSelect>
      </PageHeader>

      {data.loading ? (
        <LoadingState rows={4} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : (
        <LeaveDecisionList
          requests={data.data.requests}
          names={data.data.names}
          loading={false}
          error={null}
          canDecide
          onReload={data.reload}
        />
      )}
    </div>
  )
}
