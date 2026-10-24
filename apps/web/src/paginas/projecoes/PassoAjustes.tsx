import { MESES, mesAno, moeda, numero, percentual } from "@ito/formato";
import type { Origem, Premissas, TipoHe } from "@ito/motor";
import {
  anoMes,
  HE_MIX_PADRAO,
  PREMISSAS_PADRAO,
  TIPOS_HE,
  vtDiario,
  vtDiarioDe,
} from "@ito/motor";
import type { ContextoCarga } from "../../dados/carga";
import type { Cidade } from "../../dados/cidades";
import { nomeCidade, nomeCurtoCct } from "../../dados/cidades";
import type { Calculo, Entradas, Precos } from "../../lib/projecaoDoBanco";
import { Badge, Botao, Cartao, Segmento } from "../../ui/componentes";
import { Campo, CampoNumero, Interruptor, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { NOME_HE, soma } from "../obra/comum";
import o from "../obra/obra.module.css";
import { useInfoFuncoes } from "./funcoes";
import { rotulosMeses } from "./projecoes";
import s from "./projecoes.module.css";

const ORIGENS: readonly Origem[] = ["local", "diaria", "aloj"];

/**
 * Passos 4 e 5 do assistente (decisão do usuário, 24/10/2026): "origem" = de onde vem cada
 * função; "premissas" = HE, premissas de custo, regime e transferência, reajuste, licenças e HE
 * por tipo. As quantidades ficam no passo Histograma (PassoHistograma).
 */
export function PassoAjustes({
  parte,
  e,
  up,
  calc,
  contexto,
  precos,
  cidades,
  cctNome,
}: {
  parte: "origem" | "premissas";
  e: Entradas;
  up: (p: Partial<Entradas>) => void;
  calc: Calculo;
  contexto: ContextoCarga;
  precos: Precos;
  cidades: readonly Cidade[];
  cctNome: string | null;
}) {
  const { fun, ordenarFuncoes } = useInfoFuncoes(contexto.ctx);
  const r = calc.r;
  const meses = rotulosMeses(e.inicio, e.prazo);
  const comEfetivo = ordenarFuncoes(r ? r.resultado.funcoes : []);
  const pr: Premissas = { ...PREMISSAS_PADRAO, ...e.premissas };
  const upPrem = (p: Partial<Premissas>) => up({ premissas: { ...e.premissas, ...p } });
  const cid = precos.cidade;
  const de = precos.cidadeOrigem;
  const vtDe = (og: Origem) =>
    !cid ? null : og === "aloj" ? 0 : og === "diaria" ? (de ? vtDiarioDe(cid, de) : null) : null;
  const nomeDe = de ? de.nome.replace(/\/[A-Z]{2}$/, "").replace("Belo Horizonte", "BH") : "fora";
  const reajAuto = !e.reajuste;
  const reaj = calc.reajustes[0];
  const automaticos = calc.reajustes.filter((x) => x.automatico);
  // alojamento e viagens: benefícios só de quem está fora da sede, por pessoa·mês
  const fora = contexto.ctx.beneficios.filter((b) => b.soForaSede).map((b) => b.id);
  const alojamento = (k: string) => {
    const linha = r?.resultado.porFuncao[k] ?? [];
    const pm = soma(linha.map((c) => c.x));
    const v = soma(linha.map((c) => soma(fora.map((b) => c.beneficiosItem[b] ?? 0))));
    return pm ? v / pm : 0;
  };
  const nomeMes = (i: number) => {
    const m = anoMes(e.inicio, i);
    return mesAno(m.ano, m.mes);
  };
  const cct = precos.cct;
  const mix = e.heMix ?? r?.aplicadas.heMixPct ?? HE_MIX_PADRAO;
  const somaMix = soma(TIPOS_HE.map((t) => mix[t] ?? 0));

  return (
    <>
      {parte === "premissas" && (
        <>
          <Cartao aria-label="Horas extras por pessoa·mês">
            <div className={f.barra}>
              <span>
                <strong style={{ fontWeight: 500 }}>Horas extras por pessoa·mês</strong>
                <div className="sub">
                  {e.heMedia === null
                    ? `Das referências: ${numero(r?.aplicadas.heMedia ?? 0, 1)} h.`
                    : "Valor próprio desta projeção."}{" "}
                  Adicionais por tipo da tabela da empresa (dias úteis{" "}
                  {percentual(precos.vigente.heAdicionalPct.util, 0)}); DSR pelo calendário de cada
                  mês.
                </div>
              </span>
              <Interruptor
                rotulo="Usar valor próprio de horas extras"
                ligado={e.heMedia !== null}
                onChange={(v) =>
                  up({ heMedia: v ? Math.round((r?.aplicadas.heMedia ?? 15) * 10) / 10 : null })
                }
              />
            </div>
            {e.heMedia !== null && (
              <div className={s.corpoCartao} style={{ maxWidth: 320 }}>
                <CampoNumero
                  rotulo="Horas extras"
                  sufixo="h por pessoa·mês"
                  valor={e.heMedia}
                  casas={1}
                  max={200}
                  onSalvar={(v) => up({ heMedia: v })}
                />
              </div>
            )}
          </Cartao>

          <div className={s.grade2}>
            <Cartao aria-label="Premissas de custo da obra nova">
              <div className={f.barra}>
                <span className="rotulo">Premissas de custo da obra nova</span>
              </div>
              <div className={s.corpoCartao}>
                <div className={f.form}>
                  <CampoNumero
                    rotulo="Gratificações e prêmios"
                    sufixo="% do salário"
                    valor={pr.gratPremiosPct}
                    max={100}
                    onSalvar={(v) => upPrem({ gratPremiosPct: v })}
                  />
                  <CampoNumero
                    rotulo="Risco"
                    sufixo="%"
                    valor={pr.riscoPct}
                    max={100}
                    onSalvar={(v) => upPrem({ riscoPct: v })}
                  />
                  <CampoNumero
                    rotulo="Lucro"
                    sufixo="%"
                    valor={pr.lucroPct}
                    max={100}
                    onSalvar={(v) => upPrem({ lucroPct: v })}
                  />
                  <CampoNumero
                    rotulo="Tributos sobre o lucro"
                    sufixo="%"
                    valor={pr.tribLucroPct}
                    max={100}
                    onSalvar={(v) => upPrem({ tribLucroPct: v })}
                  />
                  <CampoNumero
                    rotulo="Absenteísmo"
                    sufixo="%"
                    valor={e.absenteismoPct ?? r?.aplicadas.absenteismoPct ?? 0}
                    dica={
                      e.absenteismoPct === null
                        ? "das referências"
                        : `referências: ${numero(r?.aplicadas.absenteismoPct ?? 0, 1)}`
                    }
                    max={100}
                    onSalvar={(v) => up({ absenteismoPct: v })}
                  />
                  <CampoNumero
                    rotulo="Rotatividade"
                    sufixo="% a.m."
                    valor={e.rotatividadePct ?? r?.aplicadas.rotatividadePct ?? 0}
                    dica={e.rotatividadePct === null ? "das referências" : "informada"}
                    max={100}
                    onSalvar={(v) => up({ rotatividadePct: v })}
                  />
                </div>
                <Interruptor
                  rotulo="Provisionar férias, 1/3, 13º e GRRF"
                  texto="Provisionar férias, 1/3, 13º e GRRF (custo por competência)"
                  ligado={pr.provisionar}
                  onChange={(v) => upPrem({ provisionar: v })}
                />
                <Interruptor
                  rotulo="Caixa: adiantamento + saldo no mês seguinte"
                  texto={`Caixa: adiantamento de ${percentual(pr.adiantamentoPct, 0)} no dia 20; saldo no 5º dia útil do mês seguinte`}
                  ligado={pr.adiantamento}
                  onChange={(v) => upPrem({ adiantamento: v })}
                />
              </div>
            </Cartao>

            <Cartao aria-label="Regime por função">
              <div className={f.barra}>
                <span className="rotulo">Regime e transferência por função</span>
                <span className="sub">
                  Prestador S/P: sem encargos de folha, com tributos sobre NF
                </span>
              </div>
              <table className={f.tabela} aria-label="Regime por função">
                <tbody>
                  {comEfetivo.map((k) => {
                    const sp = e.regime[k] === "sp";
                    const tr = pr.funcoesTransferidas.includes(k);
                    return (
                      <tr key={k}>
                        <td className={f.forte}>
                          <span className={o.amostra} style={{ background: fun(k).cor }} />
                          {fun(k).nome}
                        </td>
                        <td className={f.r}>
                          {fun(k).estagio ? (
                            <Badge tom="ambar">Estágio</Badge>
                          ) : (
                            <span
                              className={f.linha}
                              style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}
                            >
                              <Segmento
                                rotulo={`Regime de ${fun(k).nome}`}
                                opcoes={[
                                  { valor: "clt", texto: "Folha CLT" },
                                  { valor: "sp", texto: "Prestador S/P" },
                                ]}
                                valor={sp ? "sp" : "clt"}
                                onChange={(v) => up({ regime: { ...e.regime, [k]: v } })}
                              />
                              {!sp && (
                                <Interruptor
                                  rotulo={`Adicional de transferência para ${fun(k).nome}`}
                                  texto={`Transf. ${percentual(pr.transfPct, 0)}`}
                                  ligado={tr}
                                  onChange={(v) =>
                                    upPrem({
                                      funcoesTransferidas: v
                                        ? [...pr.funcoesTransferidas, k]
                                        : pr.funcoesTransferidas.filter((x) => x !== k),
                                    })
                                  }
                                />
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Cartao>
          </div>

          <div className={s.grade2}>
            <Cartao aria-label="Reajuste e calendário no prazo">
              <div className={f.barra}>
                <span className="rotulo">Reajuste e calendário no prazo</span>
              </div>
              <div className={s.corpoCartao}>
                <p className="sub" style={{ margin: 0 }} role="note">
                  {cct
                    ? `A data-base da ${nomeCurtoCct(cctNome ?? "CCT")} é em ${MESES[cct.mesDataBase - 1]}. `
                    : "Sem cidade: a tabela da empresa não tem reajuste automático. "}
                  {reaj
                    ? reaj.automatico
                      ? `Ela cai em ${automaticos.map((x) => nomeMes(x.mesIdx)).join(" e ")}: os meses seguintes saem com ${percentual(reaj.pct, 1)} de reajuste estimado (cadastro da CCT)${automaticos.length > 1 ? ", composto a cada data-base." : "."}`
                      : `Reajuste informado: ${percentual(reaj.pct, 1)} a partir de ${nomeMes(reaj.mesIdx)}.`
                    : e.reajuste
                      ? "Reajuste informado de 0%: sem reajuste no prazo."
                      : cct
                        ? "Ela não cai dentro do prazo desta obra."
                        : ""}
                </p>
                <Interruptor
                  rotulo="Informar o reajuste"
                  texto={
                    e.prazo < 2
                      ? "Informar o reajuste (precisa de ao menos 2 meses de prazo)"
                      : automaticos.length > 1 && reajAuto
                        ? `Informar o reajuste (substitui os ${numero(automaticos.length)} reajustes da data-base)`
                        : "Informar o reajuste (em vez da data-base da CCT)"
                  }
                  desabilitado={e.prazo < 2 && reajAuto}
                  ligado={!reajAuto}
                  onChange={(v) =>
                    up({
                      reajuste: v
                        ? {
                            mesIdx: reaj?.mesIdx ?? 1,
                            pct: reaj?.pct ?? 0,
                          }
                        : null,
                    })
                  }
                />
                {e.reajuste && (
                  <div className={f.form}>
                    <Campo rotulo="Reajuste a partir de">
                      <Selecao
                        value={e.reajuste.mesIdx}
                        onChange={(ev) =>
                          up({ reajuste: { ...e.reajuste!, mesIdx: Number(ev.target.value) } })
                        }
                      >
                        {meses.slice(1).map((m, j) => (
                          <option key={m} value={j + 1}>
                            {m}
                          </option>
                        ))}
                      </Selecao>
                    </Campo>
                    <CampoNumero
                      rotulo="Reajuste previsto"
                      sufixo="%"
                      valor={e.reajuste.pct}
                      min={-50}
                      max={100}
                      onSalvar={(v) => up({ reajuste: { ...e.reajuste!, pct: v } })}
                    />
                  </div>
                )}
                <div className={f.form}>
                  <CampoNumero
                    rotulo="Licenças sem remuneração"
                    sufixo="dias por pessoa·mês"
                    valor={e.licencaPorPm ?? r?.aplicadas.licencaPorPm ?? 0}
                    dica={e.licencaPorPm === null ? "das referências" : "informada"}
                    max={30}
                    onSalvar={(v) => up({ licencaPorPm: v })}
                  />
                  <CampoNumero
                    rotulo="Férias gozadas na obra"
                    sufixo="dias por pessoa·mês"
                    valor={e.feriasPorPm ?? r?.aplicadas.feriasPorPm ?? 0}
                    dica={e.feriasPorPm === null ? "das referências" : "informadas"}
                    max={30}
                    onSalvar={(v) => up({ feriasPorPm: v })}
                  />
                </div>
              </div>
            </Cartao>

            <Cartao aria-label="Horas extras por tipo">
              <div className={f.barra}>
                <span className="rotulo">Horas extras por tipo</span>
                {e.heMix && (
                  <Botao pequeno variante="fantasma" onClick={() => up({ heMix: null })}>
                    Voltar às referências
                  </Botao>
                )}
              </div>
              <div className={s.corpoCartao}>
                <p className="sub" style={{ margin: 0 }}>
                  Distribuição das horas extras {e.heMix ? "informada" : "das referências"}. Cada
                  tipo tem seu adicional (Parâmetros → HE).
                  {Math.round(somaMix) !== 100 &&
                    ` A soma está em ${percentual(somaMix, 0)}; ajuste para 100%.`}
                </p>
                <div className={f.form}>
                  {TIPOS_HE.map((t: TipoHe) => (
                    <CampoNumero
                      key={t}
                      rotulo={NOME_HE[t]}
                      sufixo="%"
                      valor={Math.round((mix[t] ?? 0) * 10) / 10}
                      casas={1}
                      max={100}
                      onSalvar={(v) => up({ heMix: { ...mix, [t]: v } })}
                    />
                  ))}
                </div>
              </div>
            </Cartao>
          </div>
        </>
      )}
      {parte === "origem" && (
        <>
          {cid && (
            <Cartao aria-label="Origem da mão de obra">
              <div className={f.barra}>
                <span>
                  <span className="rotulo">Origem da mão de obra</span>
                  <div className="sub">
                    De onde vem cada função. Muda o VT, o alojamento e as viagens. Salários seguem a
                    CCT de {cid.nome}.
                  </div>
                </span>
                <Campo rotulo="Quem vem de fora sai de">
                  <Selecao
                    value={de?.id ?? ""}
                    onChange={(ev) => up({ cidadeOrigemId: ev.target.value || null })}
                  >
                    {cidades
                      .filter((x) => x.id !== cid.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {nomeCidade(x)}
                        </option>
                      ))}
                  </Selecao>
                </Campo>
              </div>
              <table className={f.tabela} aria-label="Origem por função">
                <thead>
                  <tr>
                    <th>Função</th>
                    <th>Origem</th>
                    <th className={f.r}>VT por dia</th>
                    <th className={f.r}>Alojamento e viagens</th>
                  </tr>
                </thead>
                <tbody>
                  {comEfetivo
                    .filter((k) => !fun(k).estagio)
                    .map((k) => {
                      const og = e.origem[k] ?? "local";
                      const vt = vtDe(og);
                      return (
                        <tr key={k}>
                          <td className={f.forte}>
                            <span className={o.amostra} style={{ background: fun(k).cor }} />
                            {fun(k).nome}
                          </td>
                          <td>
                            <Segmento
                              rotulo={`Origem de ${fun(k).nome}`}
                              opcoes={[
                                { valor: "local", texto: "Local" },
                                { valor: "diaria", texto: `Vem de ${nomeDe} todo dia` },
                                { valor: "aloj", texto: "Alojada" },
                              ]}
                              valor={og}
                              onChange={(v) => up({ origem: { ...e.origem, [k]: v } })}
                            />
                          </td>
                          <td className={f.r}>
                            {e.regime[k] === "sp"
                              ? "prestador S/P"
                              : og === "local"
                                ? moeda(vtDiario(cid))
                                : vt === 0
                                  ? "sem VT"
                                  : vt && typeof vt === "object"
                                    ? `${moeda(vt.valor)}${vt.estimado ? " (estimado)" : ""}`
                                    : "—"}
                          </td>
                          <td className={f.r}>
                            {og === "aloj" && alojamento(k) > 0
                              ? `${moeda(alojamento(k), 0)} por pessoa·mês`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              <div className={f.linha} style={{ padding: "12px 22px 18px" }}>
                <span className="sub">Aplicar a todas:</span>
                {ORIGENS.map((og) => (
                  <Botao
                    key={og}
                    pequeno
                    onClick={() =>
                      up({ origem: Object.fromEntries(comEfetivo.map((k) => [k, og])) })
                    }
                  >
                    {og === "local"
                      ? "Todas locais"
                      : og === "diaria"
                        ? "Todas vindo de fora todo dia"
                        : "Todas alojadas"}
                  </Botao>
                ))}
              </div>
            </Cartao>
          )}
          {!cid && (
            <Cartao>
              <p className="sub" style={{ padding: 22, margin: 0 }}>
                Escolha a cidade da obra no passo Obra: a origem muda o VT, o alojamento e as
                viagens.
              </p>
            </Cartao>
          )}
        </>
      )}
    </>
  );
}
