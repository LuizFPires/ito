import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { mesAno, moeda, numero, percentual } from "@ito/formato";
import { useFuncoes } from "../../dados/cadastros";
import { useContextoCarga } from "../../dados/carga";
import { carregarObrasBanco, useListaObras } from "../../dados/obras";
import { inicioDe } from "../../lib/obraDoBanco";
import { juntarASelecao, MAX_COMPARAR, useSelecaoObras } from "../../lib/selecao";
import { MENU } from "../../shell/rotas";
import { BarraComposicao, BarrasMensais, Legenda } from "../../ui/BarrasMensais";
import { Botao, Cartao, Segmento } from "../../ui/componentes";
import { SeletorComBusca } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { Linhas } from "../../ui/Linhas";
import { Pagina } from "../Pagina";
import type { Curva, Eixo, ObraComparada } from "./comparar";
import { compararObra, CORES, pontos } from "./comparar";
import s from "./comparar.module.css";

export function TelaComparar() {
  const d = MENU.find((x) => x.caminho === "/comparar")!;
  const navegar = useNavigate();
  const [busca, setBusca] = useSearchParams();
  const [sel, definir] = useSelecaoObras();
  const lista = useListaObras();
  const contexto = useContextoCarga();
  const funcoes = useFuncoes();
  const [curva, setCurva] = useState<Curva>("pessoas");
  const [eixo, setEixo] = useState<Eixo>("mes");

  // link ?obras=a,b: junta à seleção uma vez e sai da URL (voltar no histórico não repete)
  const daUrl = busca.get("obras");
  useEffect(() => {
    if (!daUrl) return;
    juntarASelecao(daUrl.split(",").filter(Boolean));
    setBusca({}, { replace: true });
  }, [daUrl, setBusca]);

  const porId = useMemo(() => new Map((lista.data ?? []).map((o) => [o.id, o])), [lista.data]);
  // só obras que existem na base (obra excluída sai), até 4
  const validas = lista.data ? sel.filter((id) => porId.has(id)) : [];
  const ids = validas.slice(0, MAX_COMPARAR);
  const ctx = contexto.data;
  // uma consulta por obra: incluir ou tirar uma não baixa as outras de novo
  const consultas = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["obras", "banco", id],
      queryFn: async () => (await carregarObrasBanco([id]))[0] ?? null,
    })),
  });
  const carregando = consultas.some((q) => q.isLoading);
  const erro = consultas.some((q) => q.isError) || contexto.isError || lista.isError;
  const obras: ObraComparada[] = !ctx
    ? []
    : consultas
        .map((q) => q.data)
        .filter((b) => !!b)
        .map((b) => compararObra(b!, ctx.ctx, ctx.tabelas, ctx.vigente));

  const opcoes = (lista.data ?? [])
    .filter((o) => !ids.includes(o.id))
    .map((o) => {
      const ini = inicioDe(o.inicio);
      // nome + cliente + início: diferencia obras de nomes iguais
      return {
        valor: o.id,
        texto: `${o.nome} · ${o.cliente || "Sem cliente"} · ${mesAno(ini.ano, ini.mes)}`,
      };
    });
  const vigente = ctx?.vigente;
  const nomeFuncao = new Map((funcoes.data ?? []).map((x) => [x.id, x]));

  const histograma = curva === "pessoas" && eixo === "mes";
  const series = obras.map((o, i) => ({
    id: o.id,
    nome: o.nome,
    cor: CORES[i]!,
    pontos: pontos(o, curva, eixo),
  }));
  const maxMeses = Math.max(1, ...obras.map((o) => o.meses));
  const marcasX: [number, string][] =
    eixo === "prazo"
      ? [
          [0, "0%"],
          [25, "25%"],
          [50, "50%"],
          [75, "75%"],
          [100, "100% do prazo"],
        ]
      : Array.from({ length: maxMeses }, (_, j) => j + 1)
          .filter((m) => maxMeses <= 12 || m % Math.ceil(maxMeses / 12) === 1)
          .map((m) => [m, `M${m}`]);
  const meses = Array.from({ length: maxMeses }, (_, j) => `M${j + 1}`);
  const xsDados = eixo === "mes" ? meses.map((_, j) => j + 1) : [0, 25, 50, 75, 100];

  const linhas: [string, (o: ObraComparada) => string][] = [
    ["Área (m²)", (o) => numero(o.area)],
    ["Duração", (o) => `${numero(o.dias)} dias · ${numero(o.meses)} meses`],
    ["Data-base", (o) => `CCT ${o.dataBase}`],
    ["Pico de efetivo", (o) => `${numero(o.ind.pico, 1)} pessoas`],
    ["Pessoa-mês / 1.000 m²", (o) => numero(o.ind.pmPorMil, 1)],
    ["% mão de obra indireta", (o) => percentual(o.ind.indiretaPct, 0)],
    ["HE média (h/pessoa·mês)", (o) => numero(o.ind.heMedia, 1)],
    ["Absenteísmo médio", (o) => percentual(o.ind.absenteismoPct)],
    ["Rotatividade", (o) => `${percentual(o.ind.rotatividadePct, 0)} a.m.`],
    ["Encargos sobre a remuneração", (o) => percentual(o.ind.encargosPct)],
    ["Benefícios sobre a remuneração", (o) => percentual(o.ind.beneficiosPct)],
    [`Custo a valores de ${vigente ?? ""}`, (o) => moeda(o.ind.custo, 0)],
    ["Custo / m²", (o) => moeda(o.ind.custoM2, 0)],
    ["R$ por dia · todas as funções", (o) => moeda(o.ind.diaObra)],
    ["R$ por dia · pedreiro", (o) => (o.ind.diaPedreiro === null ? "–" : moeda(o.ind.diaPedreiro))],
  ];

  return (
    <Pagina
      grupo={d.grupo}
      titulo={d.nome}
      resumo="De 2 a 4 obras lado a lado, alinhadas por mês relativo e a valores vigentes."
      milestone={d.milestone}
    >
      <Cartao aria-label="Obras comparadas">
        <div className={f.barra}>
          <span className="rotulo">
            Obras na comparação ({numero(ids.length)} de {MAX_COMPARAR})
          </span>
          <div className={s.escolhidas}>
            {ids.map((id, i) => (
              <span key={id} className={f.tag}>
                <i className={s.cor} style={{ background: CORES[i] }} />
                <Link to={`/obras/${id}`} className={s.nome}>
                  {porId.get(id)?.nome ?? id}
                </Link>
                <button
                  type="button"
                  aria-label={`Tirar ${porId.get(id)?.nome ?? id} da comparação`}
                  onClick={() => definir(sel.filter((x) => x !== id))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {ids.length < MAX_COMPARAR ? (
            <SeletorComBusca
              rotulo="Incluir obra na comparação"
              placeholder="Incluir obra (digite e escolha)"
              opcoes={opcoes}
              confirmar
              onEscolher={(id) => definir([...ids, id])}
            />
          ) : (
            <span className="sub">Até {MAX_COMPARAR} obras: tire uma para trocar.</span>
          )}
          {ids.length >= 2 && (
            <Botao
              pequeno
              variante="primario"
              onClick={() => navegar(`/projecoes?refs=${ids.join(",")}`)}
            >
              Projetar com estas →
            </Botao>
          )}
        </div>
        {validas.length > MAX_COMPARAR && (
          <p className="sub" style={{ padding: "0 22px 14px", margin: 0 }}>
            A seleção tem {numero(validas.length)} obras; a comparação mostra as {MAX_COMPARAR}{" "}
            primeiras.
          </p>
        )}
      </Cartao>

      {erro ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            Não foi possível carregar as obras. Atualize a página.
          </p>
        </Cartao>
      ) : lista.isLoading || (ids.length >= 2 && (carregando || !ctx)) ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Carregando…
          </p>
        </Cartao>
      ) : obras.length < 2 ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Escolha pelo menos duas obras para comparar (até quatro ao mesmo tempo): aqui, ou
            selecionando na{" "}
            <Link className={f.linkAcao} to="/base">
              base histórica
            </Link>
            .
          </p>
        </Cartao>
      ) : (
        <>
          <Cartao aria-label="Curvas das obras">
            <div className={s.corpo}>
              <div className={f.linha} style={{ justifyContent: "space-between" }}>
                <h2 className="rotulo" style={{ margin: 0 }}>
                  {curva === "pessoas"
                    ? histograma
                      ? "Histograma · pessoas por 1.000 m², mês a mês"
                      : "Pessoas por 1.000 m² ao longo do prazo"
                    : "Custo acumulado (curva S), a valores vigentes"}
                </h2>
                <span className={f.linha}>
                  <Segmento
                    rotulo="Curva"
                    opcoes={[
                      { valor: "pessoas", texto: "Efetivo" },
                      { valor: "custo", texto: "Curva S de custo" },
                    ]}
                    valor={curva}
                    onChange={setCurva}
                  />
                  <Segmento
                    rotulo="Eixo"
                    opcoes={[
                      { valor: "mes", texto: "Mês relativo" },
                      { valor: "prazo", texto: "% do prazo" },
                    ]}
                    valor={eixo}
                    onChange={setEixo}
                  />
                </span>
              </div>
              <Legenda series={series} ordem="natural" />
              {histograma ? (
                <BarrasMensais
                  rotulos={meses}
                  series={obras.map((o, i) => ({
                    id: o.id,
                    nome: o.nome,
                    cor: CORES[i]!,
                    valores: o.totais.map((t) => (o.area ? (t / o.area) * 1000 : 0)),
                  }))}
                  agrupadas
                  formatar={(v) => numero(v, v < 10 ? 1 : 0)}
                  titulo="Histograma de pessoas por 1.000 m² por mês relativo"
                />
              ) : (
                <Linhas
                  series={series}
                  xMax={eixo === "prazo" ? 100 : maxMeses}
                  marcasX={marcasX}
                  formatarY={(v, casas) =>
                    curva === "pessoas" ? numero(v, casas) : `${numero(v, casas)}%`
                  }
                  titulo={
                    curva === "pessoas"
                      ? "Pessoas por 1.000 m² ao longo do prazo"
                      : "Curva S de custo"
                  }
                  pontosVisiveis={curva === "custo"}
                />
              )}
              <p className="sub" style={{ margin: 0 }}>
                {eixo === "mes"
                  ? "Mês relativo: o 1º mês de cada obra fica no M1, para comparar o ritmo de obras que começaram em datas diferentes."
                  : "O prazo de cada obra vai de 0 a 100% para obras de durações diferentes ficarem na mesma régua. É a mesma normalização que a projeção usa."}
              </p>
              <details>
                <summary className="sub">Ver dados do gráfico</summary>
                <table className={f.tabela} aria-label="Dados do gráfico">
                  <thead>
                    <tr>
                      <th>Obra</th>
                      {xsDados.map((x) => (
                        <th key={x} className={f.r}>
                          {eixo === "mes" ? `M${x}` : `${x}%`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {obras.map((o) => {
                      const p = pontos(o, curva, eixo);
                      // valor no ponto mais próximo à esquerda
                      const valorEm = (x: number) => {
                        const antes = p.filter(([a]) => a <= x + 1e-9);
                        return antes.length ? antes[antes.length - 1]![1] : 0;
                      };
                      return (
                        <tr key={o.id}>
                          <td>{o.nome}</td>
                          {xsDados.map((x) => (
                            <td key={x} className={f.r}>
                              {eixo === "mes" && x > o.meses
                                ? "–"
                                : curva === "pessoas"
                                  ? numero(valorEm(x), 1)
                                  : percentual(valorEm(x), 0)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </div>
          </Cartao>

          <Cartao aria-label="Mix de funções">
            <div className={s.corpo}>
              <h2 className="rotulo" style={{ margin: 0 }}>
                Mix de funções · % das pessoa-mês
              </h2>
              {obras.map((o, i) => {
                const total = Object.values(o.pmPorFuncao).reduce((a, x) => a + x, 0);
                const partes = Object.entries(o.pmPorFuncao)
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => ({
                    id: k,
                    nome: nomeFuncao.get(k)?.nome ?? k,
                    cor: `var(--${nomeFuncao.get(k)?.cor ?? "i4"})`,
                    valor: v,
                  }));
                return (
                  <div key={o.id} className={s.mix}>
                    <span className={s.mixNome}>
                      <i className={s.cor} style={{ background: CORES[i] }} />
                      {o.nome}
                    </span>
                    <BarraComposicao titulo={`Mix de funções de ${o.nome}`} partes={partes} />
                    <span className="sub">
                      {partes
                        .slice(0, 4)
                        .map(
                          (p) => `${p.nome} ${percentual(total ? (p.valor / total) * 100 : 0, 0)}`,
                        )
                        .join(" · ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </Cartao>

          <Cartao aria-label="Indicadores lado a lado">
            <div className={f.barra}>
              <h2 className="rotulo" style={{ margin: 0 }}>
                Indicadores lado a lado
              </h2>
              <span className="sub">custos a valores de {vigente}</span>
            </div>
            <table className={f.tabela} aria-label="Indicadores">
              <thead>
                <tr>
                  <th>Indicador</th>
                  {obras.map((o, i) => (
                    <th key={o.id} className={f.r}>
                      <i className={s.cor} style={{ background: CORES[i] }} />
                      {o.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(([rotulo, valor]) => (
                  <tr key={rotulo}>
                    <td>{rotulo}</td>
                    {obras.map((o) => (
                      <td key={o.id} className={`${f.r} ${f.forte}`}>
                        {valor(o)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        </>
      )}
    </Pagina>
  );
}
