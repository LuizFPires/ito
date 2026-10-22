import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";
import { dataHora, numero, parseData } from "@ito/formato";
import { useSessao } from "../auth/sessao";
import type { Alteracao } from "../dados/auditoria";
import { useAuditoria } from "../dados/auditoria";
import {
  diferencas,
  MODULOS,
  nomeCampo,
  OPERACAO,
  rotuloRegistro,
  valorAuditado,
} from "../lib/auditoria";
import type { Pagina as PaginaLista } from "../lib/lista";
import { podeAuditar } from "../lib/permissoes";
import { MENU } from "../shell/rotas";
import { Badge, Botao, Cartao, Segmento } from "../ui/componentes";
import { Campo, CampoBusca, Paginacao, Selecao } from "../ui/formulario";
import f from "../ui/formulario.module.css";
import { Pagina } from "./Pagina";

const POR_PAGINA = 25;
const TOM = { insert: "ok", update: "ambar", delete: "erro" } as const;

function paginaDe<T>(itens: T[], pagina: number, total: number, por: number): PaginaLista<T> {
  const paginas = Math.max(1, Math.ceil(total / por));
  const de = total ? (pagina - 1) * por + 1 : 0;
  return { itens, pagina, paginas, total, de, ate: de ? de + itens.length - 1 : 0 };
}

/** Link para o registro auditado, quando ele tem tela própria. */
function destino(a: Alteracao): string | null {
  if (a.modulo === "obras" && a.ref) return `/obras/${a.ref}`;
  if (a.modulo === "projecoes" && a.ref && a.operacao !== "delete") return `/projecoes/${a.ref}`;
  const caminho: Record<string, string> = {
    ccts: "/cidades",
    cidades: "/cidades",
    parametros: "/parametros",
    funcoes: "/funcoes",
    rubricas: "/rubricas",
    usuarios: "/usuarios",
  };
  return caminho[a.modulo] ?? null;
}

function Mudancas({ a, todas }: { a: Alteracao; todas?: boolean }) {
  const ds = diferencas(a.antes, a.depois);
  if (!ds.length) return <span className="sub">sem mudança visível</span>;
  const mostrar = todas ? ds : ds.slice(0, 2);
  return (
    <>
      {mostrar.map((d) => (
        <div key={d.campo} style={{ fontSize: 13 }}>
          <span className="sub">{nomeCampo(d.campo)}:</span>{" "}
          {a.operacao === "update" && (
            <>
              <s>{valorAuditado(d.antes, d.campo)}</s> →{" "}
            </>
          )}
          <span className={f.forte}>
            {valorAuditado(a.operacao === "delete" ? d.antes : d.depois, d.campo)}
          </span>
        </div>
      ))}
      {!todas && ds.length > 2 && (
        <div className="sub">
          e mais {numero(ds.length - 2)} {ds.length - 2 === 1 ? "campo" : "campos"}
        </div>
      )}
    </>
  );
}

