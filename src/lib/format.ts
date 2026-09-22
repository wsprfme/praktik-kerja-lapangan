import type { AttendanceStatus, LeaveStatus, PlacementStatus, ReviewStatus, Role } from "./types"

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  pembimbing: "Pembimbing",
  siswa: "Siswa",
}

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  pembimbing: "/pembimbing",
  siswa: "/siswa",
}

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
}

export const ATTENDANCE_CLASS: Record<AttendanceStatus, string> = {
  hadir: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  izin: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  sakit: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  alpa: "bg-destructive/15 text-destructive border-destructive/30",
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  menunggu: "Menunggu Tinjauan",
  ditinjau: "Sudah Ditinjau",
}

export const REVIEW_CLASS: Record<ReviewStatus, string> = {
  menunggu: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  ditinjau: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
}

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
}

export const LEAVE_STATUS_CLASS: Record<LeaveStatus, string> = {
  menunggu: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  disetujui: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  ditolak: "bg-destructive/15 text-destructive border-destructive/30",
  dibatalkan: "bg-muted text-muted-foreground border-border",
}

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  izin: "Izin",
  sakit: "Sakit",
  cuti: "Cuti",
}

export const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  draft: "Draf",
  aktif: "Aktif",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
}

export const PLACEMENT_STATUS_CLASS: Record<PlacementStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  aktif: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  selesai: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  dibatalkan: "bg-destructive/15 text-destructive border-destructive/30",
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "-"
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "-"
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
}

export function formatDayName(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "-"
  return DAY_NAMES[date.getDay()]
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return `${formatDateShort(value)} ${formatTime(value)}`
}

export function todayISO(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10)
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-")
  const index = Number(month) - 1
  if (!year || Number.isNaN(index) || index < 0 || index > 11) return monthKey
  return `${MONTH_NAMES[index]} ${year}`
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7)
}

export function lastMonthKeys(count: number): string[] {
  const keys: string[] = []
  const base = new Date(`${currentMonthKey()}-01T00:00:00`)
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return keys
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(`${start.slice(0, 10)}T00:00:00`).getTime()
  const b = new Date(`${end.slice(0, 10)}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000) + 1)
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "-"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} menit`
  if (rest === 0) return `${hours} jam`
  return `${hours} jam ${rest} menit`
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function predicateFor(score: number | null | undefined): "A" | "B" | "C" | "D" | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null
  if (score >= 85) return "A"
  if (score >= 75) return "B"
  if (score >= 60) return "C"
  return "D"
}

export const PREDICATE_LABEL: Record<string, string> = {
  A: "Sangat Baik",
  B: "Baik",
  C: "Cukup",
  D: "Kurang",
}
