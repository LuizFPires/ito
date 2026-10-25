// GERADO por scripts/gerar-calculo.mjs a partir de apps/web/src/servidor/aprovacao.ts.
// Não edite: rode pnpm gen:calculo.
// apps/web/src/lib/motorDoBanco.ts
function funcaoDoBanco(f) {
  return {
    id: f.id,
    vinculo: f.vinculo,
    escalaArea: f.escala_area,
    exames: {
      adm: Number(f.exame_adm),
      perAnual: Number(f.exame_per_anual),
      dem: Number(f.exame_dem)
    },
    periculosidadePct: Number(f.peric_pct),
    insalubridadePctSm: Number(f.insal_pct_sm),
    horasNoturnasMes: Number(f.horas_noturnas_mes),
    ferramentasMes: Number(f.ferramentas_mes),
    fatorHe: Number(f.fator_he)
  };
}
var encargoDoBanco = (e) => ({
  id: e.id,
  grupo: e.grupo,
  nome: e.nome,
  baseCalcPct: Number(e.base_calc_pct),
  aliqClt: Number(e.aliq_clt),
  aliqSp: Number(e.aliq_sp)
});
function tabelaDoBanco(d, salarios, beneficios, encargos) {
  return {
    salarios,
    beneficios,
    gratificacoes: {},
    encargos: [...encargos].sort((a, b) => a.ordem - b.ordem).map(encargoDoBanco),
    heAdicionalPct: {
      util: Number(d.he_adicional_util),
      sabado: Number(d.he_adicional_sabado),
      intervalo: Number(d.he_adicional_intervalo),
      feriado: Number(d.he_adicional_feriado)
    },
    divisor: Number(d.divisor),
    modoDias: d.modo_dias,
    sabadoTrabalhado: d.sabado_trabalhado,
    diasFixos: Number(d.dias_fixos),
    dsrFixoPct: Number(d.dsr_fixo_pct),
    vtDiaria: Number(d.vt_diaria_ref),
    fatorRescisao: Number(d.fator_rescisao),
    salarioMinimo: Number(d.salario_minimo),
    adicionalNoturnoPct: Number(d.adicional_noturno_pct),
    salarioFamilia: { teto: Number(d.sf_teto), cota: Number(d.sf_cota) }
  };
}
function contextoDoBanco(funcoes, beneficios, parametros, feriadosEmpresa) {
  return {
    funcoes: funcoes.map(funcaoDoBanco),
    beneficios: [...beneficios].sort((a, b) => a.ordem - b.ordem).map((b) => ({ id: b.id, soForaSede: b.so_fora_sede })),
    calendario: {
      carnaval: parametros.carnaval,
      corpusChristi: parametros.corpus_christi,
      feriadosEmpresa: feriadosEmpresa.map((f) => ({ data: f.data, nome: f.nome }))
    }
  };
}

