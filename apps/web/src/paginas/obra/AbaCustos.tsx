import { useState } from "react";
import { moeda, numero, percentual } from "@ito/formato";
import { somar, taxasEncargos, tabelaDoMes } from "@ito/motor";
import { parametrosDe } from "../../lib/obraDoBanco";
import { BarrasMensais, Legenda } from "../../ui/BarrasMensais";
import { Badge, Cartao, Segmento } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import type { DadosAba } from "./comum";
import {
  COMPONENTES,
  componentesVisiveis,
  NOME_GRUPO_F,
  notaVisao,
  ORDEM_GRUPOS,
  soma,
} from "./comum";
import type { SetVista } from "./controles";
import { ControleEixo, ControleGrupo } from "./controles";
import s from "./obra.module.css";

export function AbaCustos({ dados, setVista }: { dados: DadosAba; setVista: SetVista }) {
  const [porComp, setPorComp] = useState(false);
  const { r, ids, fun, rotulos, vista, V, d, ctx } = dados;
  const n = rotulos.length;
  const comps = componentesVisiveis(vista.caixa);
  // componentes do filtro de grupo, mês a mês
  const M = rotulos.map((_, i) => somar(ids.map((k) => r.porFuncao[k]![i]!)));
  const series = porComp
    ? comps.map((c) => ({
        id: c.k,
        nome: c.n.replace(/ \(.*\)$/, ""),
        cor: c.c,
        valores: M.map((m) => m[c.k] / 1000),
      }))
    : ids.map((k) => ({
        id: k,
        nome: fun(k).nome,
        cor: fun(k).cor,
        valores: r.porFuncao[k]!.map((c) => V(c) / 1000),
      }));
  const p0 = tabelaDoMes(parametrosDe(d, ctx.tabelas, ctx.vigente, vista.visao), 0);
  const tx = taxasEncargos(p0.encargos);
  const descricao: Partial<Record<(typeof COMPONENTES)[number]["k"], string>> = {
    salv: "pessoas × salário − faltas (com perda do DSR) − licenças e férias",
    extras:
      "gratificações, periculosidade, insalubridade (s/ mínimo), noturno + DSR, transferência",
    he: `horas por tipo × (salário ÷ ${numero(p0.divisor)}) × (1 + adicional do tipo)`,
    dsr:
      p0.modoDias === "calendario"
        ? "repousos ÷ dias úteis de cada mês (calendário)"
        : `${percentual(p0.dsrFixoPct, 0)} sobre o valor das HE`,
    enc: `${percentual(tx.soc.clt * 100)} da folha (inclui incidência s/ férias e 13º)`,
    prov: `${percentual(tx.prov.clt * 100)} sobre a remuneração`,
    vt: `${moeda(p0.vtDiaria)} × ${p0.modoDias === "calendario" ? "dias úteis do mês" : `${numero(p0.diasFixos)} dias`} − 6% do salário`,
    benef: "catálogo de benefícios por pessoa",
    exames: "admissional, periódico (1/12 ao mês) e demissional",
    resc: `${numero(p0.fatorRescisao * 100)}% do salário por desligamento`,
    ferr: "depreciação de ferramentas do trabalhador, sem encargos",
    nf: "só funções de prestadores (S/P)",
    rl: "premissas da obra",
  };
  const tot = soma(M.map(V));
  const acumulado = M.map((_, i) => soma(M.slice(0, i + 1).map(V)));

  return (
    <>
      <Cartao aria-label="Custo mensal">
        <div className={s.corpo}>
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <span className="rotulo">
              {porComp
                ? "Custo mensal por componente (R$ mil)"
                : "Custo mensal por função (R$ mil)"}
            </span>
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
              <ControleGrupo vista={vista} setVista={setVista} />
              <ControleEixo vista={vista} setVista={setVista} />
            </span>
          </div>
          <Legenda series={series} />
          <BarrasMensais
            rotulos={rotulos}
            series={series}
            formatar={(v) => `${numero(v)} k`}
            titulo={porComp ? "Custo por componente por mês" : "Custo por função por mês"}
          />
        </div>
      </Cartao>
      <Cartao aria-label={porComp ? "Custo por componente e mês" : "Custo por função e mês"}>
        <div className={f.barra}>
          <span className="rotulo">
            {porComp ? "Custo por componente e mês" : "Custo por função e mês"}
          </span>
          <Badge tom="ambar">
            {vista.visao === "epoca"
              ? `CCT ${d.obra.data_base} · como foi pago`
              : `Preços de ${ctx.vigente}`}
          </Badge>
        </div>
        <div className={s.mensal}>
          <table className={f.tabela} aria-label="Custos">
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
            {porComp ? (
              <tbody>
                {COMPONENTES.map((c) => {
                  const fora = vista.caixa && c.k === "prov";
                  return (
                    <tr key={c.k} className={fora ? s.discreta : undefined}>
                      <td className={f.forte}>
                        <span className={s.amostra} style={{ background: c.c }} />
                        {c.n}
                        <div className="sub">{fora ? "fora da visão caixa" : descricao[c.k]}</div>
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
                })}
                <tr className="total">
                  <td>Total do mês</td>
                  {M.map((m, i) => (
                    <td key={i} className={f.r}>
                      {moeda(V(m), 0)}
                    </td>
                  ))}
                  <td className={f.r}>{moeda(tot, 0)}</td>
                </tr>
                <tr>
                  <td>Acumulado</td>
                  {acumulado.map((a, i) => (
                    <td key={i} className={f.r}>
                      {percentual(tot ? (a / tot) * 100 : 0, 0)}
                    </td>
                  ))}
                  <td />
                </tr>
                <tr>
                  <td>Custo por pessoa-mês</td>
                  {M.map((m, i) => (
                    <td key={i} className={f.r}>
                      {moeda(m.x ? V(m) / m.x : 0, 0)}
                    </td>
                  ))}
                  <td className={f.r}>
                    <strong>
                      {moeda(soma(M.map((m) => m.x)) ? tot / soma(M.map((m) => m.x)) : 0, 0)}
                    </strong>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {ORDEM_GRUPOS.map((g) => {
                  const gk = ids.filter((k) => fun(k).grupo === g);
                  if (!gk.length) return null;
                  return [
                    <tr key={`g-${g}`} className={s.grupoLinha}>
                      <td colSpan={n + 2}>Mão de obra {NOME_GRUPO_F[g].toLowerCase()}</td>
                    </tr>,
                    ...gk.map((k) => {
                      const linha = r.porFuncao[k]!;
                      const t = soma(linha.map(V));
                      const pm = soma(linha.map((c) => c.x));
                      return (
                        <tr key={k}>
                          <td className={f.forte}>
                            <span className={s.amostra} style={{ background: fun(k).cor }} />
                            {fun(k).nome}
                            <div className="sub">
                              {moeda(linha[0]!.salario)} salário ·{" "}
                              {linha[0]!.regime === "sp"
                                ? "prestador S/P"
                                : linha[0]!.regime === "estagio"
                                  ? "estágio"
                                  : "folha CLT"}
                            </div>
                          </td>
                          {linha.map((c, i) => (
                            <td key={i} className={f.r}>
                              {c.x ? (
                                <>
                                  <strong>{moeda(V(c), 0)}</strong>
                                  <div className={`sub ${s.nowrap}`}>
                                    {numero(c.x, 1)} × {moeda(V(c) / c.x, 0)}
                                  </div>
                                </>
                              ) : (
                                <span className="sub">–</span>
                              )}
                            </td>
                          ))}
                          <td className={f.r}>
                            <strong>{moeda(t, 0)}</strong>
                            <div className={`sub ${s.nowrap}`}>
                              {numero(pm, 1)} PM × {moeda(pm ? t / pm : 0, 0)}
                            </div>
                          </td>
                        </tr>
                      );
                    }),
                    vista.grupo === "todas" && (
                      <tr key={`s-${g}`} className={s.subtotal}>
                        <td>Subtotal {NOME_GRUPO_F[g].toLowerCase()}</td>
                        {rotulos.map((_, i) => (
                          <td key={i} className={f.r}>
                            {moeda(soma(gk.map((k) => V(r.porFuncao[k]![i]!))), 0)}
                          </td>
                        ))}
                        <td className={f.r}>
                          {moeda(soma(gk.flatMap((k) => r.porFuncao[k]!.map(V))), 0)}
                        </td>
                      </tr>
                    ),
                  ];
                })}
                <tr className="total">
                  <td>Total do mês</td>
                  {M.map((m, i) => (
                    <td key={i} className={f.r}>
                      {moeda(V(m), 0)}
                      <div className="sub">{numero(m.x, 1)} PM</div>
                    </td>
                  ))}
                  <td className={f.r}>
                    {moeda(tot, 0)}
                    <div className={`sub ${s.nowrap}`}>
                      {numero(soma(M.map((m) => m.x)), 1)} PM ×{" "}
                      {moeda(soma(M.map((m) => m.x)) ? tot / soma(M.map((m) => m.x)) : 0, 0)}
                    </div>
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
        <p className="sub" style={{ padding: "12px 22px 18px", margin: 0 }}>
          {porComp
            ? ""
            : "Cada célula: custo total da função no mês e, abaixo, pessoa-mês equivalente × custo por pessoa (salário, adicionais, HE + DSR, encargos, provisões, VT, benefícios, exames, rescisões, tributos e risco/lucro). "}
          {notaVisao(vista.caixa)}
        </p>
      </Cartao>
    </>
  );
}
