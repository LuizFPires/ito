import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { dataHora, numero } from "@ito/formato";
import { useSessao } from "../auth/sessao";
import type { Convite, Permissao, UsuarioLista } from "../dados/usuarios";
import {
  useAlterarUsuario,
  useConvidar,
  useLinkSenha,
  useZerarMfa,
  usePermissoes,
  useSituacao,
  useUsuarios,
} from "../dados/usuarios";
import { alternarOrdem, contemTermos, ordenar, paginar } from "../lib/lista";
import type { Ordem } from "../lib/lista";
import { podeGerirUsuarios } from "../lib/permissoes";
import type { Perfil } from "../lib/supabase";
import { NOME_PERFIL } from "../lib/supabase";
import { MENU } from "../shell/rotas";
import { Badge, Botao, Cartao, Chip } from "../ui/componentes";
import { Campo, CampoBusca, Interruptor, Kpi, Paginacao, Selecao, ThOrdem } from "../ui/formulario";
import f from "../ui/formulario.module.css";
import { Pagina } from "./Pagina";

const POR_PAGINA = 20;
const PERFIS = Object.keys(NOME_PERFIL) as Perfil[];
const CURTO: Record<Perfil, string> = {
  planejamento: "Planejamento",
  engenharia: "Engenharia",
  dp_rh: "DP/RH",
  controladoria: "Controladoria",
  diretoria: "Diretoria",
};
type Situacao = "todos" | "ativos" | "pendentes" | "desativados";
type Chave = "nome" | "perfil" | "situacao";

function situacaoDe(u: UsuarioLista): Exclude<Situacao, "todos"> {
  if (!u.ativo) return "desativados";
  return u.convite_pendente ? "pendentes" : "ativos";
}

export function TelaUsuarios() {
  const d = MENU.find((x) => x.caminho === "/usuarios")!;
  const { usuario } = useSessao();
  const pode = podeGerirUsuarios(usuario);
  const lista = useUsuarios(pode);
  const [q, setQ] = useState("");
  const [sit, setSit] = useState<Situacao>("todos");
  const [pagina, setPagina] = useState(1);
  const [convidando, setConvidando] = useState(false);
  const [ordem, setOrdem] = useState<Ordem<Chave>>({ chave: "nome", dir: 1 });
  const ordenarPor = (k: Chave) => setOrdem(alternarOrdem(ordem, k));

  const todos = lista.data ?? [];
  const filtrados = useMemo(
    () =>
      ordenar(
        (lista.data ?? []).filter(
          (u) =>
            (sit === "todos" || situacaoDe(u) === sit) &&
            contemTermos(`${u.nome} ${u.email} ${NOME_PERFIL[u.perfil]}`, q),
        ),
        ordem,
        (u, k) =>
          k === "nome" ? u.nome || u.email : k === "perfil" ? NOME_PERFIL[u.perfil] : situacaoDe(u),
      ),
    [lista.data, sit, q, ordem],
  );
  const pg = paginar(filtrados, pagina, POR_PAGINA);
  const conta = (s: Exclude<Situacao, "todos">) => todos.filter((u) => situacaoDe(u) === s).length;
  const filtrar = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  if (!pode)
    return (
      <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            A gestão de usuários é só para administradores. Peça a um administrador para mudar o seu
            perfil ou convidar alguém.
          </p>
        </Cartao>
        <TabelaPermissoes />
      </Pagina>
    );

  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
      <div className={f.kpis}>
        <Kpi rotulo="Ativos" valor={numero(conta("ativos"))} sub="entram no ITO" />
        <Kpi
          rotulo="Administradores"
          valor={numero(todos.filter((u) => u.admin && u.ativo).length)}
          sub="gerem usuários"
        />
        <Kpi
          rotulo="Convites pendentes"
          valor={numero(conta("pendentes"))}
          sub="ainda não definiram a senha"
        />
        <Kpi
          rotulo="Desativados"
          valor={numero(conta("desativados"))}
          sub="sem login; a autoria fica"
          destaque
        />
      </div>

      {convidando && <NovoConvite onFechar={() => setConvidando(false)} />}

      <Cartao style={{ overflow: "hidden" }}>
        <div className={f.barra}>
          <CampoBusca
            rotulo="Buscar usuário"
            placeholder="Nome, e-mail ou perfil"
            valor={q}
            onChange={(v) => filtrar(() => setQ(v))}
          />
          <div role="group" aria-label="Situação" style={{ display: "flex", flexWrap: "wrap" }}>
            {(
              [
                ["todos", "Todos"],
                ["ativos", "Ativos"],
                ["pendentes", "Convite pendente"],
                ["desativados", "Desativados"],
              ] as [Situacao, string][]
            ).map(([k, n]) => (
              <Chip key={k} ativo={sit === k} onClick={() => filtrar(() => setSit(k))}>
                {n}
              </Chip>
            ))}
          </div>
          {!convidando && (
            <Botao variante="primario" pequeno onClick={() => setConvidando(true)}>
              Convidar usuário
            </Botao>
          )}
        </div>
        {lista.isError ? (
          <p className="sub" style={{ padding: 22 }} role="alert">
            Não foi possível carregar os usuários. Atualize a página.
          </p>
        ) : lista.isLoading ? (
          <p className="sub" style={{ padding: 22 }}>
            Carregando…
          </p>
        ) : (
          <>
            <table className={f.tabela} aria-label="Usuários">
              <thead>
                <tr>
                  <ThOrdem chave="nome" ordem={ordem} onOrdenar={ordenarPor}>
                    Pessoa
                  </ThOrdem>
                  <ThOrdem chave="perfil" ordem={ordem} onOrdenar={ordenarPor}>
                    Perfil
                  </ThOrdem>
                  <th>Admin</th>
                  <ThOrdem chave="situacao" ordem={ordem} onOrdenar={ordenarPor}>
                    Situação
                  </ThOrdem>
                  <th className={f.r}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {pg.itens.map((u) => (
                  <LinhaUsuario key={u.id} u={u} eu={u.id === usuario?.id} />
                ))}
              </tbody>
            </table>
            {!pg.total && (
              <p className="sub" style={{ padding: 22 }}>
                Nenhum usuário com esses filtros.
              </p>
            )}
            <Paginacao pagina={pg} onPagina={setPagina} nome="usuários" />
          </>
        )}
      </Cartao>

      <TabelaPermissoes />
    </Pagina>
  );
}

