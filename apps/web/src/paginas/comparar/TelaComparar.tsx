import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { moeda, numero, percentual } from "@ito/formato";
import { useContextoCarga } from "../../dados/carga";
import { carregarObrasBanco, useListaObras } from "../../dados/obras";
import { juntarASelecao, MAX_COMPARAR, useSelecaoObras } from "../../lib/selecao";
import { MENU } from "../../shell/rotas";
import { Cartao, Segmento } from "../../ui/componentes";
import { SeletorComBusca } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { Legenda } from "../../ui/BarrasMensais";
import { Linhas } from "../../ui/Linhas";
import { Pagina } from "../Pagina";
import type { Curva, Eixo, ObraComparada } from "./comparar";
import { compararObra, CORES, pontos } from "./comparar";
import s from "./comparar.module.css";

export function TelaComparar() {
  const d = MENU.find((x) => x.caminho === "/comparar")!;
  const [busca] = useSearchParams();
  const [sel, definir] = useSelecaoObras();
  const lista = useListaObras();
  const contexto = useContextoCarga();
  const [curva, setCurva] = useState<Curva>("pessoas");
  const [eixo, setEixo] = useState<Eixo>("mes");

  // link antigo ?obras=a,b: junta à seleção (uma vez)
  const daUrl = busca.get("obras");
  useEffect(() => {
    if (daUrl) juntarASelecao(daUrl.split(",").filter(Boolean));
  }, [daUrl]);

  const nomes = useMemo(() => new Map((lista.data ?? []).map((o) => [o.id, o.nome])), [lista.data]);
  // só obras que existem na base, até 4
  const ids = sel.filter((id) => !lista.data || nomes.has(id)).slice(0, MAX_COMPARAR);
  const ctx = contexto.data;
  const chaveIds = ids.join(",");
  const obrasQ = useQuery({
    queryKey: ["obras", "comparar", chaveIds],
    enabled: ids.length >= 2,
    queryFn: () => carregarObrasBanco(ids),
  });
  // até 4 obras: o motor recalcula a cada render em poucos milissegundos
  const por = new Map((obrasQ.data ?? []).map((b) => [b.obra.id, b]));
  const obras: ObraComparada[] = !ctx
    ? []
    : ids
        .map((id) => por.get(id))
        .filter((b) => !!b)
        .map((b) => compararObra(b!, ctx.ctx, ctx.tabelas, ctx.vigente));

  const remover = (id: string) => definir(sel.filter((x) => x !== id));
  const opcoes = (lista.data ?? [])
    .filter((o) => !ids.includes(o.id))
    .map((o) => ({ valor: o.id, texto: o.nome }));
  const vigente = ctx?.vigente;

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
          <span className="rotulo">Obras comparadas</span>
          <div className={s.escolhidas}>
            {ids.map((id, i) => (
              <span key={id} className={f.tag}>
                <i className={s.cor} style={{ background: CORES[i] }} />
                <Link to={`/obras/${id}`} className={s.nome}>
                  {nomes.get(id) ?? id}
                </Link>
                <button
                  type="button"
                  aria-label={`Tirar ${nomes.get(id) ?? id} da comparação`}
                  onClick={() => remover(id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {ids.length < MAX_COMPARAR && (
            <SeletorComBusca
              rotulo="Incluir obra na comparação"
              placeholder="Incluir obra (digite para buscar)"
              opcoes={opcoes}
              onEscolher={(id) => definir([...ids, id])}
            />
          )}
        </div>
        {sel.length > MAX_COMPARAR && (
          <p className="sub" style={{ padding: "0 22px 14px", margin: 0 }}>
            A seleção tem {numero(sel.length)} obras; a comparação mostra as {MAX_COMPARAR}{" "}
            primeiras.
          </p>
        )}
      </Cartao>

      {ids.length < 2 ? (
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
      ) : obrasQ.isError || contexto.isError ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            Não foi possível carregar as obras. Atualize a página.
          </p>
        </Cartao>
      ) : !obras.length ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Carregando…
          </p>
        </Cartao>
      ) : (
        <>
          <Cartao aria-label="Curvas das obras">
            <div className={s.corpo}>
              <div className={f.linha} style={{ justifyContent: "space-between" }}>
                <span className="rotulo">
                  {curva === "pessoas"
                    ? "Pessoas por 1.000 m² ao longo da obra"
                    : "Custo acumulado (curva S), a valores vigentes"}
                </span>
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
              <Legenda series={[...series].reverse()} />
              <Linhas
                series={series}
                xMax={eixo === "prazo" ? 100 : maxMeses}
                marcasX={marcasX}
                formatarY={(v) => (curva === "pessoas" ? numero(v, 1) : `${numero(v)}%`)}
                titulo={curva === "pessoas" ? "Pessoas por 1.000 m² por mês" : "Curva S de custo"}
                pontosVisiveis={curva === "custo"}
              />
              <p className="sub" style={{ margin: 0 }}>
                {eixo === "mes"
                  ? "Mês relativo: o 1º mês de cada obra fica no M1, para comparar o ritmo de obras que começaram em datas diferentes."
                  : "O prazo de cada obra vai de 0 a 100% para obras de durações diferentes ficarem na mesma régua. É a mesma normalização que a projeção usa."}
              </p>
            </div>
          </Cartao>

          <Cartao aria-label="Indicadores lado a lado">
            <div className={f.barra}>
              <span className="rotulo">Indicadores lado a lado</span>
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
