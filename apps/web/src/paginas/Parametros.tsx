import { useState } from "react";
import { data as fmtData, moeda, numero, parseData, percentual, MESES } from "@ito/formato";
import { calendarioMes, taxasEncargos } from "@ito/motor";
import type { ItemEncargo } from "@ito/motor";
import { useSessao } from "../auth/sessao";
import {
  NOME_GRUPO,
  useAdicionarFeriado,
  useAtualizarDataBase,
  useAtualizarEncargo,
  useAtualizarParametros,
  useBeneficios,
  useCriarDataBase,
  useDataBase,
  useDatasBase,
  useFeriadosEmpresa,
  useFuncoes,
  useGravarBeneficio,
  useGravarSalario,
  useParametros,
  useRemoverFeriado,
} from "../dados/cadastros";
import type { DataBase, DetalheDataBase, Encargo } from "../dados/cadastros";
import { podeEditarConfig } from "../lib/permissoes";
import { MENU } from "../shell/rotas";
import { Badge, Botao, Cartao, Chip, Segmento } from "../ui/componentes";
import { Campo, CampoNumero, Interruptor, Kpi, Selecao } from "../ui/formulario";
import f from "../ui/formulario.module.css";
import { Pagina } from "./Pagina";

type Aba = "sal" | "enc" | "ben" | "he" | "adic" | "cal" | "datas";
const ABAS: { valor: Aba; texto: string }[] = [
  { valor: "sal", texto: "Salários" },
  { valor: "enc", texto: "Encargos" },
  { valor: "ben", texto: "Benefícios" },
  { valor: "he", texto: "HE, VT e rescisões" },
  { valor: "adic", texto: "Adicionais e verbas" },
  { valor: "cal", texto: "Calendário" },
  { valor: "datas", texto: "Datas-base" },
];
const NOME_GRUPO_ENC = {
  soc: "Encargos sociais",
  prov: "Férias + 1/3 + 13º + GRRF (provisões)",
  nf: "Tributos sobre nota fiscal (S/P)",
} as const;

const paraMotor = (e: Encargo[]): ItemEncargo[] =>
  e.map((x) => ({
    id: x.id,
    grupo: x.grupo,
    nome: x.nome,
    baseCalcPct: Number(x.base_calc_pct),
    aliqClt: Number(x.aliq_clt),
    aliqSp: Number(x.aliq_sp),
  }));

export function TelaParametros() {
  const d = MENU.find((x) => x.caminho === "/parametros")!;
  const { usuario } = useSessao();
  const pode = podeEditarConfig(usuario);
  const { data: params } = useParametros();
  const { data: datas } = useDatasBase();
  const vigente = params?.data_base_vigente ?? undefined;
  const [anoSel, setAnoSel] = useState<number | null>(null);
  const ano = anoSel ?? vigente;
  const db = datas?.find((x) => x.ano === ano);
  const { data: det } = useDataBase(ano);
  const [aba, setAba] = useState<Aba>("sal");

  const t = det ? taxasEncargos(paraMotor(det.encargos)) : undefined;
  const pct = (v: number | undefined) => (v === undefined ? "—" : percentual(v * 100));

  return (
    <Pagina grupo={d.grupo} titulo={d.nome} resumo={d.resumo} milestone={d.milestone}>
      <div className={f.linha} role="group" aria-label="Data-base">
        {(datas ?? []).map((x) => (
          <Chip key={x.ano} ativo={x.ano === ano} onClick={() => setAnoSel(x.ano)}>
            {x.ano}
            {x.ano === vigente ? " · vigente" : ""}
          </Chip>
        ))}
        {db?.a_revisar && <Badge tom="ambar">a revisar pela controladoria</Badge>}
        {!pode && <span className="sub">Só a controladoria altera a tabela da empresa.</span>}
      </div>

      <div className={f.kpis}>
        <Kpi
          rotulo="Encargos sociais · CLT"
          valor={pct(t?.soc.clt)}
          sub={`inclui incidência de ${pct(t?.incidencia.clt)}`}
        />
        <Kpi rotulo="Provisões · CLT" valor={pct(t?.prov.clt)} sub="férias, 1/3, 13º e GRRF" />
        <Kpi
          rotulo="Total folha · CLT"
          valor={pct(t ? t.soc.clt + t.prov.clt : undefined)}
          sub="sobre a remuneração"
        />
        <Kpi rotulo="Prestador S/P" valor={pct(t?.nf.sp)} sub="tributos sobre NF" />
      </div>

      <Segmento rotulo="Seção dos parâmetros" opcoes={ABAS} valor={aba} onChange={setAba} />

      {ano && db && det && (
        <>
          {aba === "sal" && (
            <AbaSalarios
              ano={ano}
              anterior={datas?.find((x) => x.ano < ano)?.ano}
              det={det}
              pode={pode}
            />
          )}
          {aba === "enc" && <AbaEncargos ano={ano} det={det} pode={pode} />}
          {aba === "ben" && <AbaBeneficios ano={ano} det={det} pode={pode} />}
          {aba === "he" && <AbaHe db={db} pode={pode} />}
          {aba === "adic" && <AbaAdicionais db={db} pode={pode} />}
        </>
      )}
      {aba === "cal" && <AbaCalendario pode={pode} />}
      {aba === "datas" && <AbaDatasBase datas={datas ?? []} vigente={vigente} pode={pode} />}
    </Pagina>
  );
}

