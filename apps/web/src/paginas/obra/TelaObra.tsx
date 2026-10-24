import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { moeda, numero, percentual } from "@ito/formato";
import type { CustoMes, Soma } from "@ito/motor";
import { calcularObra } from "@ito/motor";
import { useSessao } from "../../auth/sessao";
import { useFuncoes } from "../../dados/cadastros";
import { useContextoCarga } from "../../dados/carga";
import type { DetalheObra } from "../../dados/obras";
import { useObra } from "../../dados/obras";
import { diasDoPeriodo, obraDoBanco, parametrosDe } from "../../lib/obraDoBanco";
import { podeCarregar } from "../../lib/permissoes";
import { compararCom } from "../../lib/selecao";
import { emAndamento, textoPeriodo } from "../../lib/situacao";
import { Cartao, Segmento } from "../../ui/componentes";
import { Kpi } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { Pagina } from "../Pagina";
import { AbaApropriacao } from "./AbaApropriacao";
import { AbaCustos } from "./AbaCustos";
import { AbaEfetivo } from "./AbaEfetivo";
import { AbaFolha } from "./AbaFolha";
import { AbaHE } from "./AbaHE";
import { AbaIndicadores } from "./AbaIndicadores";
import { AbaPessoas } from "./AbaPessoas";
import { AbaPremissas } from "./AbaPremissas";
import { AbaRealocada } from "./AbaRealocada";
import { AbaVisao } from "./AbaVisao";
import { BotaoExportarObra } from "./BotaoExportarObra";
import type { Aba, DadosAba, FuncaoInfo, Vista } from "./comum";
import { ABAS, porNome, rotulosDe } from "./comum";
import { HistoricoAlteracoes } from "../Auditoria";
import s from "./obra.module.css";
import { BarraAndamento, BotaoReabrir } from "./SituacaoObra";

/** Abas que alternam época × atualizado (como no protótipo); as demais ficam na época. */
const USA_VISAO: readonly Aba[] = ["visao", "custos", "he", "ind"];

