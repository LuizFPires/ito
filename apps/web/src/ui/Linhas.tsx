import s from "./graficos.module.css";

export interface SerieLinha {
  id: string;
  nome: string;
  cor: string;
  /** pontos [x, y] */
  pontos: readonly (readonly [number, number])[];
}

function passo(max: number, linhas = 4): number {
  if (max <= 0) return 1;
  const bruto = max / linhas;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Curvas sobrepostas (comparar obras). A tela mostra os mesmos pontos numa tabela (“Ver dados”). */
export function Linhas({
  series,
  xMax,
  marcasX,
  formatarY,
  titulo,
  pontosVisiveis = false,
  altura = 260,
}: {
  series: readonly SerieLinha[];
  xMax: number;
  marcasX: readonly (readonly [number, string])[];
  /** `casas`: decimais que o passo do eixo pede (0,05 → 2) */
  formatarY: (v: number, casas: number) => string;
  titulo: string;
  pontosVisiveis?: boolean;
  altura?: number;
}) {
  const L = 760;
  const M = { e: 56, d: 12, t: 10, b: 26 };
  const W = L - M.e - M.d;
  const H = altura - M.t - M.b;
  const max = Math.max(0, ...series.flatMap((x) => x.pontos.map((p) => p[1])));
  // folga de 5% no topo (a curva S não encosta nos 100%)
  const p = passo(max * 1.05);
  const topo = Math.max(p, Math.ceil((max * 1.05) / p) * p);
  const casas = Math.max(0, -Math.floor(Math.log10(p) + 1e-9));
  const x = (v: number) => M.e + (v / Math.max(1e-9, xMax)) * W;
  const y = (v: number) => M.t + H - (v / topo) * H;
  const grade = [];
  for (let v = 0; v <= topo + 1e-9; v += p) grade.push(v);
  return (
    <svg className={s.grafico} viewBox={`0 0 ${L} ${altura}`} role="img" aria-label={titulo}>
      {grade.map((v) => (
        <g key={v}>
          <line x1={M.e} x2={L - M.d} y1={y(v)} y2={y(v)} className={s.grade} />
          <text x={M.e - 6} y={y(v) + 4} textAnchor="end" className={s.eixo}>
            {formatarY(v, casas)}
          </text>
        </g>
      ))}
      {marcasX.map(([v, r]) => (
        <text key={`${v}-${r}`} x={x(v)} y={altura - 8} textAnchor="middle" className={s.eixo}>
          {r}
        </text>
      ))}
      {series.map((sr) => (
        <g key={sr.id}>
          <polyline
            fill="none"
            stroke={sr.cor}
            strokeWidth={2.5}
            strokeLinejoin="round"
            points={sr.pontos.map(([a, b]) => `${x(a)},${y(b)}`).join(" ")}
          >
            <title>{sr.nome}</title>
          </polyline>
          {pontosVisiveis && sr.pontos.length > 0 && (
            <circle
              cx={x(sr.pontos[sr.pontos.length - 1]![0])}
              cy={y(sr.pontos[sr.pontos.length - 1]![1])}
              r={3.5}
              fill={sr.cor}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
