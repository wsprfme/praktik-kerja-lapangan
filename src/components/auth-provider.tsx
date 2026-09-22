import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/lib/types"

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", activeSession.user.id)
      .maybeSingle()

    if (profileError) {
      setProfile(null)
      setError("Gagal memuat data akun. Silakan coba lagi.")
      setLoading(false)
      return
    }

    if (!data) {
      setProfile(null)
      setError("Data akun tidak ditemukan. Hubungi Admin.")
      setLoading(false)
      return
    }

    if (!data.is_active) {
      setProfile(null)
      setError("Akun Anda sedang dinonaktifkan. Hubungi Admin.")
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    setProfile(data as Profile)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      void loadProfile(data.session)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        if (!mounted) return
        setSession(nextSession)
        await loadProfile(nextSession)
      })()
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await loadProfile(data.session)
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, profile, loading, error, refresh, signOut }),
    [session, profile, loading, error, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider")
  }
  return context
}
