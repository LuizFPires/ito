import { useMemo, useState } from "react";
import { moeda, numero, percentual } from "@ito/formato";
import { FORA_DO_CUSTO } from "@ito/motor";
import { useRubricas } from "../../dados/cadastros";
import { useLancamentos } from "../../dados/obras";
import { paginar } from "../../lib/lista";
import { Badge, Cartao } from "../../ui/componentes";
import { Kpi, Paginacao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { Restrito } from "./AbaFolha";
import type { DadosAba } from "./comum";
import s from "./obra.module.css";

interface Pessoa {
  matricula: string;
  funcao: string;
  ini: number;
  fim: number;
  meses: number;
  he: number;
  remun: number;
  desligado: boolean;
}

export function AbaPessoas({ dados }: { dados: DadosAba }) {
  const { d, rotulos, fun, pode } = dados;
  const q = useLancamentos(d.obra.id, pode);
  const rub = useRubricas();
  const [pagina, setPagina] = useState(1);
  const n = rotulos.length;

  const pessoas = useMemo(() => {
    const noCusto = new Set(
      (rub.data ?? []).filter((r) => !FORA_DO_CUSTO.includes(r.componente)).map((r) => r.codigo),
    );
    const desconto = new Set(
      (rub.data ?? []).filter((r) => r.tipo === "desconto").map((r) => r.codigo),
    );
    const por = new Map<string, Pessoa>();
    const realocado = new Set(
      (q.data?.lancamentos ?? [])
        .filter((l) => l.realocada_para)
        .map((l) => `${l.mes_idx}|${l.matricula}|${l.funcao_id}|${l.construtora}`),
    );
    for (const l of q.data?.lancamentos ?? []) {
      if (l.realocada_para) continue;
      const p = por.get(l.matricula) ?? {
        matricula: l.matricula,
        funcao: l.funcao_id,
        ini: l.mes_idx,
        fim: l.mes_idx,
        meses: 0,
        he: 0,
        remun: 0,
        desligado: false,
      };
      p.ini = Math.min(p.ini, l.mes_idx);
      if (l.mes_idx >= p.fim) {
        p.fim = l.mes_idx;
        p.funcao = l.funcao_id;
      }
      if (Number(l.equivalente) > 0) p.meses += 1;
      p.he += Number(l.horas_extras);
      p.desligado ||= l.desligado;
      por.set(l.matricula, p);
    }
    for (const r of q.data?.rubricas ?? []) {
      const p = por.get(r.matricula);
      if (!p || !noCusto.has(r.rubrica_codigo)) continue;
      // como na Folha: o mês em que trabalhou em outra obra fica fora
      if (realocado.has(`${r.mes_idx}|${r.matricula}|${r.funcao_id}|${r.construtora}`)) continue;
      const v = Number(r.valor);
      p.remun += desconto.has(r.rubrica_codigo) ? -Math.abs(v) : v;
    }
    return [...por.values()].sort(
      (a, b) => a.ini - b.ini || a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true }),
    );
  }, [q.data, rub.data]);

  if (!pode) return <Restrito oque="A lista de pessoas" />;
  if (q.isError || rub.isError)
    return (
      <Cartao>
        <p className="sub" style={{ padding: 22, margin: 0 }} role="alert">
          Não foi possível carregar as pessoas. Atualize a página.
        </p>
      </Cartao>
    );
  if (q.isLoading || rub.isLoading)
    return (
      <Cartao>
        <p className="sub" style={{ padding: 22, margin: 0 }}>
          Carregando…
        </p>
      </Cartao>
    );

  const saiu = pessoas.filter((p) => p.desligado || p.fim < n - 1).length;
  const perm = pessoas.length ? pessoas.reduce((t, p) => t + p.meses, 0) / pessoas.length : 0;
  const pg = paginar(pessoas, pagina, 25);

  return (
    <>
      <div className={f.kpis}>
        <Kpi
          rotulo="Pessoas diferentes na obra"
          valor={numero(pessoas.length)}
          sub="identificadas pela matrícula"
        />
        <Kpi
          rotulo="Permanência média"
          valor={`${numero(perm, 1)} meses`}
          sub={`de ${numero(n)} competências`}
        />
        <Kpi
          rotulo="Saíram antes do fim"
          valor={numero(saiu)}
          sub={`${percentual(pessoas.length ? (saiu / pessoas.length) * 100 : 0, 0)} das pessoas`}
        />
        <Kpi
          rotulo="Ficaram até o fim"
          valor={numero(pessoas.length - saiu)}
          sub="desmobilização ou transferência"
          destaque
        />
      </div>
      <Cartao aria-label="Pessoas ao longo da obra">
        <div className={f.barra}>
          <span className="rotulo">Pessoas ao longo da obra</span>
          <span className="sub">
            Sem nomes: o histórico guarda só a matrícula · valores da época, como pagos na folha.
          </span>
        </div>
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Função</th>
              <th>Período</th>
              <th className={f.r}>Meses</th>
              <th className={f.r}>HE (h)</th>
              <th className={f.r}>Remuneração na folha</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {pg.itens.map((p) => (
              <tr key={p.matricula}>
                <td className="mono">{p.matricula}</td>
                <td>
                  <span className={s.amostra} style={{ background: fun(p.funcao).cor }} />
                  {fun(p.funcao).nome}
                </td>
                <td className={s.nowrap}>
                  {rotulos[p.ini]} – {rotulos[p.fim]}
                </td>
                <td className={f.r}>{numero(p.meses)}</td>
                <td className={f.r}>{numero(p.he)}</td>
                <td className={f.r}>
                  <strong>{moeda(p.remun, 0)}</strong>
                </td>
                <td>
                  {p.desligado || p.fim < n - 1 ? (
                    <Badge tom="ambar">Desligado</Badge>
                  ) : (
                    <Badge>Até o fim</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Paginacao pagina={pg} onPagina={setPagina} nome="pessoas" />
      </Cartao>
    </>
  );
}
