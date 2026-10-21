import { useMemo, useState } from "react";
import { mesAno, moeda, numero, percentual } from "@ito/formato";
import type { CustoMes, Soma } from "@ito/motor";
import { anoMes, indicadores, somar, tabelaDoMes } from "@ito/motor";
import type { ContextoCarga } from "../../dados/carga";
import type { ObraBanco } from "../../lib/obraDoBanco";
import { resumoDaObra } from "../../lib/obraDoBanco";
import type { Calculo, Entradas } from "../../lib/projecaoDoBanco";
import { cenarios } from "../../lib/projecaoDoBanco";
import { BarrasMensais, Legenda } from "../../ui/BarrasMensais";
import { Badge, Botao, Cartao, Segmento } from "../../ui/componentes";
import { Kpi } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { Linhas } from "../../ui/Linhas";
import { useToast } from "../../ui/toast";
import { COMPONENTES, NOME_GRUPO_F, notaVisao, ORDEM_GRUPOS, soma } from "../obra/comum";
import o from "../obra/obra.module.css";
import { useInfoFuncoes } from "./funcoes";
import { rotulosMeses, textoTabulado } from "./projecoes";
import s from "./projecoes.module.css";

const NOME_CENARIO = {
  planejado: "Como planejado",
  local: "Toda a mão de obra local",
  diaria: "Toda vindo de fora todo dia",
  aloj: "Toda alojada",
} as const;

/**
 * Resultado da projeção (PRD §3.4, protótipo `resultadoProj`): indicadores, premissas aplicadas,
 * histograma, efetivo e custo mês a mês, quanto custa trazer gente de fora, curva S e projeção ×
 * referências. `detalhe` mostra as ações da tela da projeção (copiar, alterar premissas).
 */
