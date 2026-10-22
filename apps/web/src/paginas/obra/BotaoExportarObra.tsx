import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBeneficios, useRubricas } from "../../dados/cadastros";
import { consultaLancamentos } from "../../dados/obras";
import { baixarXlsx, nomeArquivo } from "../../lib/planilha";
import type { Tabela } from "../../lib/planilha";
import { Botao } from "../../ui/componentes";
import { useToast } from "../../ui/toast";
import { apropriacaoPorConta } from "./calculos";
import type { DadosAba } from "./comum";
import { ORDEM_GRUPOS, rotulosDe } from "./comum";
import {
  contasComValor,
  rubricasPorMes,
  tabelaApropriacao,
  tabelaCustoComponente,
  tabelaCustoFuncao,
  tabelaEfetivo,
  tabelaRubricas,
  tituloObra,
  tituloVisao,
} from "./exportar";

/**
 * Exportar a obra para .xlsx (M8): efetivo, cabeças, custo por função e por componente (na
 * visão da tela), apropriação e, para quem carrega, as rubricas agregadas (sem matrícula).
 */
export function BotaoExportarObra({ dados }: { dados: DadosAba }) {
  const qc = useQueryClient();
  const avisar = useToast();
  const ben = useBeneficios();
  const rub = useRubricas();
  const [gerando, setGerando] = useState(false);

  async function exportar() {
    setGerando(true);
    try {
      const { d, obra, r, epoca, fun, V, vista, pode } = dados;
      const rotulos = rotulosDe(obra, "data");
      const ids = [...r.funcoes].sort(
        (a, b) =>
          ORDEM_GRUPOS.indexOf(fun(a).grupo) - ORDEM_GRUPOS.indexOf(fun(b).grupo) ||
          fun(a).nome.localeCompare(fun(b).nome, "pt-BR"),
      );
      const t = tituloObra(dados);
      const tv = [...t, tituloVisao(dados)];
      const tabelas: Tabela[] = [
        tabelaEfetivo(obra, ids, fun, rotulos, t),
        tabelaEfetivo(obra, ids, fun, rotulos, t, true),
        tabelaCustoFuncao(r, ids, fun, rotulos, V, tv),
        tabelaCustoComponente(r, ids, rotulos, V, vista.caixa, tv),
        tabelaApropriacao(
          contasComValor(apropriacaoPorConta(epoca, fun, ben.data ?? [])),
          rotulos,
          t,
        ),
      ];
      if (pode) {
        const l = await qc.fetchQuery(consultaLancamentos(d.obra.id));
        const cad = new Map((rub.data ?? []).map((x) => [x.codigo, x]));
        tabelas.push(
          tabelaRubricas(
            rubricasPorMes(l.lancamentos, l.rubricas, rotulos.length),
            cad,
            rotulos,
            t,
          ),
        );
      }
      await baixarXlsx(nomeArquivo(["ITO", d.obra.nome]), tabelas);
    } catch {
      avisar("Não foi possível gerar o arquivo. Atualize a página e tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Botao
      pequeno
      disabled={gerando || ben.isLoading || rub.isLoading}
      title={dados.pode ? undefined : "As rubricas ficam de fora: são restritas a quem carrega"}
      onClick={exportar}
    >
      {gerando ? "Gerando…" : "Exportar .xlsx"}
    </Botao>
  );
}
