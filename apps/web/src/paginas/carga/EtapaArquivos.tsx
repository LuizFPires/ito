import { useId, useRef, useState } from "react";
import type { ErroLeitura, Leituras, TipoArquivo } from "@ito/carga";
import { numero } from "@ito/formato";
import { baixarModelo } from "../../lib/arquivos";
import { LeituraInterrompida, lerNoWorker } from "../../lib/lerNoWorker";
import { foraDoLimite } from "../../lib/limitesArquivos";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { useToast } from "../../ui/toast";
import type { PropsEtapa } from "./Assistente";
import s from "./carga.module.css";
import { periodoComFolha } from "./estado";

interface Slot {
  tipo: TipoArquivo;
  titulo: string;
  formato: string;
  aceita: string;
  modelo: boolean;
}

const SLOTS: readonly Slot[] = [
  {
    tipo: "folha",
    titulo: "Folha de pagamento com rubricas",
    formato: ".xlsx (abas Rubricas, Pessoas e Resumo) ou .csv só com as rubricas",
    aceita: ".xlsx,.csv",
    modelo: true,
  },
  {
    tipo: "ponto",
    titulo: "Cartão de ponto (HE e faltas)",
    formato: ".xlsx ou .csv do relógio de ponto",
    aceita: ".xlsx,.csv",
    modelo: true,
  },
  {
    tipo: "vt",
    titulo: "Vale-transporte",
    formato: ".xlsx ou .csv do fornecedor de VT",
    aceita: ".xlsx,.csv",
    modelo: true,
  },
  {
    tipo: "nf",
    titulo: "Notas fiscais de prestadores (S/P)",
    formato: "XML da NFS-e (padrão nacional ou ABRASF); vários arquivos de uma vez",
    aceita: ".xml",
    modelo: false,
  },
  {
    tipo: "erp",
    titulo: "Realizado no ERP (processo de compras + VR)",
    formato: ".xlsx ou .csv exportado do ERP, por conta",
    aceita: ".xlsx,.csv",
    modelo: true,
  },
];

const textoErros = (e: readonly ErroLeitura[]) =>
  e.map((x) => (x.linha ? `${x.aba}, linha ${x.linha}: ${x.mensagem}` : x.mensagem));
const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
const FOLHA_VAZIA = { rubricas: [], pessoas: [], resumo: [], erros: [] };

export function EtapaArquivos({ r, mudar }: PropsEtapa) {
  const avisar = useToast();
  const [lendo, setLendo] = useState<TipoArquivo | null>(null);
  const cancelar = useRef<AbortController | null>(null);

  async function ler(tipo: TipoArquivo, arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const limite = foraDoLimite(tipo, [...arquivos]);
    if (limite) {
      avisar(limite);
      return;
    }
    setLendo(tipo);
    const controle = new AbortController();
    cancelar.current = controle;
    try {
      const nomes = [...arquivos].map((a) => a.name).join(", ");
      // M14 · S07: lido num Web Worker (a tela não trava; Cancelar encerra na hora)
      const { parcial, resumo, erros } = await lerNoWorker(tipo, [...arquivos], controle.signal);
      mudar((x) => {
        const leituras: Leituras = { folha: FOLHA_VAZIA, ...x.leituras, ...parcial };
        // erros dos demais arquivos entram na verificação (a folha traz os seus)
        if (tipo !== "folha")
          leituras.errosArquivos = { ...x.leituras?.errosArquivos, [tipo]: erros };
        // sem datas na etapa Obra (ou obra em andamento): o período sai das competências da folha
        const dados = parcial.folha ? periodoComFolha(x.dados, parcial.folha) : x.dados;
        return {
          ...x,
          dados,
          leituras,
          arquivos: { ...x.arquivos, [tipo]: { nome: nomes, resumo, erros: textoErros(erros) } },
        };
      });
    } catch (e) {
      const motivo = e instanceof LeituraInterrompida ? e.motivo : "falha";
      avisar(
        motivo === "cancelada"
          ? "Leitura cancelada."
          : motivo === "tempo"
            ? "O arquivo demorou mais de 2 minutos para ler. Divida-o por período e envie de novo."
            : motivo === "arquivo"
              ? (e as Error).message
              : "Não foi possível ler o arquivo. Envie .xlsx, .csv ou .xml no layout do ITO.",
      );
    } finally {
      cancelar.current = null;
      setLendo(null);
    }
  }

  function remover(tipo: TipoArquivo) {
    mudar((x) => {
      const arquivos = { ...x.arquivos };
      delete arquivos[tipo];
      if (tipo === "folha")
        return {
          ...x,
          // em andamento, o período vinha da folha: volta a nenhum mês
          dados: x.dados.situacao === "andamento" ? { ...x.dados, meses: 0, trocas: [] } : x.dados,
          arquivos,
          leituras: x.leituras && { ...x.leituras, folha: FOLHA_VAZIA },
        };
      const chave = tipo === "nf" ? "notas" : tipo;
      const errosArquivos = { ...x.leituras?.errosArquivos };
      delete errosArquivos[tipo];
      return {
        ...x,
        arquivos,
        leituras: x.leituras && { ...x.leituras, [chave]: null, errosArquivos },
      };
    });
  }

  return (
    <Cartao aria-label="Arquivos da obra">
      <div className={f.barra}>
        <span className="rotulo">Arquivos de pessoal da obra</span>
        <span className="sub">
          Lidos no seu computador: o arquivo não sobe para o servidor e nomes de trabalhadores são
          descartados na leitura.
        </span>
      </div>
      {SLOTS.map((sl) => (
        <SlotArquivo
          key={sl.tipo}
          slot={sl}
          meta={r.arquivos[sl.tipo]}
          lendo={lendo === sl.tipo}
          onLer={(a) => ler(sl.tipo, a)}
          onRemover={() => remover(sl.tipo)}
          onCancelar={() => cancelar.current?.abort()}
        />
      ))}
    </Cartao>
  );
}