function LinhaUsuario({ u, eu }: { u: UsuarioLista; eu: boolean }) {
  const alterar = useAlterarUsuario();
  const situacao = useSituacao();
  const link = useLinkSenha();
  const zerar = useZerarMfa();
  const s = situacaoDe(u);
  const ocupado = alterar.isPending || situacao.isPending || link.isPending || zerar.isPending;
  return (
    <tr>
      <td>
        <span className={f.forte}>{u.nome || "Sem nome"}</span> {eu && <Badge>você</Badge>}
        <div className="sub">{u.email}</div>
      </td>
      <td>
        <Campo rotulo={`Perfil de ${u.email}`} ocultarRotulo>
          <Selecao
            value={u.perfil}
            disabled={ocupado || !u.ativo}
            onChange={(e) =>
              alterar.mutate({ id: u.id, patch: { perfil: e.target.value as Perfil } })
            }
          >
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {NOME_PERFIL[p]}
              </option>
            ))}
          </Selecao>
        </Campo>
      </td>
      <td>
        <Interruptor
          rotulo={`Administrador: ${u.email}`}
          ligado={u.admin}
          desabilitado={ocupado || !u.ativo || (eu && u.admin)}
          onChange={(v) => alterar.mutate({ id: u.id, patch: { admin: v } })}
        />
      </td>
      <td>
        <Badge tom={s === "ativos" ? "ok" : s === "pendentes" ? "ambar" : "erro"}>
          {s === "ativos" ? "ativo" : s === "pendentes" ? "convite pendente" : "desativado"}
        </Badge>
        <div className="sub">
          {u.ultimo_acesso ? `último acesso ${dataHora(u.ultimo_acesso)}` : "nunca entrou"}
        </div>
        {u.mfa_obrigatorio && (
          <div className="sub">
            {u.mfa_ativo
              ? "segundo fator ativo"
              : "segundo fator pendente (ativa no próximo login)"}
          </div>
        )}
      </td>
      <td className={f.r} style={{ whiteSpace: "nowrap" }}>
        {u.ativo && (
          <Botao
            pequeno
            variante="fantasma"
            disabled={ocupado}
            title="Envia por e-mail o link para definir a senha (convite de novo ou troca de senha)"
            onClick={() => link.mutate(u.id)}
          >
            Enviar link de senha
          </Botao>
        )}{" "}
        {!eu && u.mfa_ativo && (
          <Botao
            pequeno
            variante="fantasma"
            disabled={ocupado}
            title="Para quem perdeu o celular: a pessoa ativa o segundo fator de novo no próximo login"
            onClick={() => {
              if (
                window.confirm(
                  `Zerar o segundo fator de ${u.email}? A sessão dela é encerrada e, no próximo login, ela lê um QR code novo no aplicativo autenticador.`,
                )
              )
                zerar.mutate(u.id);
            }}
          >
            Zerar segundo fator
          </Botao>
        )}{" "}
        {!eu && (
          <Botao
            pequeno
            variante={u.ativo ? "padrao" : "escuro"}
            disabled={ocupado}
            onClick={() => {
              if (
                u.ativo &&
                !window.confirm(
                  `Desativar ${u.email}? A pessoa deixa de entrar no ITO; o que ela gravou fica com a autoria dela.`,
                )
              )
                return;
              situacao.mutate({ id: u.id, ativo: !u.ativo });
            }}
          >
            {u.ativo ? "Desativar" : "Reativar"}
          </Botao>
        )}
      </td>
    </tr>
  );
}

