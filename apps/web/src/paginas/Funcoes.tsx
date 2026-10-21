import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { moeda, numero } from "@ito/formato";
import { useSessao } from "../auth/sessao";
import {
  NOME_GRUPO,
  useAdicionarSinonimo,
  useAtualizarFuncao,
  useCriarFuncao,
  useDataBase,
  useFuncoes,
  useParametros,
  useRemoverSinonimo,
} from "../dados/cadastros";
import type { Funcao, GrupoFuncao } from "../dados/cadastros";
import { alternarOrdem, codigoDe, contemTermos, ordenar, paginar } from "../lib/lista";
import type { Ordem } from "../lib/lista";
import { podeEditarCadastros } from "../lib/permissoes";
import { Badge, Botao, Cartao, Chip } from "../ui/componentes";
import {
  Campo,
  CampoBusca,
  CampoNumero,
  Interruptor,
  Paginacao,
  Selecao,
  ThOrdem,
} from "../ui/formulario";
import f from "../ui/formulario.module.css";
import { MENU } from "../shell/rotas";
import { Pagina } from "./Pagina";

const POR_PAGINA = 15;
const GRUPOS = Object.entries(NOME_GRUPO) as [GrupoFuncao, string][];
type Chave = "nome" | "grupo" | "salario";

