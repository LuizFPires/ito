import { useEffect } from "react";
import type { ReactNode } from "react";
import { Cartao } from "../ui/componentes";
import s from "../shell/Shell.module.css";

interface Props {
  grupo: string;
  titulo: string;
  resumo: string;
  milestone: string;
  children?: ReactNode;
}

/** Cabeçalho padrão das telas + estado vazio enquanto o módulo não chega. */
export function Pagina({ grupo, titulo, resumo, milestone, children }: Props) {
  useEffect(() => {
    document.title = `${titulo} · ITO`;
  }, [titulo]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className={s.cabeca}>
        <span className="rotulo">{grupo}</span>
        <h1>{titulo}</h1>
        <p className={s.lede}>{resumo}</p>
      </div>
      {children ?? (
        <Cartao>
          <div className={s.emBreve}>Esta tela chega no {milestone}.</div>
        </Cartao>
      )}
    </div>
  );
}
