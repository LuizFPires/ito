import { useMemo, useState } from "react";
import { Link } from "react-router";
import { mesAno, moeda, numero, percentual } from "@ito/formato";
import type { CustoMes, Soma } from "@ito/motor";
import { anoMes, indicadores, PREMISSAS_PADRAO, somar, tabelaDoMes } from "@ito/motor";
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
import { COMPONENTES, notaVisao, soma } from "../obra/comum";
import o from "../obra/obra.module.css";
import { useInfoFuncoes } from "./funcoes";
import { baixarXlsx, nomeArquivo } from "../../lib/planilha";
import { BotaoCopiar } from "../../ui/BotaoCopiar";
import u from "../../ui/ui.module.css";
import { tabelaCustoComponente, tabelaCustoFuncao, tabelaEfetivo } from "../obra/exportar";
import { tabelasDaProjecao, titulosProjecao } from "./exportar";
import { manualValido, rotulosMeses } from "./projecoes";
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
  situacao,
  imprimir,
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
  situacao?: string;
  /** endereço da página de impressão (PDF para a diretoria) */
  imprimir?: string;
  onAlterarPremissas?: () => void;
}) {
  const avisar = useToast();
  const [modo, setModo] = useState<"pessoas" | "custo">("pessoas");
  const [relativo, setRelativo] = useState(false);
  const [caixa, setCaixa] = useState(false);
  const [porComp, setPorComp] = useState(false);
  const [agrupadas, setAgrupadas] = useState(false);
  const [gerando, setGerando] = useState(false);
  const { fun, ordenarFuncoes } = useInfoFuncoes(contexto.ctx);
  const r = calc.r;
  const ctx = contexto.ctx;
  const manual = manualValido(e.quantidadesManuais, e.prazo);

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
  const pr = { ...PREMISSAS_PADRAO, ...e.premissas };
  const porDia = (k: string | null) => {
    const t2 = somar(k ? (R.porFuncao[k] ?? []) : M);
    return t2.dias ? t2.total / t2.dias : null;
  };
  const nSp = ids.filter((k) => e.regime[k] === "sp").length;
  const nTransf = pr.funcoesTransferidas.filter((k) => ids.includes(k)).length;
  const origens = (["local", "diaria", "aloj"] as const).map(
    (og) => ids.filter((k) => !fun(k).estagio && (e.origem[k] ?? "local") === og).length,
  );
  const mix = r.aplicadas.heMixPct;
  const nomeMes = (i: number) => {
    const m = anoMes(e.inicio, i);
    return mesAno(m.ano, m.mes);
  };

  const tituloCusto = () => [
    ...titulosProjecao({ e, cidade, vigente: vig }),
    caixa ? "Visão caixa" : "Visão competência (com provisões)",
  ];
  const funExp = (k: string) => ({ ...fun(k), conta: "" });
  async function exportar() {
    setGerando(true);
    try {
      await baixarXlsx(
        nomeArquivo(["ITO", "Projeção", e.nome || "sem nome"]),
        tabelasDaProjecao({
          e,
          calc,
          ids,
          fun,
          cidade,
          cct,
          origem,
          vigente: vig,
          situacao,
          caixa,
          cenarios: cen,
          referencias: refs.map(({ b, r: x }) => ({
            nome: b.obra.nome,
            area: Number(b.obra.area_m2),
            meses: b.obra.meses,
            pico: x.pico,
            pessoaMes: x.pessoa_mes,
            custo: x.custo_atual,
          })),
        }),
      );
    } catch {
      avisar("Não foi possível gerar o arquivo. Atualize a página e tente de novo.");
    } finally {
      setGerando(false);
    }
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
          rotulo="Pico de efetivo"
          valor={`${numero(r.pico)} pessoas`}
          sub={`em ${rotulos[picoMes] ?? "—"}`}
        />
        <Kpi
          rotulo="Pessoa-mês"
          valor={numero(r.pessoaMes, 1)}
          sub={`${numero((r.pessoaMes / e.area) * 1000, 1)} por 1.000 m²`}
        />
        <Kpi
          rotulo="R$ por dia · pedreiro"
          valor={moeda(porDia("ped"), 0)}
          sub={`servente ${moeda(porDia("serv"), 0)} · todas as funções ${moeda(ind.porDiaComTaxa, 0)}`}
        />
      </div>

      <Cartao aria-label="Premissas aplicadas">
        <div className={f.barra}>
          <span className="rotulo">Premissas aplicadas</span>
          <span className={f.linha}>
            {detalhe && (
              <Botao pequeno disabled={gerando} onClick={exportar}>
                {gerando ? "Gerando…" : "Exportar .xlsx"}
              </Botao>
            )}
            {imprimir && (
              <Link
                className={`${u.botao} ${u.pequeno}`}
                to={imprimir}
                style={{ textDecoration: "none" }}
              >
                Resumo para a diretoria (PDF)
              </Link>
            )}
            {onAlterarPremissas && (
              <Botao pequeno onClick={onAlterarPremissas}>
                Alterar premissas
              </Botao>
            )}
          </span>
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
          <span>Gratificações e prêmios {percentual(pr.gratPremiosPct, 1)}</span>
          {nTransf > 0 && (
            <span>
              Transferência {percentual(pr.transfPct, 0)} em {numero(nTransf)}{" "}
              {nTransf === 1 ? "função" : "funções"}
            </span>
          )}
          <span>
            HE {percentual(mix.util, 0)} úteis · {percentual(mix.sabado, 0)} sábados ·{" "}
            {percentual(mix.intervalo, 0)} intervalo · {percentual(mix.feriado, 0)} domingos e
            feriados
          </span>
          <span>
            {nSp ? `${numero(nSp)} ${nSp === 1 ? "função" : "funções"} S/P` : "Nenhuma função S/P"}
          </span>
          {cidade && (
            <span>
              Origem: {numero(origens[0]!)} local · {numero(origens[1]!)} vem todo dia ·{" "}
              {numero(origens[2]!)} alojada
            </span>
          )}
          <span>{pr.provisionar ? "Com provisões (competência)" : "Sem provisões"}</span>
          <span>
            {pr.adiantamento
              ? `Caixa: adiantamento de ${percentual(pr.adiantamentoPct, 0)} + saldo no mês seguinte`
              : "Caixa: folha paga no mês"}
          </span>
          <span>
            {pr.riscoPct || pr.lucroPct || pr.tribLucroPct
              ? `Risco ${percentual(pr.riscoPct, 1)} · lucro ${percentual(pr.lucroPct, 1)} · tributos s/ lucro ${percentual(pr.tribLucroPct, 1)}`
              : "Sem risco e lucro"}
          </span>
          <span>VT local {moeda(p0.vtDiaria)} por dia</span>
          <span>
            {reaj
              ? `Reajuste de ${percentual(reaj.pct, 1)} a partir de ${calc.reajustes.map((x) => nomeMes(x.mesIdx)).join(" e ")}${reaj.automatico ? (calc.reajustes.length > 1 ? " (data-base da CCT, composto)" : " (data-base da CCT)") : " (informado)"}`
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
              {modo === "pessoas" && (
                <Segmento
                  rotulo="Barras"
                  opcoes={[
                    { valor: "emp", texto: "Empilhadas" },
                    { valor: "agr", texto: "Agrupadas" },
                  ]}
                  valor={agrupadas ? "agr" : "emp"}
                  onChange={(v) => setAgrupadas(v === "agr")}
                />
              )}
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
            agrupadas={agrupadas && modo === "pessoas"}
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
                return `${fun(k).nome} ${pm == null ? (manual ? "informado" : "fixo/mês") : `${numero(pm, 1)} PM/1.000 m²`}`;
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
              {ids.map((k) => {
                const q = r.obra.equivalente[k] ?? [];
                return (
                  <tr key={k}>
                    <td className={f.forte}>
                      <span className={o.amostra} style={{ background: fun(k).cor }} />
                      {fun(k).nome}
                      <div className="sub">
                        {r.pmPorMilM2[k] == null
                          ? manual
                            ? "informado"
                            : "fixo por mês"
                          : `${numero(r.pmPorMilM2[k]!, 1)} PM/1.000 m²`}
                        {e.regime[k] === "sp" && " · prestador S/P"}
                      </div>
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
              <BotaoCopiar
                // como o protótipo: efetivo, custo por componente e por função, na visão da tela
                tabela={() => [
                  tabelaEfetivo(r.obra, ids, funExp, rotulos, tituloCusto()),
                  tabelaCustoComponente(R, ids, rotulos, V, caixa, tituloCusto()),
                  tabelaCustoFuncao(R, ids, funExp, rotulos, V, tituloCusto()),
                ]}
              />
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
