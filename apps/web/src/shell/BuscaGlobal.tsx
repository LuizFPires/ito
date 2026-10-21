import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { IconeBusca } from "./Icone";
import { useFuncoes, useRubricas } from "../dados/cadastros";
import { contemTermos } from "../lib/lista";
import { buscarDestinos } from "./rotas";
import s from "./Shell.module.css";

interface Achado {
  chave: string;
  titulo: string;
  sub: string;
  caminho: string;
  estado?: Record<string, string>;
}

const ehMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Busca global (PRD §3), aberta com Ctrl+K / ⌘K. Acha telas, funções e rubricas;
 * obras e projeções entram como fontes nos milestones delas. */
export function BuscaGlobal() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [aberta, setAberta] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navegar = useNavigate();
  const idLista = useId();

  useEffect(() => {
    function atalho(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    }
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  const mostrar = aberta && q.trim() !== "";
  const { data: funcoes } = useFuncoes(mostrar);
  const { data: rubricas } = useRubricas(mostrar);
  const achados: Achado[] = [
    ...buscarDestinos(q).map((d) => ({
      chave: d.caminho,
      titulo: d.nome,
      sub: `Tela · ${d.grupo}`,
      caminho: d.caminho,
    })),
    ...(funcoes ?? [])
      .filter((x) => x.ativo && contemTermos(`${x.nome} ${x.sinonimos.join(" ")}`, q))
      .map((x) => ({
        chave: `f:${x.id}`,
        titulo: x.nome,
        sub: `Função padrão · ${x.conta_pc}`,
        caminho: "/funcoes",
        estado: { sel: x.id },
      })),
    ...(rubricas ?? [])
      .filter((r) => r.ativo && contemTermos(`${r.codigo} ${r.nome}`, q))
      .map((r) => ({
        chave: `r:${r.codigo}`,
        titulo: `${r.codigo} · ${r.nome}`,
        sub: "Rubrica da folha",
        caminho: "/rubricas",
        estado: { q: String(r.codigo) },
      })),
  ].slice(0, 8);

  function ir({ caminho, estado }: Achado) {
    navegar(caminho, { state: estado });
    setQ("");
    setAberta(false);
    input.current?.blur();
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((i) => Math.max(0, Math.min(i + 1, achados.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && achados[sel]) {
      e.preventDefault();
      ir(achados[sel]);
    } else if (e.key === "Escape") {
      setQ("");
      setAberta(false);
      input.current?.blur();
    }
  }

  return (
    <div className={s.busca}>
      <IconeBusca />
      <input
        ref={input}
        role="combobox"
        aria-label="Buscar no ITO"
        aria-expanded={mostrar && achados.length > 0}
        aria-autocomplete="list"
        aria-controls={mostrar && achados.length ? idLista : undefined}
        aria-activedescendant={mostrar && achados[sel] ? `${idLista}-${sel}` : undefined}
        placeholder="Buscar obras, projeções, funções, rubricas…"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
          setAberta(true);
        }}
        onFocus={() => setAberta(true)}
        // As opções usam onMouseDown + preventDefault, então clicar nelas não tira o foco.
        onBlur={() => setAberta(false)}
        onKeyDown={teclas}
      />
      <span className={s.kbd} aria-hidden="true">
        {ehMac ? "⌘K" : "Ctrl K"}
      </span>
      {mostrar && achados.length > 0 && (
        <ul className={s.resultados} role="listbox" id={idLista}>
          {achados.map((d, i) => (
            <li
              key={d.chave}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === sel}
              className={s.resultado}
              onMouseDown={(e) => {
                e.preventDefault();
                ir(d);
              }}
              onMouseEnter={() => setSel(i)}
            >
              <span>{d.titulo}</span>
              <span className="sub">{d.sub}</span>
            </li>
          ))}
        </ul>
      )}
      {mostrar && achados.length === 0 && (
        <div className={`${s.resultados} ${s.vazio}`} role="status">
          Nada encontrado para “{q}”.
        </div>
      )}
    </div>
  );
}
