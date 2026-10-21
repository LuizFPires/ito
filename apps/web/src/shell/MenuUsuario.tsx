import { useEffect, useRef, useState } from "react";
import { useSessao } from "../auth/sessao";
import { NOME_PERFIL } from "../lib/supabase";
import { Badge, Botao, Segmento } from "../ui/componentes";
import { useTema } from "../ui/tema";
import type { Tema } from "../ui/tema";
import s from "./Shell.module.css";

const TEMAS = [
  { valor: "claro", texto: "Claro" },
  { valor: "escuro", texto: "Escuro" },
  { valor: "sistema", texto: "Sistema" },
] as const satisfies readonly { valor: Tema; texto: string }[];

function iniciais(nome: string, email: string): string {
  const base = nome.trim() || email.split("@")[0] || "?";
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function MenuUsuario() {
  const { usuario, sessao, sair } = useSessao();
  const { tema, setTema } = useTema();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const email = usuario?.email ?? sessao?.user.email ?? "";

  return (
    <div className={s.menuUsuario} ref={caixa}>
      <button
        className={s.avatar}
        aria-label="Conta e aparência"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        {iniciais(usuario?.nome ?? "", email)}
      </button>
      {aberto && (
        <div className={s.menuUsuarioPainel} role="dialog" aria-label="Conta e aparência">
          <div>
            <strong>{usuario?.nome || email}</strong>
            <div className="sub">{email}</div>
          </div>
          {usuario && (
            <div className="row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge tom="escuro">{NOME_PERFIL[usuario.perfil]}</Badge>
              {usuario.admin && <Badge tom="ambar">Admin</Badge>}
            </div>
          )}
          <span className="rotulo">Aparência</span>
          <Segmento rotulo="Tema" opcoes={TEMAS} valor={tema} onChange={setTema} />
          <Botao pequeno onClick={() => void sair()}>
            Sair
          </Botao>
        </div>
      )}
    </div>
  );
}