export function TelaFuncoes() {
  const d = MENU.find((x) => x.caminho === "/funcoes")!;
  const { usuario } = useSessao();
  const pode = podeEditarCadastros(usuario);
  const { data: funcoes, isLoading, isError } = useFuncoes();
  const { data: params } = useParametros();
  const vigente = params?.data_base_vigente ?? undefined;
  const { data: db } = useDataBase(vigente);

  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState<GrupoFuncao | "todas">("todas");
  const [inativas, setInativas] = useState(false);
  const [ordem, setOrdem] = useState<Ordem<Chave>>({ chave: "grupo", dir: 1 });
  const [pagina, setPagina] = useState(1);
  // Vindo da busca global: abre a função escolhida (também quando já está nesta tela).
  const local = useLocation();
  const pedida = (local.state as { sel?: string } | null)?.sel ?? null;
  const [sel, setSel] = useState<string | "nova" | null>(pedida);
  const [navegacao, setNavegacao] = useState(local.key);
  if (navegacao !== local.key) {
    setNavegacao(local.key);
    if (pedida) setSel(pedida);
  }

  const salario = (id: string) => db?.salarios[id];
  const lista = useMemo(() => {
    const filtradas = (funcoes ?? []).filter(
      (x) =>
        (inativas || x.ativo) &&
        (grupo === "todas" || x.grupo === grupo) &&
        contemTermos(`${x.nome} ${x.conta_pc} ${x.sinonimos.join(" ")}`, q),
    );
    const ordemGrupo = { direta: 0, indireta: 1, adm: 2 };
    return ordenar(filtradas, ordem, (x, k) =>
      k === "nome"
        ? x.nome
        : k === "grupo"
          ? `${ordemGrupo[x.grupo]} ${x.nome}`
          : (db?.salarios[x.id] ?? -1),
    );
  }, [funcoes, inativas, grupo, q, ordem, db]);
  const pg = paginar(lista, pagina, POR_PAGINA);
  const atual = sel && sel !== "nova" ? funcoes?.find((x) => x.id === sel) : undefined;

  const filtrar = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
      <div className={f.divisao}>
        <Cartao style={{ overflow: "hidden" }}>
          <div className={f.barra}>
            <CampoBusca
              rotulo="Buscar função"
              placeholder="Nome, conta ou sinônimo da folha"
              valor={q}
              onChange={(v) => filtrar(() => setQ(v))}
            />
            <div className="chips" role="group" aria-label="Grupo" style={{ display: "flex" }}>
              <Chip ativo={grupo === "todas"} onClick={() => filtrar(() => setGrupo("todas"))}>
                Todas
              </Chip>
              {GRUPOS.map(([g, n]) => (
                <Chip key={g} ativo={grupo === g} onClick={() => filtrar(() => setGrupo(g))}>
                  {n}
                </Chip>
              ))}
            </div>
            <Interruptor
              rotulo="Mostrar inativas"
              texto="Inativas"
              ligado={inativas}
              onChange={(v) => filtrar(() => setInativas(v))}
            />
            {pode && (
              <Botao variante="primario" pequeno onClick={() => setSel("nova")}>
                Nova função
              </Botao>
            )}
          </div>
          {isError ? (
            <p className="sub" style={{ padding: 22 }} role="alert">
              Não foi possível carregar as funções. Atualize a página.
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
                    <ThOrdem
                      chave="nome"
                      ordem={ordem}
                      onOrdenar={(k) => setOrdem(alternarOrdem(ordem, k))}
                    >
                      Função
                    </ThOrdem>
                    <ThOrdem
                      chave="grupo"
                      ordem={ordem}
                      onOrdenar={(k) => setOrdem(alternarOrdem(ordem, k))}
                    >
                      Grupo
                    </ThOrdem>
                    <th>Escala</th>
                    <ThOrdem
                      chave="salario"
                      ordem={ordem}
                      direita
                      onOrdenar={(k) => setOrdem(alternarOrdem(ordem, k))}
                    >
                      Salário {vigente ?? ""}
                    </ThOrdem>
                  </tr>
                </thead>
                <tbody>
                  {pg.itens.map((x) => (
                    <tr
                      key={x.id}
                      className={f.clicavel}
                      data-selecionada={sel === x.id || undefined}
                      onClick={() => setSel(x.id)}
                    >
                      <td>
                        <button
                          type="button"
                          className={f.thOrdem}
                          aria-pressed={sel === x.id}
                          style={{
                            textTransform: "none",
                            letterSpacing: 0,
                            font: "inherit",
                            textAlign: "left",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSel(x.id);
                          }}
                        >
                          <span className={f.amostra} style={{ background: `var(--${x.cor})` }} />
                          <span className={f.forte}>{x.nome}</span>
                        </button>{" "}
                        {x.vinculo === "estagio" && <Badge tom="ambar">estágio</Badge>}{" "}
                        {!x.ativo && <Badge>inativa</Badge>}
                        <div className="sub">
                          {x.conta_pc || "sem conta"} · {x.sinonimos.length}{" "}
                          {x.sinonimos.length === 1 ? "sinônimo" : "sinônimos"}
                        </div>
                      </td>
                      <td>{NOME_GRUPO[x.grupo]}</td>
                      <td>{x.escala_area ? "Com a área" : "Fixo por mês"}</td>
                      <td className={f.r}>
                        {salario(x.id) !== undefined ? (
                          moeda(salario(x.id))
                        ) : (
                          <Badge tom="ambar">sem salário</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!pg.itens.length && (
                    <tr>
                      <td colSpan={4} className="sub" style={{ textAlign: "center", padding: 32 }}>
                        Nenhuma função encontrada. Limpe a busca ou os filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Paginacao pagina={pg} onPagina={setPagina} nome="funções" />
            </>
          )}
        </Cartao>

        {sel === "nova" ? (
          <NovaFuncao funcoes={funcoes ?? []} onCriada={setSel} onFechar={() => setSel(null)} />
        ) : atual ? (
          <DetalheFuncao
            key={atual.id}
            funcao={atual}
            pode={pode}
            salario={salario(atual.id)}
            vigente={vigente}
            onFechar={() => setSel(null)}
          />
        ) : (
          <Cartao className={f.painel}>
            <p className="sub" style={{ margin: 0 }}>
              Escolha uma função na lista para ver exames, adicionais, ferramentas e os sinônimos
              usados na folha.
            </p>
          </Cartao>
        )}
      </div>
    </Pagina>
  );
}

function DetalheFuncao({
  funcao: x,
  pode,
  salario,
  vigente,
  onFechar,
}: {
  funcao: Funcao;
  pode: boolean;
  salario: number | undefined;
  vigente: number | undefined;
  onFechar: () => void;
}) {
  const atualizar = useAtualizarFuncao();
  const addSin = useAdicionarSinonimo();
  const remSin = useRemoverSinonimo();
  const [nome, setNome] = useState(x.nome);
  const [conta, setConta] = useState(x.conta_pc);
  const [novoSin, setNovoSin] = useState("");
  const est = x.vinculo === "estagio";
  const salvar = (patch: Parameters<typeof atualizar.mutate>[0]["patch"]) =>
    atualizar.gravar({ id: x.id, patch });

  return (
    <Cartao className={f.painel} aria-label={`Função ${x.nome}`}>
      <div className={f.painelCabeca}>
        <div>
          <span className="rotulo">
            {NOME_GRUPO[x.grupo]} · código {x.id}
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{x.nome}</h2>
          <span className="sub">
            Salário {vigente}: {salario !== undefined ? moeda(salario) : "não definido"} (em
            Parâmetros)
          </span>
        </div>
        <Botao variante="fantasma" pequeno onClick={onFechar} aria-label="Fechar detalhe">
          ×
        </Botao>
      </div>
      {!x.ativo && (
        <p className={f.aviso}>Função inativa: não aparece na carga nem nas projeções.</p>
      )}

      <div className={f.form}>
        <Campo rotulo="Nome">
          <input
            className={f.input}
            value={nome}
            disabled={!pode}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => {
              const n = nome.trim();
              if (!n) return setNome(x.nome);
              if (n !== x.nome) salvar({ nome: n }).catch(() => setNome(x.nome));
            }}
          />
        </Campo>
        <Campo rotulo="Conta do plano">
          <input
            className={f.input}
            value={conta}
            disabled={!pode}
            onChange={(e) => setConta(e.target.value)}
            onBlur={() => {
              if (conta.trim() !== x.conta_pc)
                salvar({ conta_pc: conta.trim() }).catch(() => setConta(x.conta_pc));
            }}
          />
        </Campo>
        <Campo rotulo="Grupo">
          <Selecao
            value={x.grupo}
            disabled={!pode}
            onChange={(e) => salvar({ grupo: e.target.value as GrupoFuncao })}
          >
            {GRUPOS.map(([g, n]) => (
              <option key={g} value={g}>
                {n}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Vínculo">
          <Selecao
            value={x.vinculo}
            disabled={!pode}
            onChange={(e) => salvar({ vinculo: e.target.value as "clt" | "estagio" })}
          >
            <option value="clt">CLT</option>
            <option value="estagio">Estágio</option>
          </Selecao>
        </Campo>
      </div>
      <Interruptor
        rotulo="Escala com a área"
        ligado={x.escala_area}
        desabilitado={!pode}
        texto={x.escala_area ? "Escala com a área (proporcional aos m²)" : "Fixa por mês"}
        onChange={(v) => salvar({ escala_area: v })}
      />

      <span className="rotulo">Exames (R$)</span>
      <div className={f.form}>
        <CampoNumero
          rotulo="Admissional"
          valor={Number(x.exame_adm)}
          desabilitado={!pode}
          onSalvar={(v) => salvar({ exame_adm: v })}
        />
        <CampoNumero
          rotulo="Periódico (ano)"
          valor={Number(x.exame_per_anual)}
          desabilitado={!pode}
          onSalvar={(v) => salvar({ exame_per_anual: v })}
        />
        <CampoNumero
          rotulo="Demissional"
          valor={Number(x.exame_dem)}
          desabilitado={!pode}
          onSalvar={(v) => salvar({ exame_dem: v })}
        />
      </div>

      <span className="rotulo">Adicionais e ferramentas</span>
      {est && (
        <p className="sub" style={{ margin: 0 }}>
          Estágio não recebe adicionais nem ferramentas.
        </p>
      )}
      <div className={f.form}>
        <CampoNumero
          rotulo="Periculosidade"
          sufixo="%"
          max={100}
          valor={Number(x.peric_pct)}
          desabilitado={!pode || est}
          onSalvar={(v) => salvar({ peric_pct: v })}
        />
        <CampoNumero
          rotulo="Insalubridade"
          sufixo="% do SM"
          max={100}
          valor={Number(x.insal_pct_sm)}
          desabilitado={!pode || est}
          onSalvar={(v) => salvar({ insal_pct_sm: v })}
        />
        <CampoNumero
          rotulo="Horas noturnas/mês"
          valor={Number(x.horas_noturnas_mes)}
          desabilitado={!pode || est}
          onSalvar={(v) => salvar({ horas_noturnas_mes: v })}
        />
        <CampoNumero
          rotulo="Ferramentas"
          sufixo="R$/mês"
          valor={Number(x.ferramentas_mes)}
          desabilitado={!pode || est}
          onSalvar={(v) => salvar({ ferramentas_mes: v })}
        />
        <CampoNumero
          rotulo="Fator de HE"
          casas={2}
          max={5}
          valor={Number(x.fator_he)}
          desabilitado={!pode || est}
          dica="× média de HE da obra"
          onSalvar={(v) => salvar({ fator_he: v })}
        />
      </div>

      <span className="rotulo">Sinônimos na folha</span>
      <div>
        {x.sinonimos.length ? (
          x.sinonimos.map((t) => (
            <span key={t} className={f.tag}>
              {t}
              {pode && (
                <button
                  type="button"
                  aria-label={`Remover sinônimo ${t}`}
                  onClick={() => remSin.mutate(t)}
                >
                  ×
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="sub">Nenhum. A carga da folha pedirá o mapeamento.</span>
        )}
      </div>
      {pode && (
        <form
          className={f.linha}
          onSubmit={(e) => {
            e.preventDefault();
            const t = novoSin.trim().toUpperCase();
            if (!t) return;
            addSin.mutate({ texto: t, funcao_id: x.id }, { onSuccess: () => setNovoSin("") });
          }}
        >
          <input
            className={f.input}
            style={{ flex: 1 }}
            aria-label="Novo sinônimo"
            placeholder="Como aparece na folha (ex.: MEIO OFICIAL PEDREIRO)"
            value={novoSin}
            onChange={(e) => setNovoSin(e.target.value)}
          />
          <Botao pequeno type="submit" disabled={!novoSin.trim()}>
            Adicionar
          </Botao>
        </form>
      )}

      {pode && (
        <Botao pequeno onClick={() => salvar({ ativo: !x.ativo })}>
          {x.ativo ? "Inativar função" : "Reativar função"}
        </Botao>
      )}
      <span className="sub">
        Exames: {moeda(Number(x.exame_adm), 0)} / {moeda(Number(x.exame_per_anual), 0)} /{" "}
        {moeda(Number(x.exame_dem), 0)} · fator de HE {numero(Number(x.fator_he), 2)}
      </span>
    </Cartao>
  );
}

function NovaFuncao({
  funcoes,
  onCriada,
  onFechar,
}: {
  funcoes: Funcao[];
  onCriada: (id: string) => void;
  onFechar: () => void;
}) {
  const criar = useCriarFuncao();
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState<GrupoFuncao>("direta");
  const [sinonimo, setSinonimo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const id = codigoDe(nome);

  function enviar() {
    if (!nome.trim()) return setErro("Informe o nome da função.");
    if (funcoes.some((x) => x.id === id || x.nome.toLowerCase() === nome.trim().toLowerCase()))
      return setErro("Já existe uma função com esse nome. Use outro ou reative a existente.");
    const sin = sinonimo.trim().toUpperCase();
    const dona = sin && funcoes.find((x) => x.sinonimos.includes(sin));
    if (dona)
      return setErro(`O sinônimo "${sin}" já está na função ${dona.nome}. Use outro texto.`);
    setErro(null);
    criar.mutate(
      { id, nome: nome.trim(), grupo, sinonimo: sinonimo.trim().toUpperCase() || undefined },
      { onSuccess: () => onCriada(id) },
    );
  }

  return (
    <Cartao className={f.painel} aria-label="Nova função">
      <div className={f.painelCabeca}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Nova função padrão</h2>
        <Botao variante="fantasma" pequeno onClick={onFechar} aria-label="Fechar">
          ×
        </Botao>
      </div>
      <Campo rotulo="Nome" dica={nome.trim() ? `Código: ${id}` : undefined} erro={erro}>
        <input
          className={f.input}
          value={nome}
          placeholder="Ex.: Operador de betoneira"
          onChange={(e) => setNome(e.target.value)}
        />
      </Campo>
      <Campo rotulo="Grupo">
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoFuncao)}>
          {GRUPOS.map(([g, n]) => (
            <option key={g} value={g}>
              {n}
            </option>
          ))}
        </Selecao>
      </Campo>
      <Campo rotulo="Como aparece na folha (opcional)">
        <input
          className={f.input}
          value={sinonimo}
          placeholder="Ex.: OPERADOR DE BETONEIRA"
          onChange={(e) => setSinonimo(e.target.value)}
        />
      </Campo>
      <Botao variante="primario" onClick={enviar} disabled={criar.isPending}>
        Criar função
      </Botao>
      <span className="sub">A função nasce sem salário: defina-o em Parâmetros → Salários.</span>
    </Cartao>
  );
}
