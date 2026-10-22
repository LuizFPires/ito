/** Indicadores da tela Cidades e CCTs (PLAN M2). */

/** Diferença entre o maior e o menor salário de oficial: max ÷ min − 1 (fração). */
export function diferencaOficial(salarios: readonly (number | undefined)[]): number {
  const v = salarios.filter((x): x is number => typeof x === "number" && x > 0);
  if (v.length < 2) return 0;
  return Math.max(...v) / Math.min(...v) - 1;
}

/** CCTs com data-base neste mês ou nos dois seguintes (mês 1–12; atravessa o ano). */
export function dataBaseNosProximos3Meses(meses: readonly number[], mesAtual: number): number {
  const janela = [0, 1, 2].map((d) => ((mesAtual - 1 + d) % 12) + 1);
  return meses.filter((m) => janela.includes(m)).length;
}

/** Valor da CCT ou, na falta, o da tabela da empresa (decisão M2). */
export function valorOuEmpresa(
  cct: Readonly<Record<string, number>>,
  empresa: Readonly<Record<string, number>>,
  chave: string,
): { valor: number | undefined; daEmpresa: boolean } {
  if (cct[chave] !== undefined) return { valor: cct[chave], daEmpresa: false };
  return { valor: empresa[chave], daEmpresa: true };
}
