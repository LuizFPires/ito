import { useEffect, useId, useRef, useState } from "react";
import { useSessao } from "../auth/sessao";
import { NOME_PERFIL } from "../lib/supabase";
import { Badge, Botao, Segmento } from "../ui/componentes";
import { useTema } from "../ui/tema";
import type { Tema } from "../ui/tema";
import { useToast } from "../ui/toast";
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
  const avisar = useToast();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idPainel = useId();

  useEffect(() => {
    if (!aberto) return;
    // Ao abrir, o foco entra no painel (primeiro controle).
    painel.current?.querySelector<HTMLElement>("button")?.focus();
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  async function clicarSair() {
    const ok = await sair();
    if (!ok) avisar("Não foi possível sair. Verifique a internet e tente de novo.");
  }

  const email = usuario?.email ?? sessao?.user.email ?? "";

  return (
    <div className={s.menuUsuario} ref={caixa}>
      <button
        ref={botao}
        className={s.avatar}
        aria-label="Conta e aparência"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        onClick={() => setAberto((a) => !a)}
      >
        {iniciais(usuario?.nome ?? "", email)}
      </button>
      {aberto && (
        <div
          id={idPainel}
          ref={painel}
          className={s.menuUsuarioPainel}
          role="dialog"
          aria-label="Conta e aparência"
        >
          <div>
            <strong>{usuario?.nome || email}</strong>
            <div className="sub">{email}</div>
          </div>
          {usuario && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge tom="escuro">{NOME_PERFIL[usuario.perfil]}</Badge>
              {usuario.admin && <Badge tom="ambar">Admin</Badge>}
            </div>
          )}
          <span className="rotulo">Aparência</span>
          <Segmento rotulo="Tema" opcoes={TEMAS} valor={tema} onChange={setTema} />
          <Botao pequeno onClick={() => void clicarSair()}>
            Sair
          </Botao>
        </div>
      )}
    </div>
  );
}
