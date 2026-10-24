import { Link } from "react-router";
import { mesAno } from "@ito/formato";
import { anoMes } from "@ito/motor";
import { mensagemErroCarga } from "../../dados/erros";
import type { DetalheObra } from "../../dados/obras";
import { useDefinirSituacao } from "../../dados/obras";
import { inicioDe } from "../../lib/obraDoBanco";
import { textoAndamento } from "../../lib/situacao";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { useToast } from "../../ui/toast";

const nomeMes = (d: DetalheObra, i: number) => {
  const m = anoMes(inicioDe(d.obra.inicio), i);
  return mesAno(m.ano, m.mes);
};

/**
 * Obra em andamento (M11): quantos meses já entraram, lançar o próximo, refazer o último e
 * concluir. Quem não carrega só vê a situação.
 */
export function BarraAndamento({ d, pode }: { d: DetalheObra; pode: boolean }) {
  const o = d.obra;
  const definir = useDefinirSituacao();
  const avisar = useToast();

  async function concluir() {
    const fim = nomeMes(d, o.meses - 1);
    if (
      !window.confirm(
        `Concluir “${o.nome}” com ${textoAndamento({ ...o, prazo_previsto: null })}, até ${fim}? A obra passa a servir de referência para projeções e não recebe mais meses (dá para reabrir).`,
      )
    )
      return;
    try {
      await definir.mutateAsync({ id: o.id, situacao: "concluida" });
      avisar("Obra concluída");
    } catch (e) {
      avisar(mensagemErroCarga(e));
    }
  }

  return (
    <Cartao aria-label="Obra em andamento" style={{ padding: "14px 22px" }}>
      <div className={f.linha} style={{ justifyContent: "space-between" }}>
        <span className={f.linha}>
          <Badge tom="ambar">em andamento</Badge>
          <span>
            {textoAndamento(o)}
            {o.meses > 0 && <span className="sub"> · último: {nomeMes(d, o.meses - 1)}</span>}
          </span>
        </span>
        {pode && (
          <span className={f.linha}>
            {o.meses > 0 && (
              <Link
                className={`${u.botao} ${u.pequeno}`}
                to={`/obras/${o.id}/lancar?mes=${o.meses - 1}`}
                style={{ textDecoration: "none" }}
              >
                Refazer um mês
              </Link>
            )}
            {o.meses > 0 && (
              <Botao pequeno disabled={definir.isPending} onClick={concluir}>
                Concluir obra
              </Botao>
            )}
            {o.meses < 120 && (
              <Link
                className={`${u.botao} ${u.pequeno} ${u.primario}`}
                to={`/obras/${o.id}/lancar`}
                style={{ textDecoration: "none" }}
              >
                Lançar {nomeMes(d, o.meses)} →
              </Link>
            )}
          </span>
        )}
      </div>
    </Cartao>
  );
}

/** Obra concluída: reabrir para lançar ou refazer meses (volta a ficar fora das referências). */
export function BotaoReabrir({ d }: { d: DetalheObra }) {
  const definir = useDefinirSituacao();
  const avisar = useToast();
  return (
    <Botao
      pequeno
      variante="fantasma"
      disabled={definir.isPending}
      onClick={async () => {
        if (
          !window.confirm(
            `Reabrir “${d.obra.nome}”? A obra volta a receber meses e sai das referências de projeção até ser concluída de novo.`,
          )
        )
          return;
        try {
          await definir.mutateAsync({ id: d.obra.id, situacao: "andamento" });
          avisar("Obra reaberta");
        } catch (e) {
          avisar(mensagemErroCarga(e));
        }
      }}
    >
      Reabrir obra
    </Botao>
  );
}
