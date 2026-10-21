import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { dataHora } from "@ito/formato";
import type { ContextoCarga, RascunhoCarga } from "../../dados/carga";
import { salvarRascunho, useGravarCarga } from "../../dados/carga";
import { mensagemErroBanco } from "../../dados/erros";
import { Botao } from "../../ui/componentes";
import { useToast } from "../../ui/toast";
import s from "./carga.module.css";
import { EtapaArquivos } from "./EtapaArquivos";
import { EtapaFuncoes } from "./EtapaFuncoes";
import { EtapaObra } from "./EtapaObra";
import { EtapaRubricas } from "./EtapaRubricas";
import { EtapaVerificacao } from "./EtapaVerificacao";
import { ETAPAS, faltasDaObra, preparar } from "./estado";

export type Mudar = (f: (r: RascunhoCarga) => RascunhoCarga) => void;

export interface PropsEtapa {
  r: RascunhoCarga;
  mudar: Mudar;
  ctx: ContextoCarga;
}

const ESPERA_MS = 1200;

export function Assistente({
  ctx,
  inicial,
  onNova,
}: {
  ctx: ContextoCarga;
  inicial: { id: string | null; etapa: number; conteudo: RascunhoCarga };
  onNova: () => void;
}) {
  const [r, setR] = useState(inicial.conteudo);
  const [etapa, setEtapa] = useState(inicial.etapa);
  const [sujo, setSujo] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const id = useRef(inicial.id);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const qc = useQueryClient();
  const avisar = useToast();
  const navegar = useNavigate();
  const gravar = useGravarCarga();

  const mudar: Mudar = (f) => {
    setR(f);
    setSujo(true);
  };
  const irPara = (n: number) => {
    setEtapa(n);
    setSujo(true);
  };

  // rascunho salvo sozinho, um de cada vez (o primeiro cria a linha)
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => {
      setSujo(false);
      fila.current = fila.current
        .then(() => salvarRascunho(id.current, r.dados.nome.trim(), etapa, r))
        .then((novo) => {
          id.current = novo;
          setSalvoEm(new Date().toISOString());
          return qc.invalidateQueries({ queryKey: ["carga", "rascunhos"] });
        })
        .catch(() => avisar("Não foi possível salvar o rascunho. Verifique a conexão."));
    }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [sujo, r, etapa, qc, avisar]);

  const prep = useMemo(() => preparar(r, ctx), [r, ctx]);
  const faltas = faltasDaObra(r.dados, ctx.obras);
  const temFolha = !!r.leituras;
  const liberada = (n: number) => n <= 2 || (temFolha && r.dados.meses > 0);
  const podeSeguir =
    etapa === 1 ? faltas.length === 0 : etapa === 2 ? temFolha && r.dados.meses > 0 : true;
  const existe = ctx.obras.some((o) => o.id === r.dados.id);
  const bloqueia = !prep || prep.verificacao.bloqueia || (existe && !substituir);

  async function salvarNaBase() {
    if (!prep) return;
    try {
      const obra = await gravar.mutateAsync({
        payload: { ...prep.verificacao.payload, substituir },
        rascunho: id.current,
      });
      avisar("Obra gravada na base histórica");
      navegar(`/obras/${obra}`);
    } catch (e) {
      avisar(mensagemErroBanco(e));
    }
  }

  const props: PropsEtapa = { r, mudar, ctx };

  return (
    <>
      <ol className={s.etapas} aria-label="Etapas da carga">
        {ETAPAS.map((x, i) => {
          const n = i + 1;
          return (
            <li key={x.nome}>
              <button
                type="button"
                className={s.etapa}
                aria-current={etapa === n ? "step" : undefined}
                disabled={!liberada(n)}
                onClick={() => irPara(n)}
              >
                <span className={`${s.ponto} ${etapa === n ? s.agora : n < etapa ? s.feita : ""}`}>
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

      {etapa === 1 && <EtapaObra {...props} faltas={faltas} />}
      {etapa === 2 && <EtapaArquivos {...props} />}
      {etapa === 3 && (
        <EtapaFuncoes {...props} pendentes={prep?.montagem.pendencias.funcoes ?? []} />
      )}
      {etapa === 4 && <EtapaRubricas {...props} />}
      {etapa === 5 && (
        <EtapaVerificacao
          {...props}
          prep={prep}
          existe={existe}
          substituir={substituir}
          onSubstituir={setSubstituir}
        />
      )}

      <div className={s.rodape}>
        <span className={s.linhaBotoes}>
          <Botao disabled={etapa === 1} onClick={() => irPara(etapa - 1)}>
            ← Voltar
          </Botao>
          <Botao variante="fantasma" onClick={onNova}>
            Nova carga
          </Botao>
        </span>
        <span className={s.salvoEm} aria-live="polite">
          {salvoEm ? `Rascunho salvo ${dataHora(salvoEm)}` : ""}
        </span>
        {etapa < 5 ? (
          <Botao variante="escuro" disabled={!podeSeguir} onClick={() => irPara(etapa + 1)}>
            Continuar →
          </Botao>
        ) : (
          <Botao variante="primario" disabled={bloqueia || gravar.isPending} onClick={salvarNaBase}>
            {gravar.isPending ? "Gravando…" : "Salvar na base histórica →"}
          </Botao>
        )}
      </div>
    </>
  );
}
