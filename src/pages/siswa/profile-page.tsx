import { ProfilePage } from "@/pages/profile-page"
import { useAsyncData } from "@/hooks/use-async-data"
import { useAuth } from "@/components/auth-provider"
import { fetchStudentOverview } from "@/lib/queries"
import { InlineLoading } from "@/components/page-states"

export function SiswaProfilePage() {
  const { profile } = useAuth()
  const overview = useAsyncData(
    () => (profile ? fetchStudentOverview(profile.id) : Promise.resolve(null)),
    null,
    [profile?.id],
  )

  if (overview.loading) return <InlineLoading />
  return <ProfilePage overview={overview.data} />
}
