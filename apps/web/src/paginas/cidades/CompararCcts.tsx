import { useQueries } from "@tanstack/react-query";
import { MESES, moeda, percentual } from "@ito/formato";
import { consultaCct, nomeCidade, nomeCurtoCct, useCidades } from "../../dados/cidades";
import type { CctResumo, DetalheCct } from "../../dados/cidades";
import { useBeneficios, useDataBase, useFuncoes, useParametros } from "../../dados/cadastros";
import { valorOuEmpresa } from "../../lib/ccts";
import { Botao, Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";

/** Comparação de até 4 CCTs lado a lado (só leitura). Menor salário marcado. */
export function CompararCcts({ ccts, onVoltar }: { ccts: CctResumo[]; onVoltar: () => void }) {
  const detalhes = useQueries({
    queries: ccts.map((t) => consultaCct(t.id)),
  });
  const { data: funcoes } = useFuncoes();
  const { data: bens } = useBeneficios();
  const { data: cidades } = useCidades();
  const { data: params } = useParametros();
  const { data: empresa } = useDataBase(params?.data_base_vigente ?? undefined);
  const dets = detalhes.map((d) => d.data);
  if (!empresa || dets.some((d) => !d)) return <p className="sub">Carregando…</p>;
  const D = dets as DetalheCct[];

  const ativas = (funcoes ?? [])
    .filter((x) => x.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const col = ccts.length + 1;

  return (
    <Cartao style={{ overflow: "hidden" }} aria-label="Comparação de convenções">
      <div className={f.barra} style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 500 }}>Comparação de convenções</h2>
          <span className="sub">Só leitura · para editar, escolha uma convenção na lista</span>
        </div>
        <Botao pequeno onClick={onVoltar}>
          Voltar à edição
        </Botao>
      </div>
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Função</th>
            {ccts.map((t) => (
              <th key={t.id} className={f.r} style={{ whiteSpace: "normal" }}>
                {nomeCurtoCct(t.nome)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ativas.map((x) => {
            // Sem salário na CCT nem na empresa: "—", fora do maior/menor.
            const vs = D.map((d) => valorOuEmpresa(d.salarios, empresa.salarios, x.id).valor);
            const def = vs.filter((v): v is number => v !== undefined);
            const mn = Math.min(...def);
            const mx = Math.max(...def);
            return (
              <tr key={x.id}>
                <td>
                  <span className={f.amostra} style={{ background: `var(--${x.cor})` }} />
                  <span className={f.forte}>{x.nome}</span>
                </td>
                {vs.map((v, j) => {
                  const gr = D[j]!.gratificacoes[x.id] ?? 0;
                  return (
                    <td key={ccts[j]!.id} className={f.r}>
                      <span className={v === mx && mx > mn ? f.forte : undefined}>{moeda(v)}</span>
                      {v !== undefined && v === mn && mx > mn && (
                        <span className="sub"> menor</span>
                      )}
                      {gr > 0 && <div className="sub">+ {moeda(gr, 0)} gratificação</div>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className={f.grupo}>
            <td colSpan={col}>Outros</td>
          </tr>
          <tr>
            <td>Funções com gratificação</td>
            {D.map((d, j) => (
              <td key={ccts[j]!.id} className={`${f.r} sub`} style={{ whiteSpace: "normal" }}>
                {Object.entries(d.gratificacoes)
                  .filter(([, v]) => v > 0)
                  .map(([k]) => (funcoes ?? []).find((x) => x.id === k)?.nome.toLowerCase() ?? k)
                  .join(", ") || "—"}
              </td>
            ))}
          </tr>
          <tr>
            <td>Benefícios · todas as obras</td>
            {D.map((d, j) => (
              <td key={ccts[j]!.id} className={f.r}>
                {moeda(
                  (bens ?? [])
                    .filter((b) => !b.so_fora_sede)
                    .reduce(
                      (s, b) =>
                        s + (valorOuEmpresa(d.beneficios, empresa.beneficios, b.id).valor ?? 0),
                      0,
                    ),
                )}
              </td>
            ))}
          </tr>
          <tr>
            <td>Data-base · reajuste estimado</td>
            {ccts.map((t) => (
              <td key={t.id} className={f.r}>
                {MESES[t.mes_data_base - 1]} · {percentual(Number(t.reajuste_estimado_pct), 1)}
              </td>
            ))}
          </tr>
          <tr>
            <td>Cidades</td>
            {ccts.map((t) => (
              <td key={t.id} className={`${f.r} sub`} style={{ whiteSpace: "normal" }}>
                {(cidades ?? [])
                  .filter((c) => c.cct_id === t.id)
                  .map(nomeCidade)
                  .join(", ") || "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </Cartao>
  );
}
