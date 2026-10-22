import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { data, moeda, numero, percentual } from "@ito/formato";
import { useSessao } from "../../auth/sessao";
import { nomeCidade, useCidades } from "../../dados/cidades";
import { useContextoCarga } from "../../dados/carga";
import { useProjecoes } from "../../dados/projecoes";
import { alternarOrdem, paginar } from "../../lib/lista";
import type { Ordem } from "../../lib/lista";
import { podeProjetar } from "../../lib/permissoes";
import { NOME_SITUACAO } from "../../lib/projecaoDoBanco";
import { MENU } from "../../shell/rotas";
import { Badge, Botao, Cartao, Chip } from "../../ui/componentes";
import { CampoBusca, Paginacao, ThOrdem } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { Pagina } from "../Pagina";
import type { ChaveProjecao, FiltroSituacao } from "./projecoes";
import {
  descreverBase,
  filtrarProjecoes,
  MAX_COMPARAR_PROJ,
  ordenarProjecoes,
  SITUACOES,
  TOM_SITUACAO,
} from "./projecoes";
import s from "./projecoes.module.css";

const POR_PAGINA = 25;

export function TelaProjecoes() {
  const d = MENU.find((x) => x.caminho === "/projecoes")!;
  const [busca] = useSearchParams();
  const { usuario } = useSessao();
  const pode = podeProjetar(usuario);
  const lista = useProjecoes();
  const cidadesQ = useCidades();
  const vigente = useContextoCarga().data?.vigente;
  const navegar = useNavigate();
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [q, setQ] = useState("");
  const [ordem, setOrdem] = useState<Ordem<ChaveProjecao>>({ chave: "criado", dir: -1 });
  const [pagina, setPagina] = useState(1);
  const [selecao, setSelecao] = useState<string[]>([]);

  const cidades = useMemo(
    () => new Map((cidadesQ.data ?? []).map((c) => [c.id, nomeCidade(c)])),
    [cidadesQ.data],
  );
  const cidade = (id: string | null) => (id && cidades.get(id)) || "";
  const todas = lista.data ?? [];
  const existentes = new Set(todas.map((p) => p.id));
  const sel = selecao.filter((id) => existentes.has(id));
  const filtradas = ordenarProjecoes(filtrarProjecoes(todas, situacao, q, cidade), ordem);
  const pg = paginar(filtradas, pagina, POR_PAGINA);
  const conta = (x: FiltroSituacao) =>
    todas.filter((p) => x === "todas" || p.situacao === x).length;

  // links antigos "Projetar com estas" (base, obra, comparar) abrem o assistente
  const refs = busca.get("refs");
  if (refs) return <Navigate to={`/projecoes/nova?refs=${refs}`} replace />;

  const mudarFiltro = (fn: () => void) => {
    fn();
    setPagina(1);
  };
  const ordenarPor = (c: ChaveProjecao) =>
    setOrdem(
      ordem.chave === c ? alternarOrdem(ordem, c) : { chave: c, dir: c === "nome" ? 1 : -1 },
    );
  const alternar = (id: string) =>
    setSelecao(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);

  return (
    <Pagina
      grupo={d.grupo}
      titulo={d.nome}
      resumo="Histogramas e custos de mão de obra projetados para obras em planejamento, com as quantidades do histórico e os preços da cidade da obra. Marque duas ou mais para comparar cenários lado a lado."
      milestone={d.milestone}
    >
      <div className={f.linha} style={{ justifyContent: "space-between" }}>
        <div className={u.segmento} role="group" aria-label="Situação">
          {(["todas", ...SITUACOES] as const).map((x) => (
            <Chip key={x} ativo={situacao === x} onClick={() => mudarFiltro(() => setSituacao(x))}>
              {x === "todas" ? "Todas" : NOME_SITUACAO[x]}{" "}
              <span className={s.conta}>{numero(conta(x))}</span>
            </Chip>
          ))}
        </div>
        <span className={f.linha}>
          <CampoBusca
            rotulo="Filtrar projeções"
            placeholder="Filtrar por nome, cliente ou cidade"
            valor={q}
            onChange={(v) => mudarFiltro(() => setQ(v))}
          />
          {pode && (
            <Link
              className={`${u.botao} ${u.pequeno} ${u.primario}`}
              to="/projecoes/nova"
              style={{ textDecoration: "none" }}
            >
              Nova projeção →
            </Link>
          )}
        </span>
      </div>

      {sel.length > 0 && (
        <Cartao className={s.selecao} role="region" aria-label="Projeções selecionadas">
          <strong>
            {numero(sel.length)}{" "}
            {sel.length === 1 ? "projeção selecionada" : "projeções selecionadas"}
          </strong>
          <span className={f.linha}>
            <Botao pequeno variante="fantasma" onClick={() => setSelecao([])}>
              Limpar
            </Botao>
            <Botao
              pequeno
              variante="primario"
              disabled={sel.length < 2 || sel.length > MAX_COMPARAR_PROJ}
              title={
                sel.length < 2
                  ? "Selecione ao menos 2"
                  : sel.length > MAX_COMPARAR_PROJ
                    ? `Compare até ${MAX_COMPARAR_PROJ} projeções`
                    : undefined
              }
              onClick={() => navegar(`/projecoes/comparar?ids=${sel.join(",")}`)}
            >
              Comparar cenários →
            </Botao>
          </span>
        </Cartao>
      )}

      <Cartao aria-label="Projeções">
        {lista.isError ? (
          <p className="sub" style={{ padding: 22 }} role="alert">
            Não foi possível carregar as projeções. Atualize a página.
          </p>
        ) : lista.isLoading ? (
          <p className="sub" style={{ padding: 22 }}>
            Carregando…
          </p>
        ) : !filtradas.length ? (
          <p className="sub" style={{ padding: 22 }}>
            {todas.length ? (
              <>
                Nenhuma projeção neste filtro.{" "}
                <button
                  type="button"
                  className={f.linkAcao}
                  onClick={() =>
                    mudarFiltro(() => {
                      setSituacao("todas");
                      setQ("");
                    })
                  }
                >
                  Ver todas
                </button>
              </>
            ) : pode ? (
              "Nenhuma projeção ainda. Crie a primeira em Nova projeção."
            ) : (
              "Nenhuma projeção ainda."
            )}
          </p>
        ) : (
          <>
            <table className={`${f.tabela} ${s.tabela}`} aria-label="Lista de projeções">
              <thead>
                <tr>
                  <th className={s.sel}>
                    <span className="sr-only">Selecionar</span>
                  </th>
                  <ThOrdem chave="nome" ordem={ordem} onOrdenar={ordenarPor}>
                    Projeção
                  </ThOrdem>
                  <th>Base</th>
                  <ThOrdem chave="area" ordem={ordem} direita onOrdenar={ordenarPor}>
                    Área · prazo
                  </ThOrdem>
                  <ThOrdem chave="pico" ordem={ordem} direita onOrdenar={ordenarPor}>
                    Pico
                  </ThOrdem>
                  <ThOrdem chave="total" ordem={ordem} direita onOrdenar={ordenarPor}>
                    Custo total
                  </ThOrdem>
                  <ThOrdem chave="situacao" ordem={ordem} onOrdenar={ordenarPor}>
                    Situação
                  </ThOrdem>
                </tr>
              </thead>
              <tbody>
                {pg.itens.map((p) => {
                  const r = p.resumo;
                  const area = Number(p.area_m2);
                  return (
                    <tr key={p.id}>
                      <td className={s.sel}>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${p.nome}`}
                          checked={sel.includes(p.id)}
                          onChange={() => alternar(p.id)}
                        />
                      </td>
                      <td>
                        <Link className={s.nome} to={`/projecoes/${p.id}`}>
                          {p.nome}
                        </Link>
                        <div className="sub">
                          {[p.tipologia, p.cliente].filter(Boolean).join(" · ") || "Sem cliente"} ·
                          criada em {data(p.criado_em)}
                        </div>
                      </td>
                      <td>
                        {descreverBase(p)}
                        <div className="sub">{cidade(p.cidade_id) || "sem cidade"}</div>
                      </td>
                      <td className={`${f.r} ${s.nowrap}`}>
                        {numero(area)} m²
                        <div className="sub">{numero(p.prazo_meses)} meses</div>
                      </td>
                      <td className={`${f.r} ${s.nowrap}`}>
                        {r.pico !== undefined ? `${numero(r.pico)} pessoas` : "—"}
                        {r.indireta_pct !== undefined && (
                          <div className="sub">{percentual(r.indireta_pct, 0)} indireta</div>
                        )}
                      </td>
                      <td className={`${f.r} ${s.nowrap}`}>
                        <strong>{r.total !== undefined ? moeda(r.total, 0) : "—"}</strong>
                        {r.total !== undefined && (
                          <div className="sub">
                            {moeda(r.total / area, 0)} /m²
                            {r.vigente !== undefined &&
                              r.vigente !== vigente &&
                              ` · CCT ${r.vigente}`}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge tom={TOM_SITUACAO[p.situacao]}>{NOME_SITUACAO[p.situacao]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Paginacao pagina={pg} onPagina={setPagina} nome="projeções" />
          </>
        )}
      </Cartao>
      <p className="sub" style={{ margin: 0 }}>
        Pico, custo e custo por m² são os do último cálculo de cada projeção; ao abrir uma projeção,
        o ITO recalcula com os preços vigentes da cidade e atualiza a lista.
      </p>
    </Pagina>
  );
}
