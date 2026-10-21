import { useQueries } from "@tanstack/react-query";
import { MESES, moeda, percentual } from "@ito/formato";
import { nomeCidade, nomeCurtoCct, useCidades } from "../../dados/cidades";
import type { CctResumo, DetalheCct } from "../../dados/cidades";
import {
  NOME_GRUPO,
  useBeneficios,
  useDataBase,
  useFuncoes,
  useParametros,
} from "../../dados/cadastros";
import type { GrupoFuncao } from "../../dados/cadastros";
import { valorOuEmpresa } from "../../lib/ccts";
import { supabase } from "../../lib/supabase";
import { Botao, Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";

async function carregar(id: string): Promise<DetalheCct> {
  const [sal, grat, ben] = await Promise.all([
    supabase.from("cct_salarios").select("funcao_id, valor").eq("cct_id", id),
    supabase.from("cct_gratificacoes").select("funcao_id, valor").eq("cct_id", id),
    supabase.from("cct_beneficios").select("beneficio_id, valor").eq("cct_id", id),
  ]);
  for (const r of [sal, grat, ben]) if (r.error) throw r.error;
  return {
    salarios: Object.fromEntries((sal.data ?? []).map((r) => [r.funcao_id, Number(r.valor)])),
    gratificacoes: Object.fromEntries((grat.data ?? []).map((r) => [r.funcao_id, Number(r.valor)])),
    beneficios: Object.fromEntries((ben.data ?? []).map((r) => [r.beneficio_id, Number(r.valor)])),
  };
}

/** Comparação de até 4 CCTs lado a lado (só leitura). Menor salário marcado. */
export function CompararCcts({ ccts, onVoltar }: { ccts: CctResumo[]; onVoltar: () => void }) {
  const detalhes = useQueries({
    queries: ccts.map((t) => ({ queryKey: ["cct", t.id], queryFn: () => carregar(t.id) })),
  });
  const { data: funcoes } = useFuncoes();
  const { data: bens } = useBeneficios();
  const { data: cidades } = useCidades();
  const { data: params } = useParametros();
  const { data: empresa } = useDataBase(params?.data_base_vigente ?? undefined);
  const dets = detalhes.map((d) => d.data);
  if (!empresa || dets.some((d) => !d)) return <p className="sub">Carregando…</p>;
  const D = dets as DetalheCct[];

  const grupos = Object.entries(NOME_GRUPO) as [GrupoFuncao, string][];
  const ativas = (funcoes ?? []).filter((x) => x.ativo);
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
          {grupos.map(([g, nomeG]) => {
            const fs = ativas.filter((x) => x.grupo === g);
            if (!fs.length) return null;
            return [
              <tr key={g} className={f.grupo}>
                <td colSpan={col}>Mão de obra {nomeG.toLowerCase()}</td>
              </tr>,
              ...fs.map((x) => {
                const vs = D.map(
                  (d) => valorOuEmpresa(d.salarios, empresa.salarios, x.id).valor ?? 0,
                );
                const mn = Math.min(...vs);
                const mx = Math.max(...vs);
                return (
                  <tr key={x.id}>
                    <td className={f.forte}>{x.nome}</td>
                    {vs.map((v, j) => {
                      const gr = D[j]!.gratificacoes[x.id] ?? 0;
                      return (
                        <td key={ccts[j]!.id} className={f.r}>
                          <span className={v === mx && mx > mn ? f.forte : undefined}>
                            {moeda(v)}
                          </span>
                          {v === mn && mx > mn && <span className="sub"> menor</span>}
                          {gr > 0 && <div className="sub">+ {moeda(gr, 0)} gratificação</div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              }),
            ];
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
                  .map(([k]) => ativas.find((x) => x.id === k)?.nome.toLowerCase() ?? k)
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
