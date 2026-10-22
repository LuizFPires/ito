import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router";
import { data, mesAno, moeda, numero, percentual } from "@ito/formato";
import { indicadores, PREMISSAS_PADRAO, somar } from "@ito/motor";
import { nomeCurtoCct } from "../../dados/cidades";
import { usePrecos, useProjecao, useReferencias } from "../../dados/projecoes";
import {
  calcularProjecao,
  cenarios,
  entradasDaLinha,
  NOME_SITUACAO,
} from "../../lib/projecaoDoBanco";
import { BarrasMensais, Legenda } from "../../ui/BarrasMensais";
import { Botao } from "../../ui/componentes";
import { NOME_GRUPO_F, soma } from "../obra/comum";
import { useInfoFuncoes } from "./funcoes";
import { textoReajustes } from "./exportar";
import { manualValido, rotulosMeses } from "./projecoes";
import s from "./imprimir.module.css";

const NOME_CENARIO = {
  planejado: "Como planejado",
  local: "Toda a mão de obra local",
  diaria: "Toda vindo de fora todo dia",
  aloj: "Toda alojada",
} as const;

/**
 * Resumo da projeção para a diretoria (M8): uma página A4 para imprimir ou salvar em PDF pelo
 * navegador. Fora do shell (sem menu); sempre no tema claro enquanto aberta.
 */
