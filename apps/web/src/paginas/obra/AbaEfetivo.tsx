import { useMemo, useState } from "react";
import { moeda, numero, percentual } from "@ito/formato";
import { useLancamentos } from "../../dados/obras";
import { FORA_DO_CUSTO } from "@ito/motor";
import { useRubricas } from "../../dados/cadastros";
import { Badge, Botao, Cartao, Segmento } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import { BotaoCopiar } from "../../ui/BotaoCopiar";
import { absenteismoMedio, NOME_CONSTRUTORA, porConstrutora } from "./calculos";
import { tabelaEfetivo, tituloObra } from "./exportar";
import type { Aba, DadosAba } from "./comum";
import { NOME_GRUPO_F, ORDEM_GRUPOS, soma } from "./comum";
import type { SetVista } from "./controles";
import { ControleEixo, ControleGrupo } from "./controles";
import s from "./obra.module.css";

export function AbaEfetivo({
  dados,
  setVista,
  irPara,
}: {
  dados: DadosAba;
  setVista: SetVista;
  irPara: (a: Aba) => void;
}) {
  const [modo, setModo] = useState<"eq" | "cab">("eq");
  const [cel, setCel] = useState<{ k: string; i: number } | null>(null);
  const { obra, movimentos, ids, fun, rotulos, vista, d, pode } = dados;
  const n = rotulos.length;
  const area = obra.area;
  const val = (k: string, i: number) =>
    modo === "eq" ? (obra.equivalente[k]?.[i] ?? 0) : (obra.cabecas?.[k]?.[i] ?? 0);
  const mx = Math.max(1, ...ids.flatMap((k) => rotulos.map((_, i) => val(k, i))));
  const fq = (v: number) => numero(v, modo === "eq" ? 1 : 0);
  const tt = rotulos.map((_, i) => soma(ids.map((k) => val(k, i))));
  const ad = rotulos.map((_, i) => soma(ids.map((k) => movimentos.admissoes[k]?.[i] ?? 0)));
  const de = rotulos.map((_, i) => soma(ids.map((k) => movimentos.desligamentos[k]?.[i] ?? 0)));
  const cb = rotulos.map((_, i) => soma(ids.map((k) => obra.cabecas?.[k]?.[i] ?? 0)));
  const totObra = rotulos.map((_, i) =>
    soma(Object.values(obra.equivalente).map((v) => v[i] ?? 0)),
  );
  const lic = obra.licencaPessoaDias;
  const fer = obra.feriasPessoaDias;
  // licenças e férias rateadas pela parte do filtro no efetivo do mês
  const disp = rotulos.map((_, i) => {
    const parte = totObra[i] ? tt[i]! / totObra[i]! : 0;
    return tt[i]! - (((lic[i] ?? 0) + (fer[i] ?? 0)) * parte) / 30;
  });
  const rot = de.slice(0, -1).map((x, i) => (cb[i] ? (x / cb[i]!) * 100 : 0));
  const linhaExtra = (rotulo: string, vals: string[], total: string, sub = "") => (
    <tr key={rotulo} className={s.discreta}>
      <td>{rotulo}</td>
      {vals.map((v, i) => (
        <td key={i} className={f.r}>
          {v}
        </td>
      ))}
      <td className={f.r}>{total}</td>
      <td className="sub">{sub}</td>
    </tr>
  );

  return (
    <>
      <Cartao aria-label="Efetivo por função e mês">
        <div className={f.barra}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
            <span className="rotulo">Efetivo por função e mês</span>
            <span className="sub">
              {pode
                ? "Clique num número para ver quem estava na folha."
                : "A lista de matrículas é restrita ao DP/RH e à controladoria."}
            </span>
          </div>
          <Segmento
            rotulo="Contagem"
            opcoes={[
              { valor: "eq", texto: "Equivalente (dias)" },
              { valor: "cab", texto: "Cabeças" },
            ]}
            valor={modo}
            onChange={setModo}
          />
          <ControleGrupo vista={vista} setVista={setVista} />
          <ControleEixo vista={vista} setVista={setVista} />
          <BotaoCopiar
            tabela={() => tabelaEfetivo(obra, ids, fun, rotulos, tituloObra(dados), modo === "cab")}
          />
        </div>
        <div className={s.mensal}>
          <table className={f.tabela} aria-label="Efetivo">
            <thead>
              <tr>
                <th>Função</th>
                {rotulos.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>{modo === "eq" ? "Pessoa-mês" : "Soma"}</th>
                <th className={f.r}>PM / 1.000 m²</th>
              </tr>
            </thead>
            <tbody>
              {ORDEM_GRUPOS.map((g) => {
                const gk = ids.filter((k) => fun(k).grupo === g);
                if (!gk.length) return null;
                return [
                  <tr key={`g-${g}`} className={s.grupoLinha}>
                    <td colSpan={n + 3}>Mão de obra {NOME_GRUPO_F[g].toLowerCase()}</td>
                  </tr>,
                  ...gk.map((k) => (
                    <tr key={k}>
                      <td className={f.forte}>
                        <span className={s.amostra} style={{ background: fun(k).cor }} />
                        {fun(k).nome}
                        {obra.regime?.[k] === "sp" && (
                          <>
                            {" "}
                            <Badge tom="ambar">S/P</Badge>
                          </>
                        )}
                      </td>
                      {rotulos.map((m, i) => {
                        const v = val(k, i);
                        if (!v)
                          return (
                            <td key={i} className={f.r}>
                              <span className="sub">–</span>
                            </td>
                          );
                        const a = v / mx;
                        const estilo = {
                          background: `color-mix(in srgb, var(--amber) ${Math.round(a * 55)}%, transparent)`,
                          color: a > 0.7 ? "var(--on-amber)" : undefined,
                        };
                        return (
                          <td key={i} className={f.r} style={{ padding: "4px 6px" }}>
                            {pode ? (
                              <button
                                type="button"
                                className={s.celula}
                                style={estilo}
                                aria-pressed={cel?.k === k && cel.i === i}
                                aria-label={`${fun(k).nome} em ${m}: ${fq(v)}`}
                                onClick={() => setCel({ k, i })}
                              >
                                {fq(v)}
                              </button>
                            ) : (
                              <span className={s.celula} style={estilo}>
                                {fq(v)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className={f.r}>{fq(soma(rotulos.map((_, i) => val(k, i))))}</td>
                      <td className={f.r}>
                        {numero((soma(obra.equivalente[k] ?? []) / area) * 1000, 1)}
                      </td>
                    </tr>
                  )),
                  vista.grupo === "todas" && (
                    <tr key={`s-${g}`} className={s.subtotal}>
                      <td>Subtotal {NOME_GRUPO_F[g].toLowerCase()}</td>
                      {rotulos.map((_, i) => (
                        <td key={i} className={f.r}>
                          {fq(soma(gk.map((k) => val(k, i))))}
                        </td>
                      ))}
                      <td className={f.r}>
                        {fq(soma(gk.flatMap((k) => rotulos.map((_, i) => val(k, i)))))}
                      </td>
                      <td />
                    </tr>
                  ),
                ];
              })}
              <tr className="total">
                <td>Total {modo === "eq" ? "(pessoa-mês equivalente)" : "(cabeças)"}</td>
                {tt.map((x, i) => (
                  <td key={i} className={f.r}>
                    {fq(x)}
                  </td>
                ))}
                <td className={f.r}>{fq(soma(tt))}</td>
                <td className={f.r}>
                  {numero((soma(ids.flatMap((k) => obra.equivalente[k] ?? [])) / area) * 1000, 1)}
                </td>
              </tr>
              {linhaExtra(
                "Admissões",
                ad.map((x) => numero(x)),
                numero(soma(ad)),
              )}
              {linhaExtra(
                "Desligamentos",
                de.map((x) => numero(x)),
                numero(soma(de)),
              )}
              {linhaExtra(
                "Rotatividade (desligamentos ÷ cabeças)",
                de.map((x, i) => (cb[i] ? percentual((x / cb[i]!) * 100, 0) : "–")),
                percentual(rot.length ? soma(rot) / rot.length : 0, 1),
                "média s/ último mês",
              )}
              {linhaExtra(
                "Absenteísmo (faltas + afastamentos)",
                obra.absenteismoPct.map((x) => percentual(x)),
                percentual(absenteismoMedio(obra)),
              )}
              {modo === "eq" && (
                <>
                  {linhaExtra(
                    "Licença sem remuneração (pessoa-dias)",
                    lic.map((x) => numero(x)),
                    numero(soma(lic)),
                  )}
                  {linhaExtra(
                    "Férias gozadas (pessoa-dias)",
                    fer.map((x) => numero(x)),
                    numero(soma(fer)),
                  )}
                  <tr className={s.subtotal}>
                    <td>Efetivo disponível (sem licenças e férias)</td>
                    {disp.map((x, i) => (
                      <td key={i} className={f.r}>
                        {numero(x, 1)}
                      </td>
                    ))}
                    <td className={f.r}>{numero(soma(disp), 1)}</td>
                    <td />
                  </tr>
                  {d.realocacoes
                    .filter(
                      (x) =>
                        vista.grupo === "todas" || dados.fun(x.funcao_id).grupo === vista.grupo,
                    )
                    .map((x) =>
                      linhaExtra(
                        `${x.tipo === "cedida" ? "Cedidos a" : "Recebidos de"} ${x.outra_obra} · ${fun(x.funcao_id).nome.toLowerCase()} ${x.tipo === "cedida" ? "(fora do histograma)" : "(incluídos acima)"}`,
                        rotulos.map((_, i) =>
                          i >= x.mes_ini && i <= x.mes_fim ? numero(x.qtd) : "–",
                        ),
                        numero(x.qtd * (Math.min(x.mes_fim, n - 1) - x.mes_ini + 1)),
                      ),
                    )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Cartao>
      <p className="sub" style={{ margin: 0 }}>
        Equivalente: cada pessoa conta pela fração do mês em que esteve na obra (quem entrou no dia
        16 de um mês de 31 dias conta 0,52). Cabeças: quantas pessoas diferentes passaram pela folha
        no mês.
      </p>
      {pode && <PorConstrutora dados={dados} />}
      {pode && cel && (
        <PainelMatriculas
          dados={dados}
          k={cel.k}
          i={cel.i}
          onFechar={() => setCel(null)}
          irPara={irPara}
        />
      )}
    </>
  );
}

function PainelMatriculas({
  dados,
  k,
  i,
  onFechar,
  irPara,
}: {
  dados: DadosAba;
  k: string;
  i: number;
  onFechar: () => void;
  irPara: (a: Aba) => void;
}) {
  const q = useLancamentos(dados.d.obra.id, true);
  const rub = useRubricas();
  const noCusto = new Map(
    (rub.data ?? [])
      .filter((r) => !FORA_DO_CUSTO.includes(r.componente))
      .map((r) => [r.codigo, r.tipo]),
  );
  // remuneração por matrícula no mês: rubricas que entram no custo (descontos negativos)
  // a mesma matrícula pode existir na Clássica e na Ampla (decisão M9)
  const chave = (x: { matricula: string; construtora: string }) =>
    `${x.matricula}|${x.construtora}`;
  const remun = new Map<string, number>();
  for (const r of q.data?.rubricas ?? []) {
    if (r.funcao_id !== k || r.mes_idx !== i || !noCusto.has(r.rubrica_codigo)) continue;
    const v = Number(r.valor);
    const sinal = noCusto.get(r.rubrica_codigo) === "desconto" ? -Math.abs(v) : v;
    remun.set(chave(r), (remun.get(chave(r)) ?? 0) + sinal);
  }
  const linhas = (q.data?.lancamentos ?? []).filter((l) => l.funcao_id === k && l.mes_idx === i);
  const pm = soma(linhas.map((l) => Number(l.equivalente)));
  const he = soma(linhas.map((l) => Number(l.horas_extras)));
  const total = soma([...remun.values()]);
  return (
    <Cartao aria-label="Matrículas do mês">
      <div className={f.barra}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
          <span className="rotulo">
            {dados.fun(k).nome} · {dados.rotulos[i]} · {numero(linhas.length)}{" "}
            {linhas.length === 1 ? "pessoa" : "pessoas"}
          </span>
          <span className="sub">
            {numero(pm, 1)} pessoa-mês · {numero(he)} h extras · {moeda(total, 0)} de remuneração na
            folha
          </span>
        </div>
        <Botao pequeno onClick={() => irPara("pessoas")}>
          Ver todas as pessoas →
        </Botao>
        <Botao pequeno variante="fantasma" onClick={onFechar}>
          Fechar
        </Botao>
      </div>
      {q.isLoading ? (
        <p className="sub" style={{ padding: 22 }}>
          Carregando…
        </p>
      ) : (
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Matrícula</th>
              <th className={f.r}>Pessoa-mês</th>
              <th className={f.r}>HE (h)</th>
              <th className={f.r}>Faltas (h)</th>
              <th className={f.r}>Remuneração na folha</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={chave(l)}>
                <td className="mono">
                  {l.matricula} {l.construtora === "ampla" && <Badge>Ampla</Badge>}{" "}
                  {l.desligado && <Badge tom="ambar">deslig.</Badge>}
                </td>
                <td className={f.r}>{numero(Number(l.equivalente), 2)}</td>
                <td className={f.r}>{numero(Number(l.horas_extras), 1)}</td>
                <td className={f.r}>{numero(Number(l.faltas_horas), 1)}</td>
                <td className={f.r}>{moeda(remun.get(chave(l)) ?? 0, 0)}</td>
                <td className="sub">
                  {[
                    l.admitido && "admitido",
                    l.sem_vt && "sem VT",
                    l.realocada_para && `trabalhou em ${l.realocada_para}`,
                    Number(l.ferias_dias) > 0 && `${numero(Number(l.ferias_dias))} dias de férias`,
                    Number(l.licenca_dias) > 0 &&
                      `${numero(Number(l.licenca_dias))} dias de licença`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "no mês todo"}
                </td>
              </tr>
            ))}
            {!linhas.length && (
              <tr>
                <td colSpan={6} className="sub">
                  Nenhuma matrícula neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <p className="sub" style={{ padding: "12px 22px 18px", margin: 0 }}>
        Sem nomes: o histórico guarda só a matrícula · valores da época (CCT{" "}
        {dados.d.obra.data_base}), como pagos na folha.
      </p>
    </Cartao>
  );
}

/** Efetivo e folha por construtora (Clássica e Ampla na mesma obra, decisão M9). */
function PorConstrutora({ dados }: { dados: DadosAba }) {
  const q = useLancamentos(dados.d.obra.id, true);
  const rub = useRubricas();
  const linhas = useMemo(() => {
    if (!q.data || !rub.data) return [];
    const noCusto = new Map(
      rub.data.filter((r) => !FORA_DO_CUSTO.includes(r.componente)).map((r) => [r.codigo, r.tipo]),
    );
    return porConstrutora(q.data.lancamentos, q.data.rubricas, noCusto, dados.rotulos.length);
  }, [q.data, rub.data, dados.rotulos.length]);
  if (linhas.length < 2) return null;
  return (
    <Cartao aria-label="Efetivo por construtora">
      <div className={f.barra}>
        <span className="rotulo">Efetivo por construtora</span>
        <span className="sub">
          Pessoa-mês e, abaixo, a remuneração na folha (rubricas que entram no custo) de quem estava
          fichado em cada construtora
        </span>
      </div>
      <div className={s.mensal}>
        <table className={f.tabela} aria-label="Pessoa-mês por construtora">
          <thead>
            <tr>
              <th>Construtora</th>
              {dados.rotulos.map((m) => (
                <th key={m} className={f.r}>
                  {m}
                </th>
              ))}
              <th className={f.r}>Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.construtora}>
                <td className={f.forte}>{NOME_CONSTRUTORA[l.construtora]}</td>
                {l.pm.map((v, i) => (
                  <td key={i} className={f.r}>
                    {numero(v, 1)}
                    <div className="sub">{moeda(l.remun[i], 0)}</div>
                  </td>
                ))}
                <td className={f.r}>
                  <strong>{numero(soma(l.pm), 1)}</strong>
                  <div className="sub">{moeda(soma(l.remun), 0)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}
