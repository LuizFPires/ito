import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { numero } from "@ito/formato";
import { useSessao } from "../auth/sessao";
import {
  DESCRICAO_COMPONENTE,
  NOME_COMPONENTE,
  useAtualizarRubrica,
  useCriarRubrica,
  useRubricas,
} from "../dados/cadastros";
import type { ComponenteRubrica, Rubrica, TipoRubrica } from "../dados/cadastros";
import { alternarOrdem, contemTermos, ordenar, paginar } from "../lib/lista";
import type { Ordem } from "../lib/lista";
import { podeEditarCadastros } from "../lib/permissoes";
import { MENU } from "../shell/rotas";
import { Badge, Botao, Cartao, Chip } from "../ui/componentes";
import { Campo, CampoBusca, Interruptor, Kpi, Paginacao, Selecao, ThOrdem } from "../ui/formulario";
import f from "../ui/formulario.module.css";
import { Pagina } from "./Pagina";

const POR_PAGINA = 20;
const TIPOS: [TipoRubrica, string][] = [
  ["provento", "Proventos"],
  ["desconto", "Descontos"],
  ["informativo", "Informativas"],
];
const COMPONENTES = Object.entries(NOME_COMPONENTE) as [ComponenteRubrica, string][];
const TOM: Record<TipoRubrica, "ok" | "erro" | "neutro"> = {
  provento: "ok",
  desconto: "erro",
  informativo: "neutro",
};
type Chave = "codigo" | "nome" | "componente";

