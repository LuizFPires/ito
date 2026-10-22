import { Link } from "react-router";
import { moeda, numero } from "@ito/formato";
import { useBeneficios } from "../../dados/cadastros";
import { Badge, Cartao } from "../../ui/componentes";
import { Kpi } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { apropriacaoPorConta } from "./calculos";
import type { DadosAba } from "./comum";
import { soma } from "./comum";
import { BotaoCopiar } from "../../ui/BotaoCopiar";
import { tabelaApropriacao, tituloObra } from "./exportar";
import s from "./obra.module.css";

/**
 * Apropriação por conta (protótipo): cada função na conta dela (salário, adicionais, HE, DSR,
 * encargos, provisões, rescisões, tributos, risco/lucro, ferramentas); VT, benefícios e exames
 * nas contas próprias. Época, competência.
 */
export function AbaApropriacao({ dados }: { dados: DadosAba }) {
  const { epoca, fun, rotulos, d } = dados;
  const ben = useBeneficios();
  const R = apropriacaoPorConta(epoca, fun, ben.data ?? []).filter((l) => soma(l.v) > 0.5);
  const tot = rotulos.map((_, i) => soma(R.map((l) => l.v[i]!)));
  const comErp = d.erp.length > 0;
  const comp = (i: number) => d.competencias.find((c) => c.mes_idx === i);
  const erp = rotulos.map((_, i) =>
    soma(d.erp.filter((e) => e.mes_idx === i).map((e) => Number(e.valor))),
  );
  const ito = rotulos.map((_, i) => Number(comp(i)?.ito_apropriado ?? 0));
  const dif = erp.map((e, i) => e - ito[i]!);
  const pend = rotulos.filter((_, i) => Math.abs(dif[i]!) >= 1 && !comp(i)?.justificativa).length;

  return (
    <>
      <div className={f.kpis}>
        <Kpi
          rotulo="Total apropriado"
          valor={moeda(soma(tot), 0)}
          sub={`${numero(R.length)} contas do plano · competência`}
        />
        <Kpi
          rotulo="Realizado no ERP"
          valor={comErp ? moeda(soma(erp), 0) : "—"}
          sub={comErp ? "processo de compras + VR" : "a carga não trouxe o ERP"}
        />
        <Kpi
          rotulo="Diferença ERP × caixa do ITO"
          valor={comErp ? moeda(soma(dif), 0) : "—"}
          sub={
            comErp
              ? pend
                ? `${numero(pend)} mês(es) sem justificativa`
                : "todas justificadas"
              : ""
          }
          destaque={comErp && pend > 0}
        />
      </div>
      <Cartao aria-label="Apropriação por conta e mês">
        <div className={f.barra}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
            <span className="rotulo">Apropriação por conta e mês</span>
            <span className="sub">
              Cada função e cada benefício aponta para uma conta do plano · valores da época,
              competência
            </span>
          </div>
          <BotaoCopiar tabela={() => tabelaApropriacao(R, rotulos, tituloObra(dados))} />
          <Link
            className={`${u.botao} ${u.pequeno}`}
            to="/funcoes"
            style={{ textDecoration: "none" }}
          >
            Contas por função
          </Link>
        </div>
        <div className={s.mensal}>
          <table className={f.tabela} aria-label="Apropriação">
            <thead>
              <tr>
                <th>Conta</th>
                {rotulos.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>Total</th>
              </tr>
            </thead>
            <tbody>
              {R.map((l) => (
                <tr key={l.conta}>
                  <td>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {l.conta}
                    </span>{" "}
                    <span className={f.forte}>{l.nome}</span>
                  </td>
                  {l.v.map((v, i) => (
                    <td key={i} className={f.r}>
                      {v > 0.5 ? moeda(v, 0) : <span className="sub">–</span>}
                    </td>
                  ))}
                  <td className={f.r}>
                    <strong>{moeda(soma(l.v), 0)}</strong>
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td>Total apropriado (competência)</td>
                {tot.map((v, i) => (
                  <td key={i} className={f.r}>
                    {moeda(v, 0)}
                  </td>
                ))}
                <td className={f.r}>{moeda(soma(tot), 0)}</td>
              </tr>
              {comErp && (
                <>
                  <tr>
                    <td>Caixa do ITO na carga</td>
                    {ito.map((v, i) => (
                      <td key={i} className={f.r}>
                        {moeda(v, 0)}
                      </td>
                    ))}
                    <td className={f.r}>{moeda(soma(ito), 0)}</td>
                  </tr>
                  <tr>
                    <td>Realizado no ERP</td>
                    {erp.map((v, i) => (
                      <td key={i} className={f.r}>
                        {moeda(v, 0)}
                      </td>
                    ))}
                    <td className={f.r}>{moeda(soma(erp), 0)}</td>
                  </tr>
                  <tr className={s.subtotal}>
                    <td>Diferença</td>
                    {dif.map((v, i) => (
                      <td key={i} className={f.r}>
                        {Math.abs(v) < 1 ? "0" : moeda(v)}
                      </td>
                    ))}
                    <td className={f.r}>{moeda(soma(dif))}</td>
                  </tr>
                  <tr>
                    <td>Situação</td>
                    {dif.map((v, i) => (
                      <td key={i} className={f.r}>
                        {Math.abs(v) < 1 ? (
                          <Badge tom="ok">Confere</Badge>
                        ) : comp(i)?.justificativa ? (
                          <span className="sub">{comp(i)!.justificativa}</span>
                        ) : (
                          <Badge tom="erro">Sem justificativa</Badge>
                        )}
                      </td>
                    ))}
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </Cartao>
    </>
  );
}
