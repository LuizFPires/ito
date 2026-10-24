import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { data as dataBr, numero, parseData, percentual } from "@ito/formato";
import { anoMes, calendarioMes, TIPOS_HE } from "@ito/motor";
import { mensagemErroBanco } from "../../dados/erros";
import type { DetalheObra } from "../../dados/obras";
import { chavesObras, edicao } from "../../dados/obras";
import { Badge, Botao, Cartao, Chip, Segmento } from "../../ui/componentes";
import { Campo, CampoNumero, Interruptor, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { useToast } from "../../ui/toast";
import { absenteismoMedio } from "./calculos";
import type { DadosAba } from "./comum";
import { NOME_HE, soma } from "./comum";
import s from "./obra.module.css";

type LinhaObra = DetalheObra["obra"];

/**
 * Premissas e ausências da obra (PRD §3.2.10). Quem carrega edita (decisão M5): a tela recalcula
 * na hora (o cache da obra muda antes de gravar) e grava ao sair do campo; se o banco recusar,
 * volta ao valor salvo.
 */
export function AbaPremissas({ dados }: { dados: DadosAba }) {
  const { d, fun, ctx, rotulos, obra, pode } = dados;
  const o = d.obra;
  const id = o.id;
  const qc = useQueryClient();
  const avisar = useToast();
  const chave = chavesObras.obra(id);
  const [novoFer, setNovoFer] = useState({ data: "", nome: "" });
  const doBanco = Object.fromEntries(TIPOS_HE.map((t) => [t, Number(o[`he_mix_${t}`])]));
  const chaveMix = TIPOS_HE.map((t) => doBanco[t]).join("|");
  const [mix, setMix] = useState(doBanco);
  const [mixBase, setMixBase] = useState(chaveMix);
  // obra relida (outra aba, outro usuário): mostra o que está gravado
  if (mixBase !== chaveMix) {
    setMixBase(chaveMix);
    setMix(doBanco);
  }

  /**
   * Aplica no cache (recálculo imediato) e grava. Se falhar, desfaz só esta mudança (outra
   * edição feita logo depois continua na tela). No fim, relê a obra do banco.
   */
  async function salvar(
    aplicar: (x: DetalheObra) => DetalheObra,
    desfazer: (atual: DetalheObra, antes: DetalheObra) => DetalheObra,
    gravar: () => Promise<unknown>,
  ) {
    await qc.cancelQueries({ queryKey: chave });
    const antes = qc.getQueryData<DetalheObra>(chave);
    if (antes) qc.setQueryData(chave, aplicar(antes));
    try {
      await gravar();
      avisar("Salvo");
      void qc.invalidateQueries({ queryKey: ["obras", "lista"] });
    } catch (e) {
      const atual = qc.getQueryData<DetalheObra>(chave);
      if (antes && atual) qc.setQueryData(chave, desfazer(atual, antes));
      avisar(mensagemErroBanco(e));
      throw e;
    } finally {
      void qc.invalidateQueries({ queryKey: chave });
    }
  }
  const premissa = (patch: Partial<LinhaObra>) =>
    salvar(
      (x) => ({ ...x, obra: { ...x.obra, ...patch } }),
      (atual, antes) => ({
        ...atual,
        obra: {
          ...atual.obra,
          ...Object.fromEntries(
            Object.keys(patch).map((k) => [k, antes.obra[k as keyof LinhaObra]]),
          ),
        },
      }),
      () => edicao.obra(id, patch),
    );
  /** Desfaz uma lista inteira (regime, trocas, feriados) ao estado de antes. */
  const lista =
    (k: "regime" | "trocas" | "feriados") => (atual: DetalheObra, antes: DetalheObra) => ({
      ...atual,
      [k]: antes[k],
    });
  const ausencia = (
    mes: number,
    campo: "absenteismo_pct" | "licenca_pessoa_dias" | "ferias_pessoa_dias",
    v: number,
  ) =>
    salvar(
      (x) => ({
        ...x,
        competencias: x.competencias.map((c) => (c.mes_idx === mes ? { ...c, [campo]: v } : c)),
      }),
      (atual, antes) => ({
        ...atual,
        competencias: atual.competencias.map((c) =>
          c.mes_idx === mes
            ? { ...c, [campo]: antes.competencias.find((x) => x.mes_idx === mes)?.[campo] ?? 0 }
            : c,
        ),
      }),
      () => edicao.competencia(id, mes, { [campo]: v }),
    );

  const numeroCampo = (campo: keyof LinhaObra, rotulo: string, sufixo: string, casas = 2) => (
    <CampoNumero
      rotulo={rotulo}
      sufixo={sufixo}
      valor={Number(o[campo])}
      casas={casas}
      max={100}
      desabilitado={!pode}
      onSalvar={(v) => premissa({ [campo]: v } as Partial<LinhaObra>)}
    />
  );
  const interruptor = (campo: "provisionar" | "adiantamento", rotulo: string, desc: string) => (
    <div
      className={f.linha}
      style={{
        justifyContent: "space-between",
        padding: "10px 0",
        borderTop: "1px solid var(--line)",
        flexWrap: "nowrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <strong style={{ fontWeight: 500 }}>{rotulo}</strong>
        <span className="sub">{desc}</span>
      </div>
      <Interruptor
        rotulo={rotulo}
        ligado={o[campo]}
        desabilitado={!pode}
        onChange={(v) => void premissa({ [campo]: v } as Partial<LinhaObra>).catch(() => {})}
      />
    </div>
  );
  const mixTotal = soma(Object.values(mix));
  const meses = rotulos;
  const ini = obra.inicio;

  return (
    <>
      <p className="sub" style={{ margin: 0 }}>
        Premissas registradas na carga desta obra. Alterar qualquer uma recalcula os custos e os
        indicadores dela (a rotatividade é só referência para projeções: os movimentos vêm da
        folha).
        {!pode && " Só DP/RH, controladoria ou um administrador alteram."}
      </p>
      <div className={s.dois}>
        <Cartao aria-label="Custos sobre a remuneração">
          <div className={s.corpo}>
            <span className="rotulo">Custos sobre a remuneração</span>
            <div className={f.form}>
              {numeroCampo("grat_premios_pct", "Gratificações e prêmios", "% do salário")}
              {numeroCampo("transf_pct", "Adicional de transferência", "% do salário")}
              {numeroCampo("risco_pct", "Risco", "%")}
              {numeroCampo("lucro_pct", "Lucro", "%")}
              {numeroCampo("trib_lucro_pct", "Tributos sobre o lucro (IR, CSLL)", "%")}
              {numeroCampo(
                "rotatividade_pct",
                "Rotatividade (referência para projeções)",
                "% ao mês",
              )}
              {numeroCampo("adiantamento_pct", "Adiantamento salarial", "% no dia 20", 0)}
            </div>
            <div>
              {interruptor(
                "provisionar",
                "Provisionar férias, 1/3, 13º e GRRF",
                "Desligue se a obra já recebe essas verbas pagas na rescisão",
              )}
              {interruptor(
                "adiantamento",
                "Caixa: adiantamento + saldo no mês seguinte",
                "Na visão caixa, o saldo da folha sai no 5º dia útil do mês seguinte",
              )}
            </div>
          </div>
        </Cartao>
        <Cartao aria-label="Regime e transferência por função">
          <div className={f.barra}>
            <span className="rotulo">Regime e transferência por função</span>
            <span className="sub">
              Folha CLT ou prestador (S/P) · adicional de transferência para quem foi deslocado
            </span>
          </div>
          <table className={f.tabela}>
            <tbody>
              {Object.keys(obra.equivalente).map((k) => {
                const fn = ctx.ctx.funcoes.find((x) => x.id === k);
                const est = fn?.vinculo === "estagio";
                const sp = obra.regime?.[k] === "sp";
                const tr = o.funcoes_transferidas.includes(k);
                return (
                  <tr key={k}>
                    <td className={f.forte}>
                      <span className={s.amostra} style={{ background: fun(k).cor }} />
                      {fun(k).nome}
                    </td>
                    <td className={`${f.r} ${s.semQuebra}`}>
                      {est ? (
                        <Badge tom="ambar">Estágio · bolsa</Badge>
                      ) : !pode ? (
                        <span>{sp ? "Prestador S/P" : "Folha CLT"}</span>
                      ) : (
                        <Segmento
                          rotulo={`Regime de ${fun(k).nome}`}
                          opcoes={[
                            { valor: "clt", texto: "Folha CLT" },
                            { valor: "sp", texto: "Prestador S/P" },
                          ]}
                          valor={sp ? "sp" : "clt"}
                          onChange={(v) => {
                            if (v === (sp ? "sp" : "clt")) return;
                            void salvar(
                              (x) => ({
                                ...x,
                                regime:
                                  v === "sp"
                                    ? [
                                        ...x.regime,
                                        { obra_id: id, funcao_id: k, regime: "sp" as const },
                                      ]
                                    : x.regime.filter((y) => y.funcao_id !== k),
                              }),
                              lista("regime"),
                              () => edicao.regime(id, k, v === "sp"),
                            ).catch(() => {});
                          }}
                        />
                      )}
                    </td>
                    <td className={`${f.r} ${s.nowrap}`}>
                      {!est && !sp && (
                        <Chip
                          ativo={tr}
                          disabled={!pode}
                          onClick={() => {
                            const lista = tr
                              ? o.funcoes_transferidas.filter((x) => x !== k)
                              : [...o.funcoes_transferidas, k];
                            void premissa({ funcoes_transferidas: lista }).catch(() => {});
                          }}
                        >
                          Transf. {percentual(Number(o.transf_pct), 0)}
                        </Chip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Cartao>
      </div>

      <div className={s.dois}>
        <Cartao aria-label="Horas extras por tipo">
          <div className={s.corpo}>
            <div className={f.linha} style={{ justifyContent: "space-between" }}>
              <span className="rotulo">Horas extras por tipo</span>
              <Badge tom={Math.abs(mixTotal - 100) < 0.01 ? "ok" : "erro"}>
                {numero(mixTotal)}% distribuído
              </Badge>
            </div>
            <p className="sub" style={{ margin: 0 }}>
              Participação de cada tipo nas horas extras da obra, lida da folha. Cada tipo é pago
              com o adicional da tabela. Grava quando a soma fecha em 100%.
              {Math.abs(mixTotal - 100) >= 0.01 &&
                " Ainda não gravado: ajuste os tipos para somar 100%."}
            </p>
            <div className={f.form}>
              {TIPOS_HE.map((t) => (
                <CampoNumero
                  key={t}
                  rotulo={NOME_HE[t]}
                  sufixo="%"
                  valor={mix[t]!}
                  casas={2}
                  max={100}
                  desabilitado={!pode}
                  onSalvar={(v) => {
                    const novo = { ...mix, [t]: v };
                    setMix(novo);
                    if (Math.abs(soma(Object.values(novo)) - 100) >= 0.01) return;
                    const patch = Object.fromEntries(TIPOS_HE.map((x) => [`he_mix_${x}`, novo[x]]));
                    return premissa(patch as Partial<LinhaObra>).catch((e) => {
                      const salvo = qc.getQueryData<DetalheObra>(chave)?.obra ?? o;
                      setMix(
                        Object.fromEntries(TIPOS_HE.map((x) => [x, Number(salvo[`he_mix_${x}`])])),
                      );
                      throw e;
                    });
                  }}
                />
              ))}
            </div>
          </div>
        </Cartao>
        <Cartao aria-label="Troca de tabela no meio da obra">
          <div className={s.corpo}>
            <span className="rotulo">Troca de tabela no meio da obra</span>
            <p className="sub" style={{ margin: 0 }}>
              CCT, dissídio, desoneração ou mudança de lei durante a obra. A partir do mês indicado,
              salários, encargos e benefícios saem da nova tabela.
            </p>
            {d.trocas.length ? (
              <table className={f.tabela}>
                <tbody>
                  {d.trocas.map((t) => (
                    <tr key={t.mes_idx}>
                      <td>A partir de {meses[t.mes_idx]}</td>
                      <td>
                        {pode ? (
                          <Selecao
                            aria-label={`Nova tabela a partir de ${meses[t.mes_idx]}`}
                            value={t.data_base}
                            onChange={(e) => {
                              const base = Number(e.target.value);
                              void salvar(
                                (x) => ({
                                  ...x,
                                  trocas: x.trocas.map((y) =>
                                    y.mes_idx === t.mes_idx ? { ...y, data_base: base } : y,
                                  ),
                                }),
                                lista("trocas"),
                                () => edicao.trocaTabela(id, t.mes_idx, base),
                              ).catch(() => {});
                            }}
                          >
                            {ctx.datasBase
                              .filter((a) => a !== o.data_base)
                              .map((a) => (
                                <option key={a} value={a}>
                                  CCT {a}
                                </option>
                              ))}
                          </Selecao>
                        ) : (
                          `CCT ${t.data_base}`
                        )}
                        {t.motivo && <div className="sub">{t.motivo}</div>}
                      </td>
                      <td className={f.r}>
                        {pode && (
                          <Botao
                            pequeno
                            variante="fantasma"
                            onClick={() =>
                              void salvar(
                                (x) => ({
                                  ...x,
                                  trocas: x.trocas.filter((y) => y.mes_idx !== t.mes_idx),
                                }),
                                lista("trocas"),
                                () => edicao.removerTroca(id, t.mes_idx),
                              ).catch(() => {})
                            }
                          >
                            Remover
                          </Botao>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="sub">Toda a obra usa a CCT {o.data_base}.</span>
            )}
            {pode && o.meses > 1 && (
              <NovaTroca
                key={d.trocas.map((t) => t.mes_idx).join(",")}
                meses={meses}
                datasBase={ctx.datasBase.filter((a) => a !== o.data_base)}
                ocupados={d.trocas.map((t) => t.mes_idx)}
                onAdicionar={(mes, base) =>
                  salvar(
                    (x) => ({
                      ...x,
                      trocas: [
                        ...x.trocas,
                        { obra_id: id, mes_idx: mes, data_base: base, motivo: "" },
                      ],
                    }),
                    lista("trocas"),
                    () => edicao.adicionarTroca(id, mes, base),
                  ).catch(() => {})
                }
              />
            )}
          </div>
        </Cartao>
      </div>

      <Cartao aria-label="Feriados municipais">
        <div className={s.corpo}>
          <span className="rotulo">Feriados municipais de {dados.cidade || "cidade da obra"}</span>
          <p className="sub" style={{ margin: 0 }}>
            Somam-se aos nacionais e aos da empresa (Parâmetros → Calendário). Mudam dias úteis, VT
            e DSR do mês.
          </p>
          {d.feriados.length > 0 && (
            <div className={f.linha}>
              {d.feriados.map((x) => (
                <span key={x.data} className={f.tag}>
                  {dataBr(x.data)} · {x.nome}
                  {pode && (
                    <button
                      type="button"
                      aria-label={`Remover feriado ${x.nome}`}
                      onClick={() =>
                        void salvar(
                          (y) => ({ ...y, feriados: y.feriados.filter((z) => z.data !== x.data) }),
                          lista("feriados"),
                          () => edicao.removerFeriado(id, x.data),
                        ).catch(() => {})
                      }
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {pode && (
            <div className={f.linha}>
              <Campo rotulo="Data (dd/mm/aaaa)">
                <input
                  className={f.input}
                  value={novoFer.data}
                  onChange={(e) => setNovoFer((x) => ({ ...x, data: e.target.value }))}
                />
              </Campo>
              <Campo rotulo="Descrição">
                <input
                  className={f.input}
                  placeholder="Ex.: Aniversário da cidade"
                  value={novoFer.nome}
                  onChange={(e) => setNovoFer((x) => ({ ...x, nome: e.target.value }))}
                />
              </Campo>
              <Botao
                pequeno
                variante="escuro"
                disabled={!parseData(novoFer.data) || !novoFer.nome.trim()}
                onClick={() => {
                  const iso = parseData(novoFer.data)!;
                  void salvar(
                    (y) => ({
                      ...y,
                      feriados: [
                        ...y.feriados,
                        { obra_id: id, data: iso, nome: novoFer.nome.trim() },
                      ],
                    }),
                    lista("feriados"),
                    () => edicao.adicionarFeriado(id, iso, novoFer.nome.trim()),
                  )
                    .then(() => setNovoFer({ data: "", nome: "" }))
                    .catch(() => {});
                }}
              >
                Adicionar feriado municipal
              </Botao>
            </div>
          )}
        </div>
      </Cartao>

      <Cartao aria-label="Ausências por mês">
        <div className={f.barra}>
          <span className="rotulo">Ausências por mês</span>
          <span className="sub">
            Faltas e afastamentos (% das horas) e dias de licença sem remuneração e de férias
            gozadas (pessoa-dias, lidos da folha)
          </span>
        </div>
        <div className={s.mensal}>
          <table className={f.tabela} aria-label="Ausências">
            <thead>
              <tr>
                <th />
                {meses.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["absenteismo_pct", "Absenteísmo (%)", obra.absenteismoPct, 1],
                  [
                    "licenca_pessoa_dias",
                    "Licença sem remuneração (dias)",
                    obra.licencaPessoaDias,
                    0,
                  ],
                  ["ferias_pessoa_dias", "Férias gozadas (dias)", obra.feriasPessoaDias, 0],
                ] as const
              ).map(([campo, rotulo, serie, casas]) => (
                <tr key={campo}>
                  <td>{rotulo}</td>
                  {serie.map((v, i) => (
                    <td key={i} className={f.r} style={{ padding: "4px 6px" }}>
                      {pode ? (
                        <CampoNumero
                          rotulo={`${rotulo} em ${meses[i]}`}
                          valor={v}
                          casas={casas}
                          max={campo === "absenteismo_pct" ? 100 : undefined}
                          compacto
                          largura={76}
                          onSalvar={(x) => ausencia(i, campo, x)}
                        />
                      ) : (
                        numero(v, casas)
                      )}
                    </td>
                  ))}
                  <td className={f.r}>
                    <strong>
                      {campo === "absenteismo_pct"
                        ? percentual(absenteismoMedio(obra))
                        : numero(soma(serie))}
                    </strong>
                  </td>
                </tr>
              ))}
              <tr className={s.discreta}>
                <td>Dias úteis do mês (calendário)</td>
                {meses.map((_, i) => {
                  const m = anoMes(ini, i);
                  const c = calendarioMes(
                    m.ano,
                    m.mes,
                    ctx.ctx.calendario,
                    obra.feriadosMunicipais ?? [],
                  );
                  return (
                    <td key={i} className={f.r}>
                      {numero(c.seg)}
                      {c.feriadosUteis > 0 && (
                        <span className="sub"> ({numero(c.feriadosUteis)} fer.)</span>
                      )}
                    </td>
                  );
                })}
                <td />
              </tr>
              <tr className={s.discreta}>
                <td>DSR sobre HE</td>
                {meses.map((_, i) => {
                  const m = anoMes(ini, i);
                  return (
                    <td key={i} className={f.r}>
                      {percentual(
                        calendarioMes(
                          m.ano,
                          m.mes,
                          ctx.ctx.calendario,
                          obra.feriadosMunicipais ?? [],
                        ).dsrPct,
                        1,
                      )}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Cartao>
    </>
  );
}

function NovaTroca({
  meses,
  datasBase,
  ocupados,
  onAdicionar,
}: {
  meses: readonly string[];
  datasBase: readonly number[];
  ocupados: readonly number[];
  onAdicionar: (mes: number, base: number) => Promise<unknown>;
}) {
  const livres = meses.map((_, i) => i).filter((i) => i > 0 && !ocupados.includes(i));
  const [mes, setMes] = useState(livres[0] ?? 1);
  const [base, setBase] = useState(datasBase[0] ?? 0);
  if (!livres.length || !datasBase.length) return null;
  return (
    <div className={f.linha}>
      <Campo rotulo="A partir de">
        <Selecao value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {livres.map((i) => (
            <option key={i} value={i}>
              {meses[i]}
            </option>
          ))}
        </Selecao>
      </Campo>
      <Campo rotulo="Nova tabela">
        <Selecao value={base} onChange={(e) => setBase(Number(e.target.value))}>
          {datasBase.map((a) => (
            <option key={a} value={a}>
              CCT {a}
            </option>
          ))}
        </Selecao>
      </Campo>
      <Botao pequeno variante="escuro" onClick={() => void onAdicionar(mes, base)}>
        Adicionar troca de tabela
      </Botao>
    </div>
  );
}
