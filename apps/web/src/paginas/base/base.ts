/**
 * Base histórica (PRD §3.1), lógica pura: grupos, filtro, ordenação e indicadores do filtro, como
 * no protótipo (telaBase).
 */
import type { ObraLista } from "../../dados/obras";
import { diasDoPeriodo } from "../../lib/obraDoBanco";
import { contemTermos, ordenar } from "../../lib/lista";
import type { Ordem } from "../../lib/lista";

export const GRUPOS = [
  { id: "todas", nome: "Todas" },
  { id: "mm", nome: "Mart Minas" },
  { id: "galpao", nome: "Galpões" },
  { id: "academia", nome: "Academias" },
  { id: "outras", nome: "Outras" },
] as const;
export type Grupo = (typeof GRUPOS)[number]["id"];

export type ChaveBase = "nome" | "area" | "periodo" | "pico" | "pm" | "he" | "epoca" | "atual";

/** Linha da lista com o resumo que vale agora (o do banco ou o recalculado na tela). */
export type LinhaBase = ObraLista & { cidade: string };

export const SITUACOES = [
  { valor: "todas", texto: "Todas" },
  { valor: "concluida", texto: "Concluídas" },
  { valor: "andamento", texto: "Em andamento" },
] as const;
export type FiltroSituacao = (typeof SITUACOES)[number]["valor"];

export function filtrar(
  obras: readonly LinhaBase[],
  grupo: Grupo,
  q: string,
  situacao: FiltroSituacao = "todas",
): LinhaBase[] {
  return obras.filter(
    (o) =>
      (grupo === "todas" || o.grupo === grupo) &&
      (situacao === "todas" || o.situacao === situacao) &&
      contemTermos(`${o.nome} ${o.cliente} ${o.tipologia} ${o.cidade}`, q),
  );
}

export function ordenarBase(obras: readonly LinhaBase[], ordem: Ordem<ChaveBase>): LinhaBase[] {
  return ordenar(obras, ordem, (o, k) => {
    const r = o.resumo;
    switch (k) {
      case "nome":
        return o.nome;
      case "area":
        return o.area_m2;
      case "periodo":
        return o.inicio;
      case "pico":
        return r?.pico ?? -1;
      case "pm":
        return r?.pessoa_mes ?? -1;
      case "he":
        return r?.he_por_pessoa ?? -1;
      case "epoca":
        return r?.custo_epoca ?? -1;
      case "atual":
        return r?.custo_atual ?? -1;
    }
  });
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export function mediana(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface Indicadores {
  obras: number;
  /** obras em andamento no filtro (fora da duração e das médias) */
  andamento: number;
  duracaoMedianaDias: number;
  duracaoMedianaMeses: number;
  picoMedio: number;
  pmPorMilMedia: number;
  pmPorMilMediana: number;
  custoM2Medio: number;
  custoM2Mediana: number;
}

/**
 * Indicadores do filtro (protótipo): obras sem resumo ficam fora das médias de resumo; obras em
 * andamento contam na quantidade, mas não na duração nem nas médias (o período ainda não fechou).
 */
export function indicadores(todas: readonly LinhaBase[]): Indicadores {
  const obras = todas.filter((o) => o.situacao === "concluida");
  const com = obras.filter((o) => o.resumo);
  const pm = com.map((o) => (o.resumo!.pessoa_mes / o.area_m2) * 1000);
  const cm = com.map((o) => o.resumo!.custo_atual / o.area_m2);
  return {
    obras: todas.length,
    andamento: todas.length - obras.length,
    duracaoMedianaDias: mediana(obras.map((o) => diasDoPeriodo(o.inicio, o.meses))),
    duracaoMedianaMeses: mediana(obras.map((o) => o.meses)),
    picoMedio: media(com.map((o) => o.resumo!.pico)),
    pmPorMilMedia: media(pm),
    pmPorMilMediana: mediana(pm),
    custoM2Medio: media(cm),
    custoM2Mediana: mediana(cm),
  };
}
