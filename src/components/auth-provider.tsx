import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api, ApiError, getToken, setToken } from "@/lib/api"
import type { Profile } from "@/lib/types"

interface AuthState {
  session: { access_token: string } | null
  profile: Profile | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ access_token: string } | null>(() => {
    const t = getToken()
    return t ? { access_token: t } : null
  })
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setProfile(null)
      setSession(null)
      setError(null)
      setLoading(false)
      return
    }
    try {
      const { user } = await api.me()
      if (!user.is_active) {
        setProfile(null)
        setSession(null)
        setToken(null)
        setError("Akun Anda sedang dinonaktifkan. Hubungi Admin.")
        setLoading(false)
        return
      }
      setProfile(user)
      setSession({ access_token: token })
      setError(null)
    } catch (err) {
      // 401 = sesi tidak valid (logout di tempat lain / ganti password) → bersihkan token.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setToken(null)
      setProfile(null)
      setSession(null)
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const refresh = useCallback(async () => {
    setLoading(true)
    await loadProfile()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    // Panggil server dulu supaya token dicabut (M6), lalu bersihkan state lokal.
    try {
      await api.logout()
    } catch {
      /* abaikan: token lokal tetap dihapus */
    }
    setToken(null)
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
