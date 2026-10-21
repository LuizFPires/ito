import { useMemo, useState } from "react";
import { MESES, moeda, numero, parseNumero, percentual } from "@ito/formato";
import {
  nomeCidade,
  nomeCurtoCct,
  useAjustarCct,
  useAtualizarCct,
  useAtualizarCidade,
  useCct,
  useCcts,
  useCidades,
  useCriarCct,
  useDuplicarCct,
  useExcluirCct,
  useGravarBeneficioCct,
  useGravarValorCct,
} from "../../dados/cidades";
import type { CctResumo } from "../../dados/cidades";
import {
  NOME_GRUPO,
  useBeneficios,
  useDataBase,
  useFuncoes,
  useParametros,
} from "../../dados/cadastros";
import type { GrupoFuncao } from "../../dados/cadastros";
import { valorOuEmpresa } from "../../lib/ccts";
import { codigoDe, contemTermos, ordenar, paginar } from "../../lib/lista";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import { Campo, CampoBusca, CampoNumero, Paginacao, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import s from "./cidades.module.css";
import { CompararCcts } from "./CompararCcts";

const POR_PAGINA = 10;
const MAX_COMPARAR = 4;
type OrdemCct = "nome" | "base" | "sal" | "cid";

export function AbaConvencoes({ pode }: { pode: boolean }) {
  const { data: ccts } = useCcts();
  const { data: cidades } = useCidades();
  const criar = useCriarCct();
  const [q, setQ] = useState("");
  const [ordem, setOrdem] = useState<OrdemCct>("nome");
  const [pagina, setPagina] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [comparando, setComparando] = useState(false);

  const cidadesDe = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of cidades ?? []) (m[c.cct_id] ??= []).push(nomeCidade(c));
    return m;
  }, [cidades]);

  const lista = useMemo(() => {
    const filtradas = (ccts ?? []).filter((t) =>
      contemTermos(`${t.nome} ${(cidadesDe[t.id] ?? []).join(" ")}`, q),
    );
    const dir = ordem === "sal" || ordem === "cid" ? -1 : 1;
    return ordenar(filtradas, { chave: ordem, dir }, (t, k) =>
      k === "nome"
        ? t.nome
        : k === "base"
          ? t.mes_data_base
          : k === "sal"
            ? (t.salarioOficial ?? 0)
            : (cidadesDe[t.id]?.length ?? 0),
    );
  }, [ccts, cidadesDe, q, ordem]);
  const pg = paginar(lista, pagina, POR_PAGINA);
  const atual = (ccts ?? []).find((t) => t.id === (sel ?? pg.itens[0]?.id));
  const paraComparar = marcadas
    .map((id) => (ccts ?? []).find((t) => t.id === id))
    .filter((t): t is CctResumo => !!t);

  function novaCct() {
    const base = "Nova convenção";
    let nome = base;
    for (let i = 2; (ccts ?? []).some((t) => t.nome.toLowerCase() === nome.toLowerCase()); i++)
      nome = `${base} ${i}`;
    const id = `${codigoDe(nome)}_${Date.now().toString(36)}`.slice(0, 48);
    criar.mutate(
      { id, nome },
      {
        onSuccess: () => {
          setQ("");
          setSel(id);
          setComparando(false);
        },
      },
    );
  }

  function marcar(id: string, v: boolean) {
    setMarcadas((m) => (v ? [...m, id].slice(0, MAX_COMPARAR) : m.filter((x) => x !== id)));
  }

  return (
    <div className={s.divisao}>
      <div className={s.trilho}>
        <Cartao style={{ overflow: "hidden" }}>
          <div className={s.trilhoTopo}>
            <CampoBusca
              rotulo="Buscar convenção ou cidade"
              placeholder="Buscar convenção ou cidade"
              valor={q}
              onChange={(v) => {
                setQ(v);
                setPagina(1);
              }}
            />
            <div className={f.linha} style={{ justifyContent: "space-between" }}>
              <label className={s.ordenar}>
                Ordenar
                <Selecao
                  value={ordem}
                  style={{ width: "auto", minHeight: 32, borderRadius: 999, fontSize: 12 }}
                  onChange={(e) => setOrdem(e.target.value as OrdemCct)}
                >
                  <option value="nome">Nome</option>
                  <option value="base">Mês da data-base</option>
                  <option value="sal">Maior salário</option>
                  <option value="cid">Mais cidades</option>
                </Selecao>
              </label>
              {pode && (
                <Botao pequeno variante="escuro" onClick={novaCct} disabled={criar.isPending}>
                  + Nova
                </Botao>
              )}
            </div>
          </div>
          <ul className={s.lista} aria-label="Convenções">
            {pg.itens.map((t) => {
              const ativa = t.id === atual?.id && !comparando;
              const marcada = marcadas.includes(t.id);
              return (
                <li key={t.id} className={s.item} data-ativa={ativa || undefined}>
                  <input
                    type="checkbox"
                    className={s.marca}
                    checked={marcada}
                    disabled={!marcada && marcadas.length >= MAX_COMPARAR}
                    aria-label={`Comparar ${t.nome}`}
                    onChange={(e) => marcar(t.id, e.target.checked)}
                  />
                  <button
                    type="button"
                    className={s.itemBotao}
                    aria-current={ativa || undefined}
                    onClick={() => {
                      setSel(t.id);
                      setComparando(false);
                    }}
                  >
                    <strong title={t.nome}>{nomeCurtoCct(t.nome)}</strong>
                    <span className="sub">
                      {numero(cidadesDe[t.id]?.length ?? 0)} cidade(s) · data-base{" "}
                      {MESES[t.mes_data_base - 1]} · oficial {moeda(t.salarioOficial, 0)}
                    </span>
                  </button>
                </li>
              );
            })}
            {!pg.itens.length && (
              <li className="sub" style={{ padding: 20, textAlign: "center" }}>
                Nenhuma convenção encontrada. Limpe a busca.
              </li>
            )}
          </ul>
          <Paginacao pagina={pg} onPagina={setPagina} nome="convenções" />
        </Cartao>
        {marcadas.length ? (
          <Cartao className={f.painel} style={{ position: "static", gap: 10, padding: 16 }}>
            <span className="rotulo">
              Comparar ({numero(marcadas.length)} de {MAX_COMPARAR})
            </span>
            <div>
              {paraComparar.map((t) => (
                <span key={t.id} className={f.tag}>
                  {nomeCurtoCct(t.nome)}
                </span>
              ))}
            </div>
            <div className={f.linha}>
              <Botao
                pequeno
                variante="escuro"
                disabled={marcadas.length < 2}
                onClick={() => setComparando(true)}
              >
                Comparar lado a lado
              </Botao>
              <Botao
                pequeno
                variante="fantasma"
                onClick={() => {
                  setMarcadas([]);
                  setComparando(false);
                }}
              >
                Limpar
              </Botao>
            </div>
          </Cartao>
        ) : (
          <p className="sub" style={{ margin: "0 4px" }}>
            Marque até {MAX_COMPARAR} convenções para comparar lado a lado.
          </p>
        )}
      </div>

      <div className={s.trabalho}>
        {comparando && paraComparar.length >= 2 ? (
          <CompararCcts ccts={paraComparar} onVoltar={() => setComparando(false)} />
        ) : atual ? (
          <EditorCct
            key={atual.id}
            cct={atual}
            pode={pode}
            cidadesDaCct={cidadesDe[atual.id] ?? []}
            onDuplicada={(id) => {
              setQ("");
              setSel(id);
            }}
            onExcluida={() => setSel(null)}
          />
        ) : (
          <Cartao className={f.painel} style={{ position: "static" }}>
            <p className="sub" style={{ margin: 0 }}>
              Cadastre a primeira convenção.
            </p>
          </Cartao>
        )}
      </div>
    </div>
  );
}

