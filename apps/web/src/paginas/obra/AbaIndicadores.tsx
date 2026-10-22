import { moeda, numero, percentual } from "@ito/formato";
import { indicadores, tabelaDoMes } from "@ito/motor";
import { parametrosDe } from "../../lib/obraDoBanco";
import { Cartao } from "../../ui/componentes";
import { Kpi } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { absenteismoMedio } from "./calculos";
import type { DadosAba } from "./comum";
import { NOME_GRUPO_F, soma } from "./comum";
import type { SetVista } from "./controles";
import { ControleGrupo } from "./controles";
import s from "./obra.module.css";

/** Exame sem valor aparece como "–" (como o protótipo). */
const ex0 = (v: number) => (v ? moeda(v, 0) : "–");

/** Indicadores da obra (PRD §3.2.8, SPEC §4.7) e médias por função. */
export function AbaIndicadores({ dados, setVista }: { dados: DadosAba; setVista: SetVista }) {
  const { r, obra, fun, ids, vista, d, ctx, rotulos } = dados;
  const n = rotulos.length;
  const p = tabelaDoMes(parametrosDe(d, ctx.tabelas, ctx.vigente, vista.visao), 0);
  const T = r.total;
  const ind = indicadores(r);
  const linhaF = (k: string) => {
    const l = r.porFuncao[k] ?? [];
    const pm = soma(l.map((c) => c.x));
    const ativos = l.filter((c) => c.x > 0).length || 1;
    const tot = soma(l.map((c) => c.total));
    const sem = soma(l.map((c) => c.remun));
    const dias = soma(l.map((c) => c.dias));
    return {
      pm,
      qtd: pm / ativos,
      ind: pm ? tot / pm : 0,
      indSem: pm ? sem / pm : 0,
      mensal: tot / ativos,
      dia: dias ? tot / dias : 0,
      diaSem: dias ? sem / dias : 0,
      ad: soma(l.map((c) => c.admissoes)),
      de: soma(l.map((c) => c.desligamentos)),
      exA: soma(l.map((c) => c.examesTipo.adm)),
      exP: soma(l.map((c) => c.examesTipo.per)),
      exD: soma(l.map((c) => c.examesTipo.dem)),
    };
  };
  const ped = linhaF("ped");
  const serv = linhaF("serv");
  const ad = T.adicionais;
  const legais =
    (ad.peric ?? 0) + (ad.insal ?? 0) + (ad.not ?? 0) + (ad.dsrNot ?? 0) + (ad.transf ?? 0);
  const lic = soma(obra.licencaPessoaDias);
  const fer = soma(obra.feriasPessoaDias);
  const ex = T.examesTipo;

  return (
    <>
      <div className={f.kpis}>
        <Kpi
          rotulo="R$ por dia · pedreiro"
          valor={moeda(ped.dia)}
          sub={`sem taxa ${moeda(ped.diaSem)}`}
          destaque
        />
        <Kpi
          rotulo="R$ por dia · servente"
          valor={moeda(serv.dia)}
          sub={`sem taxa ${moeda(serv.diaSem)}`}
          destaque
        />
        <Kpi
          rotulo="Salário-base"
          valor={moeda(p.salarios.ped ?? 0)}
          sub={`pedreiro · servente ${moeda(p.salarios.serv ?? 0)}`}
        />
        <Kpi
          rotulo="Encargos sobre a remuneração"
          valor={percentual(ind.encargosPct)}
          sub="sociais + provisões + tributos s/ NF"
        />
        <Kpi
          rotulo="Benefícios sobre a remuneração"
          valor={percentual(ind.beneficiosPct)}
          sub={`VT, refeição, cesta, seguro${d.obra.fora_da_sede ? ", alojamento" : ""}`}
        />
        <Kpi
          rotulo="HE média"
          valor={`${numero(T.x ? T.horasExtras / T.x : 0, 1)} h`}
          sub="por pessoa por mês"
        />
        <Kpi
          rotulo="Efetivo médio"
          valor={`${numero(T.x / Math.max(1, n), 1)} pessoas`}
          sub="equivalente por dias"
        />
        <Kpi
          rotulo="Custo mensal médio"
          valor={moeda(T.total / Math.max(1, n), 0)}
          sub="com taxa"
        />
        <Kpi
          rotulo="Absenteísmo médio"
          valor={percentual(absenteismoMedio(obra))}
          sub="faltas e afastamentos"
        />
        <Kpi
          rotulo="Rotatividade"
          valor={`${percentual(obra.rotatividadePct, 0)} a.m.`}
          sub="referência para projeções"
        />
        <Kpi
          rotulo="Licenças sem remuneração"
          valor={`${numero(lic)} dias`}
          sub={`${numero(T.x ? lic / T.x : 0, 2)} por pessoa·mês`}
        />
        <Kpi
          rotulo="Férias gozadas na obra"
          valor={`${numero(fer)} dias`}
          sub={`pagas pela provisão · ${moeda(T.ferPag, 0)} + encargos`}
        />
        <Kpi
          rotulo="Adicionais legais"
          valor={moeda(legais, 0)}
          sub="periculosidade, insalubridade, noturno, transferência"
        />
        <Kpi
          rotulo="Exames médicos"
          valor={moeda(T.exames, 0)}
          sub={`adm. ${moeda(ex.adm ?? 0, 0)} · per. ${moeda(ex.per ?? 0, 0)} · dem. ${moeda(ex.dem ?? 0, 0)}`}
        />
        <Kpi
          rotulo="% mão de obra indireta"
          valor={percentual(ind.indiretaPct, 0)}
          sub="das pessoa-mês"
        />
      </div>
      <Cartao aria-label="Médias por função">
        <div className={f.barra}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
            <span className="rotulo">Médias por função</span>
            <span className="sub">
              “Com taxa” = tudo o que a função custa; “sem taxa” = só a remuneração (salário,
              adicionais, HE e DSR)
            </span>
          </div>
          <ControleGrupo vista={vista} setVista={setVista} />
        </div>
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Função</th>
              <th className={f.r}>Qtd média</th>
              <th className={f.r}>Individual / mês</th>
              <th className={f.r}>Total mensal médio</th>
              <th className={f.r}>R$ / dia</th>
              <th className={f.r}>Admissões · desligamentos</th>
              <th className={f.r}>Exames</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((k) => {
              const x = linhaF(k);
              return (
                <tr key={k}>
                  <td className={f.forte}>
                    <span className={s.amostra} style={{ background: fun(k).cor }} />
                    {fun(k).nome}
                    <div className="sub">{NOME_GRUPO_F[fun(k).grupo]}</div>
                  </td>
                  <td className={f.r}>{numero(x.qtd, 2)}</td>
                  <td className={f.r}>
                    <strong>{moeda(x.ind, 0)}</strong>
                    <div className="sub">sem taxa {moeda(x.indSem, 0)}</div>
                  </td>
                  <td className={f.r}>{moeda(x.mensal, 0)}</td>
                  <td className={f.r}>
                    {moeda(x.dia)}
                    <div className="sub">sem taxa {moeda(x.diaSem)}</div>
                  </td>
                  <td className={f.r}>
                    {numero(x.ad)} · {numero(x.de)}
                  </td>
                  <td className={f.r}>
                    {moeda(x.exA + x.exP + x.exD, 0)}
                    <div className={`sub ${s.nowrap}`}>
                      adm. {ex0(x.exA)} · per. {ex0(x.exP)} · dem. {ex0(x.exD)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}
