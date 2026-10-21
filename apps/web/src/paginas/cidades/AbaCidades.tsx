import { useMemo, useState } from "react";
import { moeda, numero } from "@ito/formato";
import { vtDiario, vtDiarioDe } from "@ito/motor";
import type { CidadeVt } from "@ito/motor";
import {
  nomeCidade,
  nomeCurtoCct,
  useAdicionarFeriadoCidade,
  useAtualizarCidade,
  useCcts,
  useCidades,
  useCriarCidade,
  useGravarPassagem,
  useRemoverFeriadoCidade,
} from "../../dados/cidades";
import type { Cidade } from "../../dados/cidades";
import { codigoDe, contemTermos, paginar } from "../../lib/lista";
import { Botao, Cartao } from "../../ui/componentes";
import {
  Campo,
  CampoBusca,
  CampoNumero,
  Paginacao,
  Selecao,
  SeletorComBusca,
} from "../../ui/formulario";
import f from "../../ui/formulario.module.css";

const POR_PAGINA = 15;
const ORIGEM_PADRAO = "bh";

const paraVt = (c: Cidade): CidadeVt => ({
  id: c.id,
  tarifaLocal: Number(c.tarifa_local),
  conducoes: c.conducoes,
  passagens: c.passagens,
});
const dois = (n: number) => String(n).padStart(2, "0");