function NovoConvite({ onFechar }: { onFechar: () => void }) {
  const convidar = useConvidar();
  const [c, setC] = useState<Convite>({ email: "", nome: "", perfil: "engenharia", admin: false });
  const [erro, setErro] = useState<string | null>(null);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()))
      return setErro("Informe um e-mail válido.");
    if (!c.nome.trim()) return setErro("Informe o nome de quem vai entrar.");
    setErro(null);
    convidar.mutate(
      { ...c, email: c.email.trim(), nome: c.nome.trim() },
      { onSuccess: () => onFechar() },
    );
  };
  return (
    <Cartao aria-label="Convidar usuário">
      <form className={f.barra} onSubmit={enviar} noValidate style={{ alignItems: "flex-end" }}>
        <Campo rotulo="E-mail">
          <input
            className={f.input}
            type="email"
            autoFocus
            value={c.email}
            onChange={(e) => setC({ ...c, email: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Nome">
          <input
            className={f.input}
            value={c.nome}
            onChange={(e) => setC({ ...c, nome: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Perfil">
          <Selecao
            value={c.perfil}
            onChange={(e) => setC({ ...c, perfil: e.target.value as Perfil })}
          >
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {NOME_PERFIL[p]}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Interruptor
          rotulo="Convidar como administrador"
          texto="Admin"
          ligado={c.admin}
          onChange={(v) => setC({ ...c, admin: v })}
        />
        <Botao variante="primario" pequeno type="submit" disabled={convidar.isPending}>
          {convidar.isPending ? "Enviando…" : "Enviar convite"}
        </Botao>
        <Botao pequeno variante="fantasma" onClick={onFechar}>
          Cancelar
        </Botao>
      </form>
      {erro && (
        <p className="sub" role="alert" style={{ padding: "0 22px 16px", color: "var(--err)" }}>
          {erro}
        </p>
      )}
      <p className="sub" style={{ padding: "0 22px 16px", margin: 0 }}>
        A pessoa recebe um e-mail com o link para definir a senha (vale por 1 hora). Se expirar, use
        “Enviar link de senha” na lista.
      </p>
    </Cartao>
  );
}

const celula = (p: Permissao | undefined) => {
  if (!p) return "—";
  if (p.aprova) return "Aprova";
  if (p.edita) return "Edita";
  if (p.so_totais) return "Só totais";
  return p.le ? "Lê" : "—";
};

/** O que cada perfil lê, edita ou aprova, servido pelo banco (mesma regra das permissões). */
export function TabelaPermissoes() {
  const q = usePermissoes();
  const modulos = useMemo(() => {
    const m = new Map<number, { modulo: string; limitacao: string | null; por: Permissao[] }>();
    for (const p of q.data ?? []) {
      const x = m.get(p.ordem) ?? { modulo: p.modulo, limitacao: p.limitacao, por: [] };
      x.por.push(p);
      m.set(p.ordem, x);
    }
    return [...m.values()];
  }, [q.data]);
  return (
    <Cartao aria-label="Permissões por perfil" style={{ overflow: "hidden" }}>
      <div className={f.barra}>
        <span className="rotulo">Permissões por perfil</span>
        <span className="sub">
          Gerada das regras do banco: é o que cada perfil consegue fazer de fato.
        </span>
      </div>
      {q.isError ? (
        <p className="sub" style={{ padding: 22 }} role="alert">
          Não foi possível carregar as permissões. Atualize a página.
        </p>
      ) : (
        <table className={f.tabela} aria-label="Permissões por perfil">
          <thead>
            <tr>
              <th>Módulo</th>
              {PERFIS.map((p) => (
                <th key={p}>{CURTO[p]}</th>
              ))}
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {modulos.map((m) => (
              <tr key={m.modulo}>
                <td>
                  <span className={f.forte}>{m.modulo}</span>
                  {m.limitacao && <div className="sub">{m.limitacao}</div>}
                </td>
                {PERFIS.map((p) => (
                  <td key={p}>{celula(m.por.find((x) => !x.admin && x.perfil === p))}</td>
                ))}
                <td>{celula(m.por.find((x) => x.admin))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Cartao>
  );
}
