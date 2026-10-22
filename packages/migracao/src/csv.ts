/**
 * CSV das tabelas revisáveis da migração (docs/migracao/*.csv): separado por ";" e com BOM, como o
 * Excel em português abre e salva. Números no formato BR (vírgula decimal) na área.
 */

export type LinhaCsv = Record<string, string>;

/** marca de ordem de bytes: o Excel reconhece o arquivo como UTF-8 */
const BOM = String.fromCharCode(0xfeff);

const precisaAspas = (v: string) => /[;"\r\n]/.test(v);
const celula = (v: string) => (precisaAspas(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function escreverCsv(colunas: readonly string[], linhas: readonly LinhaCsv[]): string {
  return (
    BOM +
    [
      colunas.join(";"),
      ...linhas.map((l) => colunas.map((c) => celula(l[c] ?? "")).join(";")),
    ].join("\r\n") +
    "\r\n"
  );
}

export function lerCsv(texto: string): LinhaCsv[] {
  const t = texto.startsWith(BOM) ? texto.slice(1) : texto;
  // separador pelo cabeçalho: ";" (Excel em português) ou "," (Excel em outro idioma)
  const primeira = t.slice(0, t.search(/\r?\n|$/));
  const sep = primeira.includes(";") ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
      continue;
    }
    if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  const [cab, ...resto] = linhas.filter((l) => l.some((c) => c.trim()));
  if (!cab) return [];
  return resto.map((l) => Object.fromEntries(cab.map((c, j) => [c.trim(), (l[j] ?? "").trim()])));
}

/** "4.800", "4800,5" ou "4800.5" → número; vazio ou inválido → null. */
export function numeroBr(v: string | undefined): number | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number(
    t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\.(?=\d{3}\b)/g, ""),
  );
  return Number.isFinite(n) ? n : null;
}
