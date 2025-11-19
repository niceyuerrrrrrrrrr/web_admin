import { create } from 'zustand'

interface UserInfo {
  name: string
  role: string
  email?: string
}

interface AuthState {
  token: string | null
  user?: UserInfo
  setAuth: (payload: { token: string; user: UserInfo }) => void
  logout: () => void
}

const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: undefined,
  setAuth: ({ token, user }) => set({ token, user }),
  logout: () => set({ token: null, user: undefined }),
}))

export default useAuthStore
