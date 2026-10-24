import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { ComponenteRubrica, RubricaCadastro, TipoRubrica } from "@ito/carga";
import { rubricaDe } from "@ito/carga";
import { moeda, numero } from "@ito/formato";
import type { TipoHe } from "@ito/motor";
import { DESCRICAO_COMPONENTE, NOME_COMPONENTE } from "../../dados/cadastros";
import { contemTermos, paginar } from "../../lib/lista";
import { Badge, Cartao } from "../../ui/componentes";
import { CampoBusca, Interruptor, Paginacao, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import type { PropsEtapa } from "./Assistente";
import s from "./carga.module.css";

const POR_PAGINA = 15;
const TIPOS: TipoRubrica[] = ["provento", "desconto", "informativo"];
const NOME_HE: Record<TipoHe, string> = {
  util: "Dias úteis",
  sabado: "Sábado",
  intervalo: "Intervalo",
  feriado: "Domingos e feriados",
};
type Nova = Omit<RubricaCadastro, "codigo">;
/** Opções com a explicação, como no protótipo (COMPR). */
const COMPONENTE_LONGO: Record<ComponenteRubrica, string> = {
  sal: "Salário (horas normais)",
  extras: "Adicionais",
  he: "Horas extras",
  dsr: "Reflexo DSR",
  faltas: "Faltas (desconta do salário)",
  resc: "Rescisão",
  ferr: "Ferramentas (indenizatória, sem encargos)",
  provpaga: "Baixa de provisão (já custeada pela provisão)",
  compgps: "Compensado na guia do INSS (custo zero)",
  nao: "Não entra no custo (desconto do empregado)",
  info: "Só informativo",
};

export function EtapaRubricas({ r, mudar, ctx }: PropsEtapa) {
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [soNovas, setSoNovas] = useState(false);

  const linhas = useMemo(() => {
    const m = new Map<number, { codigo: number; descricao: string; valor: number }>();
    for (const x of r.leituras?.folha.rubricas ?? []) {
      const l = m.get(x.codigo) ?? { codigo: x.codigo, descricao: x.descricao, valor: 0 };
      l.valor += x.valor;
      if (!l.descricao) l.descricao = x.descricao;
      m.set(x.codigo, l);
    }
    return [...m.values()].sort((a, b) => a.codigo - b.codigo);
  }, [r.leituras]);

  const conhecida = (c: number) => ctx.cadastro.rubricas.some((x) => x.codigo === c);
  const novas = linhas.filter((l) => !conhecida(l.codigo));
  const pendentes = novas.filter((l) => !rubricaDe(l.codigo, ctx.cadastro, r.escolhas)).length;
  const filtradas = linhas.filter(
    (l) => contemTermos(`${l.codigo} ${l.descricao}`, q) && (!soNovas || !conhecida(l.codigo)),
  );
  const pg = paginar(filtradas, pagina, POR_PAGINA);
  const filtrar = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  const classificar = (codigo: number, descricao: string, p: Partial<Nova>) =>
    mudar((x) => {
      const atual: Nova = x.escolhas.rubricasNovas[codigo] ?? {
        nome: descricao || `RUBRICA ${codigo}`,
        tipo: "" as TipoRubrica,
        componente: "" as ComponenteRubrica,
        baseProvisoes: false,
        tipoHe: null,
      };
      const nova = { ...atual, ...p };
      if (nova.componente !== "he") nova.tipoHe = null;
      return {
        ...x,
        escolhas: {
          ...x.escolhas,
          rubricasNovas: { ...x.escolhas.rubricasNovas, [codigo]: nova },
        },
      };
    });

  if (!linhas.length)
    return (
      <Cartao aria-label="Rubricas da folha">
        <p className="sub" style={{ padding: 22, margin: 0 }}>
          Nenhuma folha lida ainda. Envie a folha na etapa Arquivos para ver as rubricas dela.
        </p>
      </Cartao>
    );

  return (
    <Cartao aria-label="Rubricas da folha">
      <div className={f.barra}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 260 }}>
          <span className="rotulo">Rubricas encontradas na folha</span>
          <span className="sub">
            Defina se cada verba nova é provento, desconto ou informativa, e como entra no custo.
            Rubricas novas param a carga até serem classificadas.
          </span>
        </div>
        <Link
          className={`${u.botao} ${u.pequeno}`}
          to="/rubricas"
          style={{ textDecoration: "none" }}
        >
          Dicionário completo
        </Link>
        <CampoBusca
          rotulo="Buscar rubrica"
          placeholder="Código ou nome"
          valor={q}
          onChange={(v) => filtrar(() => setQ(v))}
        />
        <Interruptor
          rotulo="Só novas"
          texto={`Só novas (${numero(novas.length)}${pendentes ? ` · ${numero(pendentes)} sem classificação` : ""})`}
          ligado={soNovas}
          onChange={(v) => filtrar(() => setSoNovas(v))}
        />
      </div>
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Cód.</th>
            <th>Rubrica</th>
            <th>Tipo</th>
            <th>Entra no custo como</th>
            <th>Base de provisões</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {pg.itens.map((l) => {
            const cad = ctx.cadastro.rubricas.find((x) => x.codigo === l.codigo);
            if (cad)
              return (
                <tr key={l.codigo}>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {l.codigo}
                  </td>
                  <td>
                    <span className={f.forte}>{cad.nome}</span>
                    <div className="sub">{moeda(l.valor)} na folha</div>
                  </td>
                  <td>{cad.tipo}</td>
                  <td>
                    {NOME_COMPONENTE[cad.componente]}
                    {cad.tipoHe && <div className="sub">{NOME_HE[cad.tipoHe]}</div>}
                  </td>
                  <td>{cad.baseProvisoes ? "Sim" : "Não"}</td>
                  <td>
                    <Badge tom="ok">no dicionário</Badge>
                  </td>
                </tr>
              );
            const e = r.escolhas.rubricasNovas[l.codigo];
            const ok = !!rubricaDe(l.codigo, ctx.cadastro, r.escolhas);
            return (
              <tr key={l.codigo}>
                <td className="mono" style={{ fontSize: 12 }}>
                  {l.codigo}
                </td>
                <td>
                  <span className={f.forte}>
                    {e?.nome ?? (l.descricao || `RUBRICA ${l.codigo}`)}
                  </span>
                  <div className="sub">
                    {moeda(l.valor)} na folha
                    {e?.componente ? ` · ${DESCRICAO_COMPONENTE[e.componente]}` : ""}
                  </div>
                </td>
                <td>
                  <Selecao
                    aria-label={`Tipo da rubrica ${l.codigo}`}
                    className={`${s.selecaoTipo} ${e?.tipo ? "" : f.invalido}`}
                    value={e?.tipo ?? ""}
                    onChange={(ev) =>
                      classificar(l.codigo, l.descricao, { tipo: ev.target.value as TipoRubrica })
                    }
                  >
                    <option value="">Escolher…</option>
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Selecao>
                </td>
                <td>
                  <Selecao
                    aria-label={`Componente da rubrica ${l.codigo}`}
                    className={e?.componente ? undefined : f.invalido}
                    value={e?.componente ?? ""}
                    onChange={(ev) =>
                      classificar(l.codigo, l.descricao, {
                        componente: ev.target.value as ComponenteRubrica,
                        tipoHe: ev.target.value === "he" ? "util" : null,
                      })
                    }
                  >
                    <option value="">Escolher…</option>
                    {Object.entries(COMPONENTE_LONGO).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Selecao>
                  {e?.componente === "he" && (
                    <Selecao
                      aria-label={`Tipo de HE da rubrica ${l.codigo}`}
                      style={{ marginTop: 6 }}
                      value={e.tipoHe ?? "util"}
                      onChange={(ev) =>
                        classificar(l.codigo, l.descricao, { tipoHe: ev.target.value as TipoHe })
                      }
                    >
                      {Object.entries(NOME_HE).map(([k, v]) => (
                        <option key={k} value={k}>
                          HE · {v}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </td>
                <td>
                  <Interruptor
                    rotulo={`Rubrica ${l.codigo} é base de provisões`}
                    ligado={!!e?.baseProvisoes}
                    onChange={(v) => classificar(l.codigo, l.descricao, { baseProvisoes: v })}
                  />
                </td>
                <td>
                  {ok ? (
                    <Badge tom="ambar">nova · classificada</Badge>
                  ) : (
                    <Badge tom="erro">nova</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Paginacao pagina={pg} onPagina={setPagina} nome="rubricas" />
    </Cartao>
  );
}
