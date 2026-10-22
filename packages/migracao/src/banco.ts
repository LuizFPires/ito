/**
 * Acesso ao banco pela API REST do Supabase (migração M9 e dados de desempenho M10): login de
 * quem grava e o contexto de cálculo (cadastros, tabelas da empresa, cidades).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Cadastro, RubricaCadastro } from "@ito/carga";
import type { Contexto, Tabela } from "@ito/motor";
import { contextoDoBanco, tabelaDoBanco } from "../../../apps/web/src/lib/motorDoBanco";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export interface Api {
  ler<R>(caminho: string): Promise<R[]>;
  rpc<R>(nome: string, corpo: unknown): Promise<R>;
  inserir(tabela: string, corpo: unknown): Promise<void>;
  apagar(caminho: string): Promise<void>;
}

function envLocal(): Record<string, string> {
  try {
    const txt = readFileSync(join(REPO, "apps/web/.env.local"), "utf8");
    return Object.fromEntries(
      txt
        .split(/\r?\n/)
        .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim()))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => [m[1]!, m[2]!]),
    );
  } catch {
    return {};
  }
}

export async function conectar(
  args: Record<string, string>,
): Promise<{ api: Api; url: string; usuario: string }> {
  const env = envLocal();
  const url = args.url ?? env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54821";
  const chave = args.chave ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const local = ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
  const email = process.env.ITO_MIGRACAO_EMAIL ?? (local ? "admin@ito.local" : "");
  const senha = process.env.ITO_MIGRACAO_SENHA ?? (local ? "ito-dev-2026" : "");
  if (!email || !senha)
    throw new Error("Informe ITO_MIGRACAO_EMAIL e ITO_MIGRACAO_SENHA (controladoria ou admin).");
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: chave, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!r.ok) throw new Error(`Login recusado (${r.status}). Confira e-mail, senha e a URL.`);
  const { access_token, user } = (await r.json()) as {
    access_token: string;
    user: { id: string };
  };
  const cab = {
    apikey: chave,
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  };
  const falha = async (r: Response, o: string) => {
    if (!r.ok) throw new Error(`${o}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  };
  return {
    url,
    usuario: user.id,
    api: {
      async ler<R>(caminho: string) {
        const todas: R[] = [];
        for (let de = 0; ; de += 1000) {
          const r = await fetch(
            `${url}/rest/v1/${caminho}${caminho.includes("?") ? "&" : "?"}limit=1000&offset=${de}`,
            { headers: cab },
          );
          await falha(r, `GET ${caminho}`);
          const lote = (await r.json()) as R[];
          todas.push(...lote);
          if (lote.length < 1000) return todas;
        }
      },
      async rpc<R>(nome: string, corpo: unknown) {
        const r = await fetch(`${url}/rest/v1/rpc/${nome}`, {
          method: "POST",
          headers: cab,
          body: JSON.stringify(corpo),
        });
        await falha(r, `rpc ${nome}`);
        const t = await r.text();
        return (t ? JSON.parse(t) : null) as R;
      },
      async inserir(tabela: string, corpo: unknown) {
        const r = await fetch(`${url}/rest/v1/${tabela}`, {
          method: "POST",
          headers: cab,
          body: JSON.stringify(corpo),
        });
        await falha(r, `POST ${tabela}`);
      },
      async apagar(caminho: string) {
        const r = await fetch(`${url}/rest/v1/${caminho}`, { method: "DELETE", headers: cab });
        await falha(r, `DELETE ${caminho}`);
      },
    },
  };
}

export interface Contexto9 {
  cadastro: Cadastro;
  ctx: Contexto;
  tabelas: Record<number, Tabela>;
  vigente: number;
  datasBase: number[];
  cidades: {
    id: string;
    nome: string;
    uf: string;
    feriados: { dia: number; mes: number; nome: string }[];
  }[];
  funcoesIds: Set<string>;
  sinonimos: Map<string, string>;
}

export async function carregarContexto(api: Api): Promise<Contexto9> {
  /* eslint-disable @typescript-eslint/no-explicit-any -- linhas do PostgREST, tipadas no app */
  const [
    funcoes,
    sinonimos,
    rubricas,
    beneficios,
    [parametros],
    feriadosEmpresa,
    datas,
    salarios,
    valoresBen,
    encargos,
    cidades,
    ferCid,
  ] = await Promise.all([
    api.ler<any>("funcoes?select=*&order=id"),
    api.ler<any>("funcao_sinonimos?select=*&order=texto"),
    api.ler<any>("rubricas?select=*&order=codigo"),
    api.ler<any>("beneficios?select=*&order=id"),
    api.ler<any>("parametros?select=*"),
    api.ler<any>("feriados_empresa?select=*&order=data"),
    api.ler<any>("datas_base?select=*&order=ano"),
    api.ler<any>("data_base_salarios?select=*&order=ano,funcao_id"),
    api.ler<any>("data_base_beneficios?select=*&order=ano,beneficio_id"),
    api.ler<any>("data_base_encargos?select=*&order=ano,id"),
    api.ler<any>("cidades?select=id,nome,uf&order=id"),
    api.ler<any>("cidade_feriados?select=*&order=cidade_id,mes,dia"),
  ]);
  const tabelas: Record<number, Tabela> = {};
  for (const d of datas)
    tabelas[d.ano] = tabelaDoBanco(
      d,
      Object.fromEntries(
        salarios
          .filter((s: any) => s.ano === d.ano)
          .map((s: any) => [s.funcao_id, Number(s.valor)]),
      ),
      Object.fromEntries(
        valoresBen
          .filter((b: any) => b.ano === d.ano)
          .map((b: any) => [b.beneficio_id, Number(b.valor)]),
      ),
      encargos.filter((e: any) => e.ano === d.ano),
    );
  const cadRubricas: RubricaCadastro[] = rubricas.map((r: any) => ({
    codigo: r.codigo,
    nome: r.nome,
    tipo: r.tipo,
    componente: r.componente,
    baseProvisoes: r.base_provisoes,
    tipoHe: r.tipo_he ?? null,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return {
    cadastro: {
      funcoes: contextoDoBanco(funcoes, [], parametros, []).funcoes,
      nomesFuncoes: Object.fromEntries(
        funcoes.map((f: { id: string; nome: string }) => [f.id, f.nome]),
      ),
      sinonimos: Object.fromEntries(
        sinonimos.map((s: { texto: string; funcao_id: string }) => [s.texto, s.funcao_id]),
      ),
      rubricas: cadRubricas,
    },
    ctx: contextoDoBanco(funcoes, beneficios, parametros, feriadosEmpresa),
    tabelas,
    vigente: parametros.data_base_vigente ?? Math.max(...datas.map((d: { ano: number }) => d.ano)),
    datasBase: datas.map((d: { ano: number }) => d.ano),
    cidades: cidades.map((c: { id: string; nome: string; uf: string }) => ({
      ...c,
      feriados: ferCid
        .filter((f: { cidade_id: string }) => f.cidade_id === c.id)
        .map((f: { dia: number; mes: number; nome: string }) => ({
          dia: f.dia,
          mes: f.mes,
          nome: f.nome,
        })),
    })),
    funcoesIds: new Set(funcoes.map((f: { id: string }) => f.id)),
    sinonimos: new Map(
      sinonimos.map((s: { texto: string; funcao_id: string }) => [s.texto, s.funcao_id]),
    ),
  };
}
