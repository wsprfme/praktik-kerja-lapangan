import * as ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
} from "date-fns"

import type { StudentOverview, Attendance, Journal, LeaveRequest, AttendanceStatus } from "@/lib/types"
import {
  formatDate,
  formatTime,
  ATTENDANCE_LABEL,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  REVIEW_LABEL,
} from "@/lib/format"

/* ------------------------------------------------------------------ */
/*  Shared style constants                                             */
/* ------------------------------------------------------------------ */

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4472C4" },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FFFFFFFF" },
  bold: true,
  size: 11,
}

const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  horizontal: "center",
  vertical: "middle",
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  hadir: "FF27AE60",
  izin: "FFF1C40F",
  sakit: "FF3498DB",
  alpa: "FFE74C3C",
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/** Apply header style to every cell in a row. */
function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = HEADER_ALIGNMENT
    cell.border = THIN_BORDER
  })
  row.height = 24
}

/** Apply thin border to every cell in a data row. */
function styleDataRow(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = THIN_BORDER
  })
}

/** Auto-fit column widths based on header text and content. */
function autoWidth(sheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 50): void {
  sheet.columns.forEach((column) => {
    if (!column || !column.eachCell) return
    let longest = minWidth
    column.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0
      if (len > longest) longest = len
    })
    column.width = Math.min(longest + 4, maxWidth)
  })
}

/** Build a student lookup map by profile id. */
function studentMap(students: StudentOverview[]): Map<string, StudentOverview> {
  const map = new Map<string, StudentOverview>()
  for (const s of students) {
    map.set(s.profile.id, s)
  }
  return map
}

/* ------------------------------------------------------------------ */
/*  buildDateRange                                                     */
/* ------------------------------------------------------------------ */