export function Resultado({
  e,
  calc,
  contexto,
  referencias,
  cidade,
  cct,
  origem,
  detalhe,
  onAlterarPremissas,
}: {
  e: Entradas;
  calc: Calculo;
  contexto: ContextoCarga;
  referencias: readonly ObraBanco[];
  cidade: string | null;
  cct: string | null;
  origem: string | null;
  detalhe?: boolean;
  onAlterarPremissas?: () => void;
}) {
  const avisar = useToast();
  const [modo, setModo] = useState<"pessoas" | "custo">("pessoas");
  const [relativo, setRelativo] = useState(false);
  const [caixa, setCaixa] = useState(false);
  const [porComp, setPorComp] = useState(false);
  const { fun, ordenarFuncoes } = useInfoFuncoes(contexto.ctx);
  const r = calc.r;
  const ctx = contexto.ctx;

  const cen = useMemo(() => (cidade ? cenarios(calc, ctx) : []), [calc, ctx, cidade]);
  const refs = useMemo(
    () =>
      referencias.flatMap((b) => {
        try {
          return [{ b, r: resumoDaObra(b, ctx, contexto.tabelas, contexto.vigente) }];
        } catch {
          return [];
        }
      }),
    [referencias, ctx, contexto.tabelas, contexto.vigente],
  );

  if (!r)
    return (
      <Cartao>
        <p className="sub" style={{ padding: 22, margin: 0 }}>
          Selecione ao menos uma obra de referência ou informe as quantidades à mão.
        </p>
      </Cartao>
    );

  const R = r.resultado;
  const V = (c: CustoMes | Soma) => (caixa ? c.caixa : c.total);
  const rotulos = rotulosMeses(e.inicio, e.prazo, relativo);
  const ids = ordenarFuncoes(R.funcoes);
  const total = V(R.total);
  const grupos = R.porGrupo;
  const gt = soma(Object.values(grupos)) || 1;
  const ind = indicadores(R);
  const picoMes = r.totais.indexOf(r.pico);
  const p0 = tabelaDoMes(calc.parametros, 0);
  const vig = contexto.vigente;
  const M = rotulos.map((_, i) => somar(ids.map((k) => R.porFuncao[k]![i]!)));
  const series = ids.map((k) => ({
    id: k,
    nome: fun(k).nome,
    cor: fun(k).cor,
    valores:
      modo === "pessoas" ? (r.obra.equivalente[k] ?? []) : R.porFuncao[k]!.map((c) => V(c) / 1000),
  }));
  const totComp = soma(M.map((m) => m.total));
  const curva = [
    {
      id: "s",
      nome: "Custo acumulado",
      cor: "var(--c3)",
      pontos: [
        [0, 0] as const,
        ...M.map(
          (_, j) =>
            [
              j + 1,
              totComp ? (soma(M.slice(0, j + 1).map((m) => m.total)) / totComp) * 100 : 0,
            ] as const,
        ),
      ],
    },
  ];
  const reaj = calc.reajustes[0];
  const nomeMes = (i: number) => {
    const m = anoMes(e.inicio, i);
    return mesAno(m.ano, m.mes);
  };

  function copiar() {
    const linhas: (string | number)[][] = [
      [porComp ? "Componente" : "Função", ...rotulos, "Total"],
      ...(porComp
        ? COMPONENTES.filter((c) => !(caixa && c.k === "prov")).map((c) => [
            c.n,
            ...M.map((m) => m[c.k]),
            soma(M.map((m) => m[c.k])),
          ])
        : ids.map((k) => [fun(k).nome, ...R.porFuncao[k]!.map(V), soma(R.porFuncao[k]!.map(V))])),
      ["Total do mês", ...M.map(V), soma(M.map(V))],
    ];
    navigator.clipboard.writeText(textoTabulado(linhas)).then(
      () => avisar("Tabela copiada. Cole no Excel."),
      () => avisar("Não foi possível copiar. Permita o acesso à área de transferência."),
    );
  }

  return (
    <>
      <div className={f.kpis}>
        <Kpi
          rotulo={`Custo total projetado${caixa ? " · caixa" : ""}`}
          valor={moeda(total, 0)}
          sub={`CCT ${vig} · inclui ${moeda(R.total.prov, 0)} de provisões`}
          destaque
        />
        <Kpi
          rotulo="Custo / m²"
          valor={moeda(total / e.area, 0)}
          sub={`sobre ${numero(e.area)} m²`}
        />
        <Kpi
          rotulo="Direta · indireta · adm."
          valor={`${percentual((grupos.direta / gt) * 100, 0)} · ${percentual((grupos.indireta / gt) * 100, 0)} · ${percentual((grupos.adm / gt) * 100, 0)}`}
          sub="do custo"
        />
        <Kpi
          rotulo="Pico de efetivo"
          valor={`${numero(r.pico)} pessoas`}
          sub={`em ${rotulos[picoMes] ?? "—"}`}
        />
        <Kpi
          rotulo="Pessoa-mês"
          valor={numero(r.pessoaMes, 1)}
          sub={`${numero((r.pessoaMes / e.area) * 1000, 1)} por 1.000 m² · ${percentual(ind.indiretaPct, 0)} indireta`}
        />
        <Kpi
          rotulo="R$ por dia trabalhado"
          valor={moeda(ind.porDiaComTaxa, 0)}
          sub={`${moeda(ind.porDiaSemTaxa, 0)} sem encargos e benefícios`}
        />
      </div>

      <Cartao aria-label="Premissas aplicadas">
        <div className={f.barra}>
          <span className="rotulo">Premissas aplicadas</span>
          {onAlterarPremissas && (
            <Botao pequeno onClick={onAlterarPremissas}>
              Alterar premissas
            </Botao>
          )}
        </div>
        <div className={s.meta} style={{ padding: "0 22px 18px" }}>
          <span>HE {numero(r.aplicadas.heMedia, 1)} h/pessoa·mês</span>
          <span>Absenteísmo {percentual(r.aplicadas.absenteismoPct)}</span>
          <span>Rotatividade {percentual(r.aplicadas.rotatividadePct, 1)} a.m.</span>
          <span>
            Licenças {numero(r.aplicadas.licencaPorPm, 2)} e férias{" "}
            {numero(r.aplicadas.feriasPorPm, 2)} dias por pessoa·mês
          </span>
          {cidade ? (
            <span>
              {cidade} · {cct}
            </span>
          ) : (
            <span>Sem cidade: tabela da empresa {vig}</span>
          )}
          <span>Oficial {moeda(p0.salarios.ped ?? 0)}</span>
          <span>VT local {moeda(p0.vtDiaria)} por dia</span>
          <span>
            {reaj
              ? `Reajuste de ${percentual(reaj.pct, 1)} a partir de ${nomeMes(reaj.mesIdx)}${reaj.automatico ? " (data-base da CCT)" : " (informado)"}`
              : "Sem reajuste no prazo"}
          </span>
        </div>
      </Cartao>

      <Cartao aria-label="Histograma projetado">
        <div
          className={o.corpo ?? undefined}
          style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <span className="rotulo">
              Histograma projetado ·{" "}
              {modo === "pessoas" ? "pessoas por função" : "custo por função (R$ mil)"}
            </span>
            <span className={f.linha}>
              <Segmento
                rotulo="Eixo"
                opcoes={[
                  { valor: "data", texto: "Datas" },
                  { valor: "rel", texto: "Mês 1, 2…" },
                ]}
                valor={relativo ? "rel" : "data"}
                onChange={(v) => setRelativo(v === "rel")}
              />
              <Segmento
                rotulo="Métrica"
                opcoes={[
                  { valor: "pessoas", texto: "Pessoas" },
                  { valor: "custo", texto: "Custo" },
                ]}
                valor={modo}
                onChange={setModo}
              />
            </span>
          </div>
          <Legenda series={series} />
          <BarrasMensais
            rotulos={rotulos}
            series={series}
            formatar={(v) => (modo === "pessoas" ? numero(v) : `${numero(v)} k`)}
            titulo={modo === "pessoas" ? "Histograma projetado" : "Custo projetado por função"}
          />
        </div>
      </Cartao>

      <Cartao aria-label="Efetivo projetado">
        <div className={f.barra}>
          <span className="rotulo">Efetivo projetado</span>
          <span className="sub">
            {ids
              .slice(0, 4)
              .map((k) => {
                const pm = r.pmPorMilM2[k];
                return `${fun(k).nome} ${pm == null ? (e.quantidadesManuais ? "informado" : "fixo/mês") : `${numero(pm, 1)} PM/1.000 m²`}`;
              })
              .join(" · ")}
            {ids.length > 4 ? "…" : ""}
          </span>
        </div>
        <div className={o.mensal}>
          <table className={f.tabela} aria-label="Pessoas por função e mês">
            <thead>
              <tr>
                <th>Função</th>
                {rotulos.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>Pessoa-mês</th>
              </tr>
            </thead>
            <tbody>
              {ORDEM_GRUPOS.map((g) => {
                const gk = ids.filter((k) => fun(k).grupo === g);
                if (!gk.length) return null;
                return [
                  <tr key={`g-${g}`} className={o.grupoLinha}>
                    <td colSpan={rotulos.length + 2}>
                      Mão de obra {NOME_GRUPO_F[g].toLowerCase()}
                    </td>
                  </tr>,
                  ...gk.map((k) => {
                    const q = r.obra.equivalente[k] ?? [];
                    return (
                      <tr key={k}>
                        <td className={f.forte}>
                          <span className={o.amostra} style={{ background: fun(k).cor }} />
                          {fun(k).nome}
                        </td>
                        {rotulos.map((_, i) => (
                          <td key={i} className={f.r}>
                            {q[i] ? numero(q[i]) : <span className="sub">–</span>}
                          </td>
                        ))}
                        <td className={f.r}>
                          <strong>{numero(soma(q))}</strong>
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
              <tr className="total">
                <td>Total</td>
                {r.totais.map((t, i) => (
                  <td key={i} className={f.r}>
                    {numero(t)}
                  </td>
                ))}
                <td className={f.r}>{numero(r.pessoaMes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao aria-label="Custo projetado">
        <div className={f.barra}>
          <span className="rotulo">Custo projetado</span>
          <span className={f.linha}>
            <Segmento
              rotulo="Custo por"
              opcoes={[
                { valor: "func", texto: "Por função" },
                { valor: "comp", texto: "Por componente" },
              ]}
              valor={porComp ? "comp" : "func"}
              onChange={(v) => setPorComp(v === "comp")}
            />
            <Segmento
              rotulo="Visão"
              opcoes={[
                { valor: "comp", texto: "Competência" },
                { valor: "caixa", texto: "Caixa" },
              ]}
              valor={caixa ? "caixa" : "comp"}
              onChange={(v) => setCaixa(v === "caixa")}
            />
            {detalhe && (
              <Botao pequeno onClick={copiar}>
                Copiar para Excel
              </Botao>
            )}
          </span>
        </div>
        <div className={o.mensal}>
          <table className={f.tabela} aria-label="Custo por mês">
            <thead>
              <tr>
                <th>{porComp ? "Componente" : "Função"}</th>
                {rotulos.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>Total</th>
              </tr>
            </thead>
            <tbody>
              {porComp
                ? COMPONENTES.map((c) => {
                    const fora = caixa && c.k === "prov";
                    return (
                      <tr key={c.k} className={fora ? o.discreta : undefined}>
                        <td className={f.forte}>
                          <span className={o.amostra} style={{ background: c.c }} />
                          {c.n.replace(/ \(.*\)$/, "")}
                          {fora && <div className="sub">fora da visão caixa</div>}
                        </td>
                        {M.map((m, i) => (
                          <td key={i} className={f.r}>
                            {moeda(m[c.k], 0)}
                          </td>
                        ))}
                        <td className={f.r}>
                          <strong>{moeda(soma(M.map((m) => m[c.k])), 0)}</strong>
                        </td>
                      </tr>
                    );
                  })
                : ids.map((k) => {
                    const linha = R.porFuncao[k]!;
                    const t = soma(linha.map(V));
                    return (
                      <tr key={k}>
                        <td className={f.forte}>
                          <span className={o.amostra} style={{ background: fun(k).cor }} />
                          {fun(k).nome}
                          <div className="sub">
                            {moeda(linha[0]!.salario)}
                            {(() => {
                              // reajuste no prazo: mostra o salário novo e o mês
                              const j = linha.findIndex((c) => c.salario !== linha[0]!.salario);
                              return j > 0 ? ` → ${moeda(linha[j]!.salario)} em ${rotulos[j]}` : "";
                            })()}{" "}
                            ·{" "}
                            {linha[0]!.regime === "sp"
                              ? "prestador S/P"
                              : linha[0]!.regime === "estagio"
                                ? "estágio"
                                : "folha CLT"}
                          </div>
                        </td>
                        {linha.map((c, i) => (
                          <td key={i} className={f.r}>
                            {c.x ? moeda(V(c), 0) : <span className="sub">–</span>}
                          </td>
                        ))}
                        <td className={f.r}>
                          <strong>{moeda(t, 0)}</strong>
                        </td>
                      </tr>
                    );
                  })}
              <tr className="total">
                <td>Total do mês</td>
                {M.map((m, i) => (
                  <td key={i} className={f.r}>
                    {moeda(V(m), 0)}
                  </td>
                ))}
                <td className={f.r}>{moeda(soma(M.map(V)), 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="sub" style={{ padding: "12px 22px 18px", margin: 0 }}>
          {notaVisao(caixa)}
        </p>
      </Cartao>

      {cen.length > 0 && (
        <Cartao aria-label="Quanto custa trazer gente de fora">
          <div className={f.barra}>
            <span className="rotulo">Quanto custa trazer gente de fora</span>
            <span className="sub">
              Mesmo histograma e mesma CCT de {cidade}; muda só a origem da mão de obra
              {origem ? ` (quem vem todo dia sai de ${origem})` : ""}
            </span>
          </div>
          <table className={f.tabela} aria-label="Cenários de origem">
            <thead>
              <tr>
                <th>Cenário</th>
                <th className={f.r}>Vale-transporte</th>
                <th className={f.r}>Benefícios</th>
                <th className={f.r}>Custo total</th>
                <th className={f.r}>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {cen.map((c, j) => {
                const b = cen[0]!.total;
                const d = c.total - b;
                return (
                  <tr key={c.nome} className={j === 0 ? s.destaque : undefined}>
                    <td>
                      {c.nome === "diaria" && origem
                        ? `Toda vindo de ${origem} todo dia`
                        : NOME_CENARIO[c.nome]}
                    </td>
                    <td className={f.r}>{moeda(c.vt, 0)}</td>
                    <td className={f.r}>{moeda(c.benef, 0)}</td>
                    <td className={f.r}>{moeda(c.total, 0)}</td>
                    <td className={f.r}>
                      {j === 0 ? (
                        "–"
                      ) : (
                        <>
                          {d >= 0 ? "+" : ""}
                          {moeda(d, 0)}{" "}
                          <span className="sub">
                            {d >= 0 ? "+" : ""}
                            {percentual(b ? (c.total / b - 1) * 100 : 0, 1)}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Cartao>
      )}

      <div className={`${s.grade2} ${s.largo}`}>
        <Cartao aria-label="Curva S">
          <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="rotulo">Curva S · custo acumulado</span>
            <Linhas
              series={curva}
              xMax={e.prazo}
              marcasX={rotulos.map((m, j) => [j + 1, m] as const)}
              formatarY={(v) => percentual(v, 0)}
              titulo="Curva S do custo projetado"
              pontosVisiveis
            />
          </div>
        </Cartao>
        <Cartao aria-label="Projeção × referências">
          <div className={f.barra}>
            <span className="rotulo">Projeção × referências</span>
            <Badge tom="ambar">a valores de {vig}</Badge>
          </div>
          <table className={f.tabela} aria-label="Projeção e obras de referência">
            <thead>
              <tr>
                <th>Obra</th>
                <th className={f.r}>Área · prazo</th>
                <th className={f.r}>Pico · PM/1.000 m²</th>
                <th className={f.r}>Custo</th>
              </tr>
            </thead>
            <tbody>
              {refs.map(({ b, r: x }) => {
                const area = Number(b.obra.area_m2);
                return (
                  <tr key={b.obra.id}>
                    <td>{b.obra.nome}</td>
                    <td className={`${f.r} ${s.nowrap}`}>
                      {numero(area)} m²
                      <div className="sub">{numero(b.obra.meses)} meses</div>
                    </td>
                    <td className={f.r}>
                      {numero(x.pico, 1)}
                      <div className="sub">{numero((x.pessoa_mes / area) * 1000, 1)} PM</div>
                    </td>
                    <td className={`${f.r} ${s.nowrap}`}>
                      {moeda(x.custo_atual, 0)}
                      <div className="sub">{moeda(x.custo_atual / area, 0)} /m²</div>
                    </td>
                  </tr>
                );
              })}
              <tr className={s.destaque}>
                <td>
                  <strong>{e.nome || "Esta projeção"}</strong>
                </td>
                <td className={`${f.r} ${s.nowrap}`}>
                  {numero(e.area)} m²
                  <div className="sub">{numero(e.prazo)} meses</div>
                </td>
                <td className={f.r}>
                  {numero(r.pico)}
                  <div className="sub">{numero((r.pessoaMes / e.area) * 1000, 1)} PM</div>
                </td>
                <td className={`${f.r} ${s.nowrap}`}>
                  {moeda(r.total, 0)}
                  <div className="sub">{moeda(r.total / e.area, 0)} /m²</div>
                </td>
              </tr>
            </tbody>
          </table>
        </Cartao>
      </div>
    </>
  );
}