function EditorCct({
  cct,
  pode,
  cidadesDaCct,
  onDuplicada,
  onExcluida,
}: {
  cct: CctResumo;
  pode: boolean;
  cidadesDaCct: string[];
  onDuplicada: (id: string) => void;
  onExcluida: () => void;
}) {
  const { data: det } = useCct(cct.id);
  const { data: ccts } = useCcts();
  const { data: cidades } = useCidades();
  const { data: funcoes } = useFuncoes();
  const { data: bens } = useBeneficios();
  const { data: params } = useParametros();
  const vigente = params?.data_base_vigente ?? undefined;
  const { data: empresa } = useDataBase(vigente);
  const atualizar = useAtualizarCct();
  const salario = useGravarValorCct("cct_salarios");
  const grat = useGravarValorCct("cct_gratificacoes");
  const beneficio = useGravarBeneficioCct();
  const duplicar = useDuplicarCct();
  const excluir = useExcluirCct();
  const ajustar = useAjustarCct();
  const vincular = useAtualizarCidade();
  const [nome, setNome] = useState(cct.nome);
  const [comId, setComId] = useState("");
  const { data: com } = useCct(comId || undefined);
  const outra = (ccts ?? []).find((t) => t.id === comId);
  const [lote, setLote] = useState("5");
  const [erroLote, setErroLote] = useState<string | null>(null);

  if (!det || !empresa) return <p className="sub">Carregando…</p>;

  const grupos = Object.entries(NOME_GRUPO) as [GrupoFuncao, string][];
  const ativas = (funcoes ?? []).filter((x) => x.ativo);
  const livres = (cidades ?? []).filter((c) => c.cct_id !== cct.id);

  function aplicarLote() {
    const pct = parseNumero(lote);
    if (pct === null || pct < -50 || pct > 100)
      return setErroLote("Informe um percentual entre -50% e 100% (ex.: 5 ou 5,5).");
    setErroLote(null);
    ajustar.mutate({ id: cct.id, pct });
  }

  function duplicarCct() {
    const n = `${cct.nome} (cópia)`;
    const id = `${codigoDe(cct.id)}_c${Date.now().toString(36)}`.slice(0, 48);
    duplicar.mutate({ origem: cct.id, id, nome: n }, { onSuccess: () => onDuplicada(id) });
  }

  return (
    <>
      <Cartao
        className={f.painel}
        style={{ position: "static" }}
        aria-label={`Convenção ${cct.nome}`}
      >
        <div className={f.linha} style={{ alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 300px" }}>
            <Campo rotulo="Nome da convenção">
              <input
                className={f.input}
                value={nome}
                disabled={!pode}
                onChange={(e) => setNome(e.target.value)}
                onBlur={() => {
                  const n = nome.trim();
                  if (!n) return setNome(cct.nome);
                  if (n !== cct.nome)
                    atualizar
                      .gravar({ id: cct.id, patch: { nome: n } })
                      .catch(() => setNome(cct.nome));
                }}
              />
            </Campo>
          </div>
          {pode && (
            <div className={f.linha}>
              <Botao pequeno onClick={duplicarCct} disabled={duplicar.isPending}>
                Duplicar
              </Botao>
              {!cidadesDaCct.length && (
                <Botao
                  pequeno
                  variante="fantasma"
                  onClick={() =>
                    window.confirm(
                      `Excluir a convenção "${cct.nome}"? Esta ação não pode ser desfeita.`,
                    ) && excluir.mutate(cct.id, { onSuccess: onExcluida })
                  }
                >
                  Excluir
                </Botao>
              )}
            </div>
          )}
        </div>

        <span className="rotulo">Cidades onde vale</span>
        <div className={f.linha} style={{ gap: 6 }}>
          {cidadesDaCct.length ? (
            cidadesDaCct.map((c) => (
              <span key={c} className={f.tag} style={{ margin: 0 }}>
                {c}
              </span>
            ))
          ) : (
            <span className="sub">Nenhuma cidade vinculada.</span>
          )}
          {pode && livres.length > 0 && (
            <Selecao
              aria-label="Vincular cidade"
              value=""
              style={{ width: "auto", minHeight: 30, borderRadius: 999, fontSize: 12 }}
              onChange={(e) => {
                if (e.target.value)
                  vincular.gravar({ id: e.target.value, patch: { cct_id: cct.id } });
              }}
            >
              <option value="">+ vincular cidade…</option>
              {livres.map((c) => (
                <option key={c.id} value={c.id}>
                  {nomeCidade(c)} (hoje:{" "}
                  {nomeCurtoCct((ccts ?? []).find((t) => t.id === c.cct_id)?.nome ?? "—")})
                </option>
              ))}
            </Selecao>
          )}
        </div>
      </Cartao>

      <div className={s.duasColunas}>
        <Cartao
          className={f.painel}
          style={{ position: "static" }}
          aria-label="Data-base da convenção"
        >
          <span className="rotulo">Data-base</span>
          <div className={f.form}>
            <Campo rotulo="Mês">
              <Selecao
                value={cct.mes_data_base}
                disabled={!pode}
                onChange={(e) =>
                  atualizar.gravar({ id: cct.id, patch: { mes_data_base: Number(e.target.value) } })
                }
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <CampoNumero
              rotulo="Reajuste estimado"
              sufixo="%"
              min={-50}
              max={100}
              valor={Number(cct.reajuste_estimado_pct)}
              desabilitado={!pode}
              onSalvar={(v) =>
                atualizar.gravar({ id: cct.id, patch: { reajuste_estimado_pct: v } })
              }
            />
          </div>
          <span className="sub">Aplicado nos meses de projeção depois da data-base.</span>
        </Cartao>

        <Cartao
          className={f.painel}
          style={{ position: "static" }}
          aria-label="Benefícios da convenção"
        >
          <span className="rotulo">Benefícios (R$/pessoa/mês)</span>
          <div className={f.form} style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(bens ?? []).map((b) => {
              const v = valorOuEmpresa(det.beneficios, empresa.beneficios, b.id);
              return (
                <CampoNumero
                  key={b.id}
                  rotulo={b.so_fora_sede ? `${b.nome} · alojados` : b.nome}
                  valor={v.valor ?? 0}
                  desabilitado={!pode}
                  dica={v.daEmpresa ? "da empresa" : undefined}
                  onSalvar={(valor) =>
                    beneficio.gravar({ cct_id: cct.id, beneficio_id: b.id, valor })
                  }
                />
              );
            })}
          </div>
        </Cartao>
      </div>

      <Cartao style={{ overflow: "hidden" }} aria-label="Salários e gratificações por função">
        <div className={f.barra} style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 500 }}>Salários e gratificações por função</h2>
            <span className="sub">
              Gratificação fixa em R$/mês por pessoa (0 = não tem). Comparado com a tabela da
              empresa ({vigente}){outra ? ` e com ${nomeCurtoCct(outra.nome)}` : ""}.
            </span>
          </div>
          <label className={s.ordenar}>
            Comparar com
            <Selecao
              value={comId}
              style={{ width: "auto", maxWidth: 220, minHeight: 34, borderRadius: 999 }}
              onChange={(e) => setComId(e.target.value)}
            >
              <option value="">só a empresa</option>
              {(ccts ?? [])
                .filter((t) => t.id !== cct.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {nomeCurtoCct(t.nome)}
                  </option>
                ))}
            </Selecao>
          </label>
        </div>
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Função</th>
              <th className={f.r}>Salário</th>
              <th className={f.r}>Gratificação</th>
              <th className={f.r}>Empresa</th>
              {outra && <th className={f.r}>{nomeCurtoCct(outra.nome)}</th>}
            </tr>
          </thead>
          <tbody>
            {grupos.map(([g, nomeG]) => {
              const fs = ativas.filter((x) => x.grupo === g);
              if (!fs.length) return null;
              return [
                <tr key={g} className={f.grupo}>
                  <td colSpan={outra ? 5 : 4}>Mão de obra {nomeG.toLowerCase()}</td>
                </tr>,
                ...fs.map((x) => {
                  const v = valorOuEmpresa(det.salarios, empresa.salarios, x.id);
                  const e = empresa.salarios[x.id];
                  const dif = v.valor !== undefined && e ? (v.valor / e - 1) * 100 : 0;
                  const vc = com
                    ? valorOuEmpresa(com.salarios, empresa.salarios, x.id).valor
                    : undefined;
                  const difc = v.valor !== undefined && vc ? (v.valor / vc - 1) * 100 : 0;
                  return (
                    <tr key={x.id}>
                      <td>
                        <span className={f.amostra} style={{ background: `var(--${x.cor})` }} />
                        <span className={f.forte}>{x.nome}</span>
                        {v.daEmpresa && <div className="sub">da empresa</div>}
                      </td>
                      <td className={f.r}>
                        {pode ? (
                          <CampoNumero
                            compacto
                            rotulo={`Salário de ${x.nome}`}
                            valor={v.valor ?? 0}
                            onSalvar={(valor) =>
                              salario.gravar({ cct_id: cct.id, funcao_id: x.id, valor })
                            }
                          />
                        ) : (
                          moeda(v.valor)
                        )}
                      </td>
                      <td className={f.r}>
                        {pode ? (
                          <CampoNumero
                            compacto
                            rotulo={`Gratificação de ${x.nome}`}
                            valor={det.gratificacoes[x.id] ?? 0}
                            onSalvar={(valor) =>
                              grat.gravar({ cct_id: cct.id, funcao_id: x.id, valor })
                            }
                          />
                        ) : (
                          moeda(det.gratificacoes[x.id] ?? 0)
                        )}
                      </td>
                      <td className={f.r}>
                        {moeda(e)}
                        <div className="sub">
                          <Diferenca pct={dif} />
                        </div>
                      </td>
                      {outra && (
                        <td className={f.r}>
                          {moeda(vc)}
                          <div className="sub">
                            <Diferenca pct={difc} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
        {pode && (
          <div className={f.barra} style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
            <span className="sub">Ajuste em lote:</span>
            <input
              className={`${f.input} ${f.num}`}
              style={{ width: 80 }}
              aria-label="Percentual do ajuste em lote"
              inputMode="decimal"
              value={lote}
              onChange={(e) => setLote(e.target.value)}
            />
            <span className="sub">%</span>
            <Botao pequeno onClick={aplicarLote} disabled={ajustar.isPending}>
              Aplicar a salários e gratificações desta CCT
            </Botao>
            {erroLote && (
              <span className={f.erro} role="alert">
                {erroLote}
              </span>
            )}
          </div>
        )}
      </Cartao>
    </>
  );
}

function Diferenca({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.05) return <span>igual</span>;
  return (
    <Badge tom={pct > 0 ? "ambar" : "neutro"}>{(pct > 0 ? "+" : "") + percentual(pct, 1)}</Badge>
  );
}
