import { useRouteError } from "react-router";
import { Botao } from "./componentes";
import { ehVersaoVelha, recarregarUmaVez } from "./versao";

/** Erro de rota: versão velha recarrega sozinha; o resto mostra o que fazer. */
export function ErroRota() {
  const erro = useRouteError();
  if (ehVersaoVelha(erro) && recarregarUmaVez()) return null;
  return (
    <main style={{ padding: 32, maxWidth: 560 }} role="alert">
      <h1 style={{ marginTop: 0 }}>Algo deu errado nesta tela</h1>
      <p className="sub">
        {ehVersaoVelha(erro)
          ? "O ITO foi atualizado. Recarregue a página para usar a versão nova."
          : "Recarregue a página. Se o erro continuar, avise o administrador do ITO."}
      </p>
      <Botao variante="primario" onClick={() => window.location.reload()}>
        Recarregar a página
      </Botao>
    </main>
  );
}
