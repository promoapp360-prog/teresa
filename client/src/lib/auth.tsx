import React, { createContext, useContext, useEffect, useState } from "react";
import { get } from "./api";

export type Me = { id: number; username: string; fullName: string | null; email: string | null; role: "doctor" | "staff"; mustChangePassword: boolean; totpEnabled: boolean; lastLoginAt: string | null };

const Ctx = createContext<{ me: Me | null; loading: boolean; refresh: () => Promise<void>; setMe: (u: Me | null) => void }>({ me: null, loading: true, refresh: async () => {}, setMe: () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try { const r = await get<{ user: Me | null }>("auth/me"); setMe(r.user); } catch { setMe(null); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  return <Ctx.Provider value={{ me, loading, refresh, setMe }}>{children}</Ctx.Provider>;
}
