import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataHora, numero } from "@ito/formato";
import { useSessao } from "../auth/sessao";
import { podeGerirUsuarios } from "../lib/permissoes";
import { supabase } from "../lib/supabase";
import { MENU } from "../shell/rotas";
import { Cartao } from "../ui/componentes";
import { Selecao } from "../ui/formulario";
import f from "../ui/formulario.module.css";
import { Pagina } from "./Pagina";

/** Metas do M12 (ms; CLS em milésimos): a tela marca o que passou delas. */
const METAS: Record<string, number> = {
  LCP: 2500,
  INP: 200,
  CLS: 100,
  TTFB: 800,
  "abrir histograma": 500,
  "abrir resultado": 500,
};
const NOMES: Record<string, string> = {
  LCP: "Maior conteúdo visível (LCP)",
  INP: "Resposta a cliques e teclas (INP)",
  CLS: "Mudança de layout (CLS × 1.000)",
  TTFB: "Primeiro byte do site (TTFB)",
};

async function rpc<R>(nome: "resumo_metricas" | "erros_tela", dias: number): Promise<R[]> {
  const { data, error } = await supabase.rpc(nome, { p_dias: dias });
  if (error) throw error;
  return (data ?? []) as R[];
}

interface LinhaResumo {
  tipo: string;
  nome: string;
  n: number;
  p50: number;
  p75: number;
  p95: number;
  ultimo: string;
}
interface LinhaErro {
  detalhe: string;
  rota: string;
  versao: string;
  vezes: number;
  ultimo: string;
}

/** Desempenho (M14): tempos de tela e erros da produção, sem dado pessoal; só administrador. */
export function TelaDesempenho() {
  const d = MENU.find((x) => x.caminho === "/desempenho")!;
  const { usuario } = useSessao();
  const pode = podeGerirUsuarios(usuario);
  const [dias, setDias] = useState(7);
  const resumo = useQuery({
    queryKey: ["desempenho", "resumo", dias],
    queryFn: () => rpc<LinhaResumo>("resumo_metricas", dias),
    enabled: pode,
  });
  const erros = useQuery({
    queryKey: ["desempenho", "erros", dias],
    queryFn: () => rpc<LinhaErro>("erros_tela", dias),
    enabled: pode,
  });

  if (!pode)
    return (
      <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            O desempenho é restrito aos administradores.
          </p>
        </Cartao>
      </Pagina>
    );

  const ms = (v: number) => `${numero(v)} ms`;
  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
      <Cartao style={{ overflow: "hidden" }}>
        <div className={f.barra}>
          <Selecao
            aria-label="Período"
            style={{ width: "auto", borderRadius: 999 }}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
          >
            {[1, 7, 30, 90].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Último dia" : `Últimos ${n} dias`}
              </option>
            ))}
          </Selecao>
          <span className="sub">Medido no navegador de quem usa o ITO; sem nome nem obra.</span>
        </div>
        <table className={f.tabela} aria-label="Tempos de tela">
          <thead>
            <tr>
              <th>Medida</th>
              <th className={f.r}>Medições</th>
              <th className={f.r}>Mediana</th>
              <th className={f.r}>75%</th>
              <th className={f.r}>95%</th>
              <th className={f.r}>Meta</th>
            </tr>
          </thead>
          <tbody>
            {(resumo.data ?? []).map((r) => {
              const meta = METAS[r.nome];
              const fora = meta !== undefined && Number(r.p75) > meta;
              const fmt = r.nome === "CLS" ? (v: number) => numero(v) : ms;
              return (
                <tr key={`${r.tipo}-${r.nome}`}>
                  <td>
                    {NOMES[r.nome] ?? r.nome}
                    <div className="sub">última em {dataHora(r.ultimo)}</div>
                  </td>
                  <td className={f.r}>{numero(Number(r.n))}</td>
                  <td className={f.r}>{fmt(Number(r.p50))}</td>
                  <td className={f.r} style={fora ? { color: "var(--err)" } : undefined}>
                    {fmt(Number(r.p75))}
                  </td>
                  <td className={f.r}>{fmt(Number(r.p95))}</td>
                  <td className={f.r}>{meta === undefined ? "—" : fmt(meta)}</td>
                </tr>
              );
            })}
            {resumo.data && !resumo.data.length && (
              <tr>
                <td colSpan={6} className="sub">
                  Nenhuma medição no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>
      <Cartao style={{ overflow: "hidden" }}>
        <table className={f.tabela} aria-label="Erros da tela">
          <thead>
            <tr>
              <th>Erro</th>
              <th className={f.r}>Vezes</th>
              <th className={f.r}>Último</th>
            </tr>
          </thead>
          <tbody>
            {(erros.data ?? []).map((e) => (
              <tr key={`${e.detalhe}-${e.rota}-${e.versao}`}>
                <td>
                  {e.detalhe}
                  <div className="sub">
                    {e.rota || "—"} · versão {e.versao || "—"}
                  </div>
                </td>
                <td className={f.r}>{numero(Number(e.vezes))}</td>
                <td className={f.r}>{dataHora(e.ultimo)}</td>
              </tr>
            ))}
            {erros.data && !erros.data.length && (
              <tr>
                <td colSpan={3} className="sub">
                  Nenhum erro no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>
    </Pagina>
  );
}
