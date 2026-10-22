import type { ReactNode } from "react";
import type { Icone as Nome } from "./rotas";

/** Ícones lineares do protótipo ITO 2.0. */
const DESENHOS: Record<Nome, ReactNode> = {
  base: <path d="M3 13V8M8 13V3M13 13V6" />,
  comp: (
    <>
      <path d="M2 12c2-4 4-6 6-6s4 2 6 6" />
      <path d="M2 9c2-2 4-3 6-3" />
    </>
  ),
  proj: <path d="M2 12l4-4 3 3 5-6" />,
  carga: <path d="M8 11V2M4.5 5.5L8 2l3.5 3.5M2.5 14h11" />,
  cid: (
    <>
      <path d="M8 14.5s-4.5-4.2-4.5-7.8a4.5 4.5 0 0 1 9 0c0 3.6-4.5 7.8-4.5 7.8z" />
      <circle cx="8" cy="6.6" r="1.6" />
    </>
  ),
  param: (
    <>
      <path d="M2 4h12M2 8h12M2 12h12" />
      <circle cx="5" cy="4" r="1.6" fill="currentColor" />
      <circle cx="11" cy="8" r="1.6" fill="currentColor" />
      <circle cx="7" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  func: (
    <>
      <circle cx="5.5" cy="5" r="2.2" />
      <circle cx="11" cy="6" r="1.8" />
      <path d="M1.8 13c.5-2.3 2-3.5 3.7-3.5s3.2 1.2 3.7 3.5M9.5 10c.5-.4 1-.6 1.5-.6 1.4 0 2.6 1 3 3.1" />
    </>
  ),
  rub: (
    <>
      <rect x="2.5" y="2" width="11" height="12" rx="2" />
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
    </>
  ),
  audit: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3" />
    </>
  ),
};

export function Icone({ nome }: { nome: Nome }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {DESENHOS[nome]}
    </svg>
  );
}

export function IconeBusca() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3 3" />
    </svg>
  );
}