function SlotArquivo({
  slot,
  meta,
  lendo,
  onLer,
  onRemover,
  onCancelar,
}: {
  slot: Slot;
  meta: { nome: string; resumo: string; erros: string[] } | undefined;
  lendo: boolean;
  onLer: (a: FileList | null) => void;
  onRemover: () => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const avisar = useToast();
  return (
    <div className={`${s.slot} ${meta ? s.slotLido : ""}`}>
      <span className={s.icone} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
      </span>
      <div className={s.slotTexto}>
        <strong style={{ fontWeight: 500 }}>
          {slot.titulo} {slot.tipo === "folha" && <Badge tom="escuro">obrigatório</Badge>}
        </strong>
        {meta ? (
          <>
            <span className="mono" style={{ fontSize: 11 }}>
              {meta.nome}
            </span>
            <span className="sub">{meta.resumo}</span>
            {meta.erros.length > 0 && (
              <ul className={s.erros} role="alert">
                {meta.erros.slice(0, 5).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {meta.erros.length > 5 && <li>e mais {numero(meta.erros.length - 5)} erros</li>}
              </ul>
            )}
          </>
        ) : (
          <span className="sub">{slot.formato}</span>
        )}
      </div>
      {meta &&
        (meta.erros.length ? (
          <Badge tom="erro">{plural(meta.erros.length, "erro", "erros")}</Badge>
        ) : (
          <Badge tom="ok">● Lido</Badge>
        ))}
      {slot.modelo && slot.tipo !== "nf" && (
        <Botao
          pequeno
          variante="fantasma"
          onClick={() =>
            baixarModelo(slot.tipo as "folha" | "ponto" | "vt" | "erp").catch(() =>
              avisar("Não foi possível gerar o modelo. Tente de novo."),
            )
          }
        >
          Baixar modelo
        </Botao>
      )}
      {meta && !lendo && (
        <Botao pequeno variante="fantasma" onClick={onRemover}>
          Remover
        </Botao>
      )}
      {lendo && (
        <Botao pequeno variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Botao>
      )}
      {/* input antes do rótulo: o foco do teclado aparece no "botão" (CSS :focus-visible + label) */}
      <input
        id={id}
        className={s.arquivoInput}
        type="file"
        accept={slot.aceita}
        multiple={slot.tipo === "nf"}
        disabled={lendo}
        aria-label={slot.titulo}
        onChange={(e) => {
          onLer(e.target.files);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={`${u.botao} ${u.pequeno} ${meta ? "" : u.escuro} ${s.botaoArquivo}`}
        aria-disabled={lendo}
      >
        {lendo ? "Lendo…" : meta ? "Trocar arquivo" : "Escolher arquivo"}
      </label>
    </div>
  );
}
