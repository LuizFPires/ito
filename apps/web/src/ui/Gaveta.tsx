import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Botao } from "./componentes";
import s from "./ui.module.css";

/**
 * Painel lateral (gaveta) sobre a tela, à direita. Usa o `<dialog>` do navegador: foco preso
 * dentro, Esc fecha e o fundo escurece. Clicar fora também fecha.
 */
export function Gaveta({
  aberta,
  titulo,
  subtitulo,
  onFechar,
  children,
}: {
  aberta: boolean;
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal?.();
    if (!aberta && d.open) d.close();
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      className={s.gaveta}
      aria-label={titulo}
      onClose={onFechar}
      onClick={(e) => {
        // clique no fundo (fora do conteúdo) fecha
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className={s.gavetaCorpo}>
        <div className={s.gavetaCabeca}>
          <div>
            <span className="rotulo">{titulo}</span>
            {subtitulo && <p className="sub">{subtitulo}</p>}
          </div>
          <Botao variante="fantasma" pequeno aria-label="Fechar" onClick={onFechar}>
            ×
          </Botao>
        </div>
        {children}
      </div>
    </dialog>
  );
}