export function TelaObra() {
  const { id } = useParams();
  const [busca, setBusca] = useSearchParams();
  const aba = (ABAS.find(([k]) => k === busca.get("aba"))?.[0] ?? "visao") as Aba;
  const irPara = (a: Aba) =>
    setBusca((b) => {
      b.set("aba", a);
      return b;
    });
  const { usuario } = useSessao();
  const pode = podeCarregar(usuario);
  const obraQ = useObra(id);
  const contexto = useContextoCarga();
  const funcoesQ = useFuncoes();
  const [vista, setVistaEstado] = useState<Vista>(() => ({
    visao: "epoca",
    caixa: false,
    eixo: "data",
    agrupadas: false,
    ...lerPreferencias(),
  }));
  const setVista: typeof setVistaEstado = (v) =>
    setVistaEstado((x) => {
      const novo = typeof v === "function" ? v(x) : v;
      guardarPreferencias(novo);
      return novo;
    });

  const d = obraQ.data;
  const ctx = contexto.data;
  // o motor roda quando a obra ou os cadastros mudam, não a cada alternância de tela
  const calculo = useMemo(() => {
    // obra em andamento sem mês lançado não tem o que calcular
    if (!d || !ctx || d.obra.meses < 1) return null;
    try {
      const { obra, movimentos } = obraDoBanco(d);
      const calc = (v: Vista["visao"]) =>
        calcularObra(obra, parametrosDe(d, ctx.tabelas, ctx.vigente, v), ctx.ctx, { movimentos });
      return { obra, movimentos, epoca: calc("epoca"), atual: calc("atualizado"), erro: null };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "A obra não pôde ser calculada." };
    }
  }, [d, ctx]);
  const dados = useMemo((): DadosAba | null => {
    if (!d || !ctx || !calculo || calculo.erro !== null) return null;
    const { obra, movimentos, epoca, atual } = calculo;
    const usa = USA_VISAO.includes(aba) ? vista.visao : "epoca";
    const porId = new Map((funcoesQ.data ?? []).map((x) => [x.id, x]));
    const fun = (fid: string): FuncaoInfo => {
      const x = porId.get(fid);
      return {
        id: fid,
        nome: x?.nome ?? fid,
        cor: `var(--${x?.cor ?? "i4"})`,
        conta: x?.conta_pc || "—",
      };
    };
    const r = usa === "epoca" ? epoca : atual;
    const ids = [...r.funcoes].sort(porNome(fun));
    return {
      d,
      obra,
      movimentos,
      r,
      epoca,
      atual,
      rotulos: rotulosDe(obra, vista.eixo),
      fun,
      ids,
      vista: { ...vista, visao: usa },
      V: (c: CustoMes | Soma) => (vista.caixa ? c.caixa : c.total),
      ctx,
      cidade: ctx.cidades.find((c) => c.id === d.obra.cidade_id)?.nome ?? "",
      pode,
    };
  }, [d, ctx, calculo, funcoesQ.data, vista, aba, pode]);

  if (obraQ.isError || contexto.isError)
    return (
      <Pagina grupo="Base histórica · Obra" titulo="Obra" resumo="" milestone="M5">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            Não foi possível carregar a obra. Atualize a página.
          </p>
        </Cartao>
      </Pagina>
    );
  if (calculo?.erro)
    return (
      <Pagina
        grupo="Base histórica · Obra"
        titulo={d?.obra.nome ?? "Obra"}
        resumo=""
        milestone="M5"
      >
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            Não foi possível calcular esta obra: {calculo.erro} Confira os cadastros de funções e
            parâmetros ou recarregue a obra.
          </p>
        </Cartao>
      </Pagina>
    );
  if (obraQ.data === null)
    return (
      <Pagina grupo="Base histórica · Obra" titulo="Obra não encontrada" resumo="" milestone="M5">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Esta obra não está na base.{" "}
            <Link className={f.linkAcao} to="/base">
              Voltar para a base histórica
            </Link>
          </p>
        </Cartao>
      </Pagina>
    );
  const migalha = (cliente: string) => (
    <>
      <Link to="/base" className={s.migalha}>
        Base histórica
      </Link>{" "}
      · {cliente || "Sem cliente"}
    </>
  );
  // obra em andamento recém-começada: só o cadastro, à espera do 1º mês
  if (d && ctx && d.obra.meses < 1)
    return (
      <Pagina
        grupo={migalha(d.obra.cliente)}
        titulo={d.obra.nome}
        resumo={metaDe(d, ctx.cidades.find((c) => c.id === d.obra.cidade_id)?.nome ?? "")}
        milestone="M11"
      >
        <BarraAndamento d={d} pode={pode} />
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Nenhum mês lançado ainda.{" "}
            {pode
              ? "Lance a folha do primeiro mês para ver o histograma, os custos e os indicadores."
              : "DP/RH ou a controladoria lançam a folha de cada mês."}
          </p>
        </Cartao>
        <HistoricoAlteracoes modulo="obras" refId={d.obra.id} />
      </Pagina>
    );
  if (!dados)
    return (
      <Pagina grupo="Base histórica · Obra" titulo="Obra" resumo="" milestone="M5">
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Carregando…
          </p>
        </Cartao>
      </Pagina>
    );

  const o = dados.d.obra;
  const andamento = emAndamento(o);

  return (
    <Pagina
      grupo={migalha(o.cliente)}
      titulo={o.nome}
      resumo={metaDe(dados.d, dados.cidade)}
      milestone="M5"
    >
      {andamento && <BarraAndamento d={dados.d} pode={pode} />}
      <div className={f.linha} style={{ justifyContent: "space-between" }}>
        <div className={s.abas} role="tablist" aria-label="Abas da obra">
          {ABAS.map(([k, nome]) => (
            <button
              key={k}
              type="button"
              id={`aba-${k}`}
              className={u.chip}
              role="tab"
              aria-selected={aba === k}
              aria-controls="painel-obra"
              tabIndex={aba === k ? 0 : -1}
              onClick={() => irPara(k)}
              onKeyDown={(e) => {
                const i = ABAS.findIndex(([x]) => x === k);
                const prox =
                  e.key === "ArrowRight"
                    ? ABAS[(i + 1) % ABAS.length]
                    : e.key === "ArrowLeft"
                      ? ABAS[(i - 1 + ABAS.length) % ABAS.length]
                      : null;
                if (!prox) return;
                e.preventDefault();
                irPara(prox[0]);
                document.getElementById(`aba-${prox[0]}`)?.focus();
              }}
            >
              {nome}
            </button>
          ))}
        </div>
        <span className={f.linha}>
          {!andamento && pode && <BotaoReabrir d={dados.d} />}
          <BotaoExportarObra dados={dados} />
          <Link
            className={`${u.botao} ${u.pequeno}`}
            to="/comparar"
            onClick={() => compararCom(o.id)}
            style={{ textDecoration: "none" }}
          >
            Comparar com…
          </Link>
          {/* só obra concluída é referência de projeção (M11) */}
          {!andamento && (
            <Link
              className={`${u.botao} ${u.pequeno} ${u.primario}`}
              to={`/projecoes/nova?refs=${o.id}`}
              style={{ textDecoration: "none" }}
            >
              Usar como referência →
            </Link>
          )}
        </span>
      </div>

      {USA_VISAO.includes(aba) && (
        <div className={f.linha}>
          <Segmento
            rotulo="Valores"
            opcoes={[
              { valor: "epoca", texto: `Época · CCT ${o.data_base}` },
              { valor: "atualizado", texto: `Atualizado · ${dados.ctx.vigente}` },
            ]}
            valor={vista.visao}
            onChange={(v) => setVista((x) => ({ ...x, visao: v }))}
          />
          {(aba === "visao" || aba === "custos") && (
            <Segmento
              rotulo="Competência ou caixa"
              opcoes={[
                { valor: "comp", texto: "Competência" },
                { valor: "caixa", texto: "Caixa" },
              ]}
              valor={vista.caixa ? "caixa" : "comp"}
              onChange={(v) => setVista((x) => ({ ...x, caixa: v === "caixa" }))}
            />
          )}
        </div>
      )}

      {(aba === "visao" || aba === "custos") && <KpisObra dados={dados} />}

      <div id="painel-obra" role="tabpanel" aria-labelledby={`aba-${aba}`} className={s.painel}>
        {aba === "visao" && <AbaVisao dados={dados} setVista={setVista} irPara={irPara} />}
        {aba === "efetivo" && <AbaEfetivo dados={dados} setVista={setVista} irPara={irPara} />}
        {aba === "custos" && <AbaCustos dados={dados} setVista={setVista} />}
        {aba === "he" && <AbaHE dados={dados} setVista={setVista} irPara={irPara} />}
        {aba === "folha" && <AbaFolha dados={dados} irPara={irPara} />}
        {aba === "pessoas" && <AbaPessoas dados={dados} />}
        {aba === "aprop" && <AbaApropriacao dados={dados} />}
        {aba === "ind" && <AbaIndicadores dados={dados} setVista={setVista} />}
        {aba === "realoc" && <AbaRealocada dados={dados} />}
        {aba === "prem" && <AbaPremissas dados={dados} />}
      </div>
      <HistoricoAlteracoes modulo="obras" refId={o.id} />
    </Pagina>
  );
}

