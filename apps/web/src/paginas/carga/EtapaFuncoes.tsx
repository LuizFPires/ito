import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Pendencias } from "@ito/carga";
import { funcaoDoTexto } from "@ito/carga";
import { numero } from "@ito/formato";
import { useCriarFuncao } from "../../dados/cadastros";
import { codigoDe, contemTermos, paginar } from "../../lib/lista";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import { useToast } from "../../ui/toast";
import { CampoBusca, Interruptor, Paginacao, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import type { PropsEtapa } from "./Assistente";
import { nomeDe } from "./estado";

const POR_PAGINA = 15;

/** Rótulo do botão: só a primeira palavra ("Criar “Tecnico”"). */
const primeira = (t: string) => {
  const w = t.trim().split(/\s+/)[0] ?? "";
  return w.charAt(0) + w.slice(1).toLowerCase();
};

export function EtapaFuncoes({
  r,
  mudar,
  ctx,
  pendentes,
}: PropsEtapa & { pendentes: Pendencias["funcoes"] }) {
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [soPendentes, setSoPendentes] = useState(false);
  const criar = useCriarFuncao("");
  const avisar = useToast();
  const qc = useQueryClient();

  // texto da folha → pico de pessoas num mês
  const linhas = useMemo(() => {
    const folha = r.leituras?.folha;
    const porMes = new Map<string, Map<string, Set<string>>>();
    for (const l of [...(folha?.rubricas ?? []), ...(folha?.pessoas ?? [])]) {
      const k = `${l.comp.ano}-${l.comp.mes}`;
      if (!porMes.has(l.funcao)) porMes.set(l.funcao, new Map());
      const m = porMes.get(l.funcao)!;
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(l.matricula);
    }
    return [...porMes].map(([texto, m]) => ({
      texto,
      pico: Math.max(...[...m.values()].map((x) => x.size)),
    }));
  }, [r.leituras]);

  const pend = new Set(pendentes.map((p) => p.texto));
  const filtradas = linhas
    .filter((l) => contemTermos(l.texto, q) && (!soPendentes || pend.has(l.texto)))
    .sort((a, b) => b.pico - a.pico || a.texto.localeCompare(b.texto));
  const pg = paginar(filtradas, pagina, POR_PAGINA);
  const filtrar = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  const mapear = (texto: string, id: string) =>
    mudar((x) => {
      const funcoes = { ...x.escolhas.funcoes };
      if (id) funcoes[texto] = id;
      else delete funcoes[texto];
      return { ...x, escolhas: { ...x.escolhas, funcoes } };
    });

  const regime = (id: string, sp: boolean) =>
    mudar((x) => {
      const reg = { ...x.dados.regime };
      if (sp) reg[id] = "sp";
      else delete reg[id];
      return { ...x, dados: { ...x.dados, regime: reg } };
    });

  async function criarFuncao(texto: string) {
    const nome = nomeDe(texto);
    // código livre: acrescenta 2, 3… como no protótipo
    const base = codigoDe(nome);
    const usados = new Set(ctx.cadastro.funcoes.map((x) => x.id));
    let id = base;
    for (let i = 2; usados.has(id); i++) id = `${base.slice(0, 30)}${i}`;
    try {
      await criar.gravar({ id, nome, sinonimo: texto });
    } catch {
      return; // o aviso do erro já apareceu
    }
    await qc.invalidateQueries({ queryKey: ["carga", "contexto"] });
    mapear(texto, id);
    avisar(`Função “${nome}” criada e mapeada`);
  }

  return (
    <Cartao aria-label="Dicionário de funções">
      <div className={f.barra}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 260 }}>
          <span className="rotulo">Dicionário de funções</span>
          <span className="sub">
            Cada nome da folha vira uma função padrão. O que você mapear aqui vira sinônimo para as
            próximas cargas.
          </span>
        </div>
        <CampoBusca
          rotulo="Buscar função da folha"
          placeholder="Buscar na folha"
          valor={q}
          onChange={(v) => filtrar(() => setQ(v))}
        />
        <Interruptor
          rotulo="Só pendentes"
          texto={`Só pendentes (${numero(pend.size)})`}
          ligado={soPendentes}
          onChange={(v) => filtrar(() => setSoPendentes(v))}
        />
      </div>
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Como está na folha</th>
            <th className={f.r}>Pessoas (pico)</th>
            <th>Função padrão do ITO</th>
            <th>S/P</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {pg.itens.map((l) => {
            const id = funcaoDoTexto(l.texto, ctx.cadastro, r.escolhas);
            const fn = ctx.funcoes.find((x) => x.id === id);
            const escolhida = r.escolhas.funcoes[l.texto];
            return (
              <tr key={l.texto}>
                <td className="mono" style={{ fontSize: 12, letterSpacing: "0.04em" }}>
                  {l.texto}
                </td>
                <td className={f.r}>{numero(l.pico)}</td>
                <td>
                  <Selecao
                    aria-label={`Função padrão para ${l.texto}`}
                    value={id}
                    className={id ? undefined : f.invalido}
                    onChange={(e) => mapear(l.texto, e.target.value)}
                  >
                    <option value="">Escolher…</option>
                    {ctx.funcoes.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                    {/* sinônimo que aponta para função inativa: aparece para não ficar sem opção */}
                    {id && !fn && (
                      <option value={id}>{ctx.cadastro.nomesFuncoes[id] ?? id} (inativa)</option>
                    )}
                  </Selecao>
                </td>
                <td>
                  {id ? (
                    <Interruptor
                      rotulo={`${l.texto} por prestador S/P`}
                      ligado={r.dados.regime[id] === "sp"}
                      onChange={(v) => regime(id, v)}
                    />
                  ) : (
                    "–"
                  )}
                </td>
                <td>
                  {!id ? (
                    <Botao
                      pequeno
                      variante="escuro"
                      disabled={criar.isPending}
                      onClick={() => criarFuncao(l.texto)}
                    >
                      Criar “{primeira(l.texto)}”
                    </Botao>
                  ) : escolhida ? (
                    <Badge tom="ambar">mapeada agora</Badge>
                  ) : (
                    <Badge tom="ok">reconhecida</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Paginacao pagina={pg} onPagina={setPagina} nome="funções da folha" />
    </Cartao>
  );
}
