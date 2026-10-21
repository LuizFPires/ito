import type { ReactNode } from "react";
import s from "./graficos.module.css";

export interface Serie {
  id: string;
  nome: string;
  /** cor CSS (token da função: var(--i4)…) */
  cor: string;
  valores: readonly number[];
}

/** Escala "redonda" para o eixo Y (1, 2, 2,5, 5 × 10^n). */
function passo(max: number, linhas = 4): number {
  if (max <= 0) return 1;
  const bruto = max / linhas;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Histograma mensal por série (função): barras empilhadas ou agrupadas, eixo em datas ou em mês
 * 1, 2… (os rótulos vêm prontos). Acessível: a tabela da aba tem os mesmos números.
 */
export function BarrasMensais({
  rotulos,
  series,
  agrupadas = false,
  formatar,
  titulo,
  altura = 240,
}: {
  rotulos: readonly string[];
  series: readonly Serie[];
  agrupadas?: boolean;
  formatar: (v: number) => string;
  titulo: string;
  altura?: number;
}) {
  const n = rotulos.length;
  const L = 760;
  const M = { e: 56, d: 8, t: 10, b: 26 };
  const W = L - M.e - M.d;
  const H = altura - M.t - M.b;
  const totais = rotulos.map((_, i) => series.reduce((t, x) => t + (x.valores[i] ?? 0), 0));
  const max = agrupadas ? Math.max(0, ...series.flatMap((x) => x.valores)) : Math.max(0, ...totais);
  const p = passo(max);
  const topo = Math.max(p, Math.ceil(max / p) * p);
  const y = (v: number) => M.t + H - (v / topo) * H;
  const col = W / Math.max(1, n);
  const larg = col * 0.72;
  const cada = Math.max(1, Math.ceil(n / 12));
  const marcas: ReactNode[] = [];
  for (let v = 0; v <= topo + 1e-9; v += p)
    marcas.push(
      <g key={v}>
        <line x1={M.e} x2={L - M.d} y1={y(v)} y2={y(v)} className={s.grade} />
        <text x={M.e - 6} y={y(v) + 4} textAnchor="end" className={s.eixo}>
          {formatar(v)}
        </text>
      </g>,
    );
  return (
    <svg className={s.grafico} viewBox={`0 0 ${L} ${altura}`} role="img" aria-label={titulo}>
      {marcas}
      {rotulos.map((r, i) => {
        const x0 = M.e + i * col + (col - larg) / 2;
        let acc = 0;
        const w = agrupadas ? larg / Math.max(1, series.length) : larg;
        return (
          <g key={i}>
            {series.map((sr, j) => {
              const v = sr.valores[i] ?? 0;
              if (v <= 0) return null;
              const yTopo = agrupadas ? y(v) : y(acc + v);
              const h = agrupadas ? y(0) - y(v) : y(acc) - y(acc + v);
              if (!agrupadas) acc += v;
              return (
                <rect
                  key={sr.id}
                  x={agrupadas ? x0 + j * w : x0}
                  y={yTopo}
                  width={Math.max(0.5, w - (agrupadas ? 1 : 0))}
                  height={Math.max(0, h)}
                  fill={sr.cor}
                >
                  <title>{`${sr.nome} · ${r}: ${formatar(v)}`}</title>
                </rect>
              );
            })}
            {i % cada === 0 && (
              <text x={x0 + larg / 2} y={altura - 8} textAnchor="middle" className={s.eixo}>
                {r}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Legenda({ series }: { series: readonly Pick<Serie, "id" | "nome" | "cor">[] }) {
  return (
    <div className={s.legenda}>
      {series.map((x) => (
        <span key={x.id}>
          <i style={{ background: x.cor }} />
          {x.nome}
        </span>
      ))}
    </div>
  );
}

/** Barra horizontal de composição (partes de um total). */
export function BarraComposicao({
  partes,
  titulo,
}: {
  partes: readonly { id: string; nome: string; cor: string; valor: number }[];
  titulo: string;
}) {
  const total = partes.reduce((t, p) => t + Math.max(0, p.valor), 0);
  return (
    <div className={s.composicao} role="img" aria-label={titulo}>
      {total > 0 &&
        partes
          .filter((p) => p.valor > 0)
          .map((p) => (
            <span
              key={p.id}
              title={p.nome}
              style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }}
            />
          ))}
    </div>
  );
}
