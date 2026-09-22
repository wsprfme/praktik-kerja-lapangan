import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Users,
} from "lucide-react"
import type { Role } from "@/lib/types"

export interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  end?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  admin: [
    {
      label: "Ringkasan",
      items: [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true }],
    },
    {
      label: "Data Induk",
      items: [
        { label: "Akun Pengguna", to: "/admin/akun", icon: Users },
        { label: "Perusahaan", to: "/admin/perusahaan", icon: Building2 },
        { label: "Periode PKL", to: "/admin/periode", icon: CalendarDays },
        { label: "Penempatan", to: "/admin/penempatan", icon: ClipboardList },
        { label: "Hari Libur", to: "/admin/libur", icon: CalendarCheck },
      ],
    },
    {
      label: "Pemantauan",
      items: [
        { label: "Presensi & Jurnal", to: "/admin/pemantauan", icon: BookOpen },
        { label: "Pengajuan Izin", to: "/admin/pengajuan", icon: FileText },
        { label: "Pengumuman", to: "/admin/pengumuman", icon: Megaphone },
      ],
    },
    {
      label: "Laporan",
      items: [
        { label: "Laporan & Ekspor", to: "/admin/laporan", icon: BarChart3 },
        { label: "Catatan Aktivitas", to: "/admin/aktivitas", icon: ScrollText },
      ],
    },
  ],
  pembimbing: [
    {
      label: "Ringkasan",
      items: [{ label: "Dashboard", to: "/pembimbing", icon: LayoutDashboard, end: true }],
    },
    {
      label: "Bimbingan",
      items: [
        { label: "Siswa Bimbingan", to: "/pembimbing/siswa", icon: GraduationCap },
        { label: "Tinjauan Jurnal", to: "/pembimbing/jurnal", icon: BookOpen },
        { label: "Pengajuan Izin", to: "/pembimbing/pengajuan", icon: FileText },
        { label: "Penilaian", to: "/pembimbing/penilaian", icon: BarChart3 },
        { label: "Pengumuman", to: "/pembimbing/pengumuman", icon: Megaphone },
      ],
    },
  ],
  siswa: [
    {
      label: "Ringkasan",
      items: [{ label: "Dashboard", to: "/siswa", icon: LayoutDashboard, end: true }],
    },
    {
      label: "Aktivitas PKL",
      items: [
        { label: "Presensi", to: "/siswa/presensi", icon: CalendarCheck },
        { label: "Jurnal Harian", to: "/siswa/jurnal", icon: BookOpen },
        { label: "Pengajuan Izin", to: "/siswa/pengajuan", icon: FileText },
      ],
    },
    {
      label: "Hasil",
      items: [
        { label: "Nilai PKL", to: "/siswa/nilai", icon: BarChart3 },
        { label: "Pengumuman", to: "/siswa/pengumuman", icon: Megaphone },
      ],
    },
  ],
}
