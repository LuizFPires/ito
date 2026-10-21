import { useParams } from "react-router";
import { MENU } from "../shell/rotas";
import { Pagina } from "./Pagina";

/** Telas vazias do M0, uma por item do menu. */
export function TelaDoMenu({ caminho }: { caminho: string }) {
  const d = MENU.find((x) => x.caminho === caminho)!;
  return <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone} />;
}

export function TelaObra() {
  const { id } = useParams();
  return (
    <Pagina
      grupo="Base histórica · Obra"
      titulo="Obra"
      resumo={`Detalhe da obra ${id ?? ""} em 10 abas: visão, efetivo, custos, horas extras, folha, pessoas, apropriação, indicadores, MDO realocada e premissas.`}
      milestone="M5"
    />
  );
}