/** Linha abaixo do título: tipologia, cidade, área, período e data-base (com as trocas). */
function metaDe(d: DetalheObra, cidade: string): string {
  const o = d.obra;
  const trocas = d.trocas.map((t) => t.data_base);
  return [
    o.tipologia,
    cidade,
    `${numero(Number(o.area_m2))} m²`,
    textoPeriodo(o),
    `CCT ${o.data_base}${trocas.length ? ` → ${trocas.join(" → ")}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function KpisObra({ dados }: { dados: DadosAba }) {
  const { r, epoca, atual, V, d } = dados;
  const area = Number(d.obra.area_m2);
  const total = V(r.total);
  const ce = epoca.total.total;
  const cv = atual.total.total;
  const totais = r.porMes.map((m) => m.x);
  const pico = Math.max(0, ...totais);
  const pm = totais.reduce((a, b) => a + b, 0);
  const rot = rotulosDe(dados.obra, "data");
  return (
    <div className={f.kpis}>
      <Kpi
        rotulo={`Custo total · ${dados.vista.visao === "epoca" ? "época" : dados.ctx.vigente}${dados.vista.caixa ? " · caixa" : ""}`}
        valor={moeda(total, 0)}
        sub={`${moeda(total / area, 0)} por m²`}
        destaque
      />
      <Kpi
        rotulo={`Reajuste época → ${dados.ctx.vigente}`}
        valor={`${cv >= ce ? "+" : ""}${percentual(ce ? (cv / ce - 1) * 100 : 0)}`}
        sub={`${moeda(ce, 0)} → ${moeda(cv, 0)}`}
      />
      <Kpi
        rotulo="Pico de efetivo"
        valor={`${numero(pico, 1)} pessoas`}
        sub={`em ${rot[totais.indexOf(pico)] ?? "—"} · equivalente`}
      />
      <Kpi
        rotulo="Pessoa-mês"
        valor={numero(pm, 1)}
        sub={`${numero((pm / area) * 1000, 1)} por 1.000 m²`}
      />
      <Kpi
        rotulo="Duração"
        valor={`${numero(diasDoPeriodo(d.obra.inicio, d.obra.meses))} dias`}
        sub={`${numero(d.obra.meses)} competências${emAndamento(d.obra) ? " até agora" : ""}`}
      />
    </div>
  );
}

const CHAVE_PREF = "ito.obra.vista";
/** Eixo, barras e caixa ficam lembrados neste navegador (como no protótipo). */
function lerPreferencias(): Partial<Vista> {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PREF) ?? "{}") as Partial<Vista>;
    return {
      ...(p.eixo === "data" || p.eixo === "mes" ? { eixo: p.eixo } : {}),
      ...(typeof p.agrupadas === "boolean" ? { agrupadas: p.agrupadas } : {}),
      ...(typeof p.caixa === "boolean" ? { caixa: p.caixa } : {}),
    };
  } catch {
    return {};
  }
}
function guardarPreferencias(v: Vista) {
  try {
    localStorage.setItem(
      CHAVE_PREF,
      JSON.stringify({ eixo: v.eixo, agrupadas: v.agrupadas, caixa: v.caixa }),
    );
  } catch {
    // navegador sem armazenamento: segue sem lembrar
  }
}
