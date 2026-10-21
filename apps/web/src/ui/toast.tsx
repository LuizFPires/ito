import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import s from "./ui.module.css";

const DURACAO_MS = 3200;

const ToastCtx = createContext<(msg: string) => void>(() => {});

/** Aviso curto no rodapé (como no protótipo). Some sozinho em 3,2 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const avisar = useCallback((m: string) => {
    clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => setMsg(null), DURACAO_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div role="status" aria-live="polite">
        {msg && (
          <div className={s.toast}>
            <i aria-hidden="true" />
            {msg}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
