import { useMemo } from "react";
import { Link } from "react-router";
import { moeda, numero } from "@ito/formato";
import { FORA_DO_CUSTO } from "@ito/motor";
import { NOME_COMPONENTE, useRubricas } from "../../dados/cadastros";
import { useLancamentos } from "../../dados/obras";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import type { Aba, DadosAba } from "./comum";
import { custoRealocacao } from "./calculos";
import { soma } from "./comum";
import { BotaoCopiar } from "../../ui/BotaoCopiar";
import { rubricasPorMes, tabelaRubricas, tituloObra } from "./exportar";
import s from "./obra.module.css";

export function Restrito({ oque, feminino = true }: { oque: string; feminino?: boolean }) {
  return (
    <Cartao>
      <p className="sub" style={{ padding: 22, margin: 0 }}>
        {oque} é {feminino ? "restrita" : "restrito"} ao DP/RH, à controladoria e aos
        administradores: mostra valores por matrícula. Os totais da obra estão nas abas Custos e
        Indicadores.
      </p>
    </Cartao>
  );
}

const TOM = { provento: "ok", desconto: "erro", informativo: "neutro" } as const;

export function AbaFolha({ dados, irPara }: { dados: DadosAba; irPara: (a: Aba) => void }) {
  const { d, rotulos, epoca, pode } = dados;
  const q = useLancamentos(d.obra.id, pode);
  const rub = useRubricas();
  const n = rotulos.length;

  const tabela = useMemo(
    () => rubricasPorMes(q.data?.lancamentos ?? [], q.data?.rubricas ?? [], n),
    [q.data, n],
  );

  if (!pode) return <Restrito oque="A folha por rubrica" />;
  if (q.isError || rub.isError)
    return (
      <Cartao>
        <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
          Não foi possível carregar a folha. Atualize a página.
        </p>
      </Cartao>
    );
  if (q.isLoading || rub.isLoading)
    return (
      <Cartao>
        <p className="sub" style={{ padding: 22, margin: 0 }}>
          Carregando…
        </p>
      </Cartao>
    );

  const cad = new Map((rub.data ?? []).map((r) => [r.codigo, r]));
  // só rubricas com valor no período (como o protótipo)
  const codigos = [...tabela.keys()]
    .filter((c) => tabela.get(c)!.some((v) => Math.abs(v) > 0.5))
    .sort((a, b) => a - b);
  // descontos com sinal negativo (a folha pode trazê-los positivos: o tipo decide)
  const valor = (c: number, v: number) => (cad.get(c)?.tipo === "desconto" ? -Math.abs(v) : v);
  const serie = (c: number) => tabela.get(c)!.map((v) => valor(c, v));
  const filtroSoma = (fn: (c: number) => boolean) =>
    rotulos.map((_, i) => soma(codigos.filter(fn).map((c) => serie(c)[i]!)));
  const prov = filtroSoma((c) => cad.get(c)?.tipo === "provento");
  const desc = filtroSoma((c) => cad.get(c)?.tipo === "desconto");
  const noCusto = filtroSoma((c) => {
    const r = cad.get(c);
    return !!r && !FORA_DO_CUSTO.includes(r.componente);
  });
  const custoIto = epoca.porMes.map((m) => m.remun + m.resc + m.ferr);
  const confere = noCusto.every((v, i) => Math.abs(v - custoIto[i]!) < 1);
  const realoc = d.realocacoes;

  return (
    <>
      <Cartao aria-label="Folha por rubrica">
        <div className={f.barra}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
            <span className="rotulo">Folha por rubrica</span>
            <span className="sub">
              Valores pagos na folha (CCT {d.obra.data_base}) · cada rubrica classificada no
              dicionário · sem a MDO realocada
            </span>
          </div>
          <BotaoCopiar tabela={() => tabelaRubricas(tabela, cad, rotulos, tituloObra(dados))} />
          <Link
            className={`${u.botao} ${u.pequeno}`}
            to="/rubricas"
            style={{ textDecoration: "none" }}
          >
            Abrir dicionário de rubricas
          </Link>
        </div>
        <div className={s.mensal}>
          <table className={f.tabela} aria-label="Rubricas por mês">
            <thead>
              <tr>
                <th>Rubrica</th>
                {rotulos.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>Total</th>
              </tr>
            </thead>
            <tbody>
              {codigos.map((c) => {
                const r = cad.get(c);
                const v = serie(c);
                return (
                  <tr key={c}>
                    <td>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {c}
                      </span>{" "}
                      <span className={f.forte}>{r?.nome ?? "—"}</span>{" "}
                      {r && <Badge tom={TOM[r.tipo]}>{r.tipo}</Badge>}
                      <div className="sub">
                        {r ? NOME_COMPONENTE[r.componente] : ""}
                        {r?.base_provisoes ? " · base de provisões" : ""}
                      </div>
                    </td>
                    {v.map((x, i) => (
                      <td key={i} className={f.r}>
                        {moeda(x, 0)}
                      </td>
                    ))}
                    <td className={f.r}>
                      <strong>{moeda(soma(v), 0)}</strong>
                    </td>
                  </tr>
                );
              })}
              <tr className={s.subtotal}>
                <td>Proventos</td>
                {prov.map((v, i) => (
                  <td key={i} className={f.r}>
                    {moeda(v, 0)}
                  </td>
                ))}
                <td className={f.r}>{moeda(soma(prov), 0)}</td>
              </tr>
              <tr className={s.subtotal}>
                <td>Descontos</td>
                {desc.map((v, i) => (
                  <td key={i} className={f.r}>
                    {moeda(v, 0)}
                  </td>
                ))}
                <td className={f.r}>{moeda(soma(desc), 0)}</td>
              </tr>
              <tr className="total">
                <td>Líquido da folha</td>
                {prov.map((v, i) => (
                  <td key={i} className={f.r}>
                    {moeda(v + desc[i]!, 0)}
                  </td>
                ))}
                <td className={f.r}>{moeda(soma(prov) + soma(desc), 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao aria-label="Conferência rubricas × custo do ITO">
        <div className={f.barra}>
          <span className="rotulo">Conferência rubricas × custo do ITO</span>
          <span style={{ marginLeft: "auto" }}>
            <Badge tom={confere ? "ok" : "erro"}>{confere ? "Confere" : "Diferença"}</Badge>
          </span>
        </div>
        <div className={s.mensal}>
          <table className={f.tabela}>
            <thead>
              <tr>
                <th />
                {rotulos.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rubricas que entram no custo</td>
                {noCusto.map((v, i) => (
                  <td key={i} className={f.r}>
                    {moeda(v, 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Remuneração + rescisões + ferramentas calculadas pelo ITO</td>
                {custoIto.map((v, i) => (
                  <td key={i} className={f.r}>
                    {moeda(v, 0)}
                  </td>
                ))}
              </tr>
              <tr className={s.subtotal}>
                <td>Diferença</td>
                {noCusto.map((v, i) => (
                  <td key={i} className={f.r}>
                    {Math.abs(v - custoIto[i]!) < 1 ? "0" : moeda(v - custoIto[i]!)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="sub" style={{ padding: "12px 22px 18px", margin: 0 }}>
          Descontos do empregado (INSS, IRRF, VT 6%, cesta, café, taxa negocial) não são custo da
          empresa: aparecem na folha mas ficam fora do custo. Férias gozadas são pagas com a
          provisão já lançada mês a mês; o salário-família é compensado na guia do INSS. Encargos
          patronais, provisões e benefícios entram pelo cálculo de cada componente.
        </p>
      </Cartao>

      {realoc.length > 0 && (
        <Cartao
          aria-label="MDO realocada nesta folha"
          style={{ background: "var(--amber-tint)", borderColor: "transparent" }}
        >
          <div className={s.corpo}>
            <div className={f.linha} style={{ justifyContent: "space-between" }}>
              <span className="rotulo">MDO realocada nesta folha</span>
              <Botao pequeno onClick={() => irPara("realoc")}>
                Ver realocações
              </Botao>
            </div>
            <p className="sub" style={{ margin: 0 }}>
              {realoc
                .map((x) => {
                  const custo = moeda(custoRealocacao(dados, x), 0);
                  const quem = `${numero(x.qtd)} ${dados.fun(x.funcao_id).nome.toLowerCase()}`;
                  const quando = `de ${rotulos[x.mes_ini]} a ${rotulos[x.mes_fim]}`;
                  return x.tipo === "cedida"
                    ? `${quem} estavam na folha desta obra ${quando}, mas trabalharam em ${x.outra_obra}: o custo (${custo}) foi apropriado lá e não aparece nesta conferência.`
                    : `${quem} de ${x.outra_obra} trabalharam aqui ${quando}: a folha é da outra obra, mas o custo (${custo}) está incluído nesta.`;
                })
                .join(" ")}
            </p>
          </div>
        </Cartao>
      )}
    </>
  );
}
