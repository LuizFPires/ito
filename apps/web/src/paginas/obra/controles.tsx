import type { Dispatch, SetStateAction } from "react";
import { Segmento } from "../../ui/componentes";
import type { Vista } from "./comum";

export type SetVista = Dispatch<SetStateAction<Vista>>;

export function ControleGrupo({ vista, setVista }: { vista: Vista; setVista: SetVista }) {
  return (
    <Segmento
      rotulo="Grupos de função"
      opcoes={[
        { valor: "todas", texto: "Todas" },
        { valor: "direta", texto: "Direta" },
        { valor: "indireta", texto: "Indireta" },
        { valor: "adm", texto: "Adm." },
      ]}
      valor={vista.grupo}
      onChange={(v) => setVista((x) => ({ ...x, grupo: v }))}
    />
  );
}

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