export function AbaCidades({ pode }: { pode: boolean }) {
  const { data: cidades } = useCidades();
  const { data: ccts } = useCcts();
  const atualizar = useAtualizarCidade();
  const passagem = useGravarPassagem();
  const [q, setQ] = useState("");
  const [cct, setCct] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);

  const origem = (cidades ?? []).find((c) => c.id === ORIGEM_PADRAO);
  const lista = useMemo(
    () =>
      (cidades ?? []).filter(
        (c) => (!cct || c.cct_id === cct) && contemTermos(`${c.nome} ${c.uf} ${nomeCidade(c)}`, q),
      ),
    [cidades, cct, q],
  );
  const pg = paginar(lista, pagina, POR_PAGINA);
  const detalhe = (cidades ?? []).find((c) => c.id === aberta);
  const salvar = (c: Cidade, patch: Parameters<typeof atualizar.gravar>[0]["patch"]) =>
    atualizar.gravar({ id: c.id, patch });

  return (
    <>
      <Cartao style={{ overflow: "hidden" }}>
        <div className={f.barra}>
          <CampoBusca
            rotulo="Buscar cidade"
            placeholder="Buscar cidade"
            valor={q}
            onChange={(v) => {
              setQ(v);
              setPagina(1);
            }}
          />
          <Selecao
            aria-label="Filtrar por convenção"
            style={{ width: "auto", maxWidth: 280, borderRadius: 999 }}
            value={cct}
            onChange={(e) => {
              setCct(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todas as convenções</option>
            {(ccts ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {nomeCurtoCct(t.nome)}
              </option>
            ))}
          </Selecao>
          <span className="sub">
            VT diário = tarifa × conduções × 2 · Vindo de {origem ? nomeCidade(origem) : "BH"} =
            passagem por trajeto × 2
          </span>
        </div>
        <table className={f.tabela} aria-label="Cidades">
          <thead>
            <tr>
              <th>Cidade</th>
              <th>Convenção que vale</th>
              <th className={f.r}>Tarifa</th>
              <th className={f.r}>Conduções</th>
              <th className={f.r}>Vindo de {origem?.nome ?? "BH"}</th>
              <th className={f.r}>ISS %</th>
              <th className={f.r}>Feriados</th>
            </tr>
          </thead>
          <tbody>
            {pg.itens.map((c) => {
              const vtDe = origem ? vtDiarioDe(paraVt(c), paraVt(origem)) : undefined;
              return (
                <tr key={c.id} data-selecionada={c.id === aberta || undefined}>
                  <td>
                    <span className={f.forte}>{nomeCidade(c)}</span>
                    <div className="sub">VT local {moeda(vtDiario(paraVt(c)))}/dia</div>
                  </td>
                  <td>
                    {pode ? (
                      <Selecao
                        aria-label={`Convenção de ${nomeCidade(c)}`}
                        value={c.cct_id}
                        style={{ width: "auto", maxWidth: 200, minHeight: 34, borderRadius: 999 }}
                        onChange={(e) => salvar(c, { cct_id: e.target.value })}
                      >
                        {(ccts ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {nomeCurtoCct(t.nome)}
                          </option>
                        ))}
                      </Selecao>
                    ) : (
                      nomeCurtoCct((ccts ?? []).find((t) => t.id === c.cct_id)?.nome ?? "—")
                    )}
                  </td>
                  <td className={f.r}>
                    {pode ? (
                      <CampoNumero
                        compacto
                        largura={84}
                        rotulo={`Tarifa local de ${nomeCidade(c)}`}
                        valor={Number(c.tarifa_local)}
                        onSalvar={(v) => salvar(c, { tarifa_local: v })}
                      />
                    ) : (
                      moeda(Number(c.tarifa_local))
                    )}
                  </td>
                  <td className={f.r}>
                    {pode ? (
                      <CampoNumero
                        compacto
                        largura={56}
                        casas={0}
                        min={1}
                        max={10}
                        rotulo={`Conduções em ${nomeCidade(c)}`}
                        valor={c.conducoes}
                        onSalvar={(v) => salvar(c, { conducoes: v })}
                      />
                    ) : (
                      numero(c.conducoes)
                    )}
                  </td>
                  <td className={f.r}>
                    {c.id === ORIGEM_PADRAO || !origem ? (
                      <span className="sub">—</span>
                    ) : (
                      <>
                        {pode ? (
                          <CampoNumero
                            compacto
                            largura={84}
                            rotulo={`Passagem de ${nomeCidade(origem)} para ${nomeCidade(c)}`}
                            valor={c.passagens[ORIGEM_PADRAO] ?? 0}
                            onSalvar={(valor) =>
                              passagem.gravar({ cidade_id: c.id, origem_id: ORIGEM_PADRAO, valor })
                            }
                          />
                        ) : (
                          moeda(c.passagens[ORIGEM_PADRAO])
                        )}
                        <div className="sub">
                          VT {moeda(vtDe?.valor)}/dia{vtDe?.estimado ? " (estimado)" : ""}
                        </div>
                      </>
                    )}
                  </td>
                  <td className={f.r}>
                    {pode ? (
                      <CampoNumero
                        compacto
                        largura={64}
                        max={10}
                        rotulo={`ISS de ${nomeCidade(c)}`}
                        valor={Number(c.iss_pct)}
                        onSalvar={(v) => salvar(c, { iss_pct: v })}
                      />
                    ) : (
                      numero(Number(c.iss_pct), 2)
                    )}
                  </td>
                  <td className={f.r}>
                    <Botao
                      pequeno
                      variante="fantasma"
                      aria-label={`Feriados e passagens de ${nomeCidade(c)}`}
                      aria-pressed={c.id === aberta}
                      onClick={() => setAberta(c.id === aberta ? null : c.id)}
                    >
                      {numero(c.feriados.length)} · detalhes
                    </Botao>
                  </td>
                </tr>
              );
            })}
            {!pg.itens.length && (
              <tr>
                <td colSpan={7} className="sub" style={{ textAlign: "center", padding: 28 }}>
                  Nenhuma cidade encontrada. Limpe a busca ou o filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Paginacao pagina={pg} onPagina={setPagina} nome="cidades" />
      </Cartao>

      {detalhe && (
        <DetalheCidade
          key={detalhe.id}
          cidade={detalhe}
          pode={pode}
          onFechar={() => setAberta(null)}
        />
      )}
      {pode && <NovaCidade />}
    </>
  );
}

function DetalheCidade({
  cidade: c,
  pode,
  onFechar,
}: {
  cidade: Cidade;
  pode: boolean;
  onFechar: () => void;
}) {
  const { data: cidades } = useCidades();
  const atualizar = useAtualizarCidade();
  const passagem = useGravarPassagem();
  const addFer = useAdicionarFeriadoCidade();
  const remFer = useRemoverFeriadoCidade();
  const [nome, setNome] = useState(c.nome);
  const [ddmm, setDdmm] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novaOrigem, setNovaOrigem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const outras = (cidades ?? []).filter((x) => x.id !== c.id);
  const nomeDe = (id: string) => {
    const x = outras.find((o) => o.id === id);
    return x ? nomeCidade(x) : id;
  };

  function incluirFeriado() {
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(ddmm.trim());
    if (!m || !descricao.trim()) return setErro("Informe dia/mês (dd/mm) e a descrição.");
    setErro(null);
    addFer.mutate(
      { cidade_id: c.id, dia: Number(m[1]), mes: Number(m[2]), nome: descricao.trim() },
      {
        onSuccess: () => {
          setDdmm("");
          setDescricao("");
        },
      },
    );
  }

  return (
    <Cartao
      className={f.painel}
      style={{ position: "static" }}
      aria-label={`Cidade ${nomeCidade(c)}`}
    >
      <div className={f.painelCabeca}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>{nomeCidade(c)}</h2>
        <Botao variante="fantasma" pequeno onClick={onFechar} aria-label="Fechar detalhe">
          ×
        </Botao>
      </div>
      <div className={f.form}>
        <Campo rotulo="Nome">
          <input
            className={f.input}
            value={nome}
            disabled={!pode}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => {
              const n = nome.trim();
              if (!n) return setNome(c.nome);
              if (n !== c.nome)
                atualizar.gravar({ id: c.id, patch: { nome: n } }).catch(() => setNome(c.nome));
            }}
          />
        </Campo>
        <Campo rotulo="UF">
          <Selecao
            value={c.uf}
            disabled={!pode}
            onChange={(e) => atualizar.gravar({ id: c.id, patch: { uf: e.target.value } })}
          >
            {UFS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Selecao>
        </Campo>
      </div>

      <span className="rotulo">Feriados municipais (todo ano)</span>
      <div>
        {c.feriados.length ? (
          c.feriados.map((x) => (
            <span key={`${x.mes}-${x.dia}`} className={f.tag} title={x.nome}>
              {dois(x.dia)}/{dois(x.mes)} {x.nome}
              {pode && (
                <button
                  type="button"
                  aria-label={`Remover feriado ${x.nome}`}
                  onClick={() => remFer.mutate({ cidade_id: c.id, mes: x.mes, dia: x.dia })}
                >
                  ×
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="sub">Nenhum feriado municipal.</span>
        )}
      </div>
      {pode && (
        <form
          className={f.linha}
          onSubmit={(e) => {
            e.preventDefault();
            incluirFeriado();
          }}
        >
          <input
            className={f.input}
            style={{ width: 100 }}
            aria-label="Dia e mês do feriado"
            placeholder="dd/mm"
            value={ddmm}
            onChange={(e) => setDdmm(e.target.value)}
          />
          <input
            className={f.input}
            style={{ flex: 1, minWidth: 180 }}
            aria-label="Descrição do feriado municipal"
            placeholder="Ex.: Padroeira da cidade"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <Botao pequeno type="submit">
            Adicionar feriado
          </Botao>
          {erro && (
            <span className={f.erro} role="alert">
              {erro}
            </span>
          )}
        </form>
      )}

      <span className="rotulo">Passagem para quem vem de outra cidade (R$ por trajeto)</span>
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Origem</th>
            <th className={f.r}>Passagem</th>
            <th className={f.r}>VT diário</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(c.passagens).map(([o, v]) => (
            <tr key={o}>
              <td>{nomeDe(o)}</td>
              <td className={f.r}>
                {pode ? (
                  <CampoNumero
                    compacto
                    largura={90}
                    rotulo={`Passagem de ${nomeDe(o)}`}
                    valor={v}
                    dica="0 remove"
                    onSalvar={(valor) => passagem.gravar({ cidade_id: c.id, origem_id: o, valor })}
                  />
                ) : (
                  moeda(v)
                )}
              </td>
              <td className={f.r}>{moeda(v * 2)}</td>
            </tr>
          ))}
          {!Object.keys(c.passagens).length && (
            <tr>
              <td colSpan={3} className="sub">
                Nenhuma passagem cadastrada: o VT de quem vem de fora é estimado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {pode && (
        <div className={f.linha}>
          <SeletorComBusca
            rotulo="Nova origem"
            placeholder="+ cidade de origem (digite o nome)…"
            opcoes={outras
              .filter((o) => c.passagens[o.id] === undefined)
              .map((o) => ({ valor: o.id, texto: nomeCidade(o) }))}
            onEscolher={setNovaOrigem}
          />
          {novaOrigem && <span className="sub">Origem: {nomeDe(novaOrigem)}</span>}
          {novaOrigem && (
            <CampoNumero
              rotulo="Passagem da nova origem"
              valor={0}
              onSalvar={(valor) =>
                passagem
                  .gravar({ cidade_id: c.id, origem_id: novaOrigem, valor })
                  .then(() => setNovaOrigem(""))
              }
            />
          )}
        </div>
      )}
    </Cartao>
  );
}

const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

function NovaCidade() {
  const { data: ccts } = useCcts();
  const { data: cidades } = useCidades();
  const criar = useCriarCidade();
  const [nome, setNome] = useState("");
  const [uf, setUf] = useState("MG");
  const [cct, setCct] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  // Padrão: a CCT de BH, como no protótipo; sem ela, a primeira da lista.
  const cctEscolhida = cct || ccts?.find((t) => t.id === "bh")?.id || ccts?.[0]?.id || "";

  function enviar() {
    const n = nome.trim();
    if (!n) return setErro("Informe o nome da cidade.");
    if (!cctEscolhida) return setErro("Cadastre uma convenção antes de adicionar cidades.");
    if ((cidades ?? []).some((c) => c.nome.toLowerCase() === n.toLowerCase() && c.uf === uf))
      return setErro(`${n}/${uf} já está cadastrada.`);
    setErro(null);
    let id = codigoDe(`${n} ${uf}`);
    for (let i = 2; (cidades ?? []).some((c) => c.id === id); i++)
      id = `${codigoDe(`${n} ${uf}`)}_${i}`;
    criar.mutate(
      { id, nome: n, uf, cct_id: cctEscolhida, tarifa_local: 5, conducoes: 1, iss_pct: 3 },
      { onSuccess: () => setNome("") },
    );
  }

  return (
    <Cartao className={f.painel} style={{ position: "static" }} aria-label="Nova cidade">
      <span className="rotulo">Nova cidade</span>
      <div className={f.form}>
        <Campo rotulo="Nome">
          <input
            className={f.input}
            value={nome}
            placeholder="Ex.: Sete Lagoas"
            onChange={(e) => setNome(e.target.value)}
          />
        </Campo>
        <Campo rotulo="UF">
          <Selecao value={uf} onChange={(e) => setUf(e.target.value)}>
            {UFS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Convenção">
          <Selecao value={cctEscolhida} onChange={(e) => setCct(e.target.value)}>
            {(ccts ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {nomeCurtoCct(t.nome)}
              </option>
            ))}
          </Selecao>
        </Campo>
      </div>
      {erro && (
        <p className={f.erro} role="alert" style={{ margin: 0 }}>
          {erro}
        </p>
      )}
      <div className={f.linha}>
        <Botao variante="primario" onClick={enviar} disabled={criar.isPending || !nome.trim()}>
          Adicionar cidade
        </Botao>
        <span className="sub">Nasce com tarifa R$ 5,00, 1 condução e ISS 3%; ajuste na lista.</span>
      </div>
    </Cartao>
  );
}
