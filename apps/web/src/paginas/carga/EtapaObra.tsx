import { useId } from "react";
import { mesAno, numero } from "@ito/formato";
import { anoMes } from "@ito/motor";
import type { DadosObra } from "@ito/carga";
import { Cartao, CartaoCorpo, Segmento } from "../../ui/componentes";
import { Campo, CampoNumero, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import type { PropsEtapa } from "./Assistente";
import {
  codigoDaObra,
  doCampoMes,
  fimDe,
  mesesEntre,
  paraCampoMes,
  periodoComFolha,
  TIPOLOGIAS,
} from "./estado";

const SITUACOES = [
  { valor: "concluida", texto: "Concluída" },
  { valor: "andamento", texto: "Em andamento" },
] as const;

export function EtapaObra({ r, mudar, ctx, faltas }: PropsEtapa & { faltas: string[] }) {
  const d = r.dados;
  const idCidades = useId();
  const set = (p: Partial<DadosObra>) => mudar((x) => ({ ...x, dados: { ...x.dados, ...p } }));
  // mudar o período desloca os meses: as escolhas por mês (NF, justificativa do ERP) recomeçam
  const setPeriodo = (p: Partial<DadosObra>) =>
    mudar((x) => ({
      ...x,
      dados: { ...x.dados, ...p, trocas: [] },
      escolhas: { ...x.escolhas, nfMes: {}, justificativas: {} },
    }));
  const troca = d.trocas[0];
  const cidade = ctx.cidades.find((c) => c.id === d.cidadeId);
  const fim = d.meses > 0 ? fimDe(d.inicio, d.meses) : null;
  const outras = ctx.datasBase.filter((a) => a !== d.dataBase);
  const andamento = d.situacao === "andamento";
  // em andamento, o período vai do início à última competência da folha enviada (se houver)
  const comFolha = (x: DadosObra) => (r.leituras ? periodoComFolha(x, r.leituras.folha) : x);

  return (
    <Cartao aria-label="Cadastro da obra">
      <CartaoCorpo>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <span className="rotulo">
              Cadastro da obra {andamento ? "em andamento" : "concluída"}
            </span>
            <Segmento
              rotulo="Situação da obra"
              opcoes={SITUACOES}
              valor={d.situacao ?? "concluida"}
              onChange={(v) => {
                const x = comFolha({ ...d, situacao: v, meses: v === "andamento" ? 0 : d.meses });
                setPeriodo({
                  situacao: v,
                  meses: x.meses,
                  prazoPrevisto: v === "andamento" ? (d.prazoPrevisto ?? null) : null,
                });
              }}
            />
          </div>
          <div className={f.form}>
            <Campo rotulo="Nome da obra">
              <input
                className={f.input}
                value={d.nome}
                onChange={(e) => {
                  const nome = e.target.value;
                  // o código interno da obra (endereço da página) sai do nome
                  set({ nome, id: codigoDaObra(nome) });
                }}
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
              <Selecao value={d.tipologia} onChange={(e) => set({ tipologia: e.target.value })}>
                <option value="">Escolher…</option>
                {TIPOLOGIAS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Selecao>
            </Campo>
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
                  // texto que não é uma cidade da lista: sem cidade (não fica a anterior)
                  if ((c?.id ?? null) !== d.cidadeId) set({ cidadeId: c?.id ?? null });
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
              min={100}
              onSalvar={(area) => set({ area })}
            />
            <Campo rotulo="Início da obra">
              <input
                className={f.input}
                type="month"
                value={d.meses > 0 || andamento ? paraCampoMes(d.inicio) : ""}
                onChange={(e) => {
                  const ini = doCampoMes(e.target.value);
                  if (!ini) return;
                  if (andamento) {
                    setPeriodo({
                      inicio: ini,
                      meses: comFolha({ ...d, inicio: ini, meses: 0 }).meses,
                    });
                    return;
                  }
                  const n = fim ? mesesEntre(ini, fim) : 1;
                  setPeriodo({ inicio: ini, meses: Math.max(0, n) });
                }}
              />
            </Campo>
            {andamento ? (
              <CampoNumero
                rotulo="Prazo previsto"
                sufixo="meses"
                valor={d.prazoPrevisto ?? 0}
                casas={0}
                max={120}
                dica="0 = sem prazo previsto"
                onSalvar={(v) => set({ prazoPrevisto: v || null })}
              />
            ) : (
              <Campo rotulo="Término da obra">
                <input
                  className={f.input}
                  type="month"
                  value={fim ? paraCampoMes(fim) : ""}
                  onChange={(e) => {
                    const fm = doCampoMes(e.target.value);
                    if (!fm) return;
                    setPeriodo({ meses: Math.max(0, mesesEntre(d.inicio, fm)) });
                  }}
                />
              </Campo>
            )}
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
            <Campo
              rotulo="Troca de tabela"
              dica={outras.length ? undefined : "Só há uma data-base cadastrada"}
            >
              <Selecao
                value={troca?.mesIdx ?? ""}
                disabled={d.meses < 2 || !outras.length}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  // sugere a data-base seguinte à da obra (dissídio); senão, a mais próxima
                  const outra =
                    outras.filter((a) => a > d.dataBase).sort((a, b) => a - b)[0] ?? outras[0];
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
                  {outras.map((a) => (
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
              {andamento
                ? `Em andamento: a folha de cada mês é lançada depois, no detalhe da obra. Envie agora a folha dos meses que já passaram ou comece a obra sem folha.${d.meses > 0 ? ` A folha enviada vai até o ${numero(d.meses)}º mês.` : ""}`
                : d.meses > 0
                  ? `${numero(d.meses)} ${d.meses === 1 ? "competência" : "competências"} · o primeiro e o último mês entram pela fração de dias de vínculo de cada pessoa (aba Pessoas da folha).`
                  : "Sem datas: ao ler a folha, início e término saem das competências dela."}
            </span>
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
