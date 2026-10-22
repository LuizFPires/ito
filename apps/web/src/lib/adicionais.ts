/** Adicionais legais por pessoa·mês (SPEC §4.2, sem faltas): peric + insal + noturno. */
export function adicionaisPorPessoa(
  f: { vinculo: string; peric_pct: number; insal_pct_sm: number; horas_noturnas_mes: number },
  salario: number,
  db: { salario_minimo: number; divisor: number; adicional_noturno_pct: number },
): number {
  if (f.vinculo === "estagio") return 0;
  return (
    (salario * Number(f.peric_pct)) / 100 +
    (Number(db.salario_minimo) * Number(f.insal_pct_sm)) / 100 +
    ((Number(f.horas_noturnas_mes) * salario) / Number(db.divisor)) *
      (Number(db.adicional_noturno_pct) / 100)
  );
}