export function buildDateRange(
  mode: "harian" | "mingguan" | "bulanan" | "seluruh",
  referenceDate?: string,
): { from: string; to: string } {
  const ref = referenceDate ? parseISO(referenceDate) : new Date()

  switch (mode) {
    case "harian": {
      const day = startOfDay(ref)
      return {
        from: format(day, "yyyy-MM-dd"),
        to: format(endOfDay(ref), "yyyy-MM-dd"),
      }
    }
    case "mingguan": {
      const weekStart = startOfWeek(ref, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(ref, { weekStartsOn: 1 })
      return {
        from: format(weekStart, "yyyy-MM-dd"),
        to: format(weekEnd, "yyyy-MM-dd"),
      }
    }
    case "bulanan": {
      return {
        from: format(startOfMonth(ref), "yyyy-MM-dd"),
        to: format(endOfMonth(ref), "yyyy-MM-dd"),
      }
    }
    case "seluruh":
    default:
      return { from: "2000-01-01", to: "2099-12-31" }
  }
}

/* ------------------------------------------------------------------ */
/*  downloadWorkbook                                                   */
/* ------------------------------------------------------------------ */

export async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  saveAs(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`)
}

/* ------------------------------------------------------------------ */
/*  exportAttendanceReport                                             */
/* ------------------------------------------------------------------ */

export interface AttendanceReportParams {
  students: StudentOverview[]
  attendance: Attendance[]
  journals: Journal[]
  leaveRequests: LeaveRequest[]
  period: string
  dateRange: { from: string; to: string }
}

export async function exportAttendanceReport(
  params: AttendanceReportParams,
): Promise<ExcelJS.Workbook> {
  const { students, attendance, journals, leaveRequests, period, dateRange } = params

  const sMap = studentMap(students)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistem PKL"
  workbook.created = new Date()

  /* ============================== Sheet 1 ============================== */
  buildRekapSheet(workbook, students, attendance, period, dateRange)

  /* ============================== Sheet 2 ============================== */
  buildDetailSheet(workbook, attendance, sMap)

  /* ============================== Sheet 3 ============================== */
  buildJurnalSheet(workbook, journals, sMap)

  /* ============================== Sheet 4 ============================== */
  buildIzinSheet(workbook, leaveRequests, sMap)

  return workbook
}

/* ------------------------------------------------------------------ */
/*  Sheet 1 – Rekap Presensi                                           */
/* ------------------------------------------------------------------ */

function buildRekapSheet(
  workbook: ExcelJS.Workbook,
  students: StudentOverview[],
  attendance: Attendance[],
  period: string,
  dateRange: { from: string; to: string },
): void {
  const sheet = workbook.addWorksheet("Rekap Presensi")

  /* ---- Title rows ---- */
  const titleRow = sheet.addRow(["Rekap Presensi Siswa PKL"])
  titleRow.font = { bold: true, size: 14 }
  sheet.mergeCells("A1:L1")

  const periodRow = sheet.addRow([`Periode: ${period}`])
  periodRow.font = { bold: true, size: 11 }
  sheet.mergeCells("A2:L2")

  const rangeRow = sheet.addRow([
    `Tanggal: ${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`,
  ])
  rangeRow.font = { italic: true, size: 11 }
  sheet.mergeCells("A3:L3")

  sheet.addRow([]) // spacer

  /* ---- Header ---- */
  const headers = [
    "No",
    "NISN",
    "NIS",
    "Nama Siswa",
    "Kelas",
    "Jurusan",
    "Perusahaan",
    "Hadir",
    "Izin",
    "Sakit",
    "Alpa",
    "Total Hari",
  ]
  const headerRow = sheet.addRow(headers)
  styleHeaderRow(headerRow)

  /* ---- Aggregate attendance per student ---- */
  const countsMap = new Map<string, Record<AttendanceStatus | "total", number>>()
  for (const a of attendance) {
    let rec = countsMap.get(a.student_id)
    if (!rec) {
      rec = { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0 }
      countsMap.set(a.student_id, rec)
    }
    rec[a.status] += 1
    rec.total += 1
  }

  /* ---- Data rows ---- */
  let sumHadir = 0
  let sumIzin = 0
  let sumSakit = 0
  let sumAlpa = 0
  let sumTotal = 0

  students.forEach((s, idx) => {
    const c = countsMap.get(s.profile.id) ?? { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0 }

    sumHadir += c.hadir
    sumIzin += c.izin
    sumSakit += c.sakit
    sumAlpa += c.alpa
    sumTotal += c.total

    const row = sheet.addRow([
      idx + 1,
      s.detail?.nisn ?? "-",
      s.detail?.nis ?? "-",
      s.profile.full_name,
      s.detail?.class_name ?? "-",
      s.detail?.major ?? "-",
      s.company?.name ?? "-",
      c.hadir,
      c.izin,
      c.sakit,
      c.alpa,
      c.total,
    ])
    styleDataRow(row)
  })

  /* ---- Summary row ---- */
  const summaryRow = sheet.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "Total",
    sumHadir,
    sumIzin,
    sumSakit,
    sumAlpa,
    sumTotal,
  ])
  summaryRow.font = { bold: true, size: 11 }
  styleDataRow(summaryRow)

  /* ---- Auto-filter on the header row ---- */
  const headerRowNumber = headerRow.number
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: headers.length },
  }

  autoWidth(sheet)
}

/* ------------------------------------------------------------------ */
/*  Sheet 2 – Detail Presensi                                          */
/* ------------------------------------------------------------------ */

function buildDetailSheet(
  workbook: ExcelJS.Workbook,
  attendance: Attendance[],
  sMap: Map<string, StudentOverview>,
): void {
  const sheet = workbook.addWorksheet("Detail Presensi")

  const headers = [
    "Tanggal",
    "Nama Siswa",
    "NISN",
    "Status",
    "Jam Masuk",
    "Jam Keluar",
    "Lokasi Masuk",
    "Lokasi Keluar",
    "Keterangan",
  ]
  const headerRow = sheet.addRow(headers)
  styleHeaderRow(headerRow)

  /* Sort by date then student name */
  const sorted = [...attendance].sort((a, b) => {
    const dc = a.date.localeCompare(b.date)
    if (dc !== 0) return dc
    const nameA = sMap.get(a.student_id)?.profile.full_name ?? ""
    const nameB = sMap.get(b.student_id)?.profile.full_name ?? ""
    return nameA.localeCompare(nameB)
  })

  for (const a of sorted) {
    const student = sMap.get(a.student_id)
    const row = sheet.addRow([
      formatDate(a.date),
      student?.profile.full_name ?? "-",
      student?.detail?.nisn ?? "-",
      ATTENDANCE_LABEL[a.status] ?? a.status,
      formatTime(a.check_in_time),
      formatTime(a.check_out_time),
      a.address ?? "-",
      a.check_out_address ?? "-",
      a.note ?? "-",
    ])
    styleDataRow(row)

    /* Color-code the status cell (column 4) */
    const statusCell = row.getCell(4)
    const argb = STATUS_COLORS[a.status]
    if (argb) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb },
      }
      /* Use white text on darker backgrounds, dark text on yellow */
      statusCell.font = {
        color: { argb: a.status === "izin" ? "FF000000" : "FFFFFFFF" },
        bold: true,
      }
    }
  }

  /* Auto-filter */
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: headers.length },
  }

  autoWidth(sheet)
}

/* ------------------------------------------------------------------ */
/*  Sheet 3 – Jurnal Harian                                            */
/* ------------------------------------------------------------------ */

function buildJurnalSheet(
  workbook: ExcelJS.Workbook,
  journals: Journal[],
  sMap: Map<string, StudentOverview>,
): void {
  const sheet = workbook.addWorksheet("Jurnal Harian")

  const headers = [
    "Tanggal",
    "Nama Siswa",
    "Judul",
    "Deskripsi",
    "Durasi (menit)",
    "Status Review",
    "Umpan Balik",
  ]
  const headerRow = sheet.addRow(headers)
  styleHeaderRow(headerRow)

  /* Sort by date */
  const sorted = [...journals].sort((a, b) => a.date.localeCompare(b.date))

  for (const j of sorted) {
    const student = sMap.get(j.student_id)
    const row = sheet.addRow([
      formatDate(j.date),
      student?.profile.full_name ?? "-",
      j.title,
      j.description ?? "-",
      j.duration_minutes ?? "-",
      REVIEW_LABEL[j.review_status] ?? j.review_status,
      j.supervisor_feedback ?? "-",
    ])
    styleDataRow(row)
  }

  /* Auto-filter */
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: headers.length },
  }

  autoWidth(sheet)
}

/* ------------------------------------------------------------------ */
/*  Sheet 4 – Pengajuan Izin                                           */
/* ------------------------------------------------------------------ */

function buildIzinSheet(
  workbook: ExcelJS.Workbook,
  leaveRequests: LeaveRequest[],
  sMap: Map<string, StudentOverview>,
): void {
  const sheet = workbook.addWorksheet("Pengajuan Izin")

  const headers = [
    "Nama Siswa",
    "Jenis",
    "Tanggal Mulai",
    "Tanggal Selesai",
    "Alasan",
    "Status",
    "Keputusan Oleh",
    "Catatan",
  ]
  const headerRow = sheet.addRow(headers)
  styleHeaderRow(headerRow)

  for (const lr of leaveRequests) {
    const student = sMap.get(lr.student_id)
    const row = sheet.addRow([
      student?.profile.full_name ?? "-",
      LEAVE_TYPE_LABEL[lr.type] ?? lr.type,
      formatDate(lr.start_date),
      formatDate(lr.end_date),
      lr.reason,
      LEAVE_STATUS_LABEL[lr.status] ?? lr.status,
      lr.decided_by_name ?? "-",
      lr.decision_note ?? "-",
    ])
    styleDataRow(row)
  }

  /* Auto-filter */
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: headers.length },
  }

  autoWidth(sheet)
}
