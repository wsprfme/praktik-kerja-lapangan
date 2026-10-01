import { useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Moon,
  Sun,
  UserRound,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { PwaInstallPopup } from "@/components/pwa"
import { SchoolLogo } from "@/components/school-logo"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"

interface TabItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const PRIMARY_TABS: TabItem[] = [
  { label: "Beranda", to: "/siswa", icon: LayoutDashboard, end: true },
  { label: "Presensi", to: "/siswa/presensi", icon: CalendarCheck },
  { label: "Jurnal", to: "/siswa/jurnal", icon: BookOpen },
  { label: "Izin", to: "/siswa/pengajuan", icon: FileText },
]

const SECONDARY_LINKS: TabItem[] = [
  { label: "Nilai PKL", to: "/siswa/nilai", icon: BarChart3 },
  { label: "Pengumuman", to: "/siswa/pengumuman", icon: Megaphone },
  { label: "Profil & Kata Sandi", to: "/siswa/profil", icon: UserRound },
]

const PAGE_TITLES: Record<string, string> = {
  "/siswa": "Beranda",
  "/siswa/presensi": "Presensi",
  "/siswa/jurnal": "Jurnal Harian",
  "/siswa/pengajuan": "Izin & Sakit",
  "/siswa/nilai": "Nilai PKL",
  "/siswa/pengumuman": "Pengumuman",
  "/siswa/profil": "Profil",
}

export function SiswaShell() {
  const { profile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const displayName = profile?.full_name ?? "Siswa"
  const title = PAGE_TITLES[pathname] ?? "Beranda"

  const handleSignOut = async () => {
    setMoreOpen(false)
    await signOut()
    navigate("/masuk", { replace: true })
  }

  const secondaryActive = SECONDARY_LINKS.some((item) => item.to === pathname)

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 dark:bg-white/95">
            <SchoolLogo className="size-full object-contain" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ubah tema"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-5 dark:hidden" />
            <Moon className="hidden size-5 dark:block" />
          </Button>
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials(displayName)}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">
        <Outlet />
      </main>

      {/* Navigasi bawah menempel tepi (bukan mengambang), sudut atas membulat +
          bayangan ke atas. Tab aktif berbentuk pil; semua item memendek saat ditekan. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.10)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-stretch gap-1 px-3 pt-2 pb-2">
          {PRIMARY_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-all active:scale-95",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-accent",
                )
              }
            >
              <tab.icon className="size-5" />
              {tab.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-all active:scale-95",
              secondaryActive ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-accent",
            )}
          >
            <MoreHorizontal className="size-5" />
            Lainnya
          </button>
        </div>
      </nav>

      <PwaInstallPopup />

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarFallback>{initials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DrawerTitle className="truncate">{displayName}</DrawerTitle>
                <p className="truncate text-xs text-muted-foreground">Siswa PKL</p>
              </div>
            </div>
          </DrawerHeader>
          <div className="space-y-1 px-2 pb-2">
            {SECONDARY_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all active:scale-[0.99]",
                    isActive ? "bg-primary/10 text-primary" : "active:bg-accent",
                  )
                }
              >
                <item.icon className="size-5" />
                {item.label}
              </NavLink>
            ))}
            <Separator className="my-2" />
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="size-5" />
              Keluar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
