/**
 * Estado do assistente de carga (puro): rascunho vazio, código da obra, período e a preparação
 * (montagem + verificações de @ito/carga) a partir do rascunho e dos cadastros.
 */
import type { DadosObra, Montagem, ResultadoVerificacao } from "@ito/carga";
import { ESCOLHAS_VAZIAS, montarCarga, verificarCarga } from "@ito/carga";
import type { InicioObra, ParametrosObra } from "@ito/motor";
import { anoMes, feriadosDaCidade, parametrosEpoca } from "@ito/motor";
import type { ContextoCarga, RascunhoCarga } from "../../dados/carga";

export const ETAPAS = [
  { nome: "Obra", sub: "datas, área, cidade" },
  { nome: "Arquivos", sub: "folha, ponto, VT, NF, ERP" },
  { nome: "Funções", sub: "folha → função padrão" },
  { nome: "Rubricas", sub: "como cada verba entra" },
  { nome: "Verificação", sub: "conferir e salvar" },
] as const;

export const TIPOLOGIAS = [
  "Supermercado atacarejo",
  "Galpão logístico",
  "Academia",
  "Comercial",
  "Residencial",
];

export function rascunhoVazio(vigente: number, hoje = new Date()): RascunhoCarga {
  return {
    versao: 1,
    dados: {
      id: "",
      nome: "",
      cliente: "",
      tipologia: "",
      cidadeId: null,
      area: 0,
      inicio: { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 },
      // 0 = período ainda não informado (a folha preenche)
      meses: 0,
      dataBase: vigente,
      trocas: [],
      feriados: [],
      premissas: { foraDaSede: false },
      regime: {},
    },
    arquivos: {},
    leituras: null,
    escolhas: ESCOLHAS_VAZIAS,
  };
}

/** Código da obra a partir do nome: minúsculas, sem acento, "_" no lugar de espaços. */
export function codigoDaObra(nome: string): string {
  const s = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const c = /^[a-z]/.test(s) ? s : `obra_${s}`;
  return c.slice(0, 48).replace(/_+$/, "") || "obra";
}

/** "2025-03" ↔ {ano, mes} (campo type="month"). */
export const paraCampoMes = (i: InicioObra) => `${i.ano}-${String(i.mes).padStart(2, "0")}`;
export function doCampoMes(v: string): InicioObra | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { ano: Number(m[1]), mes } : null;
}
export const fimDe = (inicio: InicioObra, meses: number): InicioObra =>
  anoMes(inicio, Math.max(0, meses - 1));
export const mesesEntre = (ini: InicioObra, fim: InicioObra) =>
  (fim.ano - ini.ano) * 12 + fim.mes - ini.mes + 1;

/** O que falta na etapa Obra (vazio = pode seguir). */
export function faltasDaObra(d: DadosObra, obras: ContextoCarga["obras"]): string[] {
  const f: string[] = [];
  if (!d.nome.trim()) f.push("Informe o nome da obra.");
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(d.id))
    f.push("Código: comece com letra; use letras minúsculas, números e _.");
  if (!(d.area > 0)) f.push("Informe a área construída (m²).");
  if (d.meses < 1) f.push("Informe início e término (o término não pode ser antes do início).");
  if (d.meses > 120) f.push("A obra pode ter até 120 meses.");
  const outra = obras.find(
    (o) => o.id !== d.id && o.nome.trim().toLowerCase() === d.nome.trim().toLowerCase(),
  );
  if (outra) f.push(`Já existe a obra “${outra.nome}” com esse nome. Use outro nome.`);
  return f;
}

/** Dados prontos para a montagem: feriados da cidade em cada ano do período. */
export function dadosParaMontagem(d: DadosObra, ctx: ContextoCarga): DadosObra {
  const cidade = ctx.cidades.find((c) => c.id === d.cidadeId);
  if (!cidade || d.meses < 1) return { ...d, feriados: [] };
  const anos = new Set<number>();
  for (let i = 0; i < d.meses; i++) anos.add(anoMes(d.inicio, i).ano);
  return { ...d, feriados: [...anos].flatMap((a) => feriadosDaCidade(cidade.feriados, a)) };
}

export function parametrosDaObra(d: DadosObra, ctx: ContextoCarga): ParametrosObra {
  return parametrosEpoca(ctx.tabelas, d.dataBase, d.trocas, ctx.vigente);
}

export interface Preparada {
  montagem: Montagem;
  verificacao: ResultadoVerificacao;
}

/** Montagem e verificações do rascunho (null sem folha lida ou sem período). */
export function preparar(r: RascunhoCarga, ctx: ContextoCarga): Preparada | null {
  if (!r.leituras || r.dados.meses < 1) return null;
  const dados = dadosParaMontagem(r.dados, ctx);
  const parametros = parametrosDaObra(dados, ctx);
  const montagem = montarCarga(dados, r.leituras, ctx.cadastro, r.escolhas, parametros);
  const verificacao = verificarCarga(
    montagem,
    r.leituras,
    r.escolhas,
    ctx.cadastro,
    ctx.ctx,
    parametros,
  );
  return { montagem, verificacao };
}
