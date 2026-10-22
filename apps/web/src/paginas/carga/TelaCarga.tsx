import { useState } from "react";
import { dataHora } from "@ito/formato";
import { useSessao } from "../../auth/sessao";
import type { RascunhoCarga } from "../../dados/carga";
import { lerRascunho, useApagarRascunho, useContextoCarga, useRascunhos } from "../../dados/carga";
import { podeCarregar } from "../../lib/permissoes";
import { MENU } from "../../shell/rotas";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import { useToast } from "../../ui/toast";
import { Pagina } from "../Pagina";
import { Assistente } from "./Assistente";
import { ETAPAS, rascunhoVazio } from "./estado";

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
      {outros.length > 0 && (
        <Cartao aria-label="Rascunhos salvos">
          <div className={f.barra}>
            <span className="rotulo">Rascunhos salvos</span>
            <span className="sub">Cada etapa é salva sozinha; continue de onde parou.</span>
          </div>
          <table className={f.tabela}>
            <thead>
              <tr>
                <th>Obra</th>
                <th>Etapa</th>
                <th>Atualizado</th>
                <th className={f.r}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {outros.map((x) => (
                <tr key={x.id}>
                  <td className={f.forte}>
                    {x.titulo || "Carga sem nome"} {!x.meu && <Badge>de outro usuário</Badge>}
                  </td>
                  <td>
                    {x.etapa} · {ETAPAS[x.etapa - 1]?.nome}
                  </td>
                  <td className="sub">{dataHora(x.atualizado_em)}</td>
                  <td className={f.r}>
                    <span className={f.linha} style={{ justifyContent: "flex-end" }}>
                      {x.meu && (
                        <Botao pequeno variante="escuro" onClick={() => continuar(x.id)}>
                          Continuar
                        </Botao>
                      )}
                      <Botao
                        pequeno
                        variante="fantasma"
                        onClick={() => {
                          if (confirm(`Apagar o rascunho “${x.titulo || "Carga sem nome"}”?`))
                            apagar.mutate(x.id);
                        }}
                      >
                        Apagar
                      </Botao>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}

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
