import React, { createContext, useContext, useEffect, useState } from "react";
import { get } from "./api";

export type Category = { id: number; slug: string; name: string; subtitle: string | null; intro: string | null; body: string | null; icon: string | null };
export type Service = { id: number; categoryId: number; slug: string; name: string; shortDescription: string | null; description: string | null; infoNotes: string | null; durationMin: number; priceCents: number | null; bookable: boolean };
export type SiteData = { settings: any; categories: Category[]; services: Service[] };

const Ctx = createContext<{ site: SiteData | null; reload: () => void }>({ site: null, reload: () => {} });
export const useSite = () => useContext(Ctx);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [site, setSite] = useState<SiteData | null>(null);
  const load = () => get<SiteData>("public/site").then(setSite).catch(() => setTimeout(load, 3000));
  useEffect(() => { load(); }, []);
  return <Ctx.Provider value={{ site, reload: load }}>{children}</Ctx.Provider>;
}
