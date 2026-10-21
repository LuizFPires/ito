import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { moeda, mesAno, numero, percentual } from "@ito/formato";
import { anoMes } from "@ito/motor";
import { useSessao } from "../../auth/sessao";
import { useContextoCarga } from "../../dados/carga";
import type { Resumo } from "../../lib/obraDoBanco";
import { diasDoPeriodo, inicioDe } from "../../lib/obraDoBanco";
import {
  atualizarResumos,
  desatualizado,
  useInvalidarObras,
  useListaObras,
} from "../../dados/obras";
import { alternarOrdem, paginar } from "../../lib/lista";
import type { Ordem } from "../../lib/lista";
import { podeCarregar, podeEditarConfig } from "../../lib/permissoes";
import { MENU } from "../../shell/rotas";
import { Botao, Cartao, Chip } from "../../ui/componentes";
import { CampoBusca, Kpi, Paginacao, ThOrdem } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { MiniHistograma } from "../../ui/MiniHistograma";
import { Pagina } from "../Pagina";
import type { ChaveBase, Grupo, LinhaBase } from "./base";
import { filtrar, GRUPOS, indicadores, ordenarBase } from "./base";
import s from "./base.module.css";

const POR_PAGINA = 25;
const LOTE = 25;

export function TelaBase() {
  const d = MENU.find((x) => x.caminho === "/base")!;
  const { usuario } = useSessao();
  const carregador = podeCarregar(usuario);
  const gravaResumo = carregador || podeEditarConfig(usuario);
  const lista = useListaObras();
  const contexto = useContextoCarga();
  const invalidar = useInvalidarObras();
  const navegar = useNavigate();

  const [grupo, setGrupo] = useState<Grupo>("todas");
  const [q, setQ] = useState("");
  const [ordem, setOrdem] = useState<Ordem<ChaveBase>>({ chave: "periodo", dir: -1 });
  const [pagina, setPagina] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  // resumos recalculados na tela (obra editada, tabela vigente nova)
  const [novos, setNovos] = useState<Record<string, Resumo>>({});
  const [recalculando, setRecalculando] = useState(0);

  const ctx = contexto.data;
  const cidades = useMemo(() => new Map((ctx?.cidades ?? []).map((c) => [c.id, c.nome])), [ctx]);
  const linhas: LinhaBase[] = useMemo(
    () =>
      (lista.data ?? []).map((o) => ({
        ...o,
        cidade: (o.cidade_id && cidades.get(o.cidade_id)) || "",
        resumo: novos[o.id] ?? o.resumo,
      })),
    [lista.data, cidades, novos],
  );

  // recalcula, em lotes, os resumos desatualizados (grava quando o usuário pode)
  useEffect(() => {
    if (!ctx || !lista.data) return;
    const ids = lista.data.filter((o) => desatualizado(o, ctx.vigente)).map((o) => o.id);
    if (!ids.length) return;
    let parar = false;
    (async () => {
      setRecalculando(ids.length);
      const feitos: Record<string, Resumo> = {};
      for (let k = 0; k < ids.length && !parar; k += LOTE) {
        try {
          const r = await atualizarResumos(ids.slice(k, k + LOTE), ctx, gravaResumo);
          for (const x of r) feitos[x.obra_id] = x;
          setNovos((a) => ({ ...a, ...Object.fromEntries(r.map((x) => [x.obra_id, x])) }));
        } catch {
          break; // sem conexão: tenta de novo ao voltar à tela
        }
        setRecalculando(Math.max(0, ids.length - k - LOTE));
      }
      if (!parar && gravaResumo && Object.keys(feitos).length) await invalidar();
    })();
    return () => {
      parar = true;
    };
  }, [ctx, lista.data, gravaResumo, invalidar]);

  const presentes = new Set(linhas.map((o) => o.grupo));
  const filtradas = ordenarBase(filtrar(linhas, grupo, q), ordem);
  const k = indicadores(filtradas);
  const pg = paginar(filtradas, pagina, POR_PAGINA);
  const vigente = ctx?.vigente;
  const mudarFiltro = (fn: () => void) => {
    fn();
    setPagina(1);
  };
  const alternar = (id: string) =>
    setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const periodo = (o: LinhaBase) => {
    const ini = inicioDe(o.inicio);
    const fim = anoMes(ini, o.meses - 1);
    return `${mesAno(ini.ano, ini.mes)} – ${mesAno(fim.ano, fim.mes)}`;
  };

  return (
    <Pagina
      grupo={d.grupo}
      titulo={d.nome}
      resumo="Mão de obra das obras concluídas, no nível da folha: efetivo equivalente por função, rubricas, encargos, provisões, benefícios, admissões e desligamentos, mês a mês. Selecione obras parecidas para comparar ou projetar."
      milestone={d.milestone}
    >
      <div className={f.linha} style={{ justifyContent: "space-between" }}>
        <div className={u.segmento} role="group" aria-label="Grupo de obras">
          {GRUPOS.filter((g) => g.id === "todas" || presentes.has(g.id)).map((g) => (
            <Chip
              key={g.id}
              ativo={grupo === g.id}
              onClick={() => mudarFiltro(() => setGrupo(g.id))}
            >
              {g.nome}
            </Chip>
          ))}
        </div>
        <span className={f.linha}>
          <CampoBusca
            rotulo="Filtrar obras"
            placeholder="Filtrar por nome, cliente ou cidade"
            valor={q}
            onChange={(v) => mudarFiltro(() => setQ(v))}
          />
          {carregador && (
            <Link
              className={`${u.botao} ${u.pequeno}`}
              to="/carga"
              style={{ textDecoration: "none" }}
            >
              Carregar obra
            </Link>
          )}
        </span>
      </div>

      {filtradas.length > 0 && (
        <div className={f.kpis}>
          <Kpi
            rotulo="Obras na seleção"
            valor={numero(k.obras)}
            sub={
              k.obras === 1
                ? filtradas[0]!.tipologia
                : `filtro: ${GRUPOS.find((g) => g.id === grupo)!.nome}`
            }
          />
          <Kpi
            rotulo="Duração mediana"
            valor={`${numero(k.duracaoMedianaDias)} dias`}
            sub={`${numero(k.duracaoMedianaMeses)} meses de folha`}
          />
          <Kpi
            rotulo="Pico de efetivo"
            valor={`${numero(k.picoMedio, 1)} pessoas`}
            sub="média · equivalente por dias"
          />
          <Kpi
            rotulo="Pessoa-mês / 1.000 m²"
            valor={numero(k.pmPorMilMedia, 1)}
            sub={`mediana ${numero(k.pmPorMilMediana, 1)}`}
          />
          <Kpi
            rotulo="Mão de obra indireta"
            valor={percentual(k.indiretaMedia, 0)}
            sub="das pessoa-mês, média"
          />
          <Kpi
            rotulo={`Custo de MO / m² · ${vigente ?? ""}`}
            valor={moeda(k.custoM2Medio, 0)}
            sub={`mediana ${moeda(k.custoM2Mediana, 0)}`}
            destaque
          />
        </div>
      )}

      {sel.length > 0 && (
        <Cartao className={s.selecao} role="region" aria-label="Obras selecionadas">
          <strong>
            {numero(sel.length)} {sel.length === 1 ? "obra selecionada" : "obras selecionadas"}
          </strong>
          <span className={f.linha}>
            <Botao pequeno variante="fantasma" onClick={() => setSel([])}>
              Limpar
            </Botao>
            <Botao
              pequeno
              disabled={sel.length < 2 || sel.length > 4}
              title={
                sel.length < 2
                  ? "Selecione ao menos 2 obras"
                  : sel.length > 4
                    ? "Compare até 4 obras"
                    : undefined
              }
              onClick={() => navegar(`/comparar?obras=${sel.join(",")}`)}
            >
              Comparar
            </Botao>
            <Botao
              pequeno
              variante="primario"
              onClick={() => navegar(`/projecoes?refs=${sel.join(",")}`)}
            >
              Projetar com estas →
            </Botao>
          </span>
        </Cartao>
      )}

      <Cartao aria-label="Obras na base">
        <div className={f.barra}>
          <span className="rotulo">Obras na base</span>
          <span className="sub">
            Clique numa obra para abrir histograma, folha, apropriação e indicadores.
            {recalculando > 0 && ` Atualizando o resumo de ${numero(recalculando)} obras…`}
          </span>
        </div>
        {lista.isError ? (
          <p className="sub" style={{ padding: 22 }} role="alert">
            Não foi possível carregar as obras. Atualize a página.
          </p>
        ) : lista.isLoading ? (
          <p className="sub" style={{ padding: 22 }}>
            Carregando…
          </p>
        ) : !filtradas.length ? (
          <p className="sub" style={{ padding: 22 }}>
            {linhas.length ? (
              <>
                Nenhuma obra neste filtro.{" "}
                <button
                  type="button"
                  className={f.linkAcao}
                  onClick={() =>
                    mudarFiltro(() => {
                      setGrupo("todas");
                      setQ("");
                    })
                  }
                >
                  Ver todas
                </button>
              </>
            ) : (
              "Nenhuma obra na base ainda. Carregue a primeira em Carga de dados."
            )}
          </p>
        ) : (
          <>
            <table className={`${f.tabela} ${s.tabela}`} aria-label="Obras">
              <thead>
                <tr>
                  <th className={s.sel}>
                    <span className="sr-only">Selecionar</span>
                  </th>
                  <ThOrdem
                    chave="nome"
                    ordem={ordem}
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    Obra
                  </ThOrdem>
                  <ThOrdem
                    chave="area"
                    ordem={ordem}
                    direita
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    Área (m²)
                  </ThOrdem>
                  <ThOrdem
                    chave="periodo"
                    ordem={ordem}
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    Período
                  </ThOrdem>
                  <th className={s.hist}>Histograma</th>
                  <ThOrdem
                    chave="pico"
                    ordem={ordem}
                    direita
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    Pico
                  </ThOrdem>
                  <ThOrdem
                    chave="pm"
                    ordem={ordem}
                    direita
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    Pessoa-mês
                  </ThOrdem>
                  <ThOrdem
                    chave="he"
                    ordem={ordem}
                    direita
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    HE h/pes.
                  </ThOrdem>
                  <ThOrdem
                    chave="epoca"
                    ordem={ordem}
                    direita
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    Custo época
                  </ThOrdem>
                  <ThOrdem
                    chave="atual"
                    ordem={ordem}
                    direita
                    onOrdenar={(c) => setOrdem(alternarOrdem(ordem, c))}
                  >
                    Custo {vigente ?? ""}
                  </ThOrdem>
                </tr>
              </thead>
              <tbody>
                {pg.itens.map((o) => {
                  const r = o.resumo;
                  return (
                    <tr key={o.id}>
                      <td className={s.sel}>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${o.nome}`}
                          checked={sel.includes(o.id)}
                          onChange={() => alternar(o.id)}
                        />
                      </td>
                      <td>
                        <Link className={s.obra} to={`/obras/${o.id}`}>
                          {o.nome}
                        </Link>
                        <div className="sub">
                          {o.cidade || o.cliente || "Sem cliente"} · CCT {o.data_base}
                        </div>
                      </td>
                      <td className={f.r}>{numero(o.area_m2)}</td>
                      <td className={s.nowrap}>
                        {periodo(o)}
                        <div className="sub">{numero(diasDoPeriodo(o.inicio, o.meses))} dias</div>
                      </td>
                      <td className={s.hist}>{r && <MiniHistograma valores={r.histograma} />}</td>
                      <td className={f.r}>{r ? numero(r.pico, 1) : "—"}</td>
                      <td className={f.r}>
                        {r ? numero(r.pessoa_mes, 1) : "—"}
                        {r && (
                          <div className={`sub ${s.nowrap}`}>
                            {numero((r.pessoa_mes / o.area_m2) * 1000, 1)} /1.000 m²
                          </div>
                        )}
                      </td>
                      <td className={f.r}>{r ? numero(r.he_por_pessoa, 1) : "—"}</td>
                      <td className={f.r}>{r ? moeda(r.custo_epoca, 0) : "—"}</td>
                      <td className={`${f.r} ${s.nowrap}`}>
                        <strong>{r ? moeda(r.custo_atual, 0) : "—"}</strong>
                        {r && <div className="sub">{moeda(r.custo_atual / o.area_m2, 0)} /m²</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Paginacao pagina={pg} onPagina={setPagina} nome="obras" />
          </>
        )}
      </Cartao>
      <p className="sub" style={{ margin: 0 }}>
        “Custo {vigente ?? "vigente"}” recalcula o mesmo histograma (pessoa-mês, horas extras,
        absenteísmo e movimentações de cada mês) com salários, encargos, provisões, benefícios e
        premissas vigentes. Pico e pessoa-mês contam o efetivo equivalente pelos dias trabalhados.
      </p>
    </Pagina>
  );
}