export function TelaRubricas() {
  const d = MENU.find((x) => x.caminho === "/rubricas")!;
  const { usuario } = useSessao();
  const pode = podeEditarCadastros(usuario);
  const { data: rubricas, isLoading, isError } = useRubricas();
  const atualizar = useAtualizarRubrica();

  // Vindo da busca global: filtra pela rubrica escolhida (também quando já está nesta tela).
  const local = useLocation();
  const pedida = (local.state as { q?: string } | null)?.q;
  const [q, setQ] = useState(pedida ?? "");
  const [navegacao, setNavegacao] = useState(local.key);
  if (navegacao !== local.key) {
    setNavegacao(local.key);
    if (pedida) setQ(pedida);
  }
  const [tipo, setTipo] = useState<TipoRubrica | "todos">("todos");
  const [comp, setComp] = useState<ComponenteRubrica | "">("");
  const [inativas, setInativas] = useState(false);
  const [ordem, setOrdem] = useState<Ordem<Chave>>({ chave: "codigo", dir: 1 });
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);

  const ativas = (rubricas ?? []).filter((r) => r.ativo);
  const conta = (t: TipoRubrica) => ativas.filter((r) => r.tipo === t).length;

  const lista = useMemo(
    () =>
      ordenar(
        (rubricas ?? []).filter(
          (r) =>
            (inativas || r.ativo) &&
            (tipo === "todos" || r.tipo === tipo) &&
            (!comp || r.componente === comp) &&
            contemTermos(`${r.codigo} ${r.nome}`, q),
        ),
        ordem,
        (r, k) =>
          k === "codigo" ? r.codigo : k === "nome" ? r.nome : NOME_COMPONENTE[r.componente],
      ),
    [rubricas, inativas, tipo, comp, q, ordem],
  );
  const pg = paginar(lista, pagina, POR_PAGINA);
  const filtrar = (fn: () => void) => {
    fn();
    setPagina(1);
  };
  const ordenarPor = (k: Chave) => setOrdem(alternarOrdem(ordem, k));
  const salvar = (r: Rubrica, patch: Partial<Rubrica>) =>
    atualizar.mutate({ codigo: r.codigo, patch });

  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
      <div className={f.kpis}>
        <Kpi
          rotulo="Rubricas ativas"
          valor={numero(ativas.length)}
          sub="reaproveitadas em todas as cargas"
        />
        <Kpi rotulo="Proventos" valor={numero(conta("provento"))} sub="entram no custo" />
        <Kpi
          rotulo="Descontos"
          valor={numero(conta("desconto"))}
          sub="faltas entram; os do empregado não"
        />
        <Kpi rotulo="Informativas" valor={numero(conta("informativo"))} sub="só para conferência" />
      </div>

      {criando && <NovaRubrica rubricas={rubricas ?? []} onFechar={() => setCriando(false)} />}

      <Cartao style={{ overflow: "hidden" }}>
        <div className={f.barra}>
          <CampoBusca
            rotulo="Buscar rubrica"
            placeholder="Código ou nome"
            valor={q}
            onChange={(v) => filtrar(() => setQ(v))}
          />
          <div role="group" aria-label="Tipo" style={{ display: "flex", flexWrap: "wrap" }}>
            <Chip ativo={tipo === "todos"} onClick={() => filtrar(() => setTipo("todos"))}>
              Todas
            </Chip>
            {TIPOS.map(([t, n]) => (
              <Chip key={t} ativo={tipo === t} onClick={() => filtrar(() => setTipo(t))}>
                {n}
              </Chip>
            ))}
          </div>
          <Selecao
            aria-label="Entra no custo como"
            style={{ width: "auto", borderRadius: 999 }}
            value={comp}
            onChange={(e) => filtrar(() => setComp(e.target.value as ComponenteRubrica | ""))}
          >
            <option value="">Todos os componentes</option>
            {COMPONENTES.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </Selecao>
          <Interruptor
            rotulo="Mostrar inativas"
            texto="Inativas"
            ligado={inativas}
            onChange={(v) => filtrar(() => setInativas(v))}
          />
          {pode && !criando && (
            <Botao variante="primario" pequeno onClick={() => setCriando(true)}>
              Nova rubrica
            </Botao>
          )}
        </div>

        {isError ? (
          <p className="sub" style={{ padding: 22 }} role="alert">
            Não foi possível carregar as rubricas. Atualize a página.
          </p>
        ) : isLoading ? (
          <p className="sub" style={{ padding: 22 }}>
            Carregando…
          </p>
        ) : (
          <>
            <table className={f.tabela}>
              <thead>
                <tr>
                  <ThOrdem chave="codigo" ordem={ordem} onOrdenar={ordenarPor}>
                    Cód.
                  </ThOrdem>
                  <ThOrdem chave="nome" ordem={ordem} onOrdenar={ordenarPor}>
                    Rubrica
                  </ThOrdem>
                  <th>Tipo</th>
                  <ThOrdem chave="componente" ordem={ordem} onOrdenar={ordenarPor}>
                    Entra no custo como
                  </ThOrdem>
                  <th>Base de provisões</th>
                  {pode && <th className={f.r}>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {pg.itens.map((r) => (
                  <tr key={r.codigo}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {r.codigo}
                    </td>
                    <td>
                      <span className={f.forte}>{r.nome}</span> {!r.ativo && <Badge>inativa</Badge>}
                      <div className="sub">{DESCRICAO_COMPONENTE[r.componente]}</div>
                    </td>
                    <td>
                      {pode ? (
                        <Selecao
                          aria-label={`Tipo de ${r.nome}`}
                          style={{ width: "auto", minHeight: 34, borderRadius: 999 }}
                          value={r.tipo}
                          onChange={(e) => salvar(r, { tipo: e.target.value as TipoRubrica })}
                        >
                          <option value="provento">provento</option>
                          <option value="desconto">desconto</option>
                          <option value="informativo">informativo</option>
                        </Selecao>
                      ) : (
                        <Badge tom={TOM[r.tipo]}>{r.tipo}</Badge>
                      )}
                    </td>
                    <td>
                      {pode ? (
                        <Selecao
                          aria-label={`Componente de ${r.nome}`}
                          style={{ width: "auto", minHeight: 34, borderRadius: 999 }}
                          value={r.componente}
                          onChange={(e) =>
                            salvar(r, { componente: e.target.value as ComponenteRubrica })
                          }
                        >
                          {COMPONENTES.map(([k, n]) => (
                            <option key={k} value={k}>
                              {n}
                            </option>
                          ))}
                        </Selecao>
                      ) : (
                        NOME_COMPONENTE[r.componente]
                      )}
                    </td>
                    <td>
                      <Interruptor
                        rotulo={`${r.nome} é base de provisões`}
                        ligado={r.base_provisoes}
                        desabilitado={!pode}
                        onChange={(v) => salvar(r, { base_provisoes: v })}
                      />
                    </td>
                    {pode && (
                      <td className={f.r}>
                        <Botao
                          pequeno
                          variante="fantasma"
                          onClick={() => salvar(r, { ativo: !r.ativo })}
                        >
                          {r.ativo ? "Inativar" : "Reativar"}
                        </Botao>
                      </td>
                    )}
                  </tr>
                ))}
                {!pg.itens.length && (
                  <tr>
                    <td
                      colSpan={pode ? 6 : 5}
                      className="sub"
                      style={{ textAlign: "center", padding: 32 }}
                    >
                      Nenhuma rubrica encontrada. Limpe a busca ou os filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Paginacao pagina={pg} onPagina={setPagina} nome="rubricas" />
          </>
        )}
      </Cartao>
    </Pagina>
  );
}

function NovaRubrica({ rubricas, onFechar }: { rubricas: Rubrica[]; onFechar: () => void }) {
  const criar = useCriarRubrica();
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoRubrica>("provento");
  const [componente, setComponente] = useState<ComponenteRubrica>("sal");
  const [base, setBase] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    const cod = Number(codigo);
    if (!Number.isInteger(cod) || cod <= 0)
      return setErro("Informe o código da rubrica na folha (número inteiro).");
    if (!nome.trim()) return setErro("Informe o nome da rubrica.");
    if (rubricas.some((r) => r.codigo === cod))
      return setErro(`Já existe a rubrica ${cod}. Use outro código.`);
    setErro(null);
    criar.mutate(
      { codigo: cod, nome: nome.trim().toUpperCase(), tipo, componente, base_provisoes: base },
      { onSuccess: onFechar },
    );
  }

  return (
    <Cartao className={f.painel} style={{ position: "static" }} aria-label="Nova rubrica">
      <div className={f.painelCabeca}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Nova rubrica</h2>
        <Botao variante="fantasma" pequeno onClick={onFechar} aria-label="Fechar">
          ×
        </Botao>
      </div>
      <div className={f.form}>
        <Campo rotulo="Código na folha">
          <input
            className={f.input}
            inputMode="numeric"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Nome">
          <input
            className={f.input}
            value={nome}
            placeholder="Ex.: ADICIONAL NOTURNO"
            onChange={(e) => setNome(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Tipo">
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as TipoRubrica)}>
            <option value="provento">provento</option>
            <option value="desconto">desconto</option>
            <option value="informativo">informativo</option>
          </Selecao>
        </Campo>
        <Campo rotulo="Entra no custo como" dica={DESCRICAO_COMPONENTE[componente]}>
          <Selecao
            value={componente}
            onChange={(e) => setComponente(e.target.value as ComponenteRubrica)}
          >
            {COMPONENTES.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </Selecao>
        </Campo>
      </div>
      <Interruptor
        rotulo="Base de provisões"
        texto="Compõe a base das provisões"
        ligado={base}
        onChange={setBase}
      />
      {erro && (
        <p className={f.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={f.linha}>
        <Botao variante="primario" onClick={enviar} disabled={criar.isPending}>
          Criar rubrica
        </Botao>
      </div>
    </Cartao>
  );
}
