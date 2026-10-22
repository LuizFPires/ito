/** Mini-histograma (barras) do efetivo por mês, para listas. Decorativo: o valor está na linha. */
export function MiniHistograma({
  valores,
  largura = 120,
  altura = 28,
}: {
  valores: readonly number[];
  largura?: number;
  altura?: number;
}) {
  const max = Math.max(0, ...valores);
  if (!valores.length || max <= 0) return null;
  const w = largura / valores.length;
  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true">
      {valores.map((v, i) => {
        const h = Math.max(1, (v / max) * (altura - 2));
        return (
          <rect
            key={i}
            x={i * w + 0.5}
            y={altura - h}
            width={Math.max(1, w - 1)}
            height={h}
            rx={1}
            fill="var(--amber)"
          />
        );
      })}
    </svg>
  );
}