// apps/web/src/dados/carregar.ts
async function ok(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}
async function todas(pagina) {
  const linhas = [];
  for (let de = 0; ; de += 1e3) {
    const lote = await ok(pagina(de, de + 999));
    linhas.push(...lote);
    if (lote.length < 1e3) return linhas;
  }
}
function agrupar(linhas, chave) {
  const m = /* @__PURE__ */ new Map();
  for (const r of linhas) {
    const k = chave(r);
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return m;
}
async function carregarContexto(c) {
  const [
    funcoes,
    sinonimos,
    rubricas,
    beneficios,
    parametros,
    feriadosEmpresa,
    datas,
    salarios,
    valoresBen,
    encargos,
    just,
    cidades,
    ferCid,
    obras
  ] = await Promise.all([
    ok(c.from("funcoes").select("*").order("nome")),
    // listas que crescem com as cargas: paginadas (limite de 1.000 linhas do PostgREST)
    todas((de, ate) => c.from("funcao_sinonimos").select("*").order("texto").range(de, ate)),
    todas((de, ate) => c.from("rubricas").select("*").order("codigo").range(de, ate)),
    ok(c.from("beneficios").select("*")),
    ok(c.from("parametros").select("*").single()),
    ok(c.from("feriados_empresa").select("*")),
    ok(c.from("datas_base").select("*").order("ano", { ascending: false })),
    todas(
      (de, ate) => c.from("data_base_salarios").select("*").order("ano").order("funcao_id").range(de, ate)
    ),
    todas(
      (de, ate) => c.from("data_base_beneficios").select("*").order("ano").order("beneficio_id").range(de, ate)
    ),
    todas(
      (de, ate) => c.from("data_base_encargos").select("*").order("ano").order("id").range(de, ate)
    ),
    ok(c.from("justificativas_erp").select("*").order("ordem")),
    todas(
      (de, ate) => c.from("cidades").select("id, nome, uf").order("nome").order("id").range(de, ate)
    ),
    todas((de, ate) => c.from("cidade_feriados").select("*").order("cidade_id").range(de, ate)),
    todas((de, ate) => c.from("obras").select("id, nome").order("nome").range(de, ate))
  ]);
  const tabelas = {};
  for (const d of datas) {
    const sal = Object.fromEntries(
      salarios.filter((s) => s.ano === d.ano).map((s) => [s.funcao_id, Number(s.valor)])
    );
    const ben = Object.fromEntries(
      valoresBen.filter((b) => b.ano === d.ano).map((b) => [b.beneficio_id, Number(b.valor)])
    );
    tabelas[d.ano] = tabelaDoBanco(
      d,
      sal,
      ben,
      encargos.filter((e) => e.ano === d.ano)
    );
  }
  const rubricasCad = rubricas.map((r) => ({
    codigo: r.codigo,
    nome: r.nome,
    tipo: r.tipo,
    componente: r.componente,
    baseProvisoes: r.base_provisoes,
    tipoHe: r.tipo_he ?? null
  }));
  return {
    cadastro: {
      // inativas também: o histórico pode ter função que hoje não se usa
      funcoes: contextoDoBanco(funcoes, [], parametros, []).funcoes,
      nomesFuncoes: Object.fromEntries(funcoes.map((f) => [f.id, f.nome])),
      sinonimos: Object.fromEntries(sinonimos.map((s) => [s.texto, s.funcao_id])),
      rubricas: rubricasCad
    },
    ctx: contextoDoBanco(funcoes, beneficios, parametros, feriadosEmpresa),
    tabelas,
    vigente: parametros.data_base_vigente ?? datas[0]?.ano ?? (/* @__PURE__ */ new Date()).getFullYear(),
    datasBase: datas.map((d) => d.ano),
    justificativas: just.map((j) => j.texto),
    funcoes: funcoes.filter((f) => f.ativo).map((f) => ({ id: f.id, nome: f.nome })),
    cidades: cidades.map((x) => ({
      id: x.id,
      nome: `${x.nome}/${x.uf}`,
      feriados: ferCid.filter((f) => f.cidade_id === x.id).map((f) => ({ dia: f.dia, mes: f.mes, nome: f.nome }))
    })),
    obras
  };
}
var nomeCidade = (x) => `${x.nome}/${x.uf}`;
async function carregarCidades(c) {
  const [cidades, fer, pas] = await Promise.all([
    todas((de, ate) => c.from("cidades").select("*").order("nome").order("id").range(de, ate)),
    todas(
      (de, ate) => c.from("cidade_feriados").select("*").order("cidade_id").order("mes").order("dia").range(de, ate)
    ),
    todas(
      (de, ate) => c.from("cidade_passagens").select("*").order("cidade_id").order("origem_id").range(de, ate)
    )
  ]);
  const ferPor = agrupar(fer, (f) => f.cidade_id);
  const pasPor = agrupar(pas, (p) => p.cidade_id);
  return cidades.map((x) => ({
    ...x,
    feriados: (ferPor.get(x.id) ?? []).map((f) => ({ mes: f.mes, dia: f.dia, nome: f.nome })),
    passagens: Object.fromEntries(
      (pasPor.get(x.id) ?? []).map((p) => [p.origem_id, Number(p.valor)])
    )
  }));
}
async function carregarCct(c, id) {
  const [sal, grat, ben] = await Promise.all([
    ok(c.from("cct_salarios").select("funcao_id, valor").eq("cct_id", id)),
    ok(c.from("cct_gratificacoes").select("funcao_id, valor").eq("cct_id", id)),
    ok(c.from("cct_beneficios").select("beneficio_id, valor").eq("cct_id", id))
  ]);
  return {
    salarios: Object.fromEntries(sal.map((r) => [r.funcao_id, Number(r.valor)])),
    gratificacoes: Object.fromEntries(grat.map((r) => [r.funcao_id, Number(r.valor)])),
    beneficios: Object.fromEntries(ben.map((r) => [r.beneficio_id, Number(r.valor)]))
  };
}
async function carregarCctPrecos(c, cctId) {
  const [linha, det] = await Promise.all([
    ok(c.from("ccts").select("*").eq("id", cctId).single()),
    carregarCct(c, cctId)
  ]);
  return {
    id: linha.id,
    nome: linha.nome,
    mesDataBase: linha.mes_data_base,
    reajusteEstimadoPct: Number(linha.reajuste_estimado_pct),
    ...det
  };
}
var cidadeComPrecos = (x) => ({
  id: x.id,
  nome: nomeCidade(x),
  cctId: x.cct_id,
  tarifaLocal: Number(x.tarifa_local),
  conducoes: x.conducoes,
  issPct: Number(x.iss_pct),
  passagens: x.passagens,
  feriados: x.feriados
});
var origemPadrao = (cidades, cidadeId) => cidades.find((x) => x.id === "bh" && x.id !== cidadeId)?.id ?? cidades.find((x) => x.id !== cidadeId)?.id ?? null;
function montarPrecos(tabela, cidades, cidadeId, origemId, cct) {
  const cid = cidades.find((x) => x.id === cidadeId) ?? null;
  if (!tabela || cid && !cct) return null;
  const orig = origemId ?? origemPadrao(cidades, cidadeId);
  const de = cidades.find((x) => x.id === orig && x.id !== cidadeId) ?? null;
  return {
    vigente: tabela,
    cidade: cid ? cidadeComPrecos(cid) : null,
    cidadeOrigem: de ? cidadeComPrecos(de) : null,
    cct: cid ? cct : null
  };
}
async function carregarObrasBanco(c, ids) {
  const lotes = [];
  for (let k = 0; k < ids.length; k += 50) lotes.push(ids.slice(k, k + 50));
  const resultados = Array.from({ length: lotes.length }, () => []);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, lotes.length) }, async () => {
      while (proximo < lotes.length) {
        const i = proximo++;
        resultados[i] = await carregarLote(c, lotes[i]);
      }
    })
  );
  return resultados.flat();
}
async function carregarLote(c, lote) {
  const [obras, comps, efetivo, regime, trocas, feriados] = await Promise.all([
    ok(c.from("obras").select("*").in("id", lote)),
    // ordem estável entre páginas (LIMIT/OFFSET sem ORDER BY pula ou repete linhas)
    todas(
      (de, ate) => c.from("competencias").select("*").in("obra_id", lote).order("obra_id").order("mes_idx").range(de, ate)
    ),
    todas(
      (de, ate) => c.from("efetivo_mes").select("*").in("obra_id", lote).order("obra_id").order("funcao_id").order("mes_idx").range(de, ate)
    ),
    todas(
      (de, ate) => c.from("obra_regime").select("*").in("obra_id", lote).order("obra_id").order("funcao_id").range(de, ate)
    ),
    todas(
      (de, ate) => c.from("obra_trocas_tabela").select("*").in("obra_id", lote).order("obra_id").order("mes_idx").range(de, ate)
    ),
    todas(
      (de, ate) => c.from("obra_feriados").select("*").in("obra_id", lote).order("obra_id").order("data").range(de, ate)
    )
  ]);
  return obras.map((o) => ({
    obra: o,
    competencias: comps.filter((x) => x.obra_id === o.id),
    efetivo: efetivo.filter((x) => x.obra_id === o.id),
    regime: regime.filter((x) => x.obra_id === o.id),
    trocas: trocas.filter((x) => x.obra_id === o.id),
    feriados: feriados.filter((x) => x.obra_id === o.id)
  }));
}

