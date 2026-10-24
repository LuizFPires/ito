import type { ReactNode } from "react";
import type { EstadoVerificacao, IdVerificacao } from "@ito/carga";
import { mesAno, moeda, numero } from "@ito/formato";
import { anoMes } from "@ito/motor";
import { Badge, Cartao, CartaoCorpo } from "../../ui/componentes";
import { Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import type { PropsEtapa } from "./Assistente";
import s from "./carga.module.css";
import type { Preparada } from "./estado";
import { fimDe } from "./estado";

const SELO: Record<EstadoVerificacao, { texto: string; tom: "ok" | "ambar" | "erro" }> = {
  ok: { texto: "OK", tom: "ok" },
  aviso: { texto: "Alerta", tom: "ambar" },
  erro: { texto: "Pendente", tom: "erro" },
};
const FORA = "__fora";

export function EtapaVerificacao({
  r,
  mudar,
  ctx,
  prep,
  existe,
  substituir,
  onSubstituir,
}: PropsEtapa & {
  prep: Preparada | null;
  existe: boolean;
  substituir: boolean;
  onSubstituir: (v: boolean) => void;
}) {
  if (!prep)
    return (
      <Cartao>
        <p className="sub" style={{ padding: 22, margin: 0 }}>
          Envie a folha e informe o período da obra para verificar.
        </p>
      </Cartao>
    );
  const v = prep.verificacao;
  const d = r.dados;
  const nomeMes = (i: number) => {
    const m = anoMes(d.inicio, i);
    return mesAno(m.ano, m.mes);
  };
  const escolher = (p: Partial<typeof r.escolhas>) =>
    mudar((x) => ({ ...x, escolhas: { ...x.escolhas, ...p } }));

  const extras: Partial<Record<IdVerificacao, ReactNode>> = {
    vt: v.semVt.length > 0 && (
      <label className={f.linha} style={{ fontSize: 13 }}>
        <input
          type="checkbox"
          checked={r.escolhas.semVtConfirmado}
          onChange={(e) => escolher({ semVtConfirmado: e.target.checked })}
        />
        Confirmo que optaram por não receber
      </label>
    ),
    nf: v.nfSemMes.length > 0 && (
      <div className={f.linha}>
        {v.nfSemMes.map((n) => (
          <Selecao
            key={n.chave}
            aria-label={`Competência da NF ${n.numero}`}
            style={{ width: "auto" }}
            value={r.escolhas.nfMes[n.chave] ?? ""}
            onChange={(e) => {
              const nfMes = { ...r.escolhas.nfMes };
              if (e.target.value) nfMes[n.chave] = Number(e.target.value);
              else delete nfMes[n.chave];
              escolher({ nfMes });
            }}
          >
            <option value="">NF {n.numero}: escolher competência…</option>
            {Array.from({ length: d.meses }, (_, i) => (
              <option key={i} value={i}>
                NF {n.numero}: {nomeMes(i)}
              </option>
            ))}
          </Selecao>
        ))}
      </div>
    ),
    realocada: v.destinosRealocada.length > 0 && (
      <div className={f.linha}>
        {v.destinosRealocada.map((dst) => {
          const atual = r.escolhas.realocacao[dst.texto];
          return (
            <Selecao
              key={dst.texto}
              aria-label={`Obra onde trabalharam (${dst.texto})`}
              style={{ width: "auto" }}
              value={atual ? (atual.obraId ?? FORA) : ""}
              onChange={(e) => {
                const realocacao = { ...r.escolhas.realocacao };
                const val = e.target.value;
                const obra = ctx.obras.find((o) => o.id === val);
                if (!val) delete realocacao[dst.texto];
                else
                  realocacao[dst.texto] = obra
                    ? { nome: obra.nome, obraId: obra.id }
                    : { nome: dst.texto, obraId: null };
                escolher({ realocacao });
              }}
            >
              <option value="">“{dst.texto}”: escolher obra de destino…</option>
              {ctx.obras
                .filter((o) => o.id !== d.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              <option value={FORA}>Obra fora da base: manter “{dst.texto}”</option>
            </Selecao>
          );
        })}
      </div>
    ),
    erp: v.apropriacao.length > 0 && (
      <table className={`${f.tabela} ${s.miniTabela}`}>
        <thead>
          <tr>
            <th>Mês</th>
            <th className={f.r}>ITO (caixa)</th>
            <th className={f.r}>ERP</th>
            <th className={f.r}>Diferença</th>
            <th>Justificativa</th>
          </tr>
        </thead>
        <tbody>
          {v.apropriacao.map((a) => (
            <tr key={a.mesIdx}>
              <td>{nomeMes(a.mesIdx)}</td>
              <td className={f.r}>{moeda(a.ito)}</td>
              <td className={f.r}>{moeda(a.erp)}</td>
              <td className={f.r}>{moeda(a.diferenca)}</td>
              <td>
                {Math.abs(a.diferenca) >= 1 ? (
                  <Selecao
                    aria-label={`Justificativa de ${nomeMes(a.mesIdx)}`}
                    className={a.justificativa ? undefined : f.invalido}
                    value={a.justificativa ?? ""}
                    onChange={(e) => {
                      const justificativas = { ...r.escolhas.justificativas };
                      if (e.target.value) justificativas[a.mesIdx] = e.target.value;
                      else delete justificativas[a.mesIdx];
                      escolher({ justificativas });
                    }}
                  >
                    <option value="">Justificar diferença…</option>
                    {ctx.justificativas.map((j) => (
                      <option key={j}>{j}</option>
                    ))}
                  </Selecao>
                ) : (
                  <span className="sub">confere</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    conferencia: v.conferencia.length > 0 && (
      <table className={`${f.tabela} ${s.miniTabela}`}>
        <thead>
          <tr>
            <th>Mês</th>
            <th className={f.r}>Rubricas no custo</th>
            <th className={f.r}>Custo do ITO</th>
            <th className={f.r}>Diferença</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {v.conferencia.map((c) => (
            <tr key={c.mesIdx}>
              <td>{nomeMes(c.mesIdx)}</td>
              <td className={f.r}>{moeda(c.rubricas)}</td>
              <td className={f.r}>{moeda(c.custo)}</td>
              <td className={f.r}>{moeda(c.diferenca)}</td>
              <td>
                {c.confere ? <Badge tom="ok">Confere</Badge> : <Badge tom="ambar">Diferença</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };

  const cidade = ctx.cidades.find((c) => c.id === d.cidadeId);
  const fim = fimDe(d.inicio, d.meses);
  const trocas = d.trocas.map((t) => `CCT ${t.dataBase} a partir de ${nomeMes(t.mesIdx)}`);

  return (
    <>
      <Cartao aria-label="Verificação antes de salvar">
        <div className={f.barra}>
          <span className="rotulo">Verificação antes de salvar</span>
          <span className="sub">
            {v.bloqueia
              ? "Resolva as pendências para liberar a gravação."
              : "Tudo certo para gravar na base."}
          </span>
        </div>
        {v.itens.map((it) => (
          <div key={it.id} className={s.verif} data-verificacao={it.id}>
            <div>
              <Badge tom={SELO[it.estado].tom}>{SELO[it.estado].texto}</Badge>
            </div>
            <div className={s.verifTexto}>
              <strong style={{ fontWeight: 500 }}>{it.titulo}</strong>
              <span className="sub">{it.detalhe}</span>
              {extras[it.id]}
            </div>
          </div>
        ))}
        {existe && (
          <div className={s.verif}>
            <div>
              <Badge tom={substituir ? "ok" : "erro"}>{substituir ? "OK" : "Pendente"}</Badge>
            </div>
            <div className={s.verifTexto}>
              <strong style={{ fontWeight: 500 }}>Já existe uma obra com o nome “{d.nome}”</strong>
              <label className={f.linha} style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={substituir}
                  onChange={(e) => onSubstituir(e.target.checked)}
                />
                Substituir a obra existente por esta carga
              </label>
            </div>
          </div>
        )}
      </Cartao>

      <Cartao aria-label="O que vai entrar na base">
        <CartaoCorpo>
          <span className="rotulo">O que vai entrar na base</span>
          <div className={s.resumo} style={{ marginTop: 10 }}>
            <strong>{d.nome}</strong>
            {d.tipologia && <span>{d.tipologia}</span>}
            <span>{cidade?.nome ?? "Sem cidade"}</span>
            <span>{numero(d.area)} m²</span>
            <span>
              {nomeMes(0)} a {mesAno(fim.ano, fim.mes)}
            </span>
            <span>CCT {d.dataBase}</span>
            {trocas.length > 0 && <span>{trocas.join(" · ")}</span>}
            <span>{d.premissas.foraDaSede ? "Com alojamento" : "Sem alojamento"}</span>
            <span>
              {numero(v.payload.lancamentos.length)} lançamentos · pessoa-mês{" "}
              {numero(
                Object.values(prep.montagem.obra.equivalente)
                  .flat()
                  .reduce((a, b) => a + b, 0),
                1,
              )}
            </span>
          </div>
        </CartaoCorpo>
      </Cartao>
    </>
  );
}
