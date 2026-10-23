import type { Dispatch, SetStateAction } from "react";
import { Segmento } from "../../ui/componentes";
import type { Vista } from "./comum";

export type SetVista = Dispatch<SetStateAction<Vista>>;

export function ControleEixo({ vista, setVista }: { vista: Vista; setVista: SetVista }) {
  return (
    <Segmento
      rotulo="Eixo"
      opcoes={[
        { valor: "data", texto: "Datas" },
        { valor: "mes", texto: "Mês 1, 2…" },
      ]}
      valor={vista.eixo}
      onChange={(v) => setVista((x) => ({ ...x, eixo: v }))}
    />
  );
}

export function ControleLayout({ vista, setVista }: { vista: Vista; setVista: SetVista }) {
  return (
    <Segmento
      rotulo="Barras"
      opcoes={[
        { valor: "empilhadas", texto: "Empilhadas" },
        { valor: "agrupadas", texto: "Agrupadas" },
      ]}
      valor={vista.agrupadas ? "agrupadas" : "empilhadas"}
      onChange={(v) => setVista((x) => ({ ...x, agrupadas: v === "agrupadas" }))}
    />
  );
}
