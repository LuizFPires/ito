import { useId } from "react";
import { mesAno, numero } from "@ito/formato";
import { anoMes } from "@ito/motor";
import type { DadosObra } from "@ito/carga";
import { Cartao, CartaoCorpo } from "../../ui/componentes";
import { Campo, CampoNumero, Interruptor, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import type { PropsEtapa } from "./Assistente";
import { codigoDaObra, doCampoMes, fimDe, mesesEntre, paraCampoMes, TIPOLOGIAS } from "./estado";

export function EtapaObra({ r, mudar, ctx, faltas }: PropsEtapa & { faltas: string[] }) {
  const d = r.dados;
  const idTipos = useId();
  const idCidades = useId();
  const set = (p: Partial<DadosObra>) => mudar((x) => ({ ...x, dados: { ...x.dados, ...p } }));
  const troca = d.trocas[0];
  const cidade = ctx.cidades.find((c) => c.id === d.cidadeId);
  const fim = d.meses > 0 ? fimDe(d.inicio, d.meses) : null;

  return (
    <Cartao aria-label="Cadastro da obra">
      <CartaoCorpo>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="rotulo">Cadastro da obra concluída</span>
          <div className={f.form}>
            <Campo rotulo="Nome da obra">
              <input
                className={f.input}
                value={d.nome}
                onChange={(e) => {
                  const nome = e.target.value;
                  // o código acompanha o nome enquanto não foi editado à mão
                  const auto = !d.id || d.id === codigoDaObra(d.nome);
                  set(auto ? { nome, id: codigoDaObra(nome) } : { nome });
                }}
              />
            </Campo>
            <Campo rotulo="Código da obra" dica="Identifica a obra no ITO; não muda depois.">
              <input
                className={`${f.input} mono`}
                value={d.id}
                onChange={(e) => set({ id: e.target.value.toLowerCase() })}
              />
            </Campo>
            <Campo rotulo="Cliente">
              <input
                className={f.input}
                value={d.cliente}
                onChange={(e) => set({ cliente: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Tipologia">
              <input
                className={f.input}
                list={idTipos}
                value={d.tipologia}
                onChange={(e) => set({ tipologia: e.target.value })}
              />
            </Campo>
            <datalist id={idTipos}>
              {TIPOLOGIAS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Campo
              rotulo="Cidade"
              dica={cidade ? `${cidade.feriados.length} feriados municipais` : "Digite para buscar"}
            >
              <input
                className={f.input}
                list={idCidades}
                defaultValue={cidade?.nome ?? ""}
                onChange={(e) => {
                  const c = ctx.cidades.find((x) => x.nome === e.target.value);
                  if (c || !e.target.value) set({ cidadeId: c?.id ?? null });
                }}
              />
            </Campo>
            <datalist id={idCidades}>
              {ctx.cidades.map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>
            <CampoNumero
              rotulo="Área construída"
              sufixo="m²"
              valor={d.area}
              casas={2}
              onSalvar={(area) => set({ area })}
            />
            <Campo rotulo="Início da obra">
              <input
                className={f.input}
                type="month"
                value={d.meses > 0 ? paraCampoMes(d.inicio) : ""}
                onChange={(e) => {
                  const ini = doCampoMes(e.target.value);
                  if (!ini) return;
                  const n = fim ? mesesEntre(ini, fim) : 1;
                  set({ inicio: ini, meses: Math.max(0, n), trocas: [] });
                }}
              />
            </Campo>
            <Campo rotulo="Término da obra">
              <input
                className={f.input}
                type="month"
                value={fim ? paraCampoMes(fim) : ""}
                onChange={(e) => {
                  const fm = doCampoMes(e.target.value);
                  if (!fm) return;
                  set({ meses: Math.max(0, mesesEntre(d.inicio, fm)), trocas: [] });
                }}
              />
            </Campo>
            <Campo rotulo="Data-base salarial">
              <Selecao
                value={d.dataBase}
                onChange={(e) => set({ dataBase: Number(e.target.value), trocas: [] })}
              >
                {ctx.datasBase.map((a) => (
                  <option key={a} value={a}>
                    CCT {a}
                    {a === ctx.vigente ? " · vigente" : ""}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Troca de tabela no meio da obra">
              <Selecao
                value={troca?.mesIdx ?? ""}
                disabled={d.meses < 2}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  const outra = ctx.datasBase.find((a) => a !== d.dataBase);
                  set({
                    trocas:
                      e.target.value && outra
                        ? [{ mesIdx: i, dataBase: troca?.dataBase ?? outra, motivo: "" }]
                        : [],
                  });
                }}
              >
                <option value="">Não houve</option>
                {Array.from({ length: Math.max(0, d.meses - 1) }, (_, j) => j + 1).map((i) => {
                  const m = anoMes(d.inicio, i);
                  return (
                    <option key={i} value={i}>
                      A partir de {mesAno(m.ano, m.mes)}
                    </option>
                  );
                })}
              </Selecao>
            </Campo>
            {troca && (
              <Campo rotulo="Nova tabela a partir desse mês">
                <Selecao
                  value={troca.dataBase}
                  onChange={(e) =>
                    set({ trocas: [{ ...troca, dataBase: Number(e.target.value) }] })
                  }
                >
                  {ctx.datasBase
                    .filter((a) => a !== d.dataBase)
                    .map((a) => (
                      <option key={a} value={a}>
                        CCT {a}
                      </option>
                    ))}
                </Selecao>
              </Campo>
            )}
          </div>
          <p className="sub" style={{ margin: 0 }}>
            Use a troca de tabela quando a convenção (dissídio), a desoneração ou a legislação
            mudarem salários, encargos ou benefícios durante a obra. Cada competência é calculada
            com a tabela em vigor naquele mês.
          </p>
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <span className="sub">
              {d.meses > 0
                ? `${numero(d.meses)} ${d.meses === 1 ? "competência" : "competências"}. Se a folha vier antes das datas, elas são preenchidas por ela.`
                : "Sem datas: ao ler a folha, início e término saem das competências dela."}
            </span>
            <Interruptor
              rotulo="Obra fora da sede (alojamento)"
              texto="Obra fora da sede (alojamento)"
              ligado={!!d.premissas.foraDaSede}
              onChange={(v) => set({ premissas: { ...d.premissas, foraDaSede: v } })}
            />
          </div>
          {faltas.length > 0 && (
            <p className={f.aviso} role="status">
              {faltas.join(" ")}
            </p>
          )}
        </div>
      </CartaoCorpo>
    </Cartao>
  );
}
