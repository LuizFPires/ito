import { useState } from "react";
import { numero, percentual } from "@ito/formato";
import { useLancamentos } from "../../dados/obras";
import { Cartao, Segmento } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import type { DadosAba } from "./comum";
import { NOME_GRUPO_F, ORDEM_GRUPOS, soma } from "./comum";
import type { SetVista } from "./controles";
import { ControleEixo, ControleGrupo } from "./controles";
import s from "./obra.module.css";

export function AbaEfetivo({ dados, setVista }: { dados: DadosAba; setVista: SetVista }) {
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
                        {obra.regime?.[k] === "sp" && <span className="sub"> · S/P</span>}
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
                percentual(soma(obra.absenteismoPct) / Math.max(1, n)),
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
      {pode && cel && (
        <PainelMatriculas dados={dados} k={cel.k} i={cel.i} onFechar={() => setCel(null)} />
      )}
    </>
  );
}

function PainelMatriculas({
  dados,
  k,
  i,
  onFechar,
}: {
  dados: DadosAba;
  k: string;
  i: number;
  onFechar: () => void;
}) {
  const q = useLancamentos(dados.d.obra.id, true);
  const linhas = (q.data?.lancamentos ?? []).filter((l) => l.funcao_id === k && l.mes_idx === i);
  return (
    <Cartao aria-label="Matrículas do mês">
      <div className={f.barra}>
        <span className="rotulo">
          {dados.fun(k).nome} · {dados.rotulos[i]}
        </span>
        <span className="sub">Sem nomes: o histórico guarda só a matrícula.</span>
        <button
          type="button"
          className={f.linkAcao}
          onClick={onFechar}
          style={{ marginLeft: "auto" }}
        >
          Fechar
        </button>
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
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.matricula}>
                <td className="mono">{l.matricula}</td>
                <td className={f.r}>{numero(Number(l.equivalente), 2)}</td>
                <td className={f.r}>{numero(Number(l.horas_extras), 1)}</td>
                <td className={f.r}>{numero(Number(l.faltas_horas), 1)}</td>
                <td className="sub">
                  {[
                    l.admitido && "admitido",
                    l.desligado && "desligado",
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
                <td colSpan={5} className="sub">
                  Nenhuma matrícula neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </Cartao>
  );
}
