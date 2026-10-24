import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { mesParaGravar } from "@ito/carga";
import { mesAno, numero } from "@ito/formato";
import { anoMes } from "@ito/motor";
import { useSessao } from "../../auth/sessao";
import type { ContextoCarga, RascunhoCarga } from "../../dados/carga";
import { useContextoCarga } from "../../dados/carga";
import { mensagemErroCarga } from "../../dados/erros";
import type { DetalheObra } from "../../dados/obras";
import { useLancarMes, useObra } from "../../dados/obras";
import { inicioDe } from "../../lib/obraDoBanco";
import { podeCarregar } from "../../lib/permissoes";
import { Botao, Cartao, CartaoCorpo } from "../../ui/componentes";
import { Campo, Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { useToast } from "../../ui/toast";
import type { Mudar, PropsEtapa } from "../carga/Assistente";
import c from "../carga/carga.module.css";
import { EtapaArquivos } from "../carga/EtapaArquivos";
import { EtapaFuncoes } from "../carga/EtapaFuncoes";
import { EtapaRubricas } from "../carga/EtapaRubricas";
import { EtapaVerificacao } from "../carga/EtapaVerificacao";
import { Pagina } from "../Pagina";
import { prepararMes, rascunhoDoMes } from "./mesDaObra";
import s from "./obra.module.css";

const ETAPAS = [
  { nome: "Arquivos", sub: "folha, ponto, VT, NF, ERP do mês" },
  { nome: "Funções", sub: "folha → função padrão" },
  { nome: "Rubricas", sub: "como cada verba entra" },
  { nome: "Verificação", sub: "conferir e lançar" },
] as const;

/** Lançar (ou refazer) um mês da obra em andamento: `/obras/:id/lancar?mes=N`. */
export function TelaLancarMes() {
  const { id } = useParams();
  const [busca, setBusca] = useSearchParams();
  const { usuario } = useSessao();
  const obraQ = useObra(id);
  const contexto = useContextoCarga();
  const d = obraQ.data;
  const ctx = contexto.data;

  const pagina = (titulo: string, corpo: ReactNode) => (
    <Pagina
      grupo={
        <>
          <Link to="/base" className={s.migalha}>
            Base histórica
          </Link>{" "}
          ·{" "}
          <Link to={`/obras/${id}`} className={s.migalha}>
            {d?.obra.nome ?? "Obra"}
          </Link>
        </>
      }
      titulo={titulo}
      resumo={
        d
          ? "A folha de uma competência, com as mesmas leituras e conferências da carga. Os outros meses e as premissas da obra ficam; rotatividade e mix de HE são recalculados com todos os meses lançados."
          : ""
      }
      milestone="M11"
    >
      {corpo}
    </Pagina>
  );
  const aviso = (texto: ReactNode, alerta = false) => (
    <Cartao>
      <p className="sub" style={{ padding: 22, margin: 0 }} role={alerta ? "alert" : undefined}>
        {texto}
      </p>
    </Cartao>
  );

  if (obraQ.isError || contexto.isError)
    return pagina(
      "Lançar mês",
      aviso("Não foi possível carregar a obra. Atualize a página.", true),
    );
  if (obraQ.data === null) return pagina("Lançar mês", aviso("Esta obra não está na base."));
  if (!d || !ctx) return pagina("Lançar mês", aviso("Carregando…"));
  if (!podeCarregar(usuario))
    return pagina(
      "Lançar mês",
      aviso("Só DP/RH, controladoria ou um administrador lança meses da obra.", true),
    );
  if (d.obra.situacao !== "andamento")
    return pagina(
      "Lançar mês",
      aviso(
        <>
          Esta obra está concluída. Reabra a obra no detalhe para lançar ou refazer um mês.{" "}
          <Link className={f.linkAcao} to={`/obras/${d.obra.id}`}>
            Voltar à obra
          </Link>
        </>,
      ),
    );

  const lido = Number(busca.get("mes") ?? NaN);
  const mes =
    Number.isInteger(lido) && lido >= 0 && lido <= Math.min(d.obra.meses, 119)
      ? lido
      : Math.min(d.obra.meses, 119);
  const nome = nomeDoMes(d, mes);
  return pagina(
    mes < d.obra.meses ? `Refazer ${nome}` : `Lançar ${nome}`,
    <LancarMes
      key={mes}
      d={d}
      ctx={ctx}
      mes={mes}
      onMes={(m) => setBusca({ mes: String(m) }, { replace: true })}
    />,
  );
}

const nomeDoMes = (d: DetalheObra, i: number) => {
  const m = anoMes(inicioDe(d.obra.inicio), i);
  return mesAno(m.ano, m.mes);
};

function LancarMes({
  d,
  ctx,
  mes,
  onMes,
}: {
  d: DetalheObra;
  ctx: ContextoCarga;
  mes: number;
  onMes: (m: number) => void;
}) {
  const [r, setR] = useState<RascunhoCarga>(() => rascunhoDoMes(d, mes));
  const [etapa, setEtapa] = useState(1);
  const avisar = useToast();
  const navegar = useNavigate();
  const lancar = useLancarMes();
  const mudar: Mudar = (fn) => setR(fn);
  const refazer = mes < d.obra.meses;
  const nome = nomeDoMes(d, mes);

  // montagem e verificações só a partir da etapa Funções (a folha pode ter muitas linhas)
  const prep = useMemo(
    () => (etapa >= 2 ? prepararMes(r, d, mes, ctx) : null),
    [r, d, mes, ctx, etapa],
  );
  const bloqueia = !prep || prep.verificacao.bloqueia;
  const props: PropsEtapa = { r, mudar, ctx };

  async function gravar() {
    if (!prep || bloqueia) return;
    try {
      const { ano, mes: m } = r.dados.inicio;
      await lancar.mutateAsync(
        mesParaGravar(
          d.obra.id,
          mes,
          prep.verificacao.payload,
          refazer,
          `${ano}-${String(m).padStart(2, "0")}`,
        ),
      );
      avisar(`${nome} ${refazer ? "refeito" : "lançado"} na obra`);
      navegar(`/obras/${d.obra.id}`);
    } catch (e) {
      avisar(mensagemErroCarga(e));
    }
  }

  return (
    <>
      <Cartao aria-label="Mês do lançamento">
        <CartaoCorpo>
          <div className={f.linha} style={{ justifyContent: "space-between" }}>
            <Campo rotulo="Competência">
              <Selecao value={mes} onChange={(e) => onMes(Number(e.target.value))}>
                {Array.from({ length: Math.min(d.obra.meses + 1, 120) }, (_, i) => (
                  <option key={i} value={i}>
                    {nomeDoMes(d, i)} ·{" "}
                    {i === d.obra.meses ? "próximo mês" : `refazer o ${numero(i + 1)}º mês`}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <span className="sub" style={{ maxWidth: 520 }}>
              {refazer
                ? `${nome} já foi lançado: a folha nova substitui o mês inteiro (lançamentos, ausências, ERP e notas desse mês). Os outros meses e as premissas ficam.`
                : `${nome} entra como ${numero(mes + 1)}º mês da obra. Envie a folha só dessa competência.`}
            </span>
          </div>
        </CartaoCorpo>
      </Cartao>

      <ol className={c.etapas} aria-label="Etapas do lançamento">
        {ETAPAS.map((x, i) => {
          const n = i + 1;
          return (
            <li key={x.nome}>
              <button
                type="button"
                className={c.etapa}
                aria-current={etapa === n ? "step" : undefined}
                onClick={() => setEtapa(n)}
              >
                <span className={`${c.ponto} ${etapa === n ? c.agora : n < etapa ? c.feita : ""}`}>
                  {String(n).padStart(2, "0")}
                </span>
                <span>
                  {x.nome}
                  <small>{x.sub}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {etapa === 1 && <EtapaArquivos {...props} />}
      {etapa === 2 && (
        <EtapaFuncoes {...props} pendentes={prep?.montagem.pendencias.funcoes ?? []} />
      )}
      {etapa === 3 && <EtapaRubricas {...props} />}
      {etapa === 4 && (
        <EtapaVerificacao
          {...props}
          prep={prep}
          existe={false}
          substituir={false}
          onSubstituir={() => {}}
          mes={{ idx: mes, refazer }}
        />
      )}

      <div className={c.rodape}>
        <span className={c.linhaBotoes}>
          <Botao disabled={etapa === 1} onClick={() => setEtapa(etapa - 1)}>
            ← Voltar
          </Botao>
          <Link
            className={`${f.linkAcao}`}
            to={`/obras/${d.obra.id}`}
            style={{ alignSelf: "center" }}
          >
            Cancelar
          </Link>
        </span>
        <span />
        {etapa < 4 ? (
          <Botao variante="escuro" onClick={() => setEtapa(etapa + 1)}>
            Continuar →
          </Botao>
        ) : (
          <Botao variante="primario" disabled={bloqueia || lancar.isPending} onClick={gravar}>
            {lancar.isPending ? "Gravando…" : `${refazer ? "Refazer" : "Lançar"} ${nome} →`}
          </Botao>
        )}
      </div>
    </>
  );
}
