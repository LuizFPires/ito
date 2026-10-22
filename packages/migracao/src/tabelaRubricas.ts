/**
 * Tabela de rubricas da migração (M9). Nas planilhas .xlsb a linha de códigos nem sempre foi
 * atualizada quando a coluna foi renomeada (o mesmo código aparece com títulos diferentes), então a
 * rubrica é decidida por (código, título):
 *   1. o título bate com o nome do código no dicionário do ITO → esse código;
 *   2. o título bate com o nome de outra rubrica do ITO → essa rubrica;
 *   3. código que o ITO não tem → vale o título mais frequente para ele (rubrica nova);
 *   4. coluna sem código conhecida (bolsa, ajuda de custo…) → o código dela;
 *   5. o resto → código próprio da migração (9500+), por título.
 * Uma revisão gravada (`docs/migracao/rubricas.csv`) manda sobre as regras.
 */
import type { Classificacao } from "./rubricas";
import { classificarRubrica, SEM_CODIGO } from "./rubricas";
import { normal } from "./historico";

export interface Ocorrencia {
  codigoPlanilha: number | null;
  titulo: string;
  sinal: "+" | "-" | "";
}

export interface LinhaTabela {
  codigoPlanilha: number | null;
  titulo: string;
  codigo: number;
  /** nome da rubrica no ITO (existente ou a criar) */
  nome: string;
  origem: "dicionario" | "nome" | "titulo-mais-frequente" | "sem-codigo" | "migracao" | "revisao";
  /** só para rubricas que o ITO ainda não tem */
  nova: Classificacao | null;
}

export const PRIMEIRO_CODIGO_MIGRACAO = 9500;

const titulo = (t: string) =>
  normal(t)
    .replace(/^[+-]\s*/, "")
    .replace(/[^a-z0-9%/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Nomes que querem dizer a mesma rubrica (iguais, ou um contém o outro com folga). */
export function mesmoNome(a: string, b: string): boolean {
  const x = titulo(a);
  const y = titulo(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length < y.length ? [x, y] : [y, x];
  return curto.length >= 10 && longo.startsWith(curto);
}

const chave = (o: { codigoPlanilha: number | null; titulo: string }) =>
  `${o.codigoPlanilha ?? ""}|${titulo(o.titulo)}`;

export function montarTabelaRubricas(
  ocorrencias: readonly Ocorrencia[],
  dicionario: readonly { codigo: number; nome: string }[],
  revisao: readonly {
    codigoPlanilha: number | null;
    titulo: string;
    codigo: number;
    nome?: string;
  }[] = [],
): {
  linhas: LinhaTabela[];
  resolver: (codigoPlanilha: number | null, titulo: string) => number | null;
} {
  const porCodigo = new Map(dicionario.map((d) => [d.codigo, d.nome]));
  const revisadas = new Map(revisao.map((r) => [chave(r), r]));
  // título mais frequente de cada código que o ITO não tem
  const freq = new Map<number, Map<string, number>>();
  const sinalDe = new Map<string, "+" | "-" | "">();
  for (const o of ocorrencias) {
    if (!titulo(o.titulo)) continue;
    if (!sinalDe.has(chave(o)) || o.sinal) sinalDe.set(chave(o), o.sinal);
    if (o.codigoPlanilha === null || porCodigo.has(o.codigoPlanilha)) continue;
    const m = freq.get(o.codigoPlanilha) ?? new Map<string, number>();
    m.set(titulo(o.titulo), (m.get(titulo(o.titulo)) ?? 0) + 1);
    freq.set(o.codigoPlanilha, m);
  }
  const maisFrequente = (cod: number) =>
    [...(freq.get(cod) ?? new Map<string, number>())].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0];

  const distintas = new Map<string, Ocorrencia>();
  for (const o of ocorrencias)
    if (titulo(o.titulo) && !distintas.has(chave(o))) distintas.set(chave(o), o);

  const linhas: LinhaTabela[] = [];
  const paraMigracao: Ocorrencia[] = [];
  for (const [k, o] of distintas) {
    const r = revisadas.get(k);
    if (r) {
      linhas.push({
        codigoPlanilha: o.codigoPlanilha,
        titulo: o.titulo,
        codigo: r.codigo,
        nome: r.nome ?? porCodigo.get(r.codigo) ?? o.titulo,
        origem: "revisao",
        nova: null,
      });
      continue;
    }
    const cod = o.codigoPlanilha;
    if (cod !== null && porCodigo.has(cod) && mesmoNome(porCodigo.get(cod)!, o.titulo)) {
      linhas.push({
        codigoPlanilha: cod,
        titulo: o.titulo,
        codigo: cod,
        nome: porCodigo.get(cod)!,
        origem: "dicionario",
        nova: null,
      });
      continue;
    }
    const pelo = dicionario.find((d) => mesmoNome(d.nome, o.titulo));
    if (pelo) {
      linhas.push({
        codigoPlanilha: cod,
        titulo: o.titulo,
        codigo: pelo.codigo,
        nome: pelo.nome,
        origem: "nome",
        nova: null,
      });
      continue;
    }
    if (cod !== null && !porCodigo.has(cod) && maisFrequente(cod) === titulo(o.titulo)) {
      linhas.push({
        codigoPlanilha: cod,
        titulo: o.titulo,
        codigo: cod,
        nome: o.titulo,
        origem: "titulo-mais-frequente",
        nova: null,
      });
      continue;
    }
    const sem = cod === null ? SEM_CODIGO.find(([re]) => re.test(normal(o.titulo))) : undefined;
    if (sem) {
      linhas.push({
        codigoPlanilha: null,
        titulo: o.titulo,
        codigo: sem[1],
        nome: sem[2],
        origem: "sem-codigo",
        nova: null,
      });
      continue;
    }
    paraMigracao.push(o);
  }
  // códigos da migração por título, em ordem alfabética (estável para as mesmas planilhas)
  const titulosMig = [...new Set(paraMigracao.map((o) => titulo(o.titulo)))].sort();
  const usados = new Set([...porCodigo.keys(), ...linhas.map((l) => l.codigo)]);
  const codigoMig = new Map<string, number>();
  let prox = PRIMEIRO_CODIGO_MIGRACAO;
  for (const t of titulosMig) {
    while (usados.has(prox)) prox++;
    codigoMig.set(t, prox);
    usados.add(prox++);
  }
  for (const o of paraMigracao)
    linhas.push({
      codigoPlanilha: o.codigoPlanilha,
      titulo: o.titulo,
      codigo: codigoMig.get(titulo(o.titulo))!,
      nome: o.titulo,
      origem: "migracao",
      nova: null,
    });

  // classificação sugerida para o que o ITO ainda não tem
  for (const l of linhas)
    if (!porCodigo.has(l.codigo)) l.nova = classificarRubrica(l.nome, sinalDe.get(chave(l)) ?? "");

  linhas.sort((a, b) => a.codigo - b.codigo || a.titulo.localeCompare(b.titulo));
  const mapa = new Map(linhas.map((l) => [chave(l), l.codigo]));
  return {
    linhas,
    resolver: (codigoPlanilha, t) =>
      titulo(t) ? (mapa.get(chave({ codigoPlanilha, titulo: t })) ?? null) : null,
  };
}
