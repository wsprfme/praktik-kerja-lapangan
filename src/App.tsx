import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { ForcePasswordDialog } from "@/components/force-password-dialog"
import { AuthGate, FullPageLoader, RoleGate } from "@/components/guards"
import { RoleLayout } from "@/components/role-layout"
import { SiswaShell } from "@/components/siswa-shell"
import { LoginPage } from "@/pages/login-page"
import { ProfilePage } from "@/pages/profile-page"
import { AdminAccountsPage } from "@/pages/admin/accounts-page"
import { AdminActivityPage } from "@/pages/admin/activity-page"
import { AdminAnnouncementsPage } from "@/pages/admin/announcements-page"
import { AdminCompaniesPage } from "@/pages/admin/companies-page"
import { AdminDashboard } from "@/pages/admin/dashboard"
import { AdminHolidaysPage } from "@/pages/admin/holidays-page"
import { AdminMonitoringPage } from "@/pages/admin/monitoring-page"
import { AdminPeriodsPage } from "@/pages/admin/periods-page"
import { AdminPlacementsPage } from "@/pages/admin/placements-page"
import { AdminProfilePage } from "@/pages/admin/profile-page"
import { AdminReportsPage } from "@/pages/admin/reports-page"
import { AdminReviewsPage } from "@/pages/admin/reviews-page"
import { PembimbingDashboard } from "@/pages/pembimbing/dashboard"
import { PembimbingJournalsPage } from "@/pages/pembimbing/journals-page"
import { PembimbingLeavePage } from "@/pages/pembimbing/leave-page"
import { PembimbingScoresPage } from "@/pages/pembimbing/scores-page"
import { PembimbingStudentsPage } from "@/pages/pembimbing/students-page"
import { PembimbingReportsPage } from "@/pages/pembimbing/reports-page"
import { SiswaAttendancePage } from "@/pages/siswa/attendance-page"
import { SiswaDashboard } from "@/pages/siswa/dashboard"
import { SiswaJournalsPage } from "@/pages/siswa/journals-page"
import { SiswaLeavePage } from "@/pages/siswa/leave-page"
import { SiswaProfilePage } from "@/pages/siswa/profile-page"
import { SiswaScorePage } from "@/pages/siswa/score-page"
import { AnnouncementsPage } from "@/pages/shared/announcements"
import { ROLE_HOME } from "@/lib/format"

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <FullPageLoader label="Menyiapkan sesi..." />
  if (!profile) return <Navigate to="/masuk" replace />
  return <Navigate to={ROLE_HOME[profile.role]} replace />
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/masuk" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <AuthGate>
                <RoleGate role="admin">
                  <RoleLayout role="admin" />
                </RoleGate>
              </AuthGate>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="akun" element={<AdminAccountsPage />} />
            <Route path="perusahaan" element={<AdminCompaniesPage />} />
            <Route path="periode" element={<AdminPeriodsPage />} />
            <Route path="penempatan" element={<AdminPlacementsPage />} />
            <Route path="libur" element={<AdminHolidaysPage />} />
            <Route path="pemantauan" element={<AdminMonitoringPage />} />
            <Route path="pengajuan" element={<AdminReviewsPage />} />
            <Route path="pengumuman" element={<AdminAnnouncementsPage />} />
            <Route path="laporan" element={<AdminReportsPage />} />
            <Route path="aktivitas" element={<AdminActivityPage />} />
            <Route path="profil" element={<AdminProfilePage />} />
          </Route>

          <Route
            path="/pembimbing"
            element={
              <AuthGate>
                <RoleGate role="pembimbing">
                  <RoleLayout role="pembimbing" />
                </RoleGate>
              </AuthGate>
            }
          >
            <Route index element={<PembimbingDashboard />} />
            <Route path="siswa" element={<PembimbingStudentsPage />} />
            <Route path="jurnal" element={<PembimbingJournalsPage />} />
            <Route path="pengajuan" element={<PembimbingLeavePage />} />
            <Route path="penilaian" element={<PembimbingScoresPage />} />
            <Route path="rekap" element={<PembimbingReportsPage />} />
            <Route path="pengumuman" element={<AnnouncementsPage />} />
            <Route path="profil" element={<ProfilePage />} />
          </Route>

          <Route
            path="/siswa"
            element={
              <AuthGate>
                <RoleGate role="siswa">
                  <SiswaShell />
                </RoleGate>
              </AuthGate>
            }
          >
            <Route index element={<SiswaDashboard />} />
            <Route path="presensi" element={<SiswaAttendancePage />} />
            <Route path="jurnal" element={<SiswaJournalsPage />} />
            <Route path="pengajuan" element={<SiswaLeavePage />} />
            <Route path="nilai" element={<SiswaScorePage />} />
            <Route path="pengumuman" element={<AnnouncementsPage />} />
            <Route path="profil" element={<SiswaProfilePage />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
        <Toaster position="top-right" />
        <ForcePasswordDialog />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
