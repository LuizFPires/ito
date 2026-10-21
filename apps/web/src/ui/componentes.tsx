import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import s from "./ui.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "padrao" | "primario" | "escuro" | "fantasma";
  pequeno?: boolean;
};

/** Pill. Âmbar (`primario`) é a ação principal da tela; grafite (`escuro`) é secundária forte. */
export function Botao({ variante = "padrao", pequeno, className, type, ...p }: BotaoProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(s.botao, variante !== "padrao" && s[variante], pequeno && s.pequeno, className)}
      {...p}
    />
  );
}

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { ativo: boolean };

/** Chip de filtro: ativo = grafite. */
export function Chip({ ativo, className, ...p }: ChipProps) {
  return <button type="button" aria-pressed={ativo} className={cx(s.chip, className)} {...p} />;
}

interface SegmentoProps<T extends string> {
  rotulo: string;
  opcoes: readonly { valor: T; texto: string }[];
  valor: T;
  onChange: (v: T) => void;
}

/** Alternância (época/atualizado, competência/caixa…). */
export function Segmento<T extends string>({ rotulo, opcoes, valor, onChange }: SegmentoProps<T>) {
  return (
    <div className={s.segmento} role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onChange(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Cartao({ className, children, ...p }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx(s.cartao, className)} {...p}>
      {children}
    </section>
  );
}

export function CartaoCorpo({ children }: { children: ReactNode }) {
  return <div className={s.cartaoCorpo}>{children}</div>;
}

type Tom = "neutro" | "ambar" | "escuro" | "ok" | "erro";

export function Badge({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return <span className={cx(s.badge, s[`b-${tom}`])}>{children}</span>;
}
