import { moeda, numero } from "@ito/formato";
import { custoFuncaoMes } from "@ito/motor";
import { parametrosDe } from "../../lib/obraDoBanco";
import { Badge, Cartao } from "../../ui/componentes";
import { Kpi } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import type { DadosAba } from "./comum";
import { soma } from "./comum";
import s from "./obra.module.css";

/** MDO realocada (PRD §3.2.9): o custo fica onde a pessoa trabalhou. */
export function AbaRealocada({ dados }: { dados: DadosAba }) {
  const { d, fun, rotulos, obra, ctx } = dados;
  const R = d.realocacoes;
  const p = parametrosDe(d, ctx.tabelas, ctx.vigente, "epoca");
  const n = rotulos.length;
  // custo das pessoas realocadas no período, com os preços e premissas desta obra (época)
  const custo = (x: (typeof R)[number]) => {
    const fn = ctx.ctx.funcoes.find((y) => y.id === x.funcao_id);
    if (!fn) return 0;
    let t = 0;
    for (let i = x.mes_ini; i <= Math.min(x.mes_fim, n - 1); i++)
      t += custoFuncaoMes(obra, fn, i, p, ctx.ctx, { x: x.qtd }).total;
    return t;
  };
  const pm = (x: (typeof R)[number]) => x.qtd * (Math.min(x.mes_fim, n - 1) - x.mes_ini + 1);
  const ced = R.filter((x) => x.tipo === "cedida");
  const rec = R.filter((x) => x.tipo === "recebida");

  return (
    <>
      <div className={f.kpis}>
        <Kpi
          rotulo="Cedidos a outras obras"
          valor={`${numero(soma(ced.map(pm)))} pessoa-mês`}
          sub={
            ced.length
              ? `custo ${moeda(soma(ced.map(custo)), 0)} apropriado nas obras de destino`
              : "nenhum"
          }
          destaque
        />
        <Kpi
          rotulo="Recebidos de outras obras"
          valor={`${numero(soma(rec.map(pm)))} pessoa-mês`}
          sub={
            rec.length ? `custo ${moeda(soma(rec.map(custo)), 0)} incluído nesta obra` : "nenhum"
          }
        />
        <Kpi
          rotulo="Saldo de VT transferido"
          valor={moeda(soma(R.map((x) => Number(x.saldo_vt))))}
          sub="entre obras, junto com o funcionário"
        />
      </div>
      <Cartao aria-label="MDO realocada">
        <div className={f.barra}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="rotulo">MDO realocada</span>
            <span className="sub">
              Gente que está na folha de uma obra e trabalha em outra. O histograma e o custo ficam
              onde a pessoa trabalhou. Vem da carga (coluna “Obra onde trabalhou”).
            </span>
          </div>
        </div>
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Movimento</th>
              <th>Função</th>
              <th className={f.r}>Pessoas</th>
              <th>Período · outra obra</th>
              <th className={f.r}>Saldo de VT</th>
              <th className={f.r}>Custo no período</th>
            </tr>
          </thead>
          <tbody>
            {R.length ? (
              R.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.tipo === "cedida" ? (
                      <Badge tom="ambar">Cedida</Badge>
                    ) : (
                      <Badge tom="escuro">Recebida</Badge>
                    )}
                  </td>
                  <td className={f.forte}>
                    <span className={s.amostra} style={{ background: fun(x.funcao_id).cor }} />
                    {fun(x.funcao_id).nome}
                  </td>
                  <td className={f.r}>{numero(x.qtd)}</td>
                  <td>
                    {rotulos[x.mes_ini]} a {rotulos[Math.min(x.mes_fim, n - 1)]}
                    <div className="sub">{x.outra_obra}</div>
                  </td>
                  <td className={f.r}>{moeda(Number(x.saldo_vt))}</td>
                  <td className={f.r}>
                    <strong>{moeda(custo(x), 0)}</strong>
                    <div className="sub">
                      {x.tipo === "cedida"
                        ? "na outra obra (fora deste histograma)"
                        : "nesta obra (incluída no histograma)"}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="sub" style={{ textAlign: "center", padding: 28 }}>
                  Nenhuma realocação nesta obra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}
