import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { buildNameMap, LeaveDecisionList } from "@/components/review-lists"
import { NativeSelect } from "@/components/ui/native-select"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchLeaveRequests, fetchStudentOverviews } from "@/lib/queries"

export function PembimbingLeavePage() {
  const { profile } = useAuth()
  const [status, setStatus] = useState("menunggu")

  const data = useAsyncData(
    async () => {
      const overviews = await fetchStudentOverviews()
      const ids = overviews.map((o) => o.profile.id)
      if (ids.length === 0) {
        return { requests: [], names: {} as Record<string, string> }
      }
      const requests = await fetchLeaveRequests(status === "semua" ? {} : { status })
      return {
        requests: requests.filter((r) => ids.includes(r.student_id)),
        names: buildNameMap(overviews.map((o) => o.profile)),
      }
    },
    { requests: [], names: {} as Record<string, string> },
    [status, profile?.id],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengajuan Izin, Sakit & Cuti"
        description="Tinjau pengajuan siswa bimbingan Anda dan tentukan keputusannya."
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
