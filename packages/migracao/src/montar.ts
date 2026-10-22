/**
 * Obra histórica → carga do ITO (M9), pelo mesmo caminho da tela de carga (M4): leitura da folha
 * (rubricas, pessoas, resumo) + escolhas (função de cada texto, rubricas novas, realocada) →
 * `montarCarga` e `verificarCarga`. Os achados das verificações vão para o relatório; na migração
 * só barra o que o banco recusa.
 */
import type {
  Cadastro,
  DadosObra,
  Escolhas,
  LeituraFolha,
  Leituras,
  LinhaPessoa,
  LinhaRubrica,
  LinhaVt,
  Montagem,
  ResultadoVerificacao,
  RubricaCadastro,
} from "@ito/carga";
import { montarCarga, verificarCarga } from "@ito/carga";
import type { Contexto, ParametrosObra } from "@ito/motor";
import type { ObraHistorica } from "./obras";

/** Destino da MDO realocada quando a planilha só marca "X" (não diz a obra). */
export const DESTINO_REALOCADA = "Outra obra (não identificada na planilha)";

export interface MontagemObra {
  dados: DadosObra;
  leituras: Leituras;
  escolhas: Escolhas;
  montagem: Montagem;
  verificacao: ResultadoVerificacao;
  /** texto da função na planilha → função do ITO, com quantas matrículas */
  funcoes: { texto: string; funcao: string; matriculas: number }[];
}

export function leituraDaObra(o: ObraHistorica): Leituras {
  const rubricas: LinhaRubrica[] = [];
  const pessoas: LinhaPessoa[] = [];
  const vt: LinhaVt[] = [];
  const resumo = new Map<string, { comp: { ano: number; mes: number }; proventos: number }>();
  for (const a of o.planilhas) {
    const p = a.planilha;
    for (const l of p.linhas) {
      pessoas.push({
        comp: l.comp,
        matricula: l.matricula,
        construtora: l.construtora,
        funcao: l.funcao,
        dias: l.dias,
        admitido: l.admitido,
        desligado: l.desligado,
        faltasHoras: l.faltasHoras,
        licencaDias: l.licencaDias,
        feriasDias: l.feriasDias,
        obra: l.realocada ? DESTINO_REALOCADA : null,
      });
      for (const r of l.rubricas)
        rubricas.push({
          comp: l.comp,
          matricula: l.matricula,
          construtora: l.construtora,
          funcao: l.funcao,
          codigo: r.codigo,
          descricao: r.descricao,
          referencia: r.referencia,
          valor: r.valor,
        });
      if (l.vt) vt.push({ comp: l.comp, matricula: l.matricula, valor: l.vt });
    }
    for (const x of p.proventos) {
      const k = `${x.comp.ano}-${x.comp.mes}`;
      const r = resumo.get(k) ?? { comp: x.comp, proventos: 0 };
      r.proventos = Math.round((r.proventos + x.valor) * 100) / 100;
      resumo.set(k, r);
    }
  }
  const folha: LeituraFolha = { rubricas, pessoas, resumo: [...resumo.values()], erros: [] };
  return {
    folha,
    vt: vt.length ? vt : null,
    ponto: null,
    erp: null,
    notas: null,
    errosArquivos: null,
  };
}

export function montarObra(
  o: ObraHistorica,
  dados: DadosObra,
  cadastro: Cadastro,
  ctx: Contexto,
  parametros: ParametrosObra,
  funcaoDe: (texto: string, classe: string) => string,
  rubricasNovas: Escolhas["rubricasNovas"],
): MontagemObra {
  const leituras = leituraDaObra(o);
  // função de cada texto: pela classe mais frequente que acompanha o texto (só no .xlsm)
  const classes = new Map<string, Map<string, number>>();
  const mats = new Map<string, Set<string>>();
  for (const a of o.planilhas)
    for (const l of a.planilha.linhas) {
      const m = classes.get(l.funcao) ?? new Map<string, number>();
      if (l.classe) m.set(l.classe, (m.get(l.classe) ?? 0) + 1);
      classes.set(l.funcao, m);
      const s = mats.get(l.funcao) ?? new Set<string>();
      s.add(`${l.matricula}|${l.construtora}`);
      mats.set(l.funcao, s);
    }
  const funcoes: MontagemObra["funcoes"] = [];
  const mapa: Record<string, string> = {};
  for (const [texto, m] of classes) {
    const classe = [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const id = funcaoDe(texto, classe);
    mapa[texto] = id;
    funcoes.push({ texto, funcao: id, matriculas: mats.get(texto)?.size ?? 0 });
  }
  const escolhas: Escolhas = {
    funcoes: mapa,
    rubricasNovas,
    semVtConfirmado: false,
    nfMes: {},
    realocacao: { [DESTINO_REALOCADA]: { nome: DESTINO_REALOCADA, obraId: null } },
    justificativas: {},
  };
  const montagem = montarCarga(dados, leituras, cadastro, escolhas, parametros);
  const verificacao = verificarCarga(montagem, leituras, escolhas, cadastro, ctx, parametros);
  return {
    dados,
    leituras,
    escolhas,
    montagem,
    verificacao,
    funcoes: funcoes.sort((a, b) => a.texto.localeCompare(b.texto)),
  };
}

/** Rubricas novas no formato das escolhas da carga. */
export const rubricasNovasDe = (
  linhas: readonly {
    codigo: number;
    nome: string;
    nova: {
      tipo: RubricaCadastro["tipo"];
      componente: RubricaCadastro["componente"];
      baseProvisoes: boolean;
      tipoHe: RubricaCadastro["tipoHe"];
    } | null;
  }[],
): Escolhas["rubricasNovas"] =>
  Object.fromEntries(
    linhas
      .filter((l) => l.nova)
      .map((l) => [
        l.codigo,
        {
          nome: l.nome,
          tipo: l.nova!.tipo,
          componente: l.nova!.componente,
          baseProvisoes: l.nova!.baseProvisoes,
          tipoHe: l.nova!.tipoHe,
        },
      ]),
  );
