import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { mesAno, moeda, numero, percentual } from "@ito/formato";
import type { CustoMes, Soma } from "@ito/motor";
import { anoMes, calcularObra } from "@ito/motor";
import { useSessao } from "../../auth/sessao";
import { useFuncoes } from "../../dados/cadastros";
import { useContextoCarga } from "../../dados/carga";
import { useObra } from "../../dados/obras";
import { diasDoPeriodo, inicioDe, obraDoBanco, parametrosDe } from "../../lib/obraDoBanco";
import { podeCarregar } from "../../lib/permissoes";
import { compararCom } from "../../lib/selecao";
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
import { ABAS, ORDEM_GRUPOS, rotulosDe } from "./comum";
import s from "./obra.module.css";

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
    grupo: "todas",
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
    if (!d || !ctx) return null;
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
        grupo: x?.grupo ?? ctx.ctx.funcoes.find((y) => y.id === fid)?.grupo ?? "direta",
        cor: `var(--${x?.cor ?? "i4"})`,
        conta: x?.conta_pc || "—",
      };
    };
    const r = usa === "epoca" ? epoca : atual;
    const ids = r.funcoes
      .filter((k) => vista.grupo === "todas" || fun(k).grupo === vista.grupo)
      .sort(
        (a, b) =>
          ORDEM_GRUPOS.indexOf(fun(a).grupo) - ORDEM_GRUPOS.indexOf(fun(b).grupo) ||
          fun(a).nome.localeCompare(fun(b).nome, "pt-BR"),
      );
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
  const ini = inicioDe(o.inicio);
  const fim = anoMes(ini, o.meses - 1);
  const trocas = dados.d.trocas.map((t) => t.data_base);
  const meta = [
    o.tipologia,
    dados.cidade,
    `${numero(Number(o.area_m2))} m²`,
    `${mesAno(ini.ano, ini.mes)} – ${mesAno(fim.ano, fim.mes)}`,
    `CCT ${o.data_base}${trocas.length ? ` → ${trocas.join(" → ")}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pagina
      grupo={
        <>
          <Link to="/base" className={s.migalha}>
            Base histórica
          </Link>{" "}
          · {o.cliente || "Sem cliente"}
        </>
      }
      titulo={o.nome}
      resumo={meta}
      milestone="M5"
    >
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
          <BotaoExportarObra dados={dados} />
          <Link
            className={`${u.botao} ${u.pequeno}`}
            to="/comparar"
            onClick={() => compararCom(o.id)}
            style={{ textDecoration: "none" }}
          >
            Comparar com…
          </Link>
          <Link
            className={`${u.botao} ${u.pequeno} ${u.primario}`}
            to={`/projecoes/nova?refs=${o.id}`}
            style={{ textDecoration: "none" }}
          >
            Usar como referência →
          </Link>
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
    </Pagina>
  );
}

function KpisObra({ dados }: { dados: DadosAba }) {
  const { r, epoca, atual, V, d } = dados;
  const area = Number(d.obra.area_m2);
  const total = V(r.total);
  const ce = epoca.total.total;
  const cv = atual.total.total;
  const g = r.porGrupo;
  const gt = g.direta + g.indireta + g.adm || 1;
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
        rotulo="Direta · indireta · adm."
        valor={`${percentual((g.direta / gt) * 100, 0)} · ${percentual((g.indireta / gt) * 100, 0)} · ${percentual((g.adm / gt) * 100, 0)}`}
        sub="do custo total"
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
        sub={`${numero(d.obra.meses)} competências`}
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
