import { useState } from "react";
import { moeda, numero, percentual } from "@ito/formato";
import type { TipoHe } from "@ito/motor";
import { TIPOS_HE, tabelaDoMes } from "@ito/motor";
import { parametrosDe } from "../../lib/obraDoBanco";
import { Botao, Cartao } from "../../ui/componentes";
import { Kpi } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import type { Aba, DadosAba } from "./comum";
import { gastoHe, NOME_HE, plural, soma } from "./comum";
import type { SetVista } from "./controles";
import { ControleEixo, ControleGrupo } from "./controles";
import s from "./obra.module.css";

export function AbaHE({
  dados,
  setVista,
  irPara,
}: {
  dados: DadosAba;
  setVista: SetVista;
  irPara: (a: Aba) => void;
}) {
  const { r, fun, rotulos, vista, d, ctx, obra } = dados;
  const ids = dados.ids.filter((k) => r.porFuncao[k]!.some((c) => c.horasExtras > 0));
  const mesTot = rotulos.map((_, i) => soma(ids.map((k) => gastoHe(r.porFuncao[k]![i]!))));
  const total = soma(mesTot);
  const iPk = mesTot.indexOf(Math.max(0, ...mesTot));
  const inicial = ids.includes("ped") ? "ped" : ids[0];
  const [sel, setSel] = useState<{ k: string; i: number } | null>(null);
  const atual =
    sel && ids.includes(sel.k) ? sel : inicial ? { k: inicial, i: Math.max(0, iPk) } : null;
  const p = tabelaDoMes(parametrosDe(d, ctx.tabelas, ctx.vigente, vista.visao), 0);
  const horas = soma(ids.flatMap((k) => r.porFuncao[k]!.map((c) => c.horasExtras)));
  const pm = soma(ids.flatMap((k) => r.porFuncao[k]!.map((c) => c.x)));
  const porTipo = Object.fromEntries(
    TIPOS_HE.map((t) => [t, soma(ids.flatMap((k) => r.porFuncao[k]!.map((c) => c.heTipo[t])))]),
  ) as Record<TipoHe, number>;
  const totTipo = soma(Object.values(porTipo)) || 1;
  const mx = Math.max(1, ...ids.flatMap((k) => r.porFuncao[k]!.map(gastoHe)));

  let leitura = "Nenhuma hora extra nesta obra.";
  if (atual) {
    const c = r.porFuncao[atual.k]![atual.i]!;
    const nome = fun(atual.k).nome;
    const mix = obra.heMixPct ?? {};
    leitura = c.x
      ? `Em ${rotulos[atual.i]}, ${numero(c.x, 1)} ${c.x > 1 ? plural(nome) : nome.toLowerCase()} (pessoa-mês equivalente) fizeram em média ${numero(c.horasPorPessoa, 1)} h extras cada, a ${moeda(c.valorHoraExtra)} por hora em média (${TIPOS_HE.filter(
          (t) => c.heTipo[t] > 0.5,
        )
          .map(
            (t) =>
              `${NOME_HE[t].replace(/^HE (em|aos) /, "").toLowerCase()} ${percentual(mix[t] ?? 0, 0)}`,
          )
          .join(
            ", ",
          )}). Somando o reflexo no DSR (${percentual(c.dsrPct, 1)} neste mês, pelo calendário), encargos e provisões, cada hora extra custou ${moeda(c.horaExtraCheia)}. Ao longo de ${numero(c.diasTrabalhados)} dias úteis, gastamos ${moeda(gastoHe(c), 0)} com horas extras de ${plural(nome)} nesse mês.`
      : `Nenhum ${nome.toLowerCase()} em ${rotulos[atual.i]}.`;
  }

  return (
    <>
      <div className={f.kpis}>
        <Kpi
          rotulo="Gasto com horas extras"
          valor={moeda(total, 0)}
          sub={`${percentual(r.total.total ? (total / r.total.total) * 100 : 0)} do custo · com DSR, encargos e provisões`}
          destaque
        />
        <Kpi
          rotulo="Horas extras no período"
          valor={`${numero(horas)} h`}
          sub={`${numero(pm ? horas / pm : 0, 1)} h por pessoa·mês`}
        />
        <Kpi
          rotulo="Mês de maior gasto"
          valor={total > 0 ? (rotulos[iPk] ?? "—") : "—"}
          sub={total > 0 ? moeda(mesTot[iPk] ?? 0, 0) : "sem horas extras"}
        />
        <Kpi
          rotulo="Hora extra de oficial"
          valor={moeda(((p.salarios.ped ?? 0) / p.divisor) * (1 + p.heAdicionalPct.util / 100))}
          sub={`dia útil ${percentual(p.heAdicionalPct.util, 0)} · intervalo ${percentual(p.heAdicionalPct.intervalo, 0)} · + DSR do mês`}
        />
      </div>

      <Cartao aria-label="Horas extras por tipo">
        <div className={f.barra}>
          <span className="rotulo">Horas extras por tipo</span>
          <span className="sub">
            Como na folha: cada tipo com seu adicional. Valores sem DSR e sem encargos.
          </span>
          <span style={{ marginLeft: "auto" }}>
            <Botao pequeno onClick={() => irPara("prem")}>
              Distribuição nas premissas
            </Botao>
          </span>
        </div>
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Tipo</th>
              <th className={f.r}>Adicional</th>
              <th className={f.r}>Participação nas horas</th>
              <th className={f.r}>Valor pago</th>
              <th className={f.r}>% do valor</th>
            </tr>
          </thead>
          <tbody>
            {TIPOS_HE.map((t) => (
              <tr key={t}>
                <td className={f.forte}>{NOME_HE[t]}</td>
                <td className={f.r}>{percentual(p.heAdicionalPct[t], 0)}</td>
                <td className={f.r}>{percentual(obra.heMixPct?.[t] ?? 0, 0)}</td>
                <td className={f.r}>{moeda(porTipo[t], 0)}</td>
                <td className={`${f.r} ${s.pct}`}>{percentual((porTipo[t] / totTipo) * 100)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total de horas extras</td>
              <td />
              <td className={f.r}>100%</td>
              <td className={f.r}>{moeda(soma(Object.values(porTipo)), 0)}</td>
              <td className={`${f.r} ${s.pct}`}>100%</td>
            </tr>
          </tbody>
        </table>
      </Cartao>

      {atual && (
        <Cartao
          aria-label="Leitura"
          style={{ background: "var(--amber-tint)", borderColor: "transparent" }}
        >
          <div className={s.corpo}>
            <span className="rotulo">
              Leitura · {fun(atual.k).nome} · {rotulos[atual.i]}
            </span>
            <p className={s.leitura}>{leitura}</p>
            <span className="sub">
              Clique em qualquer célula da tabela para ler outra função ou outro mês.
            </span>
          </div>
        </Cartao>
      )}

      <Cartao aria-label="Gasto com horas extras por função e mês">
        <div className={f.barra}>
          <span className="rotulo">Gasto com horas extras por função e mês</span>
          <span style={{ marginLeft: "auto" }} className={f.linha}>
            <ControleGrupo vista={vista} setVista={setVista} />
            <ControleEixo vista={vista} setVista={setVista} />
          </span>
        </div>
        <div className={s.mensal}>
          <table className={f.tabela}>
            <thead>
              <tr>
                <th>Função</th>
                {rotulos.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>Total</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((k) => {
                const linha = r.porFuncao[k]!;
                const ref = linha.find((c) => c.x > 0) ?? linha[0]!;
                return (
                  <tr key={k}>
                    <td className={f.forte}>
                      <span className={s.amostra} style={{ background: fun(k).cor }} />
                      {fun(k).nome}
                      <div className="sub">
                        HE {moeda(ref.valorHoraExtra)}/h · com tudo {moeda(ref.horaExtraCheia)}/h
                      </div>
                    </td>
                    {linha.map((c, i) => {
                      if (!c.x || !c.horasExtras)
                        return (
                          <td key={i} className={f.r}>
                            <span className="sub">–</span>
                          </td>
                        );
                      const a = gastoHe(c) / mx;
                      return (
                        <td key={i} className={f.r} style={{ padding: "4px 6px" }}>
                          <button
                            type="button"
                            className={s.celula}
                            aria-pressed={atual?.k === k && atual.i === i}
                            style={{
                              background: `color-mix(in srgb, var(--amber) ${Math.round(a * 55)}%, transparent)`,
                            }}
                            onClick={() => setSel({ k, i })}
                          >
                            <strong style={{ display: "block" }}>{moeda(gastoHe(c), 0)}</strong>
                            <span className={`sub ${s.nowrap}`}>
                              {numero(c.x, 1)} × {numero(c.horasPorPessoa, 0)} h
                            </span>
                          </button>
                        </td>
                      );
                    })}
                    <td className={f.r}>
                      <strong>{moeda(soma(linha.map(gastoHe)), 0)}</strong>
                      <div className="sub">{numero(soma(linha.map((c) => c.horasExtras)))} h</div>
                    </td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>Total do mês</td>
                {mesTot.map((t, i) => (
                  <td key={i} className={f.r}>
                    {moeda(t, 0)}
                  </td>
                ))}
                <td className={f.r}>{moeda(total, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="sub" style={{ padding: "12px 22px 18px", margin: 0 }}>
          Cada célula: gasto com horas extras da função no mês (valor da HE com adicional, reflexo
          no DSR, encargos e provisões) e, abaixo, pessoa-mês × horas médias de cada um.
        </p>
      </Cartao>
    </>
  );
}
