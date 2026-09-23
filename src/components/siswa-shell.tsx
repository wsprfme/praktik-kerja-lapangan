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
  "/siswa/pengajuan": "Pengajuan Izin",
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
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            PKL
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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-stretch">
          {PRIMARY_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      isActive && "bg-primary/10",
                    )}
                  >
                    <tab.icon className="size-5" />
                  </span>
                  {tab.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              secondaryActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                secondaryActive && "bg-primary/10",
              )}
            >
              <MoreHorizontal className="size-5" />
            </span>
            Lainnya
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Menu Lainnya</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-1 px-2 pb-2">
            {SECONDARY_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-accent",
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
              className="h-auto w-full justify-start gap-3 px-3 py-3 text-sm font-medium text-destructive hover:text-destructive"
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