// packages/motor/src/calendario.ts
var NACIONAIS = [
  ["01-01", "Confraterniza\xE7\xE3o Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independ\xEAncia do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclama\xE7\xE3o da Rep\xFAblica"],
  ["12-25", "Natal"]
];
var dois = (n) => String(n).padStart(2, "0");
var iso = (d) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
var somaDias = (isoData, n) => {
  const d = /* @__PURE__ */ new Date(`${isoData}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = (h + l - 7 * m + 114) % 31 + 1;
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}
function feriadosDoAno(ano, opcoes) {
  const lista = NACIONAIS.map(([md, nome]) => ({
    data: `${ano}-${md}`,
    nome,
    tipo: "nacional"
  }));
  if (ano >= 2024) {
    lista.push({ data: `${ano}-11-20`, nome: "Dia da Consci\xEAncia Negra", tipo: "nacional" });
  }
  const p = pascoa(ano);
  lista.push({ data: somaDias(p, -2), nome: "Sexta-feira Santa", tipo: "nacional" });
  if (opcoes.carnaval) {
    lista.push({ data: somaDias(p, -48), nome: "Carnaval (segunda)", tipo: "facultativo" });
    lista.push({ data: somaDias(p, -47), nome: "Carnaval (ter\xE7a)", tipo: "facultativo" });
  }
  if (opcoes.corpusChristi) {
    lista.push({ data: somaDias(p, 60), nome: "Corpus Christi", tipo: "facultativo" });
  }
  for (const f of opcoes.feriadosEmpresa) {
    if (f.data.startsWith(`${ano}-`)) lista.push({ ...f, tipo: "empresa" });
  }
  return lista.sort((x, y) => x.data.localeCompare(y.data));
}
function calendarioMes(ano, mes, opcoes, municipais = []) {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new RangeError(`M\xEAs inv\xE1lido: ${mes}. Use 1 a 12.`);
  }
  const prefixo = `${ano}-${dois(mes)}-`;
  const feriados = [
    ...feriadosDoAno(ano, opcoes),
    ...municipais.map((f) => ({ ...f, tipo: "municipal" }))
  ].filter((f) => f.data.startsWith(prefixo)).filter((f, i, todos) => todos.findIndex((g) => g.data === f.data) === i).sort((x, y) => x.data.localeCompare(y.data));
  const datas = new Set(feriados.map((f) => f.data));
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let seg = 0;
  let sab = 0;
  let rep = 0;
  let feriadosUteis = 0;
  for (let d = 1; d <= dias; d++) {
    const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (semana === 0) rep++;
    else if (datas.has(`${prefixo}${dois(d)}`)) {
      rep++;
      feriadosUteis++;
    } else if (semana === 6) sab++;
    else seg++;
  }
  const uteis = seg + sab;
  if (uteis === 0) {
    throw new RangeError(
      `${dois(mes)}/${ano} ficou sem dias \xFAteis. Confira os feriados cadastrados para esse m\xEAs.`
    );
  }
  return {
    ano,
    mes,
    dias,
    seg,
    sab,
    rep,
    feriadosUteis,
    uteis,
    dsrPct: rep / uteis * 100,
    feriados
  };
}

// packages/motor/src/encargos.ts
var IDS_INCIDENCIA = ["ferias", "terco", "dec"];
var zero = () => ({ clt: 0, sp: 0 });
function taxasEncargos(itens) {
  const t = { soc: zero(), prov: zero(), nf: zero(), incidencia: zero() };
  const base = { clt: 0, sp: 0 };
  for (const it of itens) {
    const fator = it.baseCalcPct / 100;
    t[it.grupo].clt += fator * it.aliqClt / 100;
    t[it.grupo].sp += fator * it.aliqSp / 100;
    if (IDS_INCIDENCIA.includes(it.id)) {
      base.clt += fator * it.aliqClt / 100;
      base.sp += fator * it.aliqSp / 100;
    }
  }
  for (const r of ["clt", "sp"]) {
    t.incidencia[r] = t.soc[r] * base[r];
    t.soc[r] += t.incidencia[r];
  }
  return t;
}

// packages/motor/src/local.ts
function vtDiario(c) {
  return c.tarifaLocal * c.conducoes * 2;
}
function vtDiarioDe(obra, origem) {
  if (obra.id === origem.id) return { valor: vtDiario(obra), estimado: false };
  const passagem = Number(obra.passagens[origem.id] ?? 0);
  if (passagem > 0) return { valor: passagem * 2, estimado: false };
  return { valor: (obra.tarifaLocal + origem.tarifaLocal) * 2, estimado: true };
}
function feriadosDaCidade(fer, ano) {
  return fer.filter((f) => {
    const d = new Date(Date.UTC(ano, f.mes - 1, f.dia));
    return d.getUTCMonth() === f.mes - 1 && d.getUTCDate() === f.dia;
  }).map((f) => ({
    data: `${ano}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`,
    nome: f.nome
  })).sort((x, y) => x.data.localeCompare(y.data));
}

// packages/motor/src/modelo.ts
var TIPOS_HE = ["util", "sabado", "intervalo", "feriado"];
var PREMISSAS_PADRAO = {
  gratPremiosPct: 3,
  transfPct: 25,
  funcoesTransferidas: [],
  riscoPct: 0,
  lucroPct: 0,
  tribLucroPct: 0,
  provisionar: true,
  adiantamento: true,
  adiantamentoPct: 40
};
var HE_MIX_PADRAO = {
  util: 70,
  sabado: 15,
  intervalo: 5,
  feriado: 10
};
var tabelaDoMes = (p, i) => typeof p === "function" ? p(i) : p;
function nMeses(o) {
  if (o.meses !== void 0) return o.meses;
  let n = Math.max(o.heMedia.length, o.absenteismoPct.length);
  for (const v of Object.values(o.equivalente)) n = Math.max(n, v.length);
  return n;
}
function anoMes(inicio, mesIdx) {
  const t = inicio.mes - 1 + mesIdx;
  return { ano: inicio.ano + Math.floor(t / 12), mes: (t % 12 + 12) % 12 + 1 };
}

// packages/motor/src/parametros.ts
function tabelaDaCidade(vigente, cct, cidade) {
  return {
    ...vigente,
    salarios: { ...vigente.salarios, ...cct.salarios },
    beneficios: { ...vigente.beneficios, ...cct.beneficios },
    gratificacoes: { ...cct.gratificacoes },
    vtDiaria: vtDiario(cidade),
    encargos: vigente.encargos.map((e) => e.id === "iss" ? { ...e, aliqSp: cidade.issPct } : e)
  };
}
function reajustesDaProjecao(inicio, prazo, informado, cct) {
  if (informado != null)
    return Number(informado.pct) ? [{ mesIdx: informado.mesIdx, pct: informado.pct, automatico: false }] : [];
  if (!cct || !cct.reajusteEstimadoPct) return [];
  const lista = [];
  for (let i = 1; i < prazo; i++) {
    if (anoMes(inicio, i).mes === cct.mesDataBase)
      lista.push({ mesIdx: i, pct: cct.reajusteEstimadoPct, automatico: true });
  }
  return lista;
}
var centavos = (v) => Math.round(v * 100) / 100;
function reajustar(t, pct) {
  const f = 1 + pct / 100;
  const vezes = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, centavos(v * f)]));
  return {
    ...t,
    salarios: vezes(t.salarios),
    beneficios: vezes(t.beneficios),
    gratificacoes: vezes(t.gratificacoes)
  };
}
function aplicarReajustes(base, prazo, reajustes) {
  const validos = reajustes.filter((r) => r.pct && r.mesIdx > 0 && r.mesIdx < prazo).sort((x, y) => x.mesIdx - y.mesIdx);
  if (!validos.length) return base;
  const etapas = [{ desde: 0, tabela: base }];
  for (const r of validos)
    etapas.push({ desde: r.mesIdx, tabela: reajustar(etapas[etapas.length - 1].tabela, r.pct) });
  return (i) => {
    let t = base;
    for (const e of etapas) if (i >= e.desde) t = e.tabela;
    return t;
  };
}
function salarioComOrigem(t, funcaoId) {
  const v = t.salarios[funcaoId];
  if (v !== void 0) return { valor: v, origem: "tabela" };
  const ped = t.salarios.ped;
  return ped !== void 0 ? { valor: ped, origem: "oficial" } : { valor: 0, origem: "ausente" };
}

// packages/motor/src/calendarioObra.ts
function diasDoMes(o, mesIdx, t, ctx) {
  if (t.modoDias === "fixo") return { dsrPct: t.dsrFixoPct, diasTrabalhados: t.diasFixos };
  const { ano, mes } = anoMes(o.inicio, mesIdx);
  const c = calendarioMes(ano, mes, ctx.calendario, o.feriadosMunicipais ?? []);
  return { dsrPct: c.dsrPct, diasTrabalhados: c.seg + (t.sabadoTrabalhado ? c.sab : 0) };
}

// packages/motor/src/movimentos.ts
function aleatorioDeterministico(semente) {
  let h = 2166136261;
  for (const c of semente) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1e4 / 1e4;
}
function cabecasMes(o, funcaoId, i) {
  const c = o.cabecas?.[funcaoId];
  return c ? c[i] ?? 0 : Math.ceil(o.equivalente[funcaoId]?.[i] ?? 0);
}
function movimentos(o, funcoes) {
  const n = nMeses(o);
  const admissoes = {};
  const desligamentos = {};
  for (const k of funcoes) {
    const ad = [];
    const de = [];
    for (let i = 0; i < n; i++) {
      const anterior = i ? cabecasMes(o, k, i - 1) : 0;
      const atual = cabecasMes(o, k, i);
      const e = i && atual ? atual * o.rotatividadePct / 100 : 0;
      const churn = Math.floor(e) + (aleatorioDeterministico(`${o.id || "p"}${k}${i}`) < e % 1 ? 1 : 0);
      ad.push(Math.max(0, atual - anterior) + churn);
      let d = Math.max(0, anterior - atual) + churn;
      if (i === n - 1) d += Math.round(atual * 0.5);
      de.push(d);
    }
    admissoes[k] = ad;
    desligamentos[k] = de;
  }
  return { admissoes, desligamentos };
}

// packages/motor/src/custo.ts
var COTAS_SALARIO_FAMILIA = 0.6;
var DESCONTO_VT = 0.06;
var ABSENTEISMO_MAX = 0.9;
function premissasDe(o) {
  return { ...PREMISSAS_PADRAO, ...o.premissas ?? {} };
}
function totalMes(o, i) {
  let t = 0;
  for (const v of Object.values(o.equivalente)) t += v[i] ?? 0;
  return t;
}
function custoFuncaoMes(o, f, i, pp, ctx, op = {}) {
  const p = tabelaDoMes(pp, i);
  const est = f.vinculo === "estagio";
  const regime = est ? "estagio" : o.regime?.[f.id] ?? "clt";
  const clt = regime === "clt";
  const pr = premissasDe(o);
  const T = taxasEncargos(p.encargos);
  const taxa = (g) => regime === "estagio" ? 0 : regime === "sp" ? T[g].sp : T[g].clt;
  const x = op.x ?? o.equivalente[f.id]?.[i] ?? 0;
  const fora = o.origem?.[f.id] === "aloj";
  const vtDiaria = o.vtDiariaPorFuncao?.[f.id] ?? p.vtDiaria;
  const { dsrPct, diasTrabalhados } = diasDoMes(o, i, p, ctx);
  const dsrF = dsrPct / 100;
  const { valor: s, origem: salarioOrigem } = salarioComOrigem(p, f.id);
  const a = Math.min(
    ABSENTEISMO_MAX,
    Math.max(0, (o.absenteismoPct[i] ?? 0) / 100 + (op.absenteismoExtra ?? 0))
  );
  const parte = x / (totalMes(o, i) || 1);
  const licD = (o.licencaPessoaDias[i] ?? 0) * parte;
  const ferD = est ? 0 : (o.feriasPessoaDias[i] ?? 0) * parte;
  const xa = Math.max(0, x - (licD + ferD) / 30);
  const pres = xa * (1 - a);
  const bruto = xa * s;
  const faltasH = bruto * a;
  const faltasD = est ? 0 : faltasH * dsrF;
  const faltas = faltasH + faltasD;
  const salv = Math.max(0, bruto - faltas);
  const bolsa = est ? salv : 0;
  const adicionais = est ? { grat: 0, peric: 0, insal: 0, transf: 0, gratF: 0, not: 0, dsrNot: 0 } : (() => {
    const not = pres * f.horasNoturnasMes * s / p.divisor * p.adicionalNoturnoPct / 100;
    return {
      grat: salv * pr.gratPremiosPct / 100,
      peric: salv * f.periculosidadePct / 100,
      insal: pres * p.salarioMinimo * f.insalubridadePctSm / 100,
      transf: pr.funcoesTransferidas.includes(f.id) ? salv * pr.transfPct / 100 : 0,
      gratF: xa * (p.gratificacoes[f.id] ?? 0),
      not,
      dsrNot: not * dsrF
    };
  })();
  const extras = adicionais.grat + adicionais.peric + adicionais.insal + adicionais.transf + adicionais.gratF + adicionais.not + adicionais.dsrNot;
  const mix = { ...HE_MIX_PADRAO, ...o.heMixPct ?? {} };
  const h = est ? 0 : (o.heMedia[i] ?? 0) * f.fatorHe * (op.multiplicadorHe ?? 1);
  const vb = s / p.divisor;
  const heTipo = {};
  let he = 0;
  for (const t of TIPOS_HE) {
    heTipo[t] = pres * h * (mix[t] / 100) * vb * (1 + p.heAdicionalPct[t] / 100);
    he += heTipo[t];
  }
  const dsr = he * dsrF;
  const valorHoraExtra = pres * h ? he / (pres * h) : vb * (1 + p.heAdicionalPct.util / 100);
  const horaExtraCheia = valorHoraExtra * (1 + dsrF) * (1 + taxa("soc") + taxa("prov") + taxa("nf"));
  const remun = salv + extras + he + dsr;
  const enc = remun * taxa("soc");
  const prov = pr.provisionar ? remun * taxa("prov") : 0;
  const nf = remun * taxa("nf");
  const comVt = regime !== "sp" && !op.semVt;
  const vtBruto = comVt ? pres * vtDiaria * diasTrabalhados : 0;
  const vtDesc = est ? 0 : Math.min(vtBruto, bruto * DESCONTO_VT);
  const vt = vtBruto - vtDesc;
  const beneficiosItem = {};
  let benef = 0;
  for (const b of ctx.beneficios) {
    if (!clt && !(est && b.id === "seguro")) continue;
    if (b.soForaSede && !fora) continue;
    const v = x * (p.beneficios[b.id] ?? 0);
    beneficiosItem[b.id] = v;
    benef += v;
  }
  const admissoes = op.admissoes ?? 0;
  const desligamentos = op.desligamentos ?? 0;
  const examesTipo = clt ? {
    adm: admissoes * f.exames.adm,
    per: x * f.exames.perAnual / 12,
    dem: desligamentos * f.exames.dem
  } : { adm: 0, per: 0, dem: 0 };
  const exames = examesTipo.adm + examesTipo.per + examesTipo.dem;
  const resc = clt ? desligamentos * s * p.fatorRescisao : 0;
  const ferr = est ? 0 : pres * f.ferramentasMes;
  const salFam = clt && s <= p.salarioFamilia.teto ? xa * COTAS_SALARIO_FAMILIA * p.salarioFamilia.cota : 0;
  const ferPag = clt ? ferD / 30 * s * (4 / 3) : 0;
  const sub = salv + extras + he + dsr + enc + prov + vt + benef + exames + resc + nf + ferr;
  const rl = sub * (pr.riscoPct + pr.lucroPct + pr.tribLucroPct) / 100;
  const total = sub + rl;
  const caixa = total - prov + ferPag * (1 + taxa("soc"));
  return {
    funcaoId: f.id,
    regime,
    x,
    xa,
    pres,
    salario: s,
    salarioOrigem,
    a,
    licD,
    ferD,
    dsrPct,
    diasTrabalhados,
    bruto,
    faltasH,
    faltasD,
    faltas,
    salv,
    bolsa,
    adicionais,
    extras,
    horasPorPessoa: h,
    heTipo,
    he,
    valorHoraExtra,
    horaExtraCheia,
    dsr,
    remun,
    enc,
    prov,
    nf,
    vtBruto,
    vtDesc,
    vt,
    beneficiosItem,
    benef,
    admissoes,
    desligamentos,
    examesTipo,
    exames,
    resc,
    ferr,
    salFam,
    ferPag,
    sub,
    rl,
    total,
    caixa,
    dias: pres * diasTrabalhados,
    horasExtras: pres * h,
    cabecas: cabecasMes(o, f.id, i)
  };
}

// packages/motor/src/obra.ts
var CAMPOS_SOMAVEIS = [
  "x",
  "xa",
  "pres",
  "bruto",
  "faltasH",
  "faltasD",
  "faltas",
  "salv",
  "bolsa",
  "extras",
  "horasExtras",
  "he",
  "dsr",
  "remun",
  "enc",
  "prov",
  "nf",
  "vtBruto",
  "vtDesc",
  "vt",
  "benef",
  "admissoes",
  "desligamentos",
  "exames",
  "resc",
  "ferr",
  "salFam",
  "ferPag",
  "sub",
  "rl",
  "total",
  "caixa",
  "dias",
  "licD",
  "ferD",
  "cabecas"
];
var somaVazia = () => {
  const s = Object.fromEntries(CAMPOS_SOMAVEIS.map((k) => [k, 0]));
  return { ...s, adicionais: {}, heTipo: {}, beneficiosItem: {}, examesTipo: {}, saldoFolha: 0 };
};
function acumular(alvo, de) {
  for (const [k, v] of Object.entries(de)) alvo[k] = (alvo[k] ?? 0) + v;
}
function somar(lista) {
  const r = somaVazia();
  for (const c of lista) {
    for (const k of CAMPOS_SOMAVEIS) r[k] += c[k];
    acumular(r.adicionais, c.adicionais);
    acumular(r.heTipo, c.heTipo);
    acumular(r.beneficiosItem, c.beneficiosItem);
    acumular(r.examesTipo, c.examesTipo);
    r.saldoFolha += c.saldoFolha;
  }
  return r;
}
var ErroEntradaMotor = class extends Error {
};
var ruim = (v) => !Number.isFinite(v) || v < 0;
function validarObra(o) {
  const erros = [];
  if (!Number.isInteger(o.inicio.mes) || o.inicio.mes < 1 || o.inicio.mes > 12)
    erros.push(`M\xEAs de in\xEDcio ${o.inicio.mes} inv\xE1lido: informe de 1 a 12.`);
  if (o.meses !== void 0 && (!Number.isInteger(o.meses) || o.meses < 0))
    erros.push(`N\xFAmero de meses ${o.meses} inv\xE1lido: informe um inteiro \u2265 0.`);
  if (ruim(o.area)) erros.push("\xC1rea inv\xE1lida: informe a \xE1rea constru\xEDda em m\xB2 (\u2265 0).");
  for (const [k, v] of Object.entries(o.equivalente))
    if (v.some(ruim))
      erros.push(`Pessoa-m\xEAs de ${k} com valor negativo ou vazio: corrija a s\xE9rie.`);
  for (const [k, v] of Object.entries(o.cabecas ?? {}))
    if (v.some(ruim)) erros.push(`Cabe\xE7as de ${k} com valor negativo ou vazio: corrija a s\xE9rie.`);
  const series = [
    ["HE m\xE9dia", o.heMedia],
    ["Licen\xE7as", o.licencaPessoaDias],
    ["F\xE9rias", o.feriasPessoaDias]
  ];
  for (const [nome, v] of series)
    if (v.some(ruim)) erros.push(`${nome} com valor negativo ou vazio: corrija a s\xE9rie.`);
  if (o.absenteismoPct.some((v) => ruim(v) || v > 100))
    erros.push("Absente\xEDsmo fora de 0\u2013100%: corrija a s\xE9rie.");
  if (ruim(o.rotatividadePct) || o.rotatividadePct > 100)
    erros.push("Rotatividade fora de 0\u2013100%: corrija a premissa.");
  if (o.heMixPct) {
    const mix = TIPOS_HE.map((t) => o.heMixPct?.[t] ?? 0);
    const soma2 = mix.reduce((a, b) => a + b, 0);
    if (mix.some(ruim) || Math.abs(soma2 - 100) > 0.01)
      erros.push(`Mix de HE soma ${soma2}%: ajuste os tipos para somar 100%.`);
  }
  return erros;
}
function calcularObra(o, p, ctx, op) {
  const erros = validarObra(o);
  if (erros.length) throw new ErroEntradaMotor(`Obra ${o.id}: ${erros.join(" ")}`);
  const n = nMeses(o);
  const todas2 = ctx.funcoes.map((f) => f.id);
  const desconhecidas = Object.entries(o.equivalente).filter(([k, v]) => v.some((x) => x > 0) && !todas2.includes(k)).map(([k]) => k);
  if (desconhecidas.length)
    throw new ErroEntradaMotor(
      `Fun\xE7\xF5es sem cadastro na obra ${o.id}: ${desconhecidas.join(", ")}. Inclua-as (mesmo inativas) nas fun\xE7\xF5es do c\xE1lculo.`
    );
  const mov = op.movimentos === "sinteticos" ? movimentos(o, todas2) : op.movimentos;
  const comEfetivo = ctx.funcoes.filter((f) => (o.equivalente[f.id] ?? []).some((v) => v > 0));
  const pr = premissasDe(o);
  const porFuncao = {};
  for (const f of comEfetivo) {
    const linha = Array.from({ length: n }, (_, i) => ({
      ...custoFuncaoMes(o, f, i, p, ctx, {
        admissoes: mov.admissoes[f.id]?.[i] ?? 0,
        desligamentos: mov.desligamentos[f.id]?.[i] ?? 0
      }),
      saldoFolha: 0
    }));
    if (pr.adiantamento) {
      const ap = pr.adiantamentoPct / 100;
      const remun = linha.map((c) => c.remun);
      linha.forEach((c, i) => {
        const sai = i < n - 1 ? remun[i] * (1 - ap) : 0;
        const entra = i ? remun[i - 1] * (1 - ap) : 0;
        c.caixa += entra - sai;
        c.saldoFolha = sai;
      });
    }
    porFuncao[f.id] = linha;
  }
  const porMes = Array.from(
    { length: n },
    (_, i) => somar(comEfetivo.map((f) => porFuncao[f.id][i]))
  );
  return {
    n,
    movimentos: mov,
    funcoes: comEfetivo.map((f) => f.id),
    porFuncao,
    porMes,
    total: somar(porMes)
  };
}

// packages/motor/src/projecao.ts
var soma = (a) => a.reduce((s, v) => s + (Number(v) || 0), 0);
var media = (a) => a.length ? soma(a) / a.length : 0;
function mediana(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function totaisPorMes(o, funcoes) {
  return Array.from(
    { length: nMeses(o) },
    (_, i) => funcoes.reduce((s, k) => s + (o.equivalente[k]?.[i] ?? 0), 0)
  );
}
function shares(curva, N) {
  const n = curva.length;
  const total = soma(curva);
  const out = [];
  for (let j = 0; j < N; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const sobre = Math.max(0, Math.min((i + 1) / n, (j + 1) / N) - Math.max(i / n, j / N));
      s += total ? sobre * curva[i] / total * n : 0;
    }
    out.push(s);
  }
  return out;
}
function pessoasInteiras(x) {
  if (!(x > 0)) return 0;
  const base = Math.floor(x + 1e-9);
  return x - base <= 0.2 + 1e-9 ? base : base + 1;
}
function manualValido(e) {
  const m = e.quantidadesManuais;
  if (!m) return null;
  return Object.values(m).every((a) => Array.isArray(a) && a.length === e.prazo) ? m : null;
}
function projetar(e, parametros, ctx) {
  const refs = e.referencias;
  const manual = manualValido(e);
  if (!refs.length && !manual || e.prazo <= 0) return null;
  const agg = e.estatistica === "mediana" ? mediana : media;
  const N = e.prazo;
  const ids = ctx.funcoes.map((f) => f.id);
  const q = {};
  const pmPorMilM2 = {};
  for (const f of ctx.funcoes) {
    const k = f.id;
    if (manual) {
      const ajm = 1 + (e.ajustesPct?.[k] ?? 0) / 100;
      q[k] = (manual[k] ?? Array(N).fill(0)).map((v) => pessoasInteiras((Number(v) || 0) * ajm));
      pmPorMilM2[k] = null;
      continue;
    }
    const aj = 1 + (e.ajustesPct?.[k] ?? 0) / 100;
    if (!f.escalaArea) {
      const m = agg(
        refs.map((r) => {
          const n = nMeses(r);
          let c = 0;
          for (let i = 0; i < n; i++) c += cabecasMes(r, k, i);
          return n ? c / n : 0;
        })
      );
      q[k] = Array(N).fill(pessoasInteiras(m * aj));
      pmPorMilM2[k] = null;
      continue;
    }
    const comArea = refs.filter((r) => r.area > 0);
    const pm = agg(comArea.map((r) => soma(r.equivalente[k] ?? []) / r.area * 1e3)) * aj;
    const curvas = comArea.map((r) => r.equivalente[k] ?? []).filter((c) => soma(c) > 0).map((c) => shares(c, N));
    const shm = Array.from({ length: N }, (_, j) => media(curvas.map((c) => c[j])));
    q[k] = shm.map((s) => pessoasInteiras(pm * e.area / 1e3 * s));
    pmPorMilM2[k] = pm;
  }
  const heMediaObra = (r) => {
    const t = totaisPorMes(r, ids);
    const n = soma(t);
    return n ? soma(t.map((x, i) => x * (r.heMedia[i] ?? 0))) / n : 0;
  };
  const absMedio = (r) => {
    const t = totaisPorMes(r, ids);
    const n = soma(t);
    return n ? soma(t.map((x, i) => x * (r.absenteismoPct[i] ?? 0))) / n : 0;
  };
  const heAp = e.heMedia ?? (refs.length ? agg(refs.map(heMediaObra)) : 15);
  const absAp = e.absenteismoPct ?? (refs.length ? agg(refs.map(absMedio)) : 3);
  const turnAp = e.rotatividadePct ?? (refs.length ? agg(refs.map((r) => r.rotatividadePct)) : 5);
  const mixAp = e.heMixPct ? { ...e.heMixPct } : refs.length ? Object.fromEntries(
    TIPOS_HE.map((t) => [
      t,
      media(refs.map((r) => ({ ...HE_MIX_PADRAO, ...r.heMixPct ?? {} })[t]))
    ])
  ) : { ...HE_MIX_PADRAO };
  const taxa = (campo) => refs.length ? agg(
    refs.map((r) => {
      const m = soma(totaisPorMes(r, ids));
      return m ? soma(r[campo]) / m : 0;
    })
  ) : 0;
  const licAp = e.licencaPorPm ?? taxa("licencaPessoaDias");
  const ferAp = e.feriasPorPm ?? taxa("feriasPessoaDias");
  const cid = e.cidade ?? null;
  const ultimoAno = anoMes(e.inicio, N - 1).ano;
  const feriadosCidade = [];
  if (cid)
    for (let a = e.inicio.ano; a <= ultimoAno; a++)
      feriadosCidade.push(...feriadosDaCidade(cid.feriados, a));
  const origem = {};
  const vtPorFuncao = {};
  for (const k of ids) {
    const og = e.origem?.[k] ?? "local";
    origem[k] = og;
    vtPorFuncao[k] = og === "aloj" ? 0 : !cid ? e.vtDiariaReferencia : og === "diaria" ? e.cidadeOrigem ? vtDiarioDe(cid, e.cidadeOrigem).valor : vtDiario(cid) : vtDiario(cid);
  }
  const obraBase = {
    id: e.id || "nova",
    inicio: e.inicio,
    area: e.area,
    equivalente: q,
    cabecas: Object.fromEntries(Object.entries(q).map(([k, v]) => [k, [...v]])),
    heMedia: Array(N).fill(heAp),
    absenteismoPct: Array(N).fill(absAp),
    licencaPessoaDias: [],
    feriasPessoaDias: [],
    rotatividadePct: turnAp,
    heMixPct: mixAp,
    regime: e.regime ?? {},
    premissas: { ...PREMISSAS_PADRAO, ...e.premissas ?? {} },
    feriadosMunicipais: [...e.feriadosMunicipais ?? [], ...feriadosCidade],
    origem,
    vtDiariaPorFuncao: vtPorFuncao
  };
  const totais = totaisPorMes(obraBase, ids);
  const obra = {
    ...obraBase,
    licencaPessoaDias: totais.map((t) => Math.round(t * licAp)),
    feriasPessoaDias: totais.map((t) => Math.round(t * ferAp))
  };
  const resultado = calcularObra(obra, parametros, ctx, { movimentos: "sinteticos" });
  return {
    obra,
    resultado,
    totais,
    pessoaMes: soma(totais),
    pico: totais.length ? Math.max(...totais) : 0,
    aplicadas: {
      heMedia: heAp,
      absenteismoPct: absAp,
      rotatividadePct: turnAp,
      heMixPct: mixAp,
      licencaPorPm: licAp,
      feriasPorPm: ferAp
    },
    pmPorMilM2,
    total: resultado.total.total
  };
}

// apps/web/src/lib/obraDoBanco.ts
var inicioDe = (iso2) => ({
  ano: Number(iso2.slice(0, 4)),
  mes: Number(iso2.slice(5, 7))
});
function obraDoBanco(b) {
  const o = b.obra;
  const n = o.meses;
  const serie = () => Array(n).fill(0);
  const equivalente = {};
  const cabecas = {};
  const admissoes = {};
  const desligamentos = {};
  for (const e of b.efetivo) {
    const f = e.funcao_id;
    if (!equivalente[f]) {
      equivalente[f] = serie();
      cabecas[f] = serie();
      admissoes[f] = serie();
      desligamentos[f] = serie();
    }
    if (e.mes_idx >= n) continue;
    equivalente[f][e.mes_idx] = Number(e.equivalente);
    cabecas[f][e.mes_idx] = e.cabecas;
    admissoes[f][e.mes_idx] = e.admissoes;
    desligamentos[f][e.mes_idx] = e.desligamentos;
  }
  const porMes = (k) => {
    const s = serie();
    for (const c of b.competencias) if (c.mes_idx < n) s[c.mes_idx] = Number(c[k] ?? 0);
    return s;
  };
  const heMixPct = {
    util: Number(o.he_mix_util),
    sabado: Number(o.he_mix_sabado),
    intervalo: Number(o.he_mix_intervalo),
    feriado: Number(o.he_mix_feriado)
  };
  return {
    obra: {
      id: o.id,
      inicio: inicioDe(o.inicio),
      meses: n,
      area: Number(o.area_m2),
      equivalente,
      cabecas,
      heMedia: porMes("he_media"),
      absenteismoPct: porMes("absenteismo_pct"),
      licencaPessoaDias: porMes("licenca_pessoa_dias"),
      feriasPessoaDias: porMes("ferias_pessoa_dias"),
      rotatividadePct: Number(o.rotatividade_pct),
      heMixPct,
      regime: Object.fromEntries(b.regime.map((r) => [r.funcao_id, r.regime])),
      premissas: {
        gratPremiosPct: Number(o.grat_premios_pct),
        transfPct: Number(o.transf_pct),
        funcoesTransferidas: o.funcoes_transferidas,
        riscoPct: Number(o.risco_pct),
        lucroPct: Number(o.lucro_pct),
        tribLucroPct: Number(o.trib_lucro_pct),
        provisionar: o.provisionar,
        adiantamento: o.adiantamento,
        adiantamentoPct: Number(o.adiantamento_pct)
      },
      feriadosMunicipais: b.feriados.map((f) => ({ data: f.data, nome: f.nome }))
    },
    movimentos: { admissoes, desligamentos }
  };
}

// apps/web/src/lib/projecaoDoBanco.ts
var num = (v) => v === null || v === void 0 ? null : Number(v);
function entradasDaLinha(p) {
  return {
    nome: p.nome,
    cliente: p.cliente,
    tipologia: p.tipologia,
    cidadeId: p.cidade_id,
    cidadeOrigemId: p.cidade_origem_id,
    inicio: inicioDe(p.inicio),
    prazo: p.prazo_meses,
    area: Number(p.area_m2),
    referencias: p.referencias,
    estatistica: p.estatistica === "mediana" ? "mediana" : "media",
    ajustes: p.ajustes ?? {},
    quantidadesManuais: p.quantidades_manuais ?? null,
    heMedia: num(p.he_media),
    absenteismoPct: num(p.absenteismo_pct),
    rotatividadePct: num(p.rotatividade_pct),
    licencaPorPm: num(p.licenca_por_pm),
    feriasPorPm: num(p.ferias_por_pm),
    heMix: p.he_mix ?? null,
    premissas: p.premissas ?? {},
    regime: p.regime ?? {},
    origem: p.origem ?? {},
    reajuste: p.reajuste_mes === null || p.reajuste_pct === null ? null : { mesIdx: p.reajuste_mes, pct: Number(p.reajuste_pct) }
  };
}
function calcularProjecao(e, referencias, precos, ctx) {
  const { vigente, cidade, cidadeOrigem, cct } = precos;
  const base = cidade && cct ? tabelaDaCidade(vigente, cct, cidade) : vigente;
  const reajustes = reajustesDaProjecao(e.inicio, e.prazo, e.reajuste, cct);
  const parametros = aplicarReajustes(base, e.prazo, reajustes);
  const entrada = {
    inicio: e.inicio,
    prazo: e.prazo,
    area: e.area,
    referencias: referencias.map((b) => obraDoBanco(b).obra),
    estatistica: e.estatistica,
    ajustesPct: e.ajustes,
    quantidadesManuais: e.quantidadesManuais,
    heMedia: e.heMedia,
    absenteismoPct: e.absenteismoPct,
    rotatividadePct: e.rotatividadePct,
    licencaPorPm: e.licencaPorPm,
    feriasPorPm: e.feriasPorPm,
    heMixPct: e.heMix,
    premissas: e.premissas,
    regime: e.regime,
    origem: e.origem,
    cidade,
    cidadeOrigem,
    vtDiariaReferencia: vigente.vtDiaria
  };
  let r;
  try {
    r = projetar(entrada, parametros, ctx);
  } catch {
    r = null;
  }
  return { parametros, reajustes, entrada, r };
}
var resumoDaProjecao = (c, vigente) => c.r ? {
  total: Math.round(c.r.total * 100) / 100,
  pico: c.r.pico,
  pessoa_mes: Math.round(c.r.pessoaMes * 100) / 100,
  vigente
} : {};

// apps/web/src/servidor/aprovacao.ts
var VERSAO_CALCULO = "c282fd29d4e00759";
var ErroAprovacao = class extends Error {
};
async function calcularAprovacao(c, id) {
  const linha = await ok(c.from("projecoes").select("*").eq("id", id).maybeSingle());
  if (!linha) throw new ErroAprovacao("A proje\xE7\xE3o n\xE3o existe. Atualize a p\xE1gina.");
  const e = entradasDaLinha(linha);
  const [contexto, cidades] = await Promise.all([carregarContexto(c), carregarCidades(c)]);
  const cid = cidades.find((x) => x.id === e.cidadeId) ?? null;
  const cct = cid ? await carregarCctPrecos(c, cid.cct_id) : void 0;
  const precos = montarPrecos(
    contexto.tabelas[contexto.vigente],
    cidades,
    e.cidadeId,
    e.cidadeOrigemId,
    cct
  );
  if (!precos)
    throw new ErroAprovacao(
      "Faltam os pre\xE7os da cidade ou a tabela vigente. Confira os cadastros."
    );
  const refs = e.referencias.length ? (await carregarObrasBanco(c, e.referencias)).filter((b) => e.referencias.includes(b.obra.id)) : [];
  const calc = calcularProjecao(e, refs, precos, contexto.ctx);
  const resumo = resumoDaProjecao(calc, contexto.vigente);
  if (resumo.total === void 0)
    throw new ErroAprovacao("A proje\xE7\xE3o n\xE3o calcula com os dados atuais. Abra-a e confira.");
  const entradas = { ...linha };
  delete entradas.resumo;
  return {
    resumo,
    atualizadoEm: linha.atualizado_em,
    registro: {
      entradas,
      precos,
      referencias: refs.map((b) => ({ id: b.obra.id, revisao: b.obra.revisao })),
      versao_calculo: VERSAO_CALCULO
    }
  };
}
export {
  ErroAprovacao,
  VERSAO_CALCULO,
  calcularAprovacao
};
