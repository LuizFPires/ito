import { useState } from "react";
import { dataHora } from "@ito/formato";
import { useSessao } from "../../auth/sessao";
import type { RascunhoCarga } from "../../dados/carga";
import { lerRascunho, useApagarRascunho, useContextoCarga, useRascunhos } from "../../dados/carga";
import { podeCarregar } from "../../lib/permissoes";
import { MENU } from "../../shell/rotas";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import { Gaveta } from "../../ui/Gaveta";
import f from "../../ui/formulario.module.css";
import { useToast } from "../../ui/toast";
import { Pagina } from "../Pagina";
import { Assistente } from "./Assistente";
import { ETAPAS, rascunhoVazio } from "./estado";
import s from "./carga.module.css";

interface Aberto {
  id: string | null;
  etapa: number;
  conteudo: RascunhoCarga;
}

export function TelaCarga() {
  const d = MENU.find((x) => x.caminho === "/carga")!;
  const { usuario } = useSessao();
  const pode = podeCarregar(usuario);
  const contexto = useContextoCarga();
  const rascunhos = useRascunhos(pode ? usuario?.id : undefined);
  const apagar = useApagarRascunho();
  const avisar = useToast();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  // nova carga: chave muda para remontar o assistente do zero
  const [chave, setChave] = useState(0);
  const [gaveta, setGaveta] = useState(false);

  const resumo =
    "O ITO lê a folha com todas as rubricas, o ponto, o VT, as notas de prestadores e o realizado do ERP de uma obra concluída, traduz funções e rubricas e só grava na base depois da sua conferência.";

  if (!pode)
    return (
      <Pagina grupo={d.grupo} titulo={d.nome} resumo={resumo} milestone={d.milestone}>
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Só DP/RH, controladoria ou um administrador carregam obras. Peça a carga a um deles.
          </p>
        </Cartao>
      </Pagina>
    );

  if (contexto.isError)
    return (
      <Pagina grupo={d.grupo} titulo={d.nome} resumo={resumo} milestone={d.milestone}>
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
            Não foi possível carregar os cadastros. Atualize a página.
          </p>
        </Cartao>
      </Pagina>
    );

  const ctx = contexto.data;
  const outros = (rascunhos.data ?? []).filter((x) => x.id !== aberto?.id);

  async function continuar(id: string) {
    try {
      const r = await lerRascunho(id);
      setAberto({ id, etapa: r.etapa, conteudo: r.conteudo });
      setChave((k) => k + 1);
    } catch {
      avisar("Não foi possível abrir o rascunho. Atualize a página.");
    }
  }

  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={resumo} milestone={d.milestone}>
      <div className={f.linha} style={{ justifyContent: "flex-end", marginBottom: -8 }}>
        <Botao
          pequeno
          onClick={() => setGaveta(true)}
          aria-label={`Rascunhos salvos (${outros.length})`}
          title="Rascunhos salvos"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M4 2.5h6l2.5 2.5v8.5H4z" />
            <path d="M10 2.5V5h2.5M6 8h4.5M6 10.5h4.5" />
          </svg>
          Rascunhos
          {outros.length > 0 && <Badge tom="ambar">{outros.length}</Badge>}
        </Botao>
      </div>
      <Gaveta
        aberta={gaveta}
        titulo="Rascunhos salvos"
        subtitulo="Cada etapa é salva sozinha. Escolha um rascunho para continuar de onde parou."
        onFechar={() => setGaveta(false)}
      >
        {!outros.length ? (
          <p className="sub">Nenhum outro rascunho salvo.</p>
        ) : (
          <ul className={s.rascunhos}>
            {outros.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={s.rascunho}
                  disabled={!x.meu}
                  onClick={() => {
                    setGaveta(false);
                    void continuar(x.id);
                  }}
                >
                  <span className={f.forte}>{x.titulo || "Carga sem nome"}</span>
                  <span className="sub">
                    Etapa {x.etapa} · {ETAPAS[x.etapa - 1]?.nome} · {dataHora(x.atualizado_em)}
                  </span>
                  {!x.meu && <Badge>de outro usuário</Badge>}
                </button>
                <Botao
                  pequeno
                  variante="fantasma"
                  aria-label={`Apagar o rascunho ${x.titulo || "Carga sem nome"}`}
                  onClick={() => {
                    if (confirm(`Apagar o rascunho “${x.titulo || "Carga sem nome"}”?`))
                      apagar.mutate(x.id);
                  }}
                >
                  Apagar
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Gaveta>

      {!ctx ? (
        <Cartao>
          <p className="sub" style={{ padding: 22, margin: 0 }}>
            Carregando…
          </p>
        </Cartao>
      ) : (
        <Assistente
          key={chave}
          ctx={ctx}
          inicial={aberto ?? { id: null, etapa: 1, conteudo: rascunhoVazio(ctx.vigente) }}
          onNova={() => {
            setAberto(null);
            setChave((k) => k + 1);
          }}
        />
      )}
    </Pagina>
  );
}
