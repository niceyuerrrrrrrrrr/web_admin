import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  name: string
  role: string
  positionType?: string
  email?: string
}

interface AuthState {
  token: string | null
  user?: UserInfo
  setAuth: (payload: { token: string; user: UserInfo }) => void
  logout: () => void
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: undefined,
      setAuth: ({ token, user }) => set({ token, user }),
      logout: () => set({ token: null, user: undefined }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    },
  ),
)

export default useAuthStore
