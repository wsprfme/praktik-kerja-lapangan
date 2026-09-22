import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { buildNameMap, JournalReviewList } from "@/components/review-lists"
import { NativeSelect } from "@/components/ui/native-select"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchJournals, fetchStudentOverviews } from "@/lib/queries"

export function PembimbingJournalsPage() {
  const { profile } = useAuth()
  const [status, setStatus] = useState("menunggu")

  const data = useAsyncData(
    async () => {
      const overviews = await fetchStudentOverviews()
      const ids = overviews.map((o) => o.profile.id)
      if (ids.length === 0) {
        return { journals: [], names: {} as Record<string, string> }
      }
      const journals = await fetchJournals(status === "semua" ? {} : { reviewStatus: status })
      return {
        journals: journals.filter((j) => ids.includes(j.student_id)),
        names: buildNameMap(overviews.map((o) => o.profile)),
      }
    },
    { journals: [], names: {} as Record<string, string> },
    [status, profile?.id],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tinjauan Jurnal"
        description="Baca jurnal siswa bimbingan Anda, buka bukti kegiatan, lalu berikan umpan balik."
      >
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="menunggu">Menunggu Tinjauan</option>
          <option value="ditinjau">Sudah Ditinjau</option>
          <option value="semua">Semua Jurnal</option>
        </NativeSelect>
      </PageHeader>

      {data.loading ? (
        <LoadingState rows={4} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : (
        <JournalReviewList
          journals={data.data.journals}
          names={data.data.names}
          loading={false}
          error={null}
          onReload={data.reload}
        />
      )}
    </div>
  )
}
