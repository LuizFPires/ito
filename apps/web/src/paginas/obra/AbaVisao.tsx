import { useState } from "react";
import { mesAno, moeda, numero, percentual } from "@ito/formato";
import { anoMes, calendarioMes } from "@ito/motor";
import { diasDoPeriodo } from "../../lib/obraDoBanco";
import { BarraComposicao, BarrasMensais, Legenda } from "../../ui/BarrasMensais";
import { Badge, Botao, Cartao, Segmento } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import type { Aba, DadosAba } from "./comum";
import { componentesVisiveis } from "./comum";
import type { SetVista } from "./controles";
import { ControleEixo, ControleLayout } from "./controles";
import s from "./obra.module.css";

export function AbaVisao({
  dados,
  setVista,
  irPara,
}: {
  dados: DadosAba;
  setVista: SetVista;
  irPara: (a: Aba) => void;
}) {
  const [metrica, setMetrica] = useState<"pessoas" | "custo">("pessoas");
  const { r, ids, fun, rotulos, vista, V, d, obra } = dados;
  const series = ids.map((k) => ({
    id: k,
    nome: fun(k).nome,
    cor: fun(k).cor,
    valores: r.porFuncao[k]!.map((c) => (metrica === "pessoas" ? c.x : V(c) / 1000)),
  }));
  const T = r.total;
  const tt = V(T);
  const comps = componentesVisiveis(vista.caixa);
  const o = d.obra;
  const ini = inicioDe(o.inicio);
  const fim = anoMes(ini, o.meses - 1);
  let ferUteis = 0;
  for (let i = 0; i < o.meses; i++) {
    const m = anoMes(ini, i);
    ferUteis += calendarioMes(
      m.ano,
      m.mes,
      dados.ctx.ctx.calendario,
      obra.feriadosMunicipais ?? [],
    ).feriadosUteis;
  }
  const oficial = dados.ctx.tabelas[o.data_base]?.salarios.ped;
  const nSp = d.regime.filter((x) => x.regime === "sp").length;
  const linhas: [string, string][] = [
    ["Cliente", o.cliente || "Sem cliente"],
    ["Tipologia", o.tipologia || "—"],
    ["Cidade", dados.cidade || "—"],
    ["Área construída", `${numero(Number(o.area_m2))} m²`],
    [
      "Período",
      `${mesAno(ini.ano, ini.mes)} a ${mesAno(fim.ano, fim.mes)} · ${numero(o.meses)} competências`,
    ],
    ["Duração", `${numero(diasDoPeriodo(o.inicio, o.meses))} dias corridos`],
    ["Data-base salarial", `CCT ${o.data_base}${oficial ? ` · oficial ${moeda(oficial)}` : ""}`],
    [
      "Troca de tabela no período",
      d.trocas.length
        ? d.trocas
            .map((t) => {
              const m = anoMes(ini, t.mes_idx);
              return `CCT ${t.data_base} a partir de ${mesAno(m.ano, m.mes)}`;
            })
            .join(" · ")
        : "Não houve",
    ],
    [
      "Feriados em dias úteis",
      `${numero(ferUteis)} no período${d.feriados.length ? ` · ${numero(d.feriados.length)} municipal(is)` : ""}`,
    ],
    [
      "MDO realocada",
      d.realocacoes.length
        ? d.realocacoes
            .map(
              (x) =>
                `${numero(x.qtd)} ${fun(x.funcao_id).nome.toLowerCase()} ${x.tipo === "cedida" ? "cedido(s) a" : "recebido(s) de"} ${x.outra_obra}`,
            )
            .join(" · ")
        : "Nenhuma",
    ],
    [
      "Regime",
      nSp
        ? `${numero(nSp)} função(ões) por prestador S/P, demais CLT`
        : "Todas as funções em folha CLT",
    ],
    ["Provisões", o.provisionar ? "Provisiona férias, 1/3, 13º e GRRF" : "Não provisiona"],
    [
      "Risco + lucro + tributos s/ lucro",
      percentual(Number(o.risco_pct) + Number(o.lucro_pct) + Number(o.trib_lucro_pct)),
    ],
  ];

  return (
    <>
      <Cartao aria-label="Histograma">
        <div className={s.corpo}>
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <span className="rotulo">
              Histograma ·{" "}
              {metrica === "pessoas"
                ? "pessoas por função (equivalente por dias trabalhados)"
                : "custo por função (R$ mil)"}
            </span>
            <span className={f.linha}>
              {metrica === "pessoas" && <ControleLayout vista={vista} setVista={setVista} />}
              <ControleEixo vista={vista} setVista={setVista} />
              <Segmento
                rotulo="Métrica"
                opcoes={[
                  { valor: "pessoas", texto: "Pessoas" },
                  { valor: "custo", texto: "Custo" },
                ]}
                valor={metrica}
                onChange={setMetrica}
              />
            </span>
          </div>
          <Legenda series={series} />
          <BarrasMensais
            rotulos={rotulos}
            series={series}
            agrupadas={metrica === "pessoas" && vista.agrupadas}
            formatar={(v) => (metrica === "pessoas" ? numero(v) : `${numero(v)} k`)}
            titulo={
              metrica === "pessoas"
                ? "Pessoas por função por mês"
                : "Custo por função por mês (R$ mil)"
            }
          />
        </div>
      </Cartao>
      <div className={s.dois}>
        <Cartao aria-label="Composição do custo">
          <div className={s.corpo}>
            <span className="rotulo">Composição do custo{vista.caixa ? " · caixa" : ""}</span>
            <BarraComposicao
              titulo="Composição do custo"
              partes={comps.map((c) => ({ id: c.k, nome: c.n, cor: c.c, valor: T[c.k] }))}
            />
            <table className={`${f.tabela} ${s.dados}`}>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.k}>
                    <td>
                      <span className={s.amostra} style={{ background: c.c }} />
                      {c.n}
                    </td>
                    <td className={`${f.r} ${s.nowrap}`}>{moeda(T[c.k], 0)}</td>
                    <td className={`${f.r} ${s.pct}`}>
                      {percentual(tt ? (T[c.k] / tt) * 100 : 0)}
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total{vista.caixa ? " (caixa)" : ""}</td>
                  <td className={`${f.r} ${s.nowrap}`}>{moeda(tt, 0)}</td>
                  <td className={`${f.r} ${s.pct}`}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Cartao>
        <Cartao aria-label="Dados da obra">
          <div className={s.corpo}>
            <span className="rotulo">Dados da obra</span>
            <table className={`${f.tabela} ${s.dados}`}>
              <tbody>
                {linhas.map(([k, v]) => (
                  <tr key={k}>
                    <td className="sub">{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={f.linha}>
              <Badge tom="ok">● Conferido na carga</Badge>
              <Botao pequeno onClick={() => irPara("prem")}>
                Ver premissas
              </Botao>
            </div>
          </div>
        </Cartao>
      </div>
    </>
  );
}

function inicioDe(iso: string) {
  return { ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) };
}
