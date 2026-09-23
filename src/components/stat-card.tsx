import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone?: "default" | "positive" | "warning" | "danger" | "info"
  loading?: boolean
}

const ICON_TONES: Record<string, string> = {
  default: "bg-muted text-foreground",
  positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", loading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={cn("flex size-9 items-center justify-center rounded-lg", ICON_TONES[tone])}>
            <Icon className="size-4" />
          </span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        )}
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
