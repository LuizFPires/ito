import { Link, useSearchParams } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { moeda, numero, percentual } from "@ito/formato";
import { indicadores } from "@ito/motor";
import { useContextoCarga } from "../../dados/carga";
import { useCidades } from "../../dados/cidades";
import type { ItemProjecao } from "../../dados/projecoes";
import {
  consultaCctPrecos,
  consultaReferencias,
  montarPrecos,
  useProjecoes,
} from "../../dados/projecoes";
import type { Calculo } from "../../lib/projecaoDoBanco";
import { calcularProjecao, entradasDaLinha, NOME_SITUACAO } from "../../lib/projecaoDoBanco";
import { Legenda } from "../../ui/BarrasMensais";
import { Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import { Linhas } from "../../ui/Linhas";
import { CORES } from "../comparar/comparar";
import o from "../obra/obra.module.css";
import { Pagina } from "../Pagina";
import { descreverBase, manualValido, MAX_COMPARAR_PROJ } from "./projecoes";
import s from "./projecoes.module.css";

type Linha = [string, (p: ItemProjecao, c: Calculo) => string];

const LINHAS: readonly Linha[] = [
  ["Área (m²)", (p) => numero(Number(p.area_m2))],
  ["Prazo", (p) => `${numero(p.prazo_meses)} meses`],
  ["Base", (p) => descreverBase(p)],
  ["Cidade", (_, c) => c.entrada.cidade?.id ?? "sem cidade"],
  ["Pico de efetivo", (_, c) => `${numero(c.r!.pico)} pessoas`],
  ["Pessoa-mês", (_, c) => numero(c.r!.pessoaMes)],
  ["% mão de obra indireta", (_, c) => percentual(indicadores(c.r!.resultado).indiretaPct, 0)],
  ["HE por pessoa·mês", (_, c) => `${numero(c.r!.aplicadas.heMedia, 1)} h`],
  ["Absenteísmo", (_, c) => percentual(c.r!.aplicadas.absenteismoPct)],
  ["Rotatividade", (_, c) => `${percentual(c.r!.aplicadas.rotatividadePct, 1)} a.m.`],
  [
    "Funções por prestador S/P",
    (p) => {
      const n = Object.values((p.regime ?? {}) as Record<string, string>).filter(
        (v) => v === "sp",
      ).length;
      return n ? numero(n) : "nenhuma";
    },
  ],
  ["Provisões incluídas", (_, c) => moeda(c.r!.resultado.total.prov, 0)],
  ["Custo / pessoa·mês", (_, c) => moeda(c.r!.pessoaMes ? c.r!.total / c.r!.pessoaMes : null, 0)],
  ["Custo total", (_, c) => moeda(c.r!.total, 0)],
  ["Custo / m²", (p, c) => moeda(c.r!.total / Number(p.area_m2), 0)],
  ["Situação", (p) => NOME_SITUACAO[p.situacao]],
];

/** Comparar projeções lado a lado (protótipo `telaCmpProj`), até 4, com os preços vigentes. */
export function CompararProjecoes() {
  const [busca] = useSearchParams();
  const pedidas = [...new Set((busca.get("ids") ?? "").split(",").filter(Boolean))];
  const lista = useProjecoes();
  const contexto = useContextoCarga();
  const cidadesQ = useCidades();
  const ps = pedidas
    .map((id) => lista.data?.find((p) => p.id === id))
    .filter((p): p is ItemProjecao => !!p)
    .slice(0, MAX_COMPARAR_PROJ);
  const cidades = cidadesQ.data ?? [];
  const cctDe = (p: ItemProjecao) => cidades.find((c) => c.id === p.cidade_id)?.cct_id;
  const ccts = useQueries({
    queries: ps.map((p) => ({ ...consultaCctPrecos(cctDe(p) ?? ""), enabled: !!cctDe(p) })),
  });
  const refs = useQueries({
    queries: ps.map((p) => ({
      ...consultaReferencias(p.referencias),
      enabled: p.referencias.length > 0 && !manualValido(p.quantidades_manuais, p.prazo_meses),
    })),
  });
  const ctx = contexto.data;
  const calcs = ps.map((p, i): Calculo | null => {
    if (!ctx || !cidadesQ.data) return null;
    const precos = montarPrecos(
      ctx.tabelas[ctx.vigente],
      cidades,
      p.cidade_id,
      p.cidade_origem_id,
      ccts[i]?.data,
    );
    const manual = manualValido(p.quantidades_manuais, p.prazo_meses);
    const rs = manual || !p.referencias.length ? [] : refs[i]?.data;
    if (!precos || !rs) return null;
    return calcularProjecao(entradasDaLinha(p), rs, precos, ctx.ctx);
  });
  const nomeCidade = new Map(cidades.map((c) => [c.id, `${c.nome}/${c.uf}`]));

  const grupo = (
    <>
      <Link to="/projecoes">Projeções</Link> / Comparar cenários
    </>
  );
  const resumo = `Até ${MAX_COMPARAR_PROJ} projeções lado a lado, todas com os preços vigentes (tabela ${ctx?.vigente ?? ""}) da cidade de cada uma.`;
  if (lista.isLoading)
    return (
      <Pagina grupo={grupo} titulo="Comparar cenários" resumo={resumo} milestone="M7">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Carregando…
          </p>
        </Cartao>
      </Pagina>
    );
  if (ps.length < 2)
    return (
      <Pagina grupo={grupo} titulo="Comparar cenários" resumo={resumo} milestone="M7">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Selecione pelo menos duas projeções na lista.{" "}
            <Link to="/projecoes">Voltar às projeções</Link>
          </p>
        </Cartao>
      </Pagina>
    );

  const prontos = calcs.every((c) => c?.r);
  const maxN = Math.max(...ps.map((p) => p.prazo_meses));
  const marcas = Array.from({ length: maxN }, (_, j) => [j + 1, `mês ${j + 1}`] as const);
  const legenda = ps.map((p, i) => ({ id: p.id, nome: p.nome, cor: CORES[i]! }));
  const pessoas = ps.map((p, i) => ({
    id: p.id,
    nome: p.nome,
    cor: CORES[i]!,
    pontos: (calcs[i]?.r?.totais ?? []).map((t, j) => [j + 1, t] as const),
  }));
  const custo = ps.map((p, i) => {
    let a = 0;
    return {
      id: p.id,
      nome: p.nome,
      cor: CORES[i]!,
      pontos: [
        [0, 0] as const,
        ...(calcs[i]?.r?.resultado.porMes ?? []).map((m, j) => {
          a += m.total;
          return [j + 1, a / 1000] as const;
        }),
      ],
    };
  });
  const base = calcs[0]?.r?.total ?? 0;

  return (
    <Pagina grupo={grupo} titulo="Comparar cenários" resumo={resumo} milestone="M7">
      {pedidas.length > ps.length && (
        <p className="sub" style={{ margin: 0 }} role="note">
          {pedidas.length > MAX_COMPARAR_PROJ
            ? `Mostrando as ${MAX_COMPARAR_PROJ} primeiras projeções escolhidas.`
            : "Alguma projeção escolhida não existe mais e ficou de fora."}
        </p>
      )}
      <Legenda series={legenda} ordem="natural" />
      {!prontos ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Calculando…
          </p>
        </Cartao>
      ) : (
        <>
          <div className={s.grade2}>
            <Cartao aria-label="Pessoas por mês">
              <div
                style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}
              >
                <span className="rotulo">Pessoas por mês</span>
                <Linhas
                  series={pessoas}
                  xMax={maxN}
                  marcasX={marcas}
                  formatarY={(v, c) => numero(v, c)}
                  titulo="Efetivo por mês"
                  pontosVisiveis
                />
              </div>
            </Cartao>
            <Cartao aria-label="Custo acumulado">
              <div
                style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}
              >
                <span className="rotulo">Custo acumulado (R$ mil)</span>
                <Linhas
                  series={custo}
                  xMax={maxN}
                  marcasX={marcas}
                  formatarY={(v, c) => `${numero(v, c)} k`}
                  titulo="Custo acumulado"
                  pontosVisiveis
                />
              </div>
            </Cartao>
          </div>
          <Cartao aria-label="Cenários lado a lado">
            <div className={f.barra}>
              <span className="rotulo">Cenários lado a lado</span>
              <span className="sub">Diferença de custo em relação a “{ps[0]!.nome}”</span>
            </div>
            <div className={o.mensal}>
              <table className={f.tabela} aria-label="Comparação de projeções">
                <thead>
                  <tr>
                    <th>Indicador</th>
                    {ps.map((p, i) => (
                      <th key={p.id} className={f.r}>
                        <span className={s.cor} style={{ background: CORES[i] }} />
                        <Link className={s.nome} to={`/projecoes/${p.id}`}>
                          {p.nome}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LINHAS.map(([nome, fn]) => (
                    <tr key={nome}>
                      <td>{nome}</td>
                      {ps.map((p, i) => (
                        <td key={p.id} className={f.r}>
                          {nome === "Cidade"
                            ? (p.cidade_id && nomeCidade.get(p.cidade_id)) || "sem cidade"
                            : fn(p, calcs[i]!)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Diferença de custo</td>
                    {ps.map((p, i) => {
                      const t = calcs[i]!.r!.total;
                      return (
                        <td key={p.id} className={f.r}>
                          {i === 0
                            ? "referência"
                            : `${t >= base ? "+" : ""}${moeda(t - base, 0)} (${t >= base ? "+" : ""}${percentual(base ? (t / base - 1) * 100 : 0, 1)})`}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Cartao>
        </>
      )}
    </Pagina>
  );
}