function Secao({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <Cartao style={{ overflow: "hidden" }} aria-label={titulo}>
      <div className={f.barra} style={{ justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 16, fontWeight: 500 }}>{titulo}</h2>
        {sub && <span className="sub">{sub}</span>}
      </div>
      {children}
    </Cartao>
  );
}

function AbaSalarios({
  ano,
  anterior,
  det,
  pode,
}: {
  ano: number;
  anterior?: number;
  det: DetalheDataBase;
  pode: boolean;
}) {
  const { data: funcoes } = useFuncoes();
  const { data: ant } = useDataBase(anterior);
  const gravar = useGravarSalario(ano);
  const lista = (funcoes ?? []).filter((x) => x.ativo || det.salarios[x.id] !== undefined);
  return (
    <Secao
      titulo={`Salário base por função · ${ano}`}
      sub="R$ por mês. Na projeção, a CCT da cidade substitui estes valores."
    >
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Função padrão</th>
            <th>Grupo</th>
            <th className={f.r}>Salário {ano}</th>
            <th className={f.r}>{anterior ? `${anterior} → ${ano}` : "Variação"}</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((x) => {
            const v = det.salarios[x.id];
            const a = ant?.salarios[x.id];
            return (
              <tr key={x.id}>
                <td>
                  <span className={f.amostra} style={{ background: `var(--${x.cor})` }} />
                  <span className={f.forte}>{x.nome}</span>
                  {v === undefined && (
                    <>
                      {" "}
                      <Badge tom="ambar">sem salário</Badge>
                    </>
                  )}
                </td>
                <td>{NOME_GRUPO[x.grupo]}</td>
                <td className={f.r}>
                  {pode ? (
                    <CampoNumero
                      compacto
                      rotulo={`Salário de ${x.nome}`}
                      valor={v ?? 0}
                      onSalvar={(valor) => gravar.mutate({ funcao_id: x.id, valor })}
                    />
                  ) : (
                    moeda(v)
                  )}
                </td>
                <td className={f.r}>
                  {v !== undefined && a ? (
                    <Badge tom="ambar">
                      {(v >= a ? "+" : "") + percentual((v / a - 1) * 100, 1)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Secao>
  );
}

function AbaEncargos({ ano, det, pode }: { ano: number; det: DetalheDataBase; pode: boolean }) {
  const atualizar = useAtualizarEncargo(ano);
  const t = taxasEncargos(paraMotor(det.encargos));
  const campo = (e: Encargo, k: "base_calc_pct" | "aliq_clt" | "aliq_sp", rot: string) =>
    pode ? (
      <CampoNumero
        compacto
        casas={4}
        max={100}
        rotulo={`${rot} de ${e.nome}`}
        valor={Number(e[k])}
        onSalvar={(v) => atualizar.mutate({ id: e.id, patch: { [k]: v } })}
      />
    ) : (
      percentual(Number(e[k]), 4)
    );
  return (
    <Secao
      titulo={`Encargos e provisões · ${ano}`}
      sub="Percentuais sobre a remuneração. A incidência sobre férias, 1/3 e 13º é calculada."
    >
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Item</th>
            <th className={f.r}>Base de cálculo %</th>
            <th className={f.r}>CLT %</th>
            <th className={f.r}>S/P %</th>
          </tr>
        </thead>
        <tbody>
          {(["soc", "prov", "nf"] as const).map((g) => (
            <Grupo key={g} titulo={NOME_GRUPO_ENC[g]}>
              {det.encargos
                .filter((e) => e.grupo === g)
                .map((e) => (
                  <tr key={e.id}>
                    <td>{e.nome}</td>
                    <td className={f.r}>{campo(e, "base_calc_pct", "Base")}</td>
                    <td className={f.r}>{campo(e, "aliq_clt", "Alíquota CLT")}</td>
                    <td className={f.r}>{campo(e, "aliq_sp", "Alíquota S/P")}</td>
                  </tr>
                ))}
              {g === "soc" && (
                <tr>
                  <td colSpan={2}>Incidência sobre férias + 1/3 + 13º (calculada)</td>
                  <td className={f.r}>{percentual(t.incidencia.clt * 100)}</td>
                  <td className={f.r}>{percentual(t.incidencia.sp * 100)}</td>
                </tr>
              )}
              <tr className={f.total}>
                <td colSpan={2}>Total · {NOME_GRUPO_ENC[g]}</td>
                <td className={f.r}>{percentual(t[g].clt * 100)}</td>
                <td className={f.r}>{percentual(t[g].sp * 100)}</td>
              </tr>
            </Grupo>
          ))}
        </tbody>
      </table>
    </Secao>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <>
      <tr className={f.grupo}>
        <td colSpan={4}>{titulo}</td>
      </tr>
      {children}
    </>
  );
}

function AbaBeneficios({ ano, det, pode }: { ano: number; det: DetalheDataBase; pode: boolean }) {
  const { data: bens } = useBeneficios();
  const gravar = useGravarBeneficio(ano);
  return (
    <Secao
      titulo={`Benefícios · ${ano}`}
      sub="R$ por pessoa·mês. A CCT da cidade substitui estes valores na projeção."
    >
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Benefício</th>
            <th>Conta</th>
            <th>Quem recebe</th>
            <th className={f.r}>Valor {ano}</th>
          </tr>
        </thead>
        <tbody>
          {(bens ?? []).map((b) => (
            <tr key={b.id}>
              <td className={f.forte}>{b.nome}</td>
              <td className="mono" style={{ fontSize: 12 }}>
                {b.conta_pc}
              </td>
              <td>
                {b.so_fora_sede
                  ? "Só MO alojada / obra fora da sede"
                  : "Todos (estágio: só seguro)"}
              </td>
              <td className={f.r}>
                {pode ? (
                  <CampoNumero
                    compacto
                    rotulo={`Valor de ${b.nome}`}
                    valor={det.beneficios[b.id] ?? 0}
                    onSalvar={(valor) => gravar.mutate({ beneficio_id: b.id, valor })}
                  />
                ) : (
                  moeda(det.beneficios[b.id])
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Secao>
  );
}

function AbaHe({ db, pode }: { db: DataBase; pode: boolean }) {
  const atualizar = useAtualizarDataBase(db.ano);
  const s = (patch: Parameters<typeof atualizar.mutate>[0]) => atualizar.mutate(patch);
  const fixo = db.modo_dias === "fixo";
  return (
    <Secao titulo={`Horas extras, VT e rescisões · ${db.ano}`}>
      <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        <span className="rotulo">Adicional de HE por tipo</span>
        <div className={f.form}>
          <CampoNumero
            rotulo="Dias úteis"
            sufixo="%"
            max={300}
            valor={Number(db.he_adicional_util)}
            desabilitado={!pode}
            onSalvar={(v) => s({ he_adicional_util: v })}
          />
          <CampoNumero
            rotulo="Sábados"
            sufixo="%"
            max={300}
            valor={Number(db.he_adicional_sabado)}
            desabilitado={!pode}
            onSalvar={(v) => s({ he_adicional_sabado: v })}
          />
          <CampoNumero
            rotulo="Intervalo intrajornada"
            sufixo="%"
            max={300}
            valor={Number(db.he_adicional_intervalo)}
            desabilitado={!pode}
            onSalvar={(v) => s({ he_adicional_intervalo: v })}
          />
          <CampoNumero
            rotulo="Domingos e feriados"
            sufixo="%"
            max={300}
            valor={Number(db.he_adicional_feriado)}
            desabilitado={!pode}
            onSalvar={(v) => s({ he_adicional_feriado: v })}
          />
          <CampoNumero
            rotulo="Divisor"
            casas={0}
            min={1}
            valor={Number(db.divisor)}
            desabilitado={!pode}
            dica="horas por mês"
            onSalvar={(v) => s({ divisor: v })}
          />
        </div>
        <span className="rotulo">Como contar os dias</span>
        <div className={f.form}>
          <Campo rotulo="Modo">
            <Selecao
              value={db.modo_dias}
              disabled={!pode}
              onChange={(e) => s({ modo_dias: e.target.value as "calendario" | "fixo" })}
            >
              <option value="calendario">Calendário real</option>
              <option value="fixo">Dias fixos</option>
            </Selecao>
          </Campo>
          <CampoNumero
            rotulo="Dias fixos"
            casas={0}
            min={1}
            max={31}
            valor={Number(db.dias_fixos)}
            desabilitado={!pode || !fixo}
            onSalvar={(v) => s({ dias_fixos: v })}
          />
          <CampoNumero
            rotulo="DSR fixo"
            sufixo="%"
            max={100}
            valor={Number(db.dsr_fixo_pct)}
            desabilitado={!pode || !fixo}
            onSalvar={(v) => s({ dsr_fixo_pct: v })}
          />
        </div>
        <Interruptor
          rotulo="Sábado é dia trabalhado"
          texto="Sábado é dia trabalhado (conta para VT e dias)"
          ligado={db.sabado_trabalhado}
          desabilitado={!pode}
          onChange={(v) => s({ sabado_trabalhado: v })}
        />
        <span className="rotulo">VT e rescisão</span>
        <div className={f.form}>
          <CampoNumero
            rotulo="VT diário de referência"
            sufixo="R$"
            valor={Number(db.vt_diaria_ref)}
            desabilitado={!pode}
            dica="sem cidade; com cidade vale a tarifa local"
            onSalvar={(v) => s({ vt_diaria_ref: v })}
          />
          <CampoNumero
            rotulo="Fator de rescisão"
            casas={2}
            max={10}
            valor={Number(db.fator_rescisao)}
            desabilitado={!pode}
            dica="× salário por desligamento"
            onSalvar={(v) => s({ fator_rescisao: v })}
          />
        </div>
      </div>
    </Secao>
  );
}

function AbaAdicionais({ db, pode }: { db: DataBase; pode: boolean }) {
  const atualizar = useAtualizarDataBase(db.ano);
  const s = (patch: Parameters<typeof atualizar.mutate>[0]) => atualizar.mutate(patch);
  return (
    <Secao titulo={`Adicionais e verbas · ${db.ano}`}>
      <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className={f.form}>
          <CampoNumero
            rotulo="Salário mínimo"
            sufixo="R$"
            valor={Number(db.salario_minimo)}
            desabilitado={!pode}
            dica="base da insalubridade"
            onSalvar={(v) => s({ salario_minimo: v })}
          />
          <CampoNumero
            rotulo="Adicional noturno"
            sufixo="%"
            max={100}
            valor={Number(db.adicional_noturno_pct)}
            desabilitado={!pode}
            onSalvar={(v) => s({ adicional_noturno_pct: v })}
          />
          <CampoNumero
            rotulo="Salário-família: teto"
            sufixo="R$"
            valor={Number(db.sf_teto)}
            desabilitado={!pode}
            onSalvar={(v) => s({ sf_teto: v })}
          />
          <CampoNumero
            rotulo="Salário-família: cota"
            sufixo="R$"
            valor={Number(db.sf_cota)}
            desabilitado={!pode}
            onSalvar={(v) => s({ sf_cota: v })}
          />
        </div>
        <p className="sub" style={{ margin: 0 }}>
          Periculosidade, insalubridade, horas noturnas e ferramentas são definidas por função, em
          Funções padrão. O salário-família é informativo: compensado na GPS, custo zero.
        </p>
      </div>
    </Secao>
  );
}

function AbaCalendario({ pode }: { pode: boolean }) {
  const { data: params } = useParametros();
  const { data: feriados } = useFeriadosEmpresa();
  const atualizar = useAtualizarParametros();
  const adicionar = useAdicionarFeriado();
  const remover = useRemoverFeriado();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dataTxt, setDataTxt] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  if (!params) return null;

  const opcoes = {
    carnaval: params.carnaval,
    corpusChristi: params.corpus_christi,
    feriadosEmpresa: (feriados ?? []).map((x) => ({ data: x.data, nome: x.nome })),
  };
  const meses = Array.from({ length: 12 }, (_, i) => calendarioMes(ano, i + 1, opcoes));

  function incluir() {
    const iso = parseData(dataTxt);
    if (!iso || !nome.trim()) return setErro("Informe a data (dd/mm/aaaa) e a descrição.");
    setErro(null);
    adicionar.mutate(
      { data: iso, nome: nome.trim() },
      {
        onSuccess: () => {
          setDataTxt("");
          setNome("");
        },
      },
    );
  }

  return (
    <>
      <Secao
        titulo="Regras do calendário"
        sub="Valem para todas as data-bases. Feriados municipais ficam na cidade e na obra."
      >
        <div style={{ padding: "18px 22px", display: "flex", flexWrap: "wrap", gap: 24 }}>
          <Interruptor
            rotulo="Carnaval é feriado"
            texto="Carnaval (segunda e terça)"
            ligado={params.carnaval}
            desabilitado={!pode}
            onChange={(v) => atualizar.mutate({ carnaval: v })}
          />
          <Interruptor
            rotulo="Corpus Christi é feriado"
            texto="Corpus Christi"
            ligado={params.corpus_christi}
            desabilitado={!pode}
            onChange={(v) => atualizar.mutate({ corpus_christi: v })}
          />
        </div>
      </Secao>

      <Secao titulo="Feriados da empresa">
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              {pode && <th className={f.r}>Ação</th>}
            </tr>
          </thead>
          <tbody>
            {(feriados ?? []).map((x) => (
              <tr key={x.data}>
                <td>{fmtData(x.data)}</td>
                <td>{x.nome}</td>
                {pode && (
                  <td className={f.r}>
                    <Botao pequeno variante="fantasma" onClick={() => remover.mutate(x.data)}>
                      Remover
                    </Botao>
                  </td>
                )}
              </tr>
            ))}
            {!feriados?.length && (
              <tr>
                <td colSpan={3} className="sub">
                  Nenhum feriado da empresa cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {pode && (
          <form
            className={f.barra}
            style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              incluir();
            }}
          >
            <input
              className={f.input}
              style={{ width: 150 }}
              aria-label="Data do feriado"
              placeholder="dd/mm/aaaa"
              value={dataTxt}
              onChange={(e) => setDataTxt(e.target.value)}
            />
            <input
              className={f.input}
              style={{ flex: 1, minWidth: 200 }}
              aria-label="Descrição do feriado"
              placeholder="Ex.: Véspera de Natal"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Botao pequeno type="submit">
              Adicionar feriado
            </Botao>
            {erro && (
              <span className={f.erro} role="alert">
                {erro}
              </span>
            )}
          </form>
        )}
      </Secao>

      <Secao titulo={`Dias e DSR por mês · ${ano}`} sub="Calculado pelo motor do ITO (SPEC §2).">
        <div className={f.barra}>
          <Botao pequeno onClick={() => setAno(ano - 1)} aria-label="Ano anterior">
            ‹
          </Botao>
          <span className="num" aria-live="polite">
            {ano}
          </span>
          <Botao pequeno onClick={() => setAno(ano + 1)} aria-label="Próximo ano">
            ›
          </Botao>
        </div>
        <table className={f.tabela} aria-label={`Calendário de ${ano}`}>
          <thead>
            <tr>
              <th>Mês</th>
              <th className={f.r}>Úteis</th>
              <th className={f.r}>Repousos</th>
              <th className={f.r}>DSR %</th>
              <th>Feriados</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes}>
                <td className={f.forte}>{MESES[m.mes - 1]}</td>
                <td className={f.r}>
                  {numero(m.uteis)}
                  <div className="sub">
                    {numero(m.seg)} seg–sex + {numero(m.sab)} sáb
                  </div>
                </td>
                <td className={f.r}>{numero(m.rep)}</td>
                <td className={f.r}>{percentual(m.dsrPct)}</td>
                <td className="sub">
                  {m.feriados.map((x) => `${x.data.slice(8)} ${x.nome}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Secao>
    </>
  );
}

function AbaDatasBase({
  datas,
  vigente,
  pode,
}: {
  datas: DataBase[];
  vigente?: number;
  pode: boolean;
}) {
  const atualizarParams = useAtualizarParametros();
  const criar = useCriarDataBase();
  const proximo = (datas[0]?.ano ?? new Date().getFullYear()) + 1;
  const [ano, setAno] = useState(String(proximo));
  const [origem, setOrigem] = useState(vigente ?? datas[0]?.ano ?? proximo - 1);
  const [reajuste, setReajuste] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    const a = Number(ano);
    if (!Number.isInteger(a) || a < 2000 || a > 2100)
      return setErro("Informe o ano da nova data-base (ex.: 2027).");
    if (datas.some((x) => x.ano === a))
      return setErro(`A data-base ${a} já existe. Escolha outro ano.`);
    setErro(null);
    criar.mutate({ ano: a, origem, reajuste });
  }

  return (
    <>
      <Secao
        titulo="Datas-base"
        sub="A vigente atualiza a base histórica e vale em todas as projeções."
      >
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Data-base</th>
              <th>Origem</th>
              <th>Situação</th>
              {pode && <th className={f.r}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {datas.map((x) => (
              <tr key={x.ano}>
                <td className={f.forte}>
                  {x.ano} {x.ano === vigente && <Badge tom="escuro">vigente</Badge>}
                </td>
                <td>
                  {x.criado_de
                    ? `cópia de ${x.criado_de} + ${percentual(Number(x.reajuste_pct ?? 0), 2)}`
                    : "carga inicial"}
                </td>
                <td>
                  {x.a_revisar ? (
                    <Badge tom="ambar">a revisar</Badge>
                  ) : (
                    <Badge tom="ok">revisada</Badge>
                  )}
                </td>
                {pode && (
                  <td className={f.r}>
                    <AcoesDataBase
                      db={x}
                      vigente={x.ano === vigente}
                      onVigente={() => atualizarParams.mutate({ data_base_vigente: x.ano })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Secao>

      {pode && (
        <Secao
          titulo="Criar nova data-base"
          sub="Copia salários, benefícios, encargos e regras; aplica o reajuste em salários e benefícios."
        >
          <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={f.form}>
              <Campo rotulo="Ano">
                <input
                  className={f.input}
                  inputMode="numeric"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                />
              </Campo>
              <Campo rotulo="Copiar de">
                <Selecao value={origem} onChange={(e) => setOrigem(Number(e.target.value))}>
                  {datas.map((x) => (
                    <option key={x.ano} value={x.ano}>
                      {x.ano}
                      {x.ano === vigente ? " (vigente)" : ""}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <CampoNumero
                rotulo="Reajuste"
                sufixo="%"
                min={-50}
                max={100}
                valor={reajuste}
                onSalvar={setReajuste}
              />
            </div>
            {erro && (
              <p className={f.erro} role="alert" style={{ margin: 0 }}>
                {erro}
              </p>
            )}
            <div className={f.linha}>
              <Botao variante="primario" onClick={enviar} disabled={criar.isPending}>
                Criar data-base
              </Botao>
              <span className="sub">
                Ela nasce "a revisar" e só vira vigente quando você escolher.
              </span>
            </div>
          </div>
        </Secao>
      )}
    </>
  );
}

function AcoesDataBase({
  db,
  vigente,
  onVigente,
}: {
  db: DataBase;
  vigente: boolean;
  onVigente: () => void;
}) {
  const atualizar = useAtualizarDataBase(db.ano);
  return (
    <div className={f.linha} style={{ justifyContent: "flex-end" }}>
      {db.a_revisar && (
        <Botao pequeno variante="fantasma" onClick={() => atualizar.mutate({ a_revisar: false })}>
          Marcar como revisada
        </Botao>
      )}
      {!vigente && (
        <Botao pequeno onClick={onVigente}>
          Tornar vigente
        </Botao>
      )}
    </div>
  );
}
