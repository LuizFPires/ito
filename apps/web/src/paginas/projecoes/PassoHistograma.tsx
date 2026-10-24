import { useState } from "react";
import { numero, percentual } from "@ito/formato";
import type { ContextoCarga } from "../../dados/carga";
import type { Calculo, Entradas } from "../../lib/projecaoDoBanco";
import { BarrasMensais, Legenda } from "../../ui/BarrasMensais";
import { Badge, Botao, Cartao, Segmento } from "../../ui/componentes";
import { Selecao } from "../../ui/formulario";
import f from "../../ui/formulario.module.css";
import { soma } from "../obra/comum";
import o from "../obra/obra.module.css";
import { useInfoFuncoes } from "./funcoes";
import { manualValido, rotulosMeses } from "./projecoes";
import s from "./projecoes.module.css";

/**
 * Passo 3 do assistente (decisão do usuário, 24/10/2026): o histograma previsto, sempre à vista,
 * e as quantidades por função numa tabela só. A tabela parte das referências; cada função tem a
 * régua "Mais ou menos" (−100% a +100%, sobre a linha inteira) e cada mês pode ser digitado.
 * Digitar um mês fixa a linha como está na tela e zera a régua dela. Pessoas sempre inteiras.
 */
export function PassoHistograma({
  e,
  up,
  calc,
  contexto,
}: {
  e: Entradas;
  up: (p: Partial<Entradas>) => void;
  calc: Calculo;
  contexto: ContextoCarga;
}) {
  const { fun, ordenarFuncoes } = useInfoFuncoes(contexto.ctx);
  const r = calc.r;
  const meses = rotulosMeses(e.inicio, e.prazo);
  const manual = manualValido(e.quantidadesManuais, e.prazo) ? e.quantidadesManuais : null;
  const temRefs = e.referencias.length > 0;
  const [agrupadas, setAgrupadas] = useState(true);
  // funções incluídas pelo usuário (fora da sugestão das referências), ainda zeradas
  const [incluidas, setIncluidas] = useState<string[]>([]);

  const todas = contexto.funcoes.map((x) => x.id);
  const zeros = () => Array<number>(e.prazo).fill(0);
  // o que está na tela = o que o motor projeta (referências ou informado, com a régua)
  const linha = (k: string): number[] =>
    r?.obra.equivalente[k] ? [...r.obra.equivalente[k]] : manual?.[k] ? [...manual[k]] : zeros();
  const comValor = todas.filter((k) => soma(linha(k)) > 0);
  // nada lançado ainda (sem referências): todas as funções, para começar a digitar
  const visiveis = ordenarFuncoes(
    comValor.length || incluidas.length ? [...new Set([...comValor, ...incluidas])] : todas,
  );
  const foraDaLista = ordenarFuncoes(todas.filter((k) => !visiveis.includes(k)));

  const definirCelula = (k: string, j: number, v: number) => {
    // a primeira digitação fixa todas as linhas como estão na tela (já com as réguas)
    const base: Record<string, number[]> = manual
      ? Object.fromEntries(todas.map((x) => [x, manual[x] ? [...manual[x]] : zeros()]))
      : Object.fromEntries(todas.map((x) => [x, linha(x)]));
    base[k] = linha(k);
    base[k][j] = v;
    up({ quantidadesManuais: base, ajustes: manual ? { ...e.ajustes, [k]: 0 } : {} });
  };
  const regua = (k: string, v: number) => up({ ajustes: { ...e.ajustes, [k]: v } });

  const ids = ordenarFuncoes(r ? r.resultado.funcoes : []);
  const series = ids.map((k) => ({
    id: k,
    nome: fun(k).nome,
    cor: fun(k).cor,
    valores: r?.obra.equivalente[k] ?? [],
  }));
  const totais = meses.map((_, j) => soma(visiveis.map((k) => linha(k)[j] ?? 0)));

  return (
    <>
      {/* o gráfico fica à vista enquanto a tabela rola (pedido do usuário) */}
      <div className={s.fixo}>
        <Cartao aria-label="Histograma previsto">
          <div className={s.cabecaCartao}>
            <span>
              <span className="rotulo">Histograma previsto</span>
              <div className="sub">
                Pessoas por mês e por função. Muda a cada número digitado ou régua movida abaixo.
              </div>
            </span>
            <Segmento
              rotulo="Barras"
              opcoes={[
                { valor: "agr", texto: "Lado a lado" },
                { valor: "emp", texto: "Empilhadas" },
              ]}
              valor={agrupadas ? "agr" : "emp"}
              onChange={(v) => setAgrupadas(v === "agr")}
            />
          </div>
          <div className={s.corpoCartao} style={{ gap: 12, paddingBlock: 14 }}>
            {r ? (
              <>
                <BarrasMensais
                  rotulos={meses}
                  series={series}
                  agrupadas={agrupadas}
                  altura={130}
                  formatar={(v) => numero(v)}
                  titulo="Histograma previsto"
                />
                <Legenda series={series} ordem="natural" />
              </>
            ) : (
              <p className="sub" style={{ margin: 0 }}>
                Escolha obras de referência ou lance as quantidades abaixo para ver o histograma.
              </p>
            )}
          </div>
        </Cartao>
      </div>

      <Cartao aria-label="Quantidades por função">
        <div className={s.cabecaCartao}>
          <span>
            <span className="rotulo">Quantidades por função</span>
            <div className="sub">
              {temRefs
                ? "A tabela já vem preenchida com as quantidades das obras de referência. "
                : ""}
              Calibre de dois jeitos, na mesma tela: a régua <strong>Mais ou menos</strong> aumenta
              ou reduz a função inteira de uma vez (pedreiro +20% sobe todos os meses do pedreiro),
              e cada mês pode ser digitado à mão. Ao digitar um mês, a linha fica como está e a
              régua dela volta a 0%. Pessoas sempre inteiras: até ,2 arredonda para baixo; de ,3 em
              diante, para cima.
            </div>
          </span>
          <Botao
            pequeno
            disabled={!temRefs || (!manual && !Object.values(e.ajustes).some(Boolean))}
            onClick={() => up({ quantidadesManuais: null, ajustes: {} })}
          >
            Voltar às referências
          </Botao>
        </div>

        <div className={`${o.mensal} ${s.rola}`}>
          <table className={f.tabela} aria-label="Pessoas por função e mês">
            <thead>
              <tr>
                <th>Função</th>
                <th>Mais ou menos</th>
                {meses.map((m) => (
                  <th key={m} className={f.r}>
                    {m}
                  </th>
                ))}
                <th className={f.r}>Pessoa-mês</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((k) => {
                const aj = e.ajustes[k] ?? 0;
                const pm = manual ? null : (r?.pmPorMilM2[k] ?? null);
                return (
                  <tr key={k}>
                    <td className={f.forte} style={{ whiteSpace: "nowrap" }}>
                      <span className={o.amostra} style={{ background: fun(k).cor }} />
                      {fun(k).nome}
                      {pm != null && (
                        <div className="sub" style={{ fontWeight: 400 }}>
                          {numero(pm / (1 + aj / 100), 1)} PM / 1.000 m² nas referências
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={f.linha} style={{ flexWrap: "nowrap", gap: 8 }}>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={5}
                          value={aj}
                          style={{ width: 92, accentColor: "var(--active-bg)" }}
                          aria-label={`Mais ou menos ${fun(k).nome}`}
                          onChange={(ev) => regua(k, Number(ev.target.value))}
                        />
                        <Badge tom={aj ? "ambar" : "neutro"}>
                          {aj > 0 ? "+" : ""}
                          {percentual(aj, 0)}
                        </Badge>
                      </span>
                    </td>
                    {linha(k).map((v, j) => (
                      <td key={j} className={s.celula}>
                        <input
                          className={`${f.input} ${f.num} ${f.compacto}`}
                          style={{ width: 56 }}
                          inputMode="numeric"
                          aria-label={`${fun(k).nome} em ${meses[j]}`}
                          value={String(v)}
                          onChange={(ev) =>
                            definirCelula(k, j, Number(ev.target.value.replace(/\D/g, "") || 0))
                          }
                        />
                      </td>
                    ))}
                    <td className={f.r}>
                      <strong>{numero(soma(linha(k)))}</strong>
                    </td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>Total do mês</td>
                <td />
                {totais.map((t, j) => (
                  <td key={j} className={f.r}>
                    {numero(t)}
                  </td>
                ))}
                <td className={f.r}>{numero(soma(totais))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={s.corpoCartao} style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {foraDaLista.length > 0 && (
            <Selecao
              aria-label="Incluir função"
              style={{ width: "auto" }}
              value=""
              onChange={(ev) => ev.target.value && setIncluidas((x) => [...x, ev.target.value])}
            >
              <option value="">+ Incluir função…</option>
              {foraDaLista.map((k) => (
                <option key={k} value={k}>
                  {fun(k).nome}
                </option>
              ))}
            </Selecao>
          )}
          <Botao
            pequeno
            variante="fantasma"
            onClick={() =>
              up({
                quantidadesManuais: Object.fromEntries(todas.map((k) => [k, zeros()])),
                ajustes: {},
              })
            }
          >
            Zerar tudo
          </Botao>
        </div>
      </Cartao>
    </>
  );
}
