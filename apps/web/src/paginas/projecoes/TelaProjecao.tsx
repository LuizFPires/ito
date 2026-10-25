import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { mesAno, moeda, numero } from "@ito/formato";
import { useSessao } from "../../auth/sessao";
import { nomeCurtoCct } from "../../dados/cidades";
import {
  useApagarProjecao,
  useDefinirSituacao,
  useDuplicarProjecao,
  useGravarResumoProjecao,
  usePrecos,
  useProjecao,
  useProjecoes,
  useReferencias,
} from "../../dados/projecoes";
import type { ResumoProjecao } from "../../dados/projecoes";
import { podeAprovar, podeProjetar } from "../../lib/permissoes";
import type { Situacao } from "../../lib/projecaoDoBanco";
import {
  calcularProjecao,
  entradasDaLinha,
  NOME_SITUACAO,
  resumoDaProjecao,
} from "../../lib/projecaoDoBanco";
import { Botao, Cartao } from "../../ui/componentes";
import { Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { Pagina } from "../Pagina";
import { manualValido, SITUACOES } from "./projecoes";
import { Resultado } from "./Resultado";
import s from "./projecoes.module.css";
import { HistoricoAlteracoes } from "../Auditoria";

const mesmoResumo = (a: ResumoProjecao, b: ResumoProjecao) =>
  a.total === b.total &&
  a.pico === b.pico &&
  a.pessoa_mes === b.pessoa_mes &&
  a.vigente === b.vigente;

/** Detalhe da projeção (protótipo `telaProjecao`): ‹ › e seletor, situação, ações e resultado. */
export function TelaProjecao() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const projeta = podeProjetar(usuario);
  const aprova = podeAprovar(usuario);
  const q = useProjecao(id);
  const lista = useProjecoes();
  const p = q.data;
  const e = useMemo(() => (p ? entradasDaLinha(p) : null), [p]);
  const { contexto, cct, precos } = usePrecos(e?.cidadeId ?? null, e?.cidadeOrigemId ?? null);
  const refsQ = useReferencias(e?.referencias ?? []);
  const situacao = useDefinirSituacao();
  const duplicar = useDuplicarProjecao();
  const apagar = useApagarProjecao();
  const gravarResumo = useGravarResumoProjecao();

  const manual = e ? manualValido(e.quantidadesManuais, e.prazo) : false;
  const refs = useMemo(
    () => (refsQ.data ?? []).filter((b) => e?.referencias.includes(b.obra.id)),
    [refsQ.data, e],
  );
  // dado provisório da projeção anterior (‹ ›) não entra no cálculo nem no resumo gravado
  const refsProntas =
    !e?.referencias.length || manual || (!!refsQ.data && !refsQ.isPlaceholderData);
  const calc = useMemo(
    () =>
      e && precos && contexto && refsProntas
        ? calcularProjecao(e, refs, precos, contexto.ctx)
        : null,
    [e, refs, precos, contexto, refsProntas],
  );
  // resumo da lista desatualizado (preço da cidade, tabela vigente, referência apagada): regrava
  const resumo = calc && contexto ? resumoDaProjecao(calc, contexto.vigente) : null;
  // aprovada: o resumo fica congelado na aprovação (M13 · S05, regra no banco)
  const gravaResumo = !!p && projeta && p.situacao !== "aprovada";
  const atrasado = !!(p && resumo && gravaResumo && !mesmoResumo(p.resumo, resumo));
  const chaveResumo = atrasado ? JSON.stringify([p!.id, resumo]) : "";
  useEffect(() => {
    if (!chaveResumo) return;
    const [pid, r] = JSON.parse(chaveResumo) as [string, ResumoProjecao];
    void gravarResumo(pid, r);
  }, [chaveResumo, gravarResumo]);

  if (q.isLoading)
    return (
      <Pagina grupo="Projeções" titulo="Projeção" resumo="" milestone="M7">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Carregando…
          </p>
        </Cartao>
      </Pagina>
    );
  if (!p || !e)
    return (
      <Pagina
        grupo={<Link to="/projecoes">Projeções</Link>}
        titulo="Projeção não encontrada"
        resumo=""
        milestone="M7"
      >
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

  const todas = lista.data ?? [];
  const i = todas.findIndex((x) => x.id === p.id);
  const ant = i > 0 ? todas[i - 1] : undefined;
  const prox = i >= 0 && i < todas.length - 1 ? todas[i + 1] : undefined;
  const aprovada = p.situacao === "aprovada";
  const podeMudar = (x: Situacao) =>
    x === p.situacao || (x === "aprovada" || aprovada ? aprova : projeta || aprova);
  const cidade = precos?.cidade?.nome ?? null;
  const nomesRefs = refs.map((b) => b.obra.nome);

  async function aoDuplicar() {
    try {
      const novo = await duplicar.gravar(p!);
      navegar(`/projecoes/${novo}`);
    } catch {
      // aviso já exibido
    }
  }
  async function aoApagar() {
    if (!window.confirm(`Apagar a projeção “${p!.nome}”? Não dá para desfazer.`)) return;
    try {
      await apagar.gravar(p!.id);
      navegar("/projecoes");
    } catch {
      // aviso já exibido
    }
  }

  return (
    <Pagina
      grupo={
        <>
          <Link to="/projecoes">Projeções</Link> / {p.cliente || "Sem cliente"}
        </>
      }
      titulo={p.nome}
      resumo=""
      milestone="M7"
    >
      <div className={f.linha} style={{ justifyContent: "space-between", marginTop: -12 }}>
        <div className={s.meta}>
          {p.tipologia && <span>{p.tipologia}</span>}
          <span>{numero(e.area)} m²</span>
          <span>
            {numero(e.prazo)} meses a partir de {mesAno(e.inicio.ano, e.inicio.mes)}
          </span>
          {cidade && <span>{cidade}</span>}
          <span>
            {manual
              ? "Quantidades informadas"
              : `${nomesRefs.join(", ") || "sem referências"} · ${e.estatistica === "mediana" ? "mediana" : "média"}`}
          </span>
        </div>
        <div className={s.alternador}>
          <Botao
            pequeno
            aria-label="Projeção anterior"
            disabled={!ant}
            onClick={() => ant && navegar(`/projecoes/${ant.id}`)}
          >
            ‹
          </Botao>
          <Selecao
            aria-label="Trocar de projeção"
            value={p.id}
            onChange={(ev) => navegar(`/projecoes/${ev.target.value}`)}
          >
            {(i >= 0 ? todas : [p, ...todas]).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome} · {NOME_SITUACAO[x.situacao]}
              </option>
            ))}
          </Selecao>
          <Botao
            pequeno
            aria-label="Próxima projeção"
            disabled={!prox}
            onClick={() => prox && navegar(`/projecoes/${prox.id}`)}
          >
            ›
          </Botao>
          {i >= 0 && (
            <span className="sub">
              {numero(i + 1)} de {numero(todas.length)}
            </span>
          )}
        </div>
      </div>

      <div className={f.linha} style={{ justifyContent: "flex-end" }}>
        <div className={u.segmento} role="group" aria-label="Situação">
          {SITUACOES.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={p.situacao === x}
              disabled={
                !podeMudar(x) ||
                situacao.isPending ||
                (x === "aprovada" && !aprovada && resumo?.total === undefined)
              }
              title={
                podeMudar(x)
                  ? x === "aprovada" && !aprovada && resumo?.total === undefined
                    ? "Espere o cálculo terminar para aprovar"
                    : undefined
                  : x === "aprovada" || aprovada
                    ? "Só controladoria, diretoria ou administrador aprova ou desfaz a aprovação"
                    : "Seu perfil só consulta projeções"
              }
              onClick={() =>
                x !== p.situacao &&
                // M14: aprovar refaz o cálculo no servidor (os números gravados são os dele)
                situacao.gravar({ id: p.id, situacao: x })
              }
            >
              {NOME_SITUACAO[x]}
            </button>
          ))}
        </div>
        {projeta && (
          <Botao disabled={duplicar.isPending} onClick={aoDuplicar}>
            Duplicar
          </Botao>
        )}
        {projeta && !aprovada && (
          <Botao variante="fantasma" disabled={apagar.isPending} onClick={aoApagar}>
            Apagar
          </Botao>
        )}
        {projeta && (
          <Botao
            variante="primario"
            disabled={aprovada}
            title={aprovada ? "Aprovada não é editada: duplique ou volte a Em análise" : undefined}
            onClick={() => navegar(`/projecoes/${p.id}/editar`)}
          >
            Editar premissas →
          </Botao>
        )}
      </div>

      {/* M13 · S05: os números aprovados ficam congelados; a tela calcula com os preços de hoje */}
      {aprovada && resumo && p.resumo.total != null && !mesmoResumo(p.resumo, resumo) && (
        <p className={f.aviso} role="status">
          O cálculo de hoje é diferente do aprovado: o total aprovado foi {moeda(p.resumo.total)} e,
          com os preços e cadastros de hoje, dá {moeda(resumo.total)}. Para aprovar os valores
          novos, volte a projeção a Em análise e aprove de novo.
        </p>
      )}

      {/* referência reaberta (M11): o resultado muda a cada mês lançado nela */}
      {!manual && refs.some((b) => b.obra.situacao === "andamento") && (
        <p className={f.aviso} role="status">
          {refs
            .filter((b) => b.obra.situacao === "andamento")
            .map((b) => `“${b.obra.nome}”`)
            .join(", ")}{" "}
          foi reaberta e está em andamento: o resultado muda a cada mês lançado nela. Ao editar a
          projeção, obras em andamento saem das referências.
        </p>
      )}

      {!calc || !contexto ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Calculando…
          </p>
        </Cartao>
      ) : (
        <Resultado
          e={e}
          calc={calc}
          contexto={contexto}
          referencias={refs}
          cidade={cidade}
          cct={cct ? nomeCurtoCct(cct.nome) : null}
          origem={precos?.cidadeOrigem?.nome ?? null}
          detalhe
          situacao={NOME_SITUACAO[p.situacao]}
          imprimir={`/projecoes/${p.id}/imprimir`}
          onAlterarPremissas={
            projeta && !aprovada ? () => navegar(`/projecoes/${p.id}/editar`) : undefined
          }
        />
      )}
      <HistoricoAlteracoes modulo="projecoes" refId={p.id} />
    </Pagina>
  );
}