export function ImprimirProjecao() {
  const { id } = useParams();
  const q = useProjecao(id);
  const p = q.data;
  const e = useMemo(() => (p ? entradasDaLinha(p) : null), [p]);
  const { contexto, cct, precos, erro } = usePrecos(e?.cidadeId ?? null, e?.cidadeOrigemId ?? null);
  const refsQ = useReferencias(e?.referencias ?? []);
  const { fun, ordenarFuncoes } = useInfoFuncoes(contexto?.ctx);
  const manual = e ? manualValido(e.quantidadesManuais, e.prazo) : false;
  const refs = useMemo(
    () => (refsQ.data ?? []).filter((b) => e?.referencias.includes(b.obra.id)),
    [refsQ.data, e],
  );
  const prontas = !e?.referencias.length || manual || (!!refsQ.data && !refsQ.isPlaceholderData);
  const calc = useMemo(
    () =>
      e && precos && contexto && prontas ? calcularProjecao(e, refs, precos, contexto.ctx) : null,
    [e, refs, precos, contexto, prontas],
  );
  const cen = useMemo(
    () => (calc && contexto && precos?.cidade ? cenarios(calc, contexto.ctx) : []),
    [calc, contexto, precos],
  );

  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.getAttribute("data-theme");
    raiz.setAttribute("data-theme", "light");
    return () => {
      if (antes === null) raiz.removeAttribute("data-theme");
      else raiz.setAttribute("data-theme", antes);
    };
  }, []);
  useEffect(() => {
    if (p) document.title = `${p.nome} · resumo · ITO`;
  }, [p]);

  if (q.isError || erro || refsQ.isError)
    return (
      <p className={s.aviso} role="alert">
        Não foi possível carregar a projeção. Atualize a página.{" "}
        <Link to={p ? `/projecoes/${p.id}` : "/projecoes"}>Voltar</Link>
      </p>
    );
  if (q.isLoading || (p && !calc)) return <p className={s.aviso}>Preparando o resumo…</p>;
  if (!p || !e || !calc?.r || !contexto)
    return (
      <p className={s.aviso} role="alert">
        {p
          ? "Não foi possível calcular esta projeção."
          : "Esta projeção não existe ou foi apagada."}{" "}
        <Link to={p ? `/projecoes/${p.id}` : "/projecoes"}>Voltar</Link>
      </p>
    );

  const r = calc.r;
  const R = r.resultado;
  const ids = ordenarFuncoes(R.funcoes);
  const rotulos = rotulosMeses(e.inicio, e.prazo);
  const ind = indicadores(R);
  const pr = { ...PREMISSAS_PADRAO, ...e.premissas };
  const a = r.aplicadas;
  const gt = soma(Object.values(R.porGrupo)) || 1;
  const custoMes = R.porMes.map((m) => m.total);
  // até 12 linhas para caber numa página: meses agrupados em trimestres, semestres… se preciso
  const passo = Math.max(1, Math.ceil(e.prazo / 12));
  const periodos = Array.from({ length: Math.ceil(e.prazo / passo) }, (_, j) => {
    const de = j * passo;
    const ate = Math.min(e.prazo, de + passo) - 1;
    return {
      nome: de === ate ? rotulos[de]! : `${rotulos[de]} a ${rotulos[ate]}`,
      pessoas: Math.max(...r.totais.slice(de, ate + 1)),
      custo: soma(custoMes.slice(de, ate + 1)),
      acumulado: soma(custoMes.slice(0, ate + 1)),
    };
  });
  const pedreiro = somar(R.porFuncao.ped ?? []);
  const series = ids.map((k) => ({
    id: k,
    nome: fun(k).nome,
    cor: fun(k).cor,
    valores: r.obra.equivalente[k] ?? [],
  }));
  const base = manual
    ? "quantidades informadas"
    : `${refs.map((b) => b.obra.nome).join(", ") || "sem referências"} (${e.estatistica === "mediana" ? "mediana" : "média"})`;

  return (
    <div className={s.pagina}>
      <div className={s.acoes}>
        <Link to={`/projecoes/${p.id}`}>← Voltar à projeção</Link>
        <Botao variante="primario" onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </Botao>
      </div>

      <header className={s.cabeca}>
        <div className={s.marca}>
          <span aria-hidden className={s.i}>
            I
          </span>
          <span className={s.ito}>ITO</span>
          <span className={s.tipo}>Resumo da projeção para a diretoria</span>
        </div>
        <h1>{p.nome}</h1>
        <p>
          {[
            p.cliente || "Sem cliente",
            p.tipologia,
            precos?.cidade?.nome,
            `${numero(e.area)} m²`,
            `${numero(e.prazo)} meses a partir de ${mesAno(e.inicio.ano, e.inicio.mes)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className={s.sub}>
          Situação: {NOME_SITUACAO[p.situacao]} · Preços de {contexto.vigente}
          {cct ? ` · ${nomeCurtoCct(cct.nome)}` : ""} · Base: {base} · Emitido em {data(new Date())}
        </p>
      </header>

      <section className={s.kpis} aria-label="Indicadores">
        <div>
          <span>Custo total</span>
          <strong>{moeda(r.total, 0)}</strong>
          <small>inclui {moeda(R.total.prov, 0)} de provisões</small>
        </div>
        <div>
          <span>Custo / m²</span>
          <strong>{moeda(r.total / e.area, 0)}</strong>
          <small>sobre {numero(e.area)} m²</small>
        </div>
        <div>
          <span>Pico de efetivo</span>
          <strong>{numero(r.pico)} pessoas</strong>
          <small>
            {numero(r.pessoaMes, 1)} pessoa-mês · {percentual(ind.indiretaPct, 0)} indireta
          </small>
        </div>
        <div>
          <span>R$ por dia · pedreiro</span>
          <strong>{moeda(pedreiro.dias ? pedreiro.total / pedreiro.dias : null, 0)}</strong>
          <small>todas as funções {moeda(ind.porDiaComTaxa, 0)}</small>
        </div>
      </section>

      <section className={s.bloco}>
        <h2>Histograma projetado · pessoas por função</h2>
        <Legenda series={series} />
        <BarrasMensais
          rotulos={rotulos}
          series={series}
          formatar={(v) => numero(v)}
          titulo="Histograma projetado"
          altura={200}
        />
      </section>

      <div className={s.duas}>
        <section className={s.bloco}>
          <h2>Custo por mês</h2>
          <table className={s.tabela}>
            <thead>
              <tr>
                <th>{passo > 1 ? "Período" : "Mês"}</th>
                <th>{passo > 1 ? "Pico" : "Pessoas"}</th>
                <th>Custo</th>
                <th>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map((x) => (
                <tr key={x.nome}>
                  <td>{x.nome}</td>
                  <td>{numero(x.pessoas)}</td>
                  <td>{moeda(x.custo, 0)}</td>
                  <td>{percentual(r.total ? (x.acumulado / r.total) * 100 : 0, 0)}</td>
                </tr>
              ))}
              <tr className={s.total}>
                <td>Total</td>
                <td>{numero(r.pessoaMes, 1)} PM</td>
                <td>{moeda(r.total, 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </section>

        <section className={s.bloco}>
          <h2>Custo por função</h2>
          <table className={s.tabela}>
            <thead>
              <tr>
                <th>Função</th>
                <th>Pessoa-mês</th>
                <th>Custo</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((k) => {
                const l = R.porFuncao[k]!;
                const t = soma(l.map((c) => c.total));
                return (
                  <tr key={k}>
                    <td>
                      {fun(k).nome}
                      {e.regime[k] === "sp" ? " (S/P)" : ""}
                    </td>
                    <td>{numero(soma(l.map((c) => c.x)), 1)}</td>
                    <td>{moeda(t, 0)}</td>
                    <td>{percentual(r.total ? (t / r.total) * 100 : 0, 0)}</td>
                  </tr>
                );
              })}
              {(["direta", "indireta", "adm"] as const).map((g) => (
                <tr key={g} className={s.grupo}>
                  <td>Mão de obra {NOME_GRUPO_F[g].toLowerCase()}</td>
                  <td />
                  <td>{moeda(R.porGrupo[g], 0)}</td>
                  <td>{percentual((R.porGrupo[g] / gt) * 100, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className={s.duas}>
        <section className={s.bloco}>
          <h2>Premissas aplicadas</h2>
          <ul className={s.lista}>
            <li>Horas extras: {numero(a.heMedia, 1)} h por pessoa·mês</li>
            <li>
              Absenteísmo {percentual(a.absenteismoPct)} · rotatividade{" "}
              {percentual(a.rotatividadePct, 1)} a.m.
            </li>
            <li>
              Licenças {numero(a.licencaPorPm, 2)} e férias {numero(a.feriasPorPm, 2)} dias por
              pessoa·mês
            </li>
            <li>Gratificações e prêmios {percentual(pr.gratPremiosPct, 1)}</li>
            <li>{textoReajustes(calc.reajustes, rotulos)}</li>
            <li>{pr.provisionar ? "Com provisões de férias, 1/3, 13º e GRRF" : "Sem provisões"}</li>
            {(pr.riscoPct > 0 || pr.lucroPct > 0 || pr.tribLucroPct > 0) && (
              <li>
                Risco {percentual(pr.riscoPct, 1)} · lucro {percentual(pr.lucroPct, 1)} · tributos
                s/ lucro {percentual(pr.tribLucroPct, 1)}
              </li>
            )}
          </ul>
        </section>

        {cen.length > 0 && (
          <section className={s.bloco}>
            <h2>Quanto custa trazer gente de fora</h2>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Cenário</th>
                  <th>Custo total</th>
                  <th>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {cen.map((c, j) => {
                  const d = c.total - cen[0]!.total;
                  return (
                    <tr key={c.nome}>
                      <td>
                        {c.nome === "diaria" && precos?.cidadeOrigem
                          ? `Toda vindo de ${precos.cidadeOrigem.nome} todo dia`
                          : NOME_CENARIO[c.nome]}
                      </td>
                      <td>{moeda(c.total, 0)}</td>
                      <td>{j === 0 ? "–" : `${d >= 0 ? "+" : ""}${moeda(d, 0)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <footer className={s.rodape}>
        ITO · quantidades do histórico de mão de obra, preços da cidade da obra (CCT, VT, ISS) e da
        tabela da empresa {contexto.vigente}. Valores em competência.
      </footer>
    </div>
  );
}
