import { cloneElement, isValidElement, useId, useState } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { arredondar, numero, parseNumero } from "@ito/formato";
import { Botao, Cartao } from "./componentes";
import type { Direcao, Ordem, Pagina } from "../lib/lista";
import s from "./formulario.module.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Rótulo + controle. Erro e dica ficam fora do rótulo (não entram no nome do campo) e
 * são ligados ao controle por aria-describedby.
 */
export function Campo({
  rotulo,
  dica,
  erro,
  ocultarRotulo,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  /** Rótulo só para leitor de tela (célula de tabela). */
  ocultarRotulo?: boolean;
  children: ReactNode;
}) {
  const idDesc = useId();
  const temDesc = !!(erro || dica);
  const controle =
    temDesc && isValidElement<{ "aria-describedby"?: string }>(children)
      ? cloneElement(children, { "aria-describedby": idDesc })
      : children;
  return (
    <div className={s.campo}>
      <label className={s.campo}>
        {ocultarRotulo ? <span className="sr-only">{rotulo}</span> : rotulo}
        {controle}
      </label>
      {erro ? (
        <span id={idDesc} className={s.erro} role="alert">
          {erro}
        </span>
      ) : (
        dica && (
          <span id={idDesc} className={s.dica}>
            {dica}
          </span>
        )
      )}
    </div>
  );
}

interface CampoNumeroProps {
  rotulo: string;
  valor: number;
  casas?: number;
  min?: number;
  max?: number;
  sufixo?: string;
  desabilitado?: boolean;
  dica?: string;
  /** Para células de tabela: rótulo oculto e campo estreito. */
  compacto?: boolean;
  /**
   * Chamado ao sair do campo (ou Enter) quando o número é válido e mudou, já arredondado
   * para `casas`. Se devolver uma promessa que falha, o campo volta ao valor anterior.
   */
  onSalvar: (v: number) => void | Promise<unknown>;
}

/** Número no formato BR (1.234,56), validado ao sair do campo. */
export function CampoNumero({
  rotulo,
  valor,
  casas = 2,
  min = 0,
  max,
  sufixo,
  desabilitado,
  dica,
  compacto,
  onSalvar,
}: CampoNumeroProps) {
  const [txt, setTxt] = useState(numero(valor, casas));
  const [erro, setErro] = useState<string | null>(null);
  const [base, setBase] = useState(valor);

  // Valor mudou fora (salvo, outra data-base): mostra o novo.
  if (base !== valor) {
    setBase(valor);
    setTxt(numero(valor, casas));
    setErro(null);
  }

  function confirmar() {
    const lido = parseNumero(txt);
    const v = lido === null ? null : arredondar(lido, casas);
    if (v === null) {
      setErro("Use números no formato 1.234,56.");
      return;
    }
    if (v < min || (max !== undefined && v > max)) {
      setErro(
        max !== undefined
          ? `Informe um valor entre ${numero(min, casas)} e ${numero(max, casas)}.`
          : `Informe um valor a partir de ${numero(min, casas)}.`,
      );
      return;
    }
    setErro(null);
    setTxt(numero(v, casas));
    if (v === valor) return;
    const r = onSalvar(v);
    // Gravação recusada: mostra de novo o valor que está salvo.
    if (r instanceof Promise) r.catch(() => setTxt(numero(valor, casas)));
  }

  return (
    <Campo
      rotulo={sufixo ? `${rotulo} (${sufixo})` : rotulo}
      erro={erro}
      dica={dica}
      ocultarRotulo={compacto}
    >
      <input
        className={cx(s.input, s.num, erro && s.invalido, compacto && s.compacto)}
        inputMode="decimal"
        value={txt}
        disabled={desabilitado}
        aria-invalid={!!erro}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </Campo>
  );
}

export function Selecao({
  className,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return <select className={cx(s.select, className)} {...p} />;
}

/** Interruptor (role="switch"). Ligado = grafite com bolinha âmbar. */
export function Interruptor({
  rotulo,
  ligado,
  desabilitado,
  texto,
  onChange,
}: {
  rotulo: string;
  ligado: boolean;
  desabilitado?: boolean;
  texto?: ReactNode;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <span className={s.toggleLinha}>
      <button
        id={id}
        type="button"
        role="switch"
        className={s.toggle}
        aria-checked={ligado}
        aria-label={rotulo}
        disabled={desabilitado}
        onClick={() => onChange(!ligado)}
      />
      {texto !== undefined ? <label htmlFor={id}>{texto}</label> : null}
    </span>
  );
}

export function CampoBusca({
  rotulo,
  valor,
  onChange,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className={s.busca}
      type="search"
      aria-label={rotulo}
      placeholder={placeholder}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Cabeçalho de coluna ordenável (aria-sort). */
export function ThOrdem<K extends string>({
  chave,
  ordem,
  onOrdenar,
  children,
  direita,
}: {
  chave: K;
  ordem: Ordem<K>;
  onOrdenar: (k: K) => void;
  children: ReactNode;
  direita?: boolean;
}) {
  const ativo = ordem.chave === chave;
  const seta = (d: Direcao) => (d > 0 ? " ↑" : " ↓");
  return (
    <th
      className={direita ? s.r : undefined}
      aria-sort={ativo ? (ordem.dir > 0 ? "ascending" : "descending") : "none"}
    >
      <button type="button" className={s.thOrdem} onClick={() => onOrdenar(chave)}>
        {children}
        {ativo && seta(ordem.dir)}
      </button>
    </th>
  );
}

export function Paginacao<T>({
  pagina,
  onPagina,
  nome,
}: {
  pagina: Pagina<T>;
  onPagina: (p: number) => void;
  nome: string;
}) {
  if (pagina.total === 0) return null;
  return (
    <nav className={s.paginacao} aria-label={`Páginas de ${nome}`}>
      <span>
        {numero(pagina.de)}–{numero(pagina.ate)} de {numero(pagina.total)} {nome}
      </span>
      {pagina.paginas > 1 && (
        <div>
          <Botao pequeno disabled={pagina.pagina <= 1} onClick={() => onPagina(pagina.pagina - 1)}>
            ‹ Anterior
          </Botao>
          <Botao
            pequeno
            disabled={pagina.pagina >= pagina.paginas}
            onClick={() => onPagina(pagina.pagina + 1)}
          >
            Próxima ›
          </Botao>
        </div>
      )}
    </nav>
  );
}

export function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: ReactNode; sub?: ReactNode }) {
  return (
    <Cartao className={s.kpi}>
      <span className="rotulo">{rotulo}</span>
      <span className={s.kpiValor}>{valor}</span>
      {sub && <span className="sub">{sub}</span>}
    </Cartao>
  );
}
