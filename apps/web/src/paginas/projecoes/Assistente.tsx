import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { MESES, mesAno, moeda, numero, percentual } from "@ito/formato";
import type { Reajuste } from "@ito/motor";
import { vtDiario } from "@ito/motor";
import { useSessao } from "../../auth/sessao";
import { nomeCidade, nomeCurtoCct } from "../../dados/cidades";
import { useListaObras } from "../../dados/obras";
import type { ObraLista } from "../../dados/obras";
import {
  origemPadrao,
  useAtualizarProjecao,
  useCriarProjecao,
  usePrecos,
  useProjecao,
  useReferencias,
} from "../../dados/projecoes";
import { contemTermos } from "../../lib/lista";
import { podeProjetar } from "../../lib/permissoes";
import { emAndamento } from "../../lib/situacao";
import type { Entradas } from "../../lib/projecaoDoBanco";
import {
  calcularProjecao,
  entradasDaLinha,
  entradasVazias,
  maisParecidas,
  resumoDaProjecao,
} from "../../lib/projecaoDoBanco";
import { Botao, Cartao, Chip, Segmento } from "../../ui/componentes";
import { Campo, CampoBusca, CampoNumero, Kpi, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { MiniHistograma } from "../../ui/MiniHistograma";
import type { Grupo } from "../base/base";
import { GRUPOS, mediana } from "../base/base";
import { soma } from "../obra/comum";
import { Pagina } from "../Pagina";
import { PassoAjustes } from "./PassoAjustes";
import { PassoHistograma } from "./PassoHistograma";
import { TIPOLOGIAS } from "../carga/estado";
import { manualValido, rotulosMeses } from "./projecoes";
import { Resultado } from "./Resultado";
import s from "./projecoes.module.css";

const PASSOS = [
  ["Obra", "nome, área, prazo, cidade"],
  ["Referências", "obras da base"],
  ["Histograma", "pessoas por função e mês"],
  ["Origem da MO", "local, diária, alojada"],
  ["Premissas", "custo, regime, reajuste, HE"],
  ["Resultado", "revisar e salvar"],
] as const;
const MAX_CANDIDATAS = 60;

/** Nova projeção (`/projecoes/nova`, com `?refs=` vindo da base, da obra ou da comparação). */
export function TelaNovaProjecao() {
  const [busca] = useSearchParams();
  const inicial = useMemo(() => {
    const e = entradasVazias();
    const refs = (busca.get("refs") ?? "").split(",").filter(Boolean);
    return { ...e, referencias: [...new Set(refs)] };
  }, [busca]);
  return <Assistente inicial={inicial} />;
}

/** Editar uma projeção (`/projecoes/:id/editar`): o assistente abre no passo 3. */
export function TelaEditarProjecao() {
  const { id } = useParams();
  const q = useProjecao(id);
  if (q.isLoading)
    return (
      <Pagina grupo="Projeções / Editar" titulo="Editar projeção" resumo="" milestone="M7">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Carregando…
          </p>
        </Cartao>
      </Pagina>
    );
  if (!q.data)
    return (
      <Pagina grupo="Projeções / Editar" titulo="Projeção não encontrada" resumo="" milestone="M7">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            {q.isError
              ? "Não foi possível carregar a projeção. Atualize a página."
              : "Esta projeção não existe ou foi apagada."}{" "}
            <Link to="/projecoes">Voltar às projeções</Link>
          </p>
        </Cartao>
      </Pagina>
    );
  return (
    <Assistente
      key={q.data.id}
      id={q.data.id}
      inicial={entradasDaLinha(q.data)}
      aprovada={q.data.situacao === "aprovada"}
      passoInicial={3}
    />
  );
}

function Assistente({
  inicial,
  id,
  aprovada,
  passoInicial = 1,
}: {
  inicial: Entradas;
  id?: string;
  aprovada?: boolean;
  passoInicial?: number;
}) {
  const { usuario } = useSessao();
  const pode = podeProjetar(usuario) && !aprovada;
  const navegar = useNavigate();
  const [e, setE] = useState(inicial);
  const [passo, setPasso] = useState(passoInicial);
  const up = (p: Partial<Entradas>) => setE((x) => ({ ...x, ...p }));
  const { contexto, cidades, cct, precos, erro } = usePrecos(e.cidadeId, e.cidadeOrigemId);
  const refsQ = useReferencias(e.referencias);
  const lista = useListaObras();
  const criar = useCriarProjecao();
  const atualizar = useAtualizarProjecao();

  // só obras concluídas servem de referência (M11): a em andamento vinda da seleção sai
  const concluidas = useMemo(() => (lista.data ?? []).filter((o) => !emAndamento(o)), [lista.data]);
  const andamento = (lista.data ?? []).filter(emAndamento);
  const [tiradas, setTiradas] = useState<string[]>([]);
  if (e.referencias.some((r) => andamento.some((o) => o.id === r))) {
    setTiradas(andamento.filter((o) => e.referencias.includes(o.id)).map((o) => o.nome));
    setE((x) => ({
      ...x,
      referencias: x.referencias.filter((r) => !andamento.some((o) => o.id === r)),
    }));
  }

  const refs = useMemo(
    () => (refsQ.data ?? []).filter((b) => e.referencias.includes(b.obra.id)),
    [refsQ.data, e.referencias],
  );
  const ctx = contexto?.ctx;
  const calc = useMemo(
    () =>
      precos && ctx ? calcularProjecao(e, e.referencias.length ? refs : [], precos, ctx) : null,
    [e, refs, precos, ctx],
  );

  const titulo = e.nome.trim() || (id ? "Editar projeção" : "Nova projeção");
  const grupo = (
    <>
      <Link to="/projecoes">Projeções</Link> / {id ? "Editar" : "Nova"}
    </>
  );
  if (!pode)
    return (
      <Pagina grupo={grupo} titulo={titulo} resumo="" milestone="M7">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            {aprovada
              ? "Projeção aprovada não é editada. Duplique-a ou peça a quem aprova para voltá-la a Em análise."
              : "Seu perfil só consulta projeções. Planejamento, engenharia e controladoria criam e editam."}{" "}
            <Link to={id ? `/projecoes/${id}` : "/projecoes"}>Voltar</Link>
          </p>
        </Cartao>
      </Pagina>
    );

  const manual = manualValido(e.quantidadesManuais, e.prazo);
  const okObra = !!e.nome.trim() && e.area > 0 && e.prazo >= 1 && e.prazo <= 120 && !!e.cidadeId;
  const okRefs = e.referencias.length > 0 || manual;
  const pode2 = okObra;
  const pode3 = okObra && okRefs;
  const liberado = (n: number) => n === 1 || (n === 2 ? pode2 : pode3);
  const r = calc?.r ?? null;
  const carregandoRefs =
    e.referencias.length > 0 && !manual && (!refsQ.data || refsQ.isPlaceholderData);

  async function salvar() {
    if (!calc?.r || !contexto || carregandoRefs) return;
    const resumo = resumoDaProjecao(calc, contexto.vigente);
    try {
      if (id) {
        await atualizar.gravar({ id, e, resumo });
        navegar(`/projecoes/${id}`);
      } else {
        const novo = await criar.gravar({ e, resumo });
        navegar(`/projecoes/${novo}`);
      }
    } catch {
      // o aviso já saiu (useGravar)
    }
  }
  const salvando = criar.isPending || atualizar.isPending;

  return (
    <Pagina grupo={grupo} titulo={titulo} resumo="" milestone="M7">
      <div className={f.linha} style={{ justifyContent: "flex-end", marginTop: -12 }}>
        <Botao onClick={() => navegar(id ? `/projecoes/${id}` : "/projecoes")}>Cancelar</Botao>
        {passo === 6 && (
          <Botao variante="primario" disabled={!r || salvando || carregandoRefs} onClick={salvar}>
            Salvar projeção →
          </Botao>
        )}
      </div>
      {tiradas.length > 0 && (
        <p className={f.aviso} role="status">
          {tiradas.map((n) => `“${n}”`).join(", ")} saiu das referências: só obras concluídas servem
          de referência. Conclua a obra para usá-la de novo.
        </p>
      )}
      <ol className={s.passos} aria-label="Passos">
        {PASSOS.map(([nome, sub], i) => (
          <li key={nome}>
            <button
              type="button"
              className={s.passo}
              aria-current={passo === i + 1 ? "step" : undefined}
              disabled={!liberado(i + 1)}
              onClick={() => setPasso(i + 1)}
            >
              <span className={`${s.ponto} ${i + 1 < passo ? s.feito : ""}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                {nome}
                <small>{sub}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {erro && (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            Não foi possível carregar os preços ou os cadastros. Atualize a página.
          </p>
        </Cartao>
      )}

      {passo < 6 && r && (
        <div className={f.kpis} aria-label="Resumo da projeção">
          <Kpi
            rotulo="Custo total"
            valor={moeda(r.total, 0)}
            sub={`CCT ${contexto?.vigente ?? ""}`}
            destaque
          />
          <Kpi
            rotulo="Pico"
            valor={`${numero(r.pico)} pessoas`}
            sub={`${numero(r.pessoaMes)} pessoa-mês`}
          />
          <Kpi
            rotulo="Custo / m²"
            valor={moeda(r.total / e.area, 0)}
            sub={`sobre ${numero(e.area)} m²`}
          />
        </div>
      )}

      {passo === 1 && (
        <PassoObra
          e={e}
          up={up}
          cidades={cidades}
          cct={cct}
          precos={precos}
          reajustes={calc?.reajustes ?? []}
          funcoes={contexto?.funcoes ?? []}
        />
      )}
      {passo === 2 && (
        <PassoReferencias
          e={e}
          up={up}
          lista={concluidas}
          vigente={contexto?.vigente}
          cidades={cidades}
          onManual={() => {
            const das =
              refs.length && precos && ctx
                ? calcularProjecao({ ...e, quantidadesManuais: null }, refs, precos, ctx).r
                : null;
            up({
              quantidadesManuais: Object.fromEntries(
                (contexto?.funcoes ?? []).map((x) => [
                  x.id,
                  das?.obra.equivalente[x.id]
                    ? [...das.obra.equivalente[x.id]!]
                    : Array<number>(e.prazo).fill(0),
                ]),
              ),
            });
            setPasso(3);
          }}
        />
      )}
      {passo === 3 && calc && contexto && (
        <PassoHistograma e={e} up={up} calc={calc} contexto={contexto} />
      )}
      {(passo === 4 || passo === 5) && calc && contexto && precos && (
        <PassoAjustes
          parte={passo === 4 ? "origem" : "premissas"}
          e={e}
          up={up}
          calc={calc}
          contexto={contexto}
          precos={precos}
          cidades={cidades}
          cctNome={cct?.nome ?? null}
        />
      )}
      {passo === 6 && calc && contexto && (
        <Resultado
          e={e}
          calc={calc}
          contexto={contexto}
          referencias={refs}
          cidade={precos?.cidade?.nome ?? null}
          cct={cct ? nomeCurtoCct(cct.nome) : null}
          origem={precos?.cidadeOrigem?.nome ?? null}
        />
      )}

      <div className={s.rodape}>
        <Botao disabled={passo === 1} onClick={() => setPasso(passo - 1)}>
          ← Voltar
        </Botao>
        {passo < 6 ? (
          <Botao
            variante="escuro"
            disabled={!liberado(passo + 1)}
            onClick={() => setPasso(passo + 1)}
          >
            Continuar →
          </Botao>
        ) : (
          <Botao variante="primario" disabled={!r || salvando || carregandoRefs} onClick={salvar}>
            Salvar projeção →
          </Botao>
        )}
      </div>
    </Pagina>
  );
}

function PassoObra({
  e,
  up,
  cidades,
  cct,
  precos,
  reajustes,
  funcoes,
}: {
  e: Entradas;
  up: (p: Partial<Entradas>) => void;
  cidades: ReturnType<typeof usePrecos>["cidades"];
  cct: ReturnType<typeof usePrecos>["cct"];
  precos: ReturnType<typeof usePrecos>["precos"];
  reajustes: readonly Reajuste[];
  funcoes: readonly { id: string; nome: string }[];
}) {
  const hoje = new Date();
  const opcoesInicio = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });
  if (!opcoesInicio.some((x) => x.ano === e.inicio.ano && x.mes === e.inicio.mes))
    opcoesInicio.unshift(e.inicio);
  // lista fechada (decisão M4); mantém a de uma projeção antiga fora da lista
  const tipologias =
    e.tipologia && !TIPOLOGIAS.includes(e.tipologia) ? [...TIPOLOGIAS, e.tipologia] : TIPOLOGIAS;
  const auto = reajustes.filter((x) => x.automatico);
  const gratificacoes = cct ? Object.entries(cct.gratificacoes).filter(([, x]) => x > 0) : [];
  const cid = precos?.cidade;
  const v = precos?.vigente;
  const oficialEmp = v?.salarios.ped;
  const oficial = cct?.salarios.ped ?? oficialEmp;
  const dif = oficial && oficialEmp ? (oficial / oficialEmp - 1) * 100 : 0;
  const valor = (k: string) => cct?.salarios[k] ?? v?.salarios[k];

  return (
    <>
      <Cartao aria-label="Dados da obra em planejamento">
        <div className={f.barra}>
          <span className="rotulo">Dados da obra em planejamento</span>
        </div>
        <div className={f.form} style={{ padding: "0 22px 18px" }}>
          <Campo rotulo="Nome da projeção">
            <input
              className={f.input}
              value={e.nome}
              maxLength={120}
              onChange={(ev) => up({ nome: ev.target.value })}
            />
          </Campo>
          <Campo rotulo="Cliente">
            <input
              className={f.input}
              value={e.cliente}
              maxLength={120}
              onChange={(ev) => up({ cliente: ev.target.value })}
            />
          </Campo>
          <Campo rotulo="Tipologia" dica="Mesma tipologia pesa nas 5 mais parecidas">
            <Selecao value={e.tipologia} onChange={(ev) => up({ tipologia: ev.target.value })}>
              <option value="">Escolha a tipologia…</option>
              {tipologias.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Cidade da obra" dica="Define CCT, VT, ISS e feriados">
            <Selecao
              value={e.cidadeId ?? ""}
              onChange={(ev) => {
                const id = ev.target.value || null;
                up({
                  cidadeId: id,
                  reajuste: id === e.cidadeId ? e.reajuste : null,
                  cidadeOrigemId:
                    e.cidadeOrigemId && e.cidadeOrigemId !== id
                      ? e.cidadeOrigemId
                      : origemPadrao(cidades, id),
                });
              }}
            >
              <option value="">Escolha a cidade…</option>
              {cidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {nomeCidade(c)}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Início previsto">
            <Selecao
              value={`${e.inicio.ano}-${e.inicio.mes}`}
              onChange={(ev) => {
                const [a, m] = ev.target.value.split("-").map(Number);
                up({ inicio: { ano: a!, mes: m! }, reajuste: null });
              }}
            >
              {opcoesInicio.map((x) => (
                <option key={`${x.ano}-${x.mes}`} value={`${x.ano}-${x.mes}`}>
                  {mesAno(x.ano, x.mes)}
                </option>
              ))}
            </Selecao>
          </Campo>
          <CampoNumero
            rotulo="Área construída"
            sufixo="m²"
            valor={e.area}
            casas={0}
            min={100}
            max={10_000_000}
            dica="A partir de 100 m²"
            onSalvar={(x) => up({ area: x })}
          />
          <CampoNumero
            rotulo="Prazo"
            sufixo="meses"
            valor={e.prazo}
            casas={0}
            min={1}
            max={120}
            onSalvar={(x) => {
              const n = Math.round(x);
              up({
                prazo: n,
                // reajuste informado fora do prazo e quantidades de outro tamanho não valem mais
                reajuste: e.reajuste && e.reajuste.mesIdx < n ? e.reajuste : null,
                quantidadesManuais: e.quantidadesManuais
                  ? Object.fromEntries(
                      Object.entries(e.quantidadesManuais).map(([k, a]) => [
                        k,
                        Array.from({ length: n }, (_, j) => a[j] ?? 0),
                      ]),
                    )
                  : null,
              });
            }}
          />
        </div>
      </Cartao>

      {cid && cct && v && (
        <Cartao aria-label={`Preços de ${cid.nome}`}>
          <div className={f.barra}>
            <span className="rotulo">Preços de {cid.nome}</span>
            <Link
              className={`${u.botao} ${u.pequeno}`}
              to="/cidades"
              style={{ textDecoration: "none" }}
            >
              Cidades e CCTs
            </Link>
          </div>
          <div className={s.meta} style={{ padding: "0 22px 18px" }}>
            <span>{nomeCurtoCct(cct.nome)}</span>
            <span>
              Oficial {moeda(oficial)}
              {Math.abs(dif) > 0.5 && ` (${dif > 0 ? "+" : ""}${percentual(dif, 0)} vs. empresa)`}
            </span>
            <span>Servente {moeda(valor("serv"))}</span>
            <span>Mestre {moeda(valor("mestre"))}</span>
            <span>
              Gratificações:{" "}
              {gratificacoes.length
                ? gratificacoes
                    .map(([k, x]) => `${funcoes.find((y) => y.id === k)?.nome ?? k} ${moeda(x)}`)
                    .join(", ")
                : "nenhuma"}
            </span>
            <span>VT local {moeda(vtDiario(cid))} por dia</span>
            <span>ISS {percentual(cid.issPct)}</span>
            <span>
              Data-base em {MESES[cct.mesDataBase - 1]} · reajuste estimado{" "}
              {percentual(cct.reajusteEstimadoPct, 1)}{" "}
              {auto.length
                ? `a partir de ${auto.map((x) => rotulosMeses(e.inicio, e.prazo)[x.mesIdx]).join(" e ")}`
                : "(fora do prazo)"}
            </span>
          </div>
        </Cartao>
      )}
    </>
  );
}

function PassoReferencias({
  e,
  up,
  lista,
  vigente,
  cidades,
  onManual,
}: {
  e: Entradas;
  up: (p: Partial<Entradas>) => void;
  lista: readonly ObraLista[];
  vigente: number | undefined;
  cidades: ReturnType<typeof usePrecos>["cidades"];
  onManual: () => void;
}) {
  const nomeDe = (id: string | null) => {
    const c = id ? cidades.find((x) => x.id === id) : undefined;
    return c ? nomeCidade(c) : "";
  };
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState<Grupo>("todas");
  const [faixa, setFaixa] = useState<"20" | "50" | "qualquer">("qualquer");
  const presentes = new Set(lista.map((o) => o.grupo));
  const dentro = (o: ObraLista) =>
    faixa === "qualquer" ||
    Math.abs(o.area_m2 - e.area) / Math.max(1, e.area) <= Number(faixa) / 100;
  const cand = maisParecidas(
    e,
    lista.filter(
      (o) =>
        (grupo === "todas" || o.grupo === grupo) &&
        dentro(o) &&
        contemTermos(`${o.nome} ${o.cliente} ${o.tipologia} ${nomeDe(o.cidade_id)}`, q),
    ),
    lista.length,
  );
  const sel = e.referencias
    .map((id) => lista.find((o) => o.id === id))
    .filter((o): o is ObraLista => !!o);
  const agg = (xs: number[]) =>
    xs.length ? (e.estatistica === "mediana" ? mediana(xs) : soma(xs) / xs.length) : 0;
  const pms = sel.filter((o) => o.resumo).map((o) => (o.resumo!.pessoa_mes / o.area_m2) * 1000);
  const alternar = (id: string) =>
    up({
      referencias: e.referencias.includes(id)
        ? e.referencias.filter((x) => x !== id)
        : [...e.referencias, id],
      quantidadesManuais: null,
    });

  return (
    <>
      <Cartao aria-label="Referências selecionadas">
        <div className={f.barra}>
          <span className="rotulo">Selecionadas ({numero(sel.length)})</span>
          <span className={f.linha}>
            <Botao
              pequeno
              disabled={!lista.length}
              onClick={() =>
                up({
                  referencias: maisParecidas(e, lista).map((o) => o.id),
                  quantidadesManuais: null,
                })
              }
            >
              Selecionar as 5 mais parecidas
            </Botao>
            {/* todas as obras do filtro (grupo, área e busca), inclusive as que não aparecem na lista */}
            <Botao
              pequeno
              disabled={!cand.length || cand.every((o) => e.referencias.includes(o.id))}
              onClick={() =>
                up({
                  referencias: [...new Set([...e.referencias, ...cand.map((o) => o.id)])],
                  quantidadesManuais: null,
                })
              }
            >
              Selecionar todas do filtro ({numero(cand.length)})
            </Botao>
            <Botao
              pequeno
              variante="fantasma"
              disabled={!e.referencias.length}
              onClick={() => up({ referencias: [] })}
            >
              Limpar
            </Botao>
          </span>
        </div>
        <div style={{ padding: "0 22px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {sel.length ? (
            <>
              <div className={f.linha}>
                {sel.map((o) => (
                  <Chip
                    key={o.id}
                    ativo
                    aria-label={`Remover ${o.nome}`}
                    onClick={() => alternar(o.id)}
                  >
                    {o.nome} ×
                  </Chip>
                ))}
              </div>
              <div className={s.meta}>
                <span>
                  PM / 1.000 m²: <strong>{numero(agg(pms), 1)}</strong>
                  {pms.length > 1 &&
                    ` (de ${numero(Math.min(...pms), 1)} a ${numero(Math.max(...pms), 1)})`}
                </span>
                <span>
                  Custo / m² {vigente ?? ""}:{" "}
                  <strong>
                    {moeda(
                      agg(
                        sel.filter((o) => o.resumo).map((o) => o.resumo!.custo_atual / o.area_m2),
                      ),
                      0,
                    )}
                  </strong>
                </span>
                <span>Prazos: {sel.map((o) => `${numero(o.meses)} meses`).join(", ")}</span>
              </div>
            </>
          ) : (
            <p className="sub" style={{ margin: 0 }}>
              Escolha obras parecidas na base ou use as 5 mais parecidas (mesma tipologia, área e
              prazo mais próximos).
            </p>
          )}
          {e.referencias.length > sel.length && (
            <p className="sub" style={{ margin: 0 }} role="note">
              {numero(e.referencias.length - sel.length)} referência(s) não estão mais na base e
              ficam de fora do cálculo.
            </p>
          )}
        </div>
      </Cartao>

      <Cartao aria-label="Base histórica">
        <div className={f.barra}>
          <span className="rotulo">
            Base histórica · {numero(cand.length)} de {numero(lista.length)} obras, mais parecidas
            primeiro
          </span>
          <CampoBusca
            rotulo="Buscar obra de referência"
            placeholder="Buscar por nome, cliente, tipologia ou cidade"
            valor={q}
            onChange={setQ}
          />
        </div>
        <div style={{ padding: "0 22px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <div className={u.segmento} role="group" aria-label="Grupo de obras">
              {GRUPOS.filter((g) => g.id === "todas" || presentes.has(g.id)).map((g) => (
                <Chip key={g.id} ativo={grupo === g.id} onClick={() => setGrupo(g.id)}>
                  {g.nome}
                </Chip>
              ))}
            </div>
            <Segmento
              rotulo="Faixa de área"
              opcoes={[
                { valor: "20", texto: "Área ±20%" },
                { valor: "50", texto: "±50%" },
                { valor: "qualquer", texto: "Qualquer área" },
              ]}
              valor={faixa}
              onChange={setFaixa}
            />
          </div>
          <div className={s.candidatas}>
            {cand.slice(0, MAX_CANDIDATAS).map((o) => {
              const on = e.referencias.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  className={s.candidata}
                  aria-pressed={on}
                  onClick={() => alternar(o.id)}
                >
                  <span className={s.caixa} aria-hidden>
                    {on ? "✓" : ""}
                  </span>
                  <span className={s.cresce}>
                    <strong style={{ display: "block", fontWeight: 500 }}>{o.nome}</strong>
                    <span className="sub">
                      {[o.tipologia, o.cliente].filter(Boolean).join(" · ")} · {numero(o.area_m2)}{" "}
                      m² · {numero(o.meses)} meses · CCT {o.data_base}
                    </span>
                  </span>
                  {o.resumo && <MiniHistograma valores={o.resumo.histograma} />}
                  <span className={f.r} style={{ minWidth: 110, textAlign: "right" }}>
                    {o.resumo ? numero((o.resumo.pessoa_mes / o.area_m2) * 1000, 1) : "—"}
                    <div className="sub">
                      PM / 1.000 m²
                      {o.resumo &&
                        ` · ${moeda(o.resumo.custo_atual / o.area_m2, 0)}/m² ${vigente ?? ""}`}
                    </div>
                  </span>
                </button>
              );
            })}
            {!cand.length && (
              <p className="sub" style={{ margin: 0 }}>
                Nenhuma obra neste filtro.
              </p>
            )}
          </div>
          {cand.length > MAX_CANDIDATAS && (
            <p className="sub" style={{ margin: 0 }}>
              Mostrando as {numero(MAX_CANDIDATAS)} mais parecidas. Use a busca para achar as
              demais.
            </p>
          )}
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <span className="sub">Como combinar as referências</span>
            <Segmento
              rotulo="Estatística"
              opcoes={[
                { valor: "media", texto: "Média" },
                { valor: "mediana", texto: "Mediana" },
              ]}
              valor={e.estatistica}
              onChange={(v) => up({ estatistica: v })}
            />
          </div>
        </div>
      </Cartao>

      <Cartao aria-label="Já tenho o histograma planejado">
        <div className={f.barra}>
          <span>
            <span className="rotulo">Já tenho o histograma planejado</span>
            <div className="sub">
              Pule as referências e digite as pessoas por função e mês. O ITO calcula os custos com
              os preços da cidade.
            </div>
          </span>
          <Botao variante="escuro" onClick={onManual}>
            Informar quantidades →
          </Botao>
        </div>
      </Cartao>
    </>
  );
}