function Tabela({
  linhas,
  mostrarModulo = true,
}: {
  linhas: Alteracao[];
  mostrarModulo?: boolean;
}) {
  const [aberta, setAberta] = useState<number | null>(null);
  return (
    <table className={f.tabela}>
      <thead>
        <tr>
          <th>Quando · quem</th>
          <th>{mostrarModulo ? "Onde" : "Registro"}</th>
          <th>O que mudou</th>
          <th className={f.r}>Detalhe</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((a) => {
          const link = destino(a);
          const total = diferencas(a.antes, a.depois).length;
          return (
            <Fragment key={a.id}>
              <tr>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {dataHora(a.em)}
                  </span>
                  <div className="sub">{a.usuario_email ?? "sistema"}</div>
                </td>
                <td>
                  <Badge tom={TOM[a.operacao]}>{OPERACAO[a.operacao]}</Badge>{" "}
                  {mostrarModulo && (
                    <span className={f.forte}>{MODULOS[a.modulo] ?? a.modulo}</span>
                  )}
                  <div className="sub">
                    {nomeCampo(a.tabela)} · {rotuloRegistro(a.registro)}
                    {mostrarModulo && link && (
                      <>
                        {" "}
                        · <Link to={link}>abrir</Link>
                      </>
                    )}
                  </div>
                </td>
                <td>
                  <Mudancas a={a} />
                </td>
                <td className={f.r}>
                  {total > 2 && (
                    <Botao
                      pequeno
                      variante="fantasma"
                      aria-expanded={aberta === a.id}
                      onClick={() => setAberta(aberta === a.id ? null : a.id)}
                    >
                      {aberta === a.id ? "Fechar" : "Ver tudo"}
                    </Botao>
                  )}
                </td>
              </tr>
              {aberta === a.id && (
                <tr>
                  <td colSpan={4} style={{ background: "var(--surface-muted)" }}>
                    <Mudancas a={a} todas />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export function TelaAuditoria() {
  const d = MENU.find((x) => x.caminho === "/auditoria")!;
  const { usuario } = useSessao();
  const pode = podeAuditar(usuario);
  const [modulo, setModulo] = useState("");
  const modulos = Object.entries(MODULOS).filter(([k]) => k !== "usuarios" || usuario?.admin);
  const [pessoa, setPessoa] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [antigas, setAntigas] = useState(false);
  const [pagina, setPagina] = useState(1);
  // a busca por pessoa consulta o servidor: espera a digitação assentar
  const [pessoaBusca, setPessoaBusca] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setPessoaBusca(pessoa.trim().length >= 2 ? pessoa.trim() : ""), 300);
    return () => clearTimeout(t);
  }, [pessoa]);
  const deIso = de.trim() ? parseData(de) : null;
  const ateIso = ate.trim() ? parseData(ate) : null;
  const dataInvalida = (de.trim() && !deIso) || (ate.trim() && !ateIso);
  const q = useAuditoria(
    { modulo, pessoa: pessoaBusca, de: deIso, ate: ateIso, antigas, pagina, porPagina: POR_PAGINA },
    pode && !dataInvalida,
  );
  const filtrar = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  if (!pode)
    return (
      <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            A auditoria é restrita à controladoria, à diretoria e aos administradores.
          </p>
        </Cartao>
      </Pagina>
    );

  const pg = paginaDe(q.data?.linhas ?? [], pagina, q.data?.total ?? 0, POR_PAGINA);
  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
      <Cartao style={{ overflow: "hidden" }}>
        <div className={f.barra}>
          <Selecao
            aria-label="Módulo"
            style={{ width: "auto", borderRadius: 999 }}
            value={modulo}
            onChange={(e) => filtrar(() => setModulo(e.target.value))}
          >
            <option value="">Todos os módulos</option>
            {modulos.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </Selecao>
          <CampoBusca
            rotulo="Quem alterou"
            placeholder="E-mail de quem alterou"
            valor={pessoa}
            onChange={(v) => filtrar(() => setPessoa(v))}
          />
          <Campo rotulo="De (dd/mm/aaaa)" ocultarRotulo>
            <input
              className={f.input}
              style={{ width: 130 }}
              placeholder="De dd/mm/aaaa"
              value={de}
              onChange={(e) => filtrar(() => setDe(e.target.value))}
            />
          </Campo>
          <Campo rotulo="Até (dd/mm/aaaa)" ocultarRotulo>
            <input
              className={f.input}
              style={{ width: 130 }}
              placeholder="Até dd/mm/aaaa"
              value={ate}
              onChange={(e) => filtrar(() => setAte(e.target.value))}
            />
          </Campo>
          <Segmento
            rotulo="Ordem"
            opcoes={[
              { valor: "recentes", texto: "Mais recentes" },
              { valor: "antigas", texto: "Mais antigas" },
            ]}
            valor={antigas ? "antigas" : "recentes"}
            onChange={(v) => filtrar(() => setAntigas(v === "antigas"))}
          />
        </div>
        {dataInvalida ? (
          <p className="sub" style={{ padding: 22 }} role="alert">
            Informe a data como dd/mm/aaaa.
          </p>
        ) : q.isError ? (
          <p className="sub" style={{ padding: 22 }} role="alert">
            Não foi possível carregar a auditoria. Atualize a página.
          </p>
        ) : q.isLoading ? (
          <p className="sub" style={{ padding: 22 }}>
            Carregando…
          </p>
        ) : !pg.total ? (
          <p className="sub" style={{ padding: 22 }}>
            Nenhuma alteração com esses filtros.
          </p>
        ) : (
          <>
            <Tabela linhas={pg.itens} />
            <Paginacao pagina={pg} onPagina={setPagina} nome="alterações" />
          </>
        )}
      </Cartao>
    </Pagina>
  );
}

/**
 * Histórico de um registro (obra, CCT, cidade, data-base, projeção) no detalhe dele: as últimas
 * alterações com a versão anterior. Só aparece para quem lê a auditoria.
 */
export function HistoricoAlteracoes({ modulo, refId }: { modulo: string; refId?: string }) {
  const { usuario } = useSessao();
  const pode = podeAuditar(usuario);
  const [aberto, setAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const q = useAuditoria({ modulo, ref: refId, pagina, porPagina: 10 }, pode && aberto);
  if (!pode) return null;
  const pg = paginaDe(q.data?.linhas ?? [], pagina, q.data?.total ?? 0, 10);
  return (
    <Cartao aria-label="Histórico de alterações" style={{ overflow: "hidden" }}>
      <div className={f.barra}>
        <span className="rotulo">Histórico de alterações</span>
        <span style={{ flex: 1 }} />
        <Botao pequeno aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? "Esconder" : "Mostrar"}
        </Botao>
      </div>
      {aberto &&
        (q.isError ? (
          <p className="sub" style={{ padding: 22 }} role="alert">
            Não foi possível carregar o histórico. Atualize a página.
          </p>
        ) : q.isLoading ? (
          <p className="sub" style={{ padding: 22 }}>
            Carregando…
          </p>
        ) : !pg.total ? (
          <p className="sub" style={{ padding: 22 }}>
            Nenhuma alteração registrada desde o início da auditoria.
          </p>
        ) : (
          <>
            <Tabela linhas={pg.itens} mostrarModulo={false} />
            <Paginacao pagina={pg} onPagina={setPagina} nome="alterações" />
          </>
        ))}
    </Cartao>
  );
}
