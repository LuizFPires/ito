import { useId, useState } from "react";
import type { ErroLeitura, Leituras, TipoArquivo } from "@ito/carga";
import { lerErp, lerFolha, lerNotasFiscais, lerPonto, lerVt, periodoDaFolha } from "@ito/carga";
import { moeda, numero } from "@ito/formato";
import { baixarModelo, decodificarTexto, planilhaDe } from "../../lib/arquivos";
import { Badge, Botao, Cartao } from "../../ui/componentes";
import f from "../../ui/formulario.module.css";
import u from "../../ui/ui.module.css";
import { useToast } from "../../ui/toast";
import type { PropsEtapa } from "./Assistente";
import s from "./carga.module.css";

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

  async function ler(tipo: TipoArquivo, arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setLendo(tipo);
    try {
      const nomes = [...arquivos].map((a) => a.name).join(", ");
      let parcial: Partial<Leituras> = {};
      let resumo = "";
      let erros: ErroLeitura[] = [];
      if (tipo === "nf") {
        const lidas = await Promise.all(
          [...arquivos].map(async (a) =>
            lerNotasFiscais(decodificarTexto(await a.arrayBuffer()), a.name),
          ),
        );
        const notas = lidas.flatMap((l) => l.notas);
        erros = lidas.flatMap((l) => l.erros);
        parcial = { notas };
        resumo = `${plural(notas.length, "nota", "notas")} · ${moeda(notas.reduce((t, n) => t + n.valor, 0))} em serviços`;
      } else {
        const p = await planilhaDe(arquivos[0]!);
        if (tipo === "folha") {
          const folha = lerFolha(p);
          erros = folha.erros;
          parcial = { folha };
          const comps = new Set(folha.rubricas.map((x) => `${x.comp.ano}-${x.comp.mes}`)).size;
          const mats = new Set(folha.rubricas.map((x) => x.matricula)).size;
          const rubs = new Set(folha.rubricas.map((x) => x.codigo)).size;
          resumo = `${plural(comps, "competência", "competências")} · ${plural(folha.rubricas.length, "lançamento", "lançamentos")} · ${plural(mats, "matrícula", "matrículas")} · ${plural(rubs, "rubrica", "rubricas")}`;
        } else if (tipo === "ponto") {
          const l = lerPonto(p);
          erros = l.erros;
          parcial = { ponto: l.linhas };
          resumo = `${numero(
            l.linhas.reduce((t, x) => t + x.he, 0),
            1,
          )} h de HE · ${numero(
            l.linhas.reduce((t, x) => t + x.faltas, 0),
            1,
          )} h de falta`;
        } else if (tipo === "vt") {
          const l = lerVt(p);
          erros = l.erros;
          parcial = { vt: l.linhas };
          resumo = `${plural(l.linhas.length, "crédito", "créditos")} · ${moeda(l.linhas.reduce((t, x) => t + x.valor, 0))}`;
        } else {
          const l = lerErp(p);
          erros = l.erros;
          parcial = { erp: l.linhas };
          const meses = new Set(l.linhas.map((x) => `${x.comp.ano}-${x.comp.mes}`)).size;
          resumo = `${plural(meses, "mês", "meses")} · ${plural(new Set(l.linhas.map((x) => x.conta)).size, "conta", "contas")}`;
        }
      }
      mudar((x) => {
        const leituras: Leituras = { folha: FOLHA_VAZIA, ...x.leituras, ...parcial };
        let dados = x.dados;
        // sem datas na etapa Obra: o período sai das competências da folha
        if (parcial.folha && dados.meses < 1) {
          const per = periodoDaFolha(parcial.folha);
          if (per) dados = { ...dados, ...per };
        }
        return {
          ...x,
          dados,
          leituras,
          arquivos: { ...x.arquivos, [tipo]: { nome: nomes, resumo, erros: textoErros(erros) } },
        };
      });
    } catch {
      avisar("Não foi possível ler o arquivo. Envie .xlsx, .csv ou .xml no layout do ITO.");
    } finally {
      setLendo(null);
    }
  }

  function remover(tipo: TipoArquivo) {
    mudar((x) => {
      const arquivos = { ...x.arquivos };
      delete arquivos[tipo];
      if (tipo === "folha") return { ...x, arquivos: {}, leituras: null };
      const chave = tipo === "nf" ? "notas" : tipo;
      return { ...x, arquivos, leituras: x.leituras && { ...x.leituras, [chave]: null } };
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
          desabilitado={sl.tipo !== "folha" && !r.arquivos.folha}
          onLer={(a) => ler(sl.tipo, a)}
          onRemover={() => remover(sl.tipo)}
        />
      ))}
    </Cartao>
  );
}

function SlotArquivo({
  slot,
  meta,
  lendo,
  desabilitado,
  onLer,
  onRemover,
}: {
  slot: Slot;
  meta: { nome: string; resumo: string; erros: string[] } | undefined;
  lendo: boolean;
  desabilitado: boolean;
  onLer: (a: FileList | null) => void;
  onRemover: () => void;
}) {
  const id = useId();
  const avisar = useToast();
  return (
    <div className={s.slot}>
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
      {meta && (
        <Botao pequeno variante="fantasma" onClick={onRemover}>
          Remover
        </Botao>
      )}
      {/* input antes do rótulo: o foco do teclado aparece no "botão" (CSS :focus-visible + label) */}
      <input
        id={id}
        className={s.arquivoInput}
        type="file"
        accept={slot.aceita}
        multiple={slot.tipo === "nf"}
        disabled={desabilitado || lendo}
        aria-label={slot.titulo}
        onChange={(e) => {
          onLer(e.target.files);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={`${u.botao} ${u.pequeno} ${meta ? "" : u.escuro} ${s.botaoArquivo}`}
        aria-disabled={desabilitado || lendo}
        title={desabilitado ? "Envie a folha primeiro" : undefined}
      >
        {lendo ? "Lendo…" : meta ? "Trocar arquivo" : "Escolher arquivo"}
      </label>
    </div>
  );
}
