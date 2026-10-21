import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { dataHora } from "@ito/formato";
import type { ContextoCarga, RascunhoCarga } from "../../dados/carga";
import { RascunhoApagado, salvarRascunho, useGravarCarga } from "../../dados/carga";
import { mensagemErroCarga } from "../../dados/erros";
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
  // a confirmação de substituir vale para o código confirmado, não para outro escolhido depois
  const [substituirId, setSubstituirId] = useState<string | null>(null);
  const id = useRef(inicial.id);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  // leituras já enviadas (a folha inteira só sobe quando um arquivo muda)
  const enviadas = useRef(inicial.id ? inicial.conteudo.leituras : undefined);
  // sem autossalvamento depois de gravar na base ou se o rascunho foi apagado
  const parado = useRef(false);
  const ultimo = useRef({ r, etapa, sujo });
  const qc = useQueryClient();
  const avisar = useToast();
  const navegar = useNavigate();
  const gravar = useGravarCarga();

  const mudar: Mudar = (fn) => {
    setR(fn);
    setSujo(true);
  };
  const irPara = (n: number) => {
    setEtapa(n);
    setSujo(true);
  };

  const salvar = useCallback(
    (x: RascunhoCarga, et: number) => {
      if (parado.current) return;
      const comLeituras = x.leituras !== enviadas.current;
      fila.current = fila.current
        .then(() =>
          parado.current
            ? id.current
            : salvarRascunho(id.current, x.dados.nome.trim(), et, x, comLeituras),
        )
        .then((novo) => {
          if (parado.current) return;
          id.current = novo;
          if (comLeituras) enviadas.current = x.leituras;
          setSalvoEm(new Date().toISOString());
          return qc.invalidateQueries({ queryKey: ["carga", "rascunhos"] });
        })
        .catch((e) => {
          if (e instanceof RascunhoApagado) {
            parado.current = true;
            avisar("Este rascunho foi apagado. A carga continua só nesta tela até ser gravada.");
          } else avisar("Não foi possível salvar o rascunho. Verifique a conexão.");
        });
    },
    [qc, avisar],
  );

  // rascunho salvo sozinho, um de cada vez (o primeiro cria a linha)
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => {
      setSujo(false);
      salvar(r, etapa);
    }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [sujo, r, etapa, salvar]);

  useEffect(() => {
    ultimo.current = { r, etapa, sujo };
  });
  // ao sair (nova carga, outro rascunho), a última mudança não se perde
  useEffect(
    () => () => {
      if (ultimo.current.sujo) salvar(ultimo.current.r, ultimo.current.etapa);
    },
    [salvar],
  );

  // montagem e verificações só onde são usadas (a folha pode ter 100 mil linhas)
  const prep = useMemo(() => (etapa >= 3 ? preparar(r, ctx) : null), [r, ctx, etapa]);
  const faltas = faltasDaObra(r.dados, ctx.obras);
  // a etapa Arquivos aceita a obra sem datas: a folha preenche o período
  const faltasSemPeriodo = faltasDaObra(r.dados, ctx.obras, false);
  const temFolha = !!r.arquivos.folha && !!r.leituras;
  const liberada = (n: number) =>
    n === 1 || (n === 2 ? faltasSemPeriodo.length === 0 : faltas.length === 0 && temFolha);
  const podeSeguir =
    etapa === 1
      ? faltasSemPeriodo.length === 0
      : etapa === 2
        ? temFolha && faltas.length === 0
        : true;
  const existe = ctx.obras.some((o) => o.id === r.dados.id);
  const substituir = existe && substituirId === r.dados.id;
  const bloqueia =
    faltas.length > 0 || !prep || prep.verificacao.bloqueia || (existe && !substituir);

  async function salvarNaBase() {
    if (!prep) return;
    parado.current = true;
    try {
      // espera o autossalvamento em andamento para não recriar o rascunho depois de gravar
      await fila.current;
      const obra = await gravar.mutateAsync({
        payload: { ...prep.verificacao.payload, substituir },
        rascunho: id.current,
      });
      avisar("Obra gravada na base histórica");
      navegar(`/obras/${obra}`);
    } catch (e) {
      parado.current = false;
      avisar(mensagemErroCarga(e));
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

      {etapa === 1 && <EtapaObra {...props} faltas={faltasSemPeriodo} />}
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
          onSubstituir={(v) => setSubstituirId(v ? r.dados.id : null)}
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
