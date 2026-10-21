import { useState } from "react";
import { numero, percentual } from "@ito/formato";
import { useSessao } from "../../auth/sessao";
import { useCcts, useCidades } from "../../dados/cidades";
import { useParametros } from "../../dados/cadastros";
import { dataBaseNosProximos3Meses, diferencaOficial } from "../../lib/ccts";
import { podeEditarConfig } from "../../lib/permissoes";
import { MENU } from "../../shell/rotas";
import { Cartao, Segmento } from "../../ui/componentes";
import { Kpi } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { Pagina } from "../Pagina";
import { AbaCidades } from "./AbaCidades";
import { AbaConvencoes } from "./AbaConvencoes";

type Aba = "cct" | "cid";

export function TelaCidades() {
  const d = MENU.find((x) => x.caminho === "/cidades")!;
  const { usuario } = useSessao();
  const pode = podeEditarConfig(usuario);
  const { data: ccts } = useCcts();
  const { data: cidades } = useCidades();
  const { data: params } = useParametros();
  const [aba, setAba] = useState<Aba>("cct");

  const lista = ccts ?? [];
  const mesAtual = new Date().getMonth() + 1;

  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
      <div className={f.kpis}>
        <Kpi
          rotulo="Convenções cadastradas"
          valor={numero(lista.length)}
          sub={`${numero(cidades?.length ?? 0)} cidades vinculadas`}
        />
        <Kpi
          rotulo="Diferença de salário · pedreiro"
          valor={percentual(diferencaOficial(lista.map((c) => c.salarioOficial)) * 100, 0)}
          sub="entre a CCT mais barata e a mais cara"
        />
        <Kpi
          rotulo="Data-base nos próximos 3 meses"
          valor={`${numero(
            dataBaseNosProximos3Meses(
              lista.map((c) => c.mes_data_base),
              mesAtual,
            ),
          )} CCTs`}
          sub="revisar salários e reajuste estimado"
        />
        <Kpi
          rotulo="Tabela da empresa"
          valor={params?.data_base_vigente ? `CCT ${params.data_base_vigente}` : "—"}
          sub="encargos, HE e legislação valem para todas"
          destaque
        />
      </div>

      <Segmento
        rotulo="Seção"
        opcoes={[
          { valor: "cct", texto: `Convenções (${numero(lista.length)})` },
          { valor: "cid", texto: `Cidades (${numero(cidades?.length ?? 0)})` },
        ]}
        valor={aba}
        onChange={setAba}
      />

      {aba === "cct" ? <AbaConvencoes pode={pode} /> : <AbaCidades pode={pode} />}

      <Cartao className={f.painel} style={{ position: "static" }}>
        <span className="rotulo">Como entra na projeção</span>
        <p className="sub" style={{ margin: 0, maxWidth: "82ch" }}>
          Do histórico vêm as quantidades: pessoa-mês por função, horas extras, faltas e
          rotatividade. Da cidade da obra vêm os preços: salários, gratificações e benefícios da
          CCT, VT de acordo com a origem de cada função, ISS e feriados. Se a data-base da CCT cair
          durante a obra, os meses seguintes saem com o reajuste estimado. Encargos, adicionais
          legais e regras de HE continuam na tabela da empresa, em Parâmetros.
        </p>
      </Cartao>
    </Pagina>
  );
}
