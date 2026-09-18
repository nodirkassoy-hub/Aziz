"use client";
/** Global UI context: toasts, confirm dialog, theme. */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

type Toast = { id: number; kind: "success" | "error" | "info" | "warn"; text: string };
type Ctx = {
  toast: (kind: Toast["kind"], text: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
};
const uiCtx = createContext<Ctx>({ toast: () => {}, theme: "dark", toggleTheme: () => {} });
export const useUI = () => useContext(uiCtx);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const stored = localStorage.getItem("mizom_theme") as "light" | "dark" | null;
    const t = stored ?? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme(cur => {
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("mizom_theme", next);
      return next;
    });
  }, []);
  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4600);
  }, []);
  return (
    <uiCtx.Provider value={{ toast, theme, toggleTheme }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 no-print">
        {toasts.map(t => (
          <div key={t.id} className="card-solid animate-scale-in flex items-start gap-3 p-3.5 pr-10 text-sm shadow-glass-lg relative" role="status">
            {t.kind === "success" && <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: "var(--pos)" }} />}
            {t.kind === "error" && <XCircle size={18} className="shrink-0 mt-0.5" style={{ color: "var(--neg)" }} />}
            {t.kind === "warn" && <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />}
            {t.kind === "info" && <Info size={18} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />}
            <div className="min-w-0 break-words">{t.text}</div>
            <button aria-label="Close" className="absolute right-2 top-2 opacity-50 hover:opacity-100" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </uiCtx.Provider>
  );
}

/** fetch wrapper with loading + toast error handling for JSON APIs */
export async function api<T = any>(url: string, opts: { method?: string; body?: any; formData?: FormData; quiet?: boolean } = {}): Promise<{ ok: boolean; error?: string; data?: T; toastText?: string }> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.formData ? "POST" : opts.body !== undefined ? "POST" : "GET"),
      body: opts.formData ?? (opts.body !== undefined && !opts.formData ? JSON.stringify(opts.body) : undefined),
      headers: opts.body && !opts.formData ? { "Content-Type": "application/json" } : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) return { ok: false, error: data.error ?? `Request failed (${res.status})`, data };
    return { ok: true, data: data.data ?? data, toastText: data.message };
  } catch (e: any) {
    return { ok: false, error: "Network error — unable to save. Please try again." };
  }
}
