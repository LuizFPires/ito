import { useState } from "react";
import { Link } from "react-router";
import {
  data as fmtData,
  moeda,
  numero,
  parseData,
  parseNumero,
  percentual,
  MESES,
} from "@ito/formato";
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
import { alternarOrdem, contemTermos, ordenar } from "../lib/lista";
import type { Ordem } from "../lib/lista";
import { adicionaisPorPessoa } from "../lib/adicionais";
import { podeEditarConfig } from "../lib/permissoes";
import { MENU } from "../shell/rotas";
import { Badge, Botao, Cartao, Chip, Segmento } from "../ui/componentes";
import {
  Campo,
  CampoBusca,
  CampoNumero,
  Interruptor,
  Kpi,
  Selecao,
  ThOrdem,
} from "../ui/formulario";
import f from "../ui/formulario.module.css";
import { Pagina } from "./Pagina";
import { HistoricoAlteracoes } from "./Auditoria";

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
  const { data: detVig } = useDataBase(vigente);
  const [aba, setAba] = useState<Aba>("sal");

  const t = det ? taxasEncargos(paraMotor(det.encargos)) : undefined;
  const pct = (v: number | undefined) => (v === undefined ? "—" : percentual(v * 100));
  // Decisão M1: só a vigente e as "a revisar" são editáveis (o banco também trava).
  const editavel = pode && !!db && (db.ano === vigente || db.a_revisar);

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
        {pode && db && !editavel && (
          <span className="sub">
            Data-base revisada e fora de vigência: só leitura, para não mudar o custo época das
            obras.
          </span>
        )}
      </div>

      <div className={f.kpis}>
        <Kpi
          rotulo="Data-base vigente"
          valor={vigente ? `CCT ${vigente}` : "—"}
          sub={`oficial ${moeda(detVig?.salarios.ped)}`}
        />
        <Kpi
          rotulo={`Encargos sociais · CLT · ${ano ?? ""}`}
          valor={pct(t?.soc.clt)}
          sub={`inclui incidência de ${pct(t?.incidencia.clt)}`}
        />
        <Kpi
          rotulo="Total folha · CLT"
          valor={pct(t ? t.soc.clt + t.prov.clt + t.nf.clt : undefined)}
          sub={`sociais ${pct(t?.soc.clt)} + provisões ${pct(t?.prov.clt)}`}
        />
        <Kpi
          rotulo="Total prestador S/P"
          valor={pct(t ? t.soc.sp + t.prov.sp + t.nf.sp : undefined)}
          sub="tributos sobre NF, sem encargos de folha"
        />
      </div>

      <Segmento rotulo="Seção dos parâmetros" opcoes={ABAS} valor={aba} onChange={setAba} />

      {ano && db && det && (
        <>
          {aba === "sal" && (
            <AbaSalarios
              ano={ano}
              anterior={datas?.find((x) => x.ano < ano)?.ano}
              det={det}
              pode={editavel}
            />
          )}
          {aba === "enc" && <AbaEncargos ano={ano} det={det} pode={editavel} />}
          {aba === "ben" && <AbaBeneficios ano={ano} det={det} pode={editavel} />}
          {aba === "he" && <AbaHe db={db} pode={editavel} />}
          {aba === "adic" && <AbaAdicionais db={db} det={det} pode={editavel} />}
        </>
      )}
      {aba === "cal" && <AbaCalendario pode={pode} anoInicial={vigente} />}
      {aba === "datas" && <AbaDatasBase datas={datas ?? []} vigente={vigente} pode={pode} />}

      <HistoricoAlteracoes modulo="parametros" />
      <Cartao className={f.painel} style={{ position: "static" }}>
        <span className="rotulo">O que é histórico e o que é atualizado</span>
        <p className="sub" style={{ margin: 0, maxWidth: "80ch" }}>
          Da base histórica, o ITO aproveita só as quantidades: pessoa-mês, horas extras, faltas,
          rotatividade, licenças e férias. Os preços vêm daqui: a <strong>época</strong> usa a
          data-base em que cada obra foi feita (com as trocas no meio da obra); o{" "}
          <strong>atualizado</strong> recalcula as mesmas quantidades com a data-base vigente.
        </p>
      </Cartao>
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
  const [q, setQ] = useState("");
  const [ordem, setOrdem] = useState<Ordem<"nome" | "grupo" | "salario" | "variacao">>({
    chave: "grupo",
    dir: 1,
  });
  const variacao = (id: string) => {
    const v = det.salarios[id];
    const a = ant?.salarios[id];
    return v !== undefined && a ? v / a - 1 : -Infinity;
  };
  const ordemGrupo = { direta: 0, indireta: 1, adm: 2 };
  const lista = ordenar(
    (funcoes ?? []).filter(
      (x) =>
        (x.ativo || det.salarios[x.id] !== undefined) &&
        contemTermos(`${x.nome} ${NOME_GRUPO[x.grupo]}`, q),
    ),
    ordem,
    (x, k) =>
      k === "nome"
        ? x.nome
        : k === "grupo"
          ? `${ordemGrupo[x.grupo]} ${x.nome}`
          : k === "salario"
            ? (det.salarios[x.id] ?? -1)
            : variacao(x.id),
  );
  const ordenarPor = (k: typeof ordem.chave) => setOrdem(alternarOrdem(ordem, k));
  return (
    <Secao
      titulo={`Salário base por função · ${ano}`}
      sub="R$ por mês. Na projeção, a CCT da cidade substitui estes valores."
    >
      <div className={f.barra}>
        <CampoBusca
          rotulo="Buscar função"
          placeholder="Função ou grupo"
          valor={q}
          onChange={setQ}
        />
      </div>
      <table className={f.tabela}>
        <thead>
          <tr>
            <ThOrdem chave="nome" ordem={ordem} onOrdenar={ordenarPor}>
              Função padrão
            </ThOrdem>
            <ThOrdem chave="grupo" ordem={ordem} onOrdenar={ordenarPor}>
              Grupo
            </ThOrdem>
            <ThOrdem chave="salario" ordem={ordem} onOrdenar={ordenarPor} direita>
              Salário {ano}
            </ThOrdem>
            <ThOrdem chave="variacao" ordem={ordem} onOrdenar={ordenarPor} direita>
              {anterior ? `${anterior} → ${ano}` : "Variação"}
            </ThOrdem>
          </tr>
        </thead>
        <tbody>
          {!lista.length && (
            <tr>
              <td colSpan={4} className="sub" style={{ textAlign: "center", padding: 24 }}>
                Nenhuma função encontrada. Limpe a busca.
              </td>
            </tr>
          )}
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
                      onSalvar={(valor) => gravar.gravar({ funcao_id: x.id, valor })}
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
        onSalvar={(v) => atualizar.gravar({ id: e.id, patch: { [k]: v } })}
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
                    <td>
                      {e.nome}
                      <div className="sub">
                        efetivo CLT{" "}
                        {percentual((Number(e.base_calc_pct) * Number(e.aliq_clt)) / 100)} · S/P{" "}
                        {percentual((Number(e.base_calc_pct) * Number(e.aliq_sp)) / 100)}
                      </div>
                    </td>
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
          <tr className={f.total}>
            <td colSpan={2}>Total sobre a remuneração (sociais + provisões + NF)</td>
            <td className={f.r}>{percentual((t.soc.clt + t.prov.clt + t.nf.clt) * 100)}</td>
            <td className={f.r}>{percentual((t.soc.sp + t.prov.sp + t.nf.sp) * 100)}</td>
          </tr>
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
  const [qBen, setQBen] = useState("");
  const gravar = useGravarBeneficio(ano);
  return (
    <Secao
      titulo={`Benefícios · ${ano}`}
      sub="R$ por pessoa·mês. A CCT da cidade substitui estes valores na projeção."
    >
      <div className={f.barra}>
        <CampoBusca
          rotulo="Buscar benefício"
          placeholder="Benefício ou conta"
          valor={qBen}
          onChange={setQBen}
        />
      </div>
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
          {(bens ?? [])
            .filter((b) => contemTermos(`${b.nome} ${b.conta_pc}`, qBen))
            .map((b) => (
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
                      onSalvar={(valor) => gravar.gravar({ beneficio_id: b.id, valor })}
                    />
                  ) : (
                    moeda(det.beneficios[b.id])
                  )}
                </td>
              </tr>
            ))}
          <tr className={f.total}>
            <td colSpan={3}>Total por pessoa · todas as obras</td>
            <td className={f.r}>
              {moeda(
                (bens ?? [])
                  .filter((b) => !b.so_fora_sede)
                  .reduce((s, b) => s + (det.beneficios[b.id] ?? 0), 0),
              )}
            </td>
          </tr>
          <tr className={f.total}>
            <td colSpan={3}>Total por pessoa · MO alojada / obra fora da sede</td>
            <td className={f.r}>
              {moeda((bens ?? []).reduce((s, b) => s + (det.beneficios[b.id] ?? 0), 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </Secao>
  );
}

function AbaHe({ db, pode }: { db: DataBase; pode: boolean }) {
  const atualizar = useAtualizarDataBase(db.ano);
  const s = (patch: Parameters<typeof atualizar.mutate>[0]) => atualizar.gravar(patch);
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
          <Campo
            rotulo="Modo"
            dica={
              fixo
                ? `Usa ${numero(Number(db.dias_fixos))} dias e DSR de ${percentual(Number(db.dsr_fixo_pct))} fixos em todo mês.`
                : "Dias trabalhados e DSR de cada mês pelo calendário (aba Calendário)."
            }
          >
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

function QuemRecebe({ db, det }: { db: DataBase; det: DetalheDataBase }) {
  const { data: funcoes } = useFuncoes();
  const lista = (funcoes ?? []).filter(
    (x) =>
      x.ativo &&
      (x.vinculo === "estagio" ||
        Number(x.peric_pct) > 0 ||
        Number(x.insal_pct_sm) > 0 ||
        Number(x.horas_noturnas_mes) > 0 ||
        Number(x.ferramentas_mes) > 0),
  );
  return (
    <Secao titulo={`Quem recebe o quê · ${db.ano}`} sub="Valores por pessoa·mês, sem faltas.">
      <table className={f.tabela}>
        <thead>
          <tr>
            <th>Função</th>
            <th>Adicionais legais</th>
            <th className={f.r}>Ferramentas</th>
            <th className={f.r}>Adicionais / pessoa·mês</th>
            <th>Vínculo</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((x) => {
            const est = x.vinculo === "estagio";
            const partes = [
              Number(x.peric_pct) > 0 && `periculosidade ${percentual(Number(x.peric_pct), 0)}`,
              Number(x.insal_pct_sm) > 0 &&
                `insalubridade ${percentual(Number(x.insal_pct_sm), 0)} do SM`,
              Number(x.horas_noturnas_mes) > 0 &&
                `${numero(Number(x.horas_noturnas_mes))} h noturnas`,
            ].filter(Boolean);
            return (
              <tr key={x.id}>
                <td className={f.forte}>{x.nome}</td>
                <td>{est ? "—" : partes.join(" · ") || "—"}</td>
                <td className={f.r}>{est ? "—" : moeda(Number(x.ferramentas_mes))}</td>
                <td className={f.r}>
                  {moeda(adicionaisPorPessoa(x, det.salarios[x.id] ?? 0, db))}
                </td>
                <td>{est ? <Badge tom="ambar">estágio · bolsa sem encargos</Badge> : "CLT"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={f.barra} style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
        <Link to="/funcoes" className={f.linkAcao}>
          Adicionais por função →
        </Link>
        <span className="sub">
          Gratificações, prêmios e transferência ficam nas premissas de cada obra ou projeção.
        </span>
      </div>
    </Secao>
  );
}

function AbaAdicionais({ db, det, pode }: { db: DataBase; det: DetalheDataBase; pode: boolean }) {
  const atualizar = useAtualizarDataBase(db.ano);
  const s = (patch: Parameters<typeof atualizar.mutate>[0]) => atualizar.gravar(patch);
  return (
    <>
      <QuemRecebe db={db} det={det} />
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
    </>
  );
}

const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const NOME_TIPO_FERIADO = {
  nacional: "Nacional",
  facultativo: "Ponto facultativo",
  empresa: "Empresa",
  municipal: "Municipal",
} as const;

function AbaCalendario({ pode, anoInicial }: { pode: boolean; anoInicial?: number }) {
  const { data: params } = useParametros();
  const { data: feriados } = useFeriadosEmpresa();
  const atualizar = useAtualizarParametros();
  const adicionar = useAdicionarFeriado();
  const remover = useRemoverFeriado();
  const [ano, setAno] = useState(anoInicial ?? new Date().getFullYear());
  const [qFer, setQFer] = useState("");
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
  const soma = (k: "dias" | "seg" | "sab" | "rep" | "uteis" | "feriadosUteis") =>
    meses.reduce((s, m) => s + m[k], 0);
  const feriadosAno = meses.flatMap((m) => m.feriados);
  const diaSemana = (iso: string) => DIA_SEMANA[new Date(`${iso}T00:00:00Z`).getUTCDay()];

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
          setAno(Number(iso.slice(0, 4))); // mostra o ano do feriado incluído
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
            onChange={(v) => atualizar.gravar({ carnaval: v })}
          />
          <Interruptor
            rotulo="Corpus Christi é feriado"
            texto="Corpus Christi"
            ligado={params.corpus_christi}
            desabilitado={!pode}
            onChange={(v) => atualizar.gravar({ corpus_christi: v })}
          />
        </div>
      </Secao>

      <Secao titulo="Feriados da empresa">
        <div className={f.barra}>
          <CampoBusca
            rotulo="Buscar feriado"
            placeholder="Data ou descrição"
            valor={qFer}
            onChange={setQFer}
          />
        </div>
        <table className={f.tabela}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              {pode && <th className={f.r}>Ação</th>}
            </tr>
          </thead>
          <tbody>
            {(feriados ?? [])
              .filter((x) => contemTermos(`${fmtData(x.data)} ${x.nome}`, qFer))
              .map((x) => (
                <tr key={x.data}>
                  <td>{fmtData(x.data)}</td>
                  <td>{x.nome}</td>
                  {pode && (
                    <td className={f.r}>
                      <Botao
                        pequeno
                        variante="fantasma"
                        onClick={() =>
                          window.confirm(`Remover o feriado de ${fmtData(x.data)} (${x.nome})?`) &&
                          remover.mutate(x.data)
                        }
                      >
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
              <th className={f.r}>Dias</th>
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
                <td className={f.r}>{numero(m.dias)}</td>
                <td className={f.r}>
                  {numero(m.uteis)}
                  <div className="sub">
                    sendo {numero(m.seg)} seg–sex + {numero(m.sab)} sáb
                  </div>
                </td>
                <td className={f.r}>
                  {numero(m.rep)}
                  <div className="sub">inclui {numero(m.feriadosUteis)} feriado(s) em dia útil</div>
                </td>
                <td className={f.r}>{percentual(m.dsrPct)}</td>
                <td className="sub">
                  {m.feriados.map((x) => `${x.data.slice(8)} ${x.nome}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
            <tr className={f.total}>
              <td>Ano</td>
              <td className={f.r}>{numero(soma("dias"))}</td>
              <td className={f.r}>
                {numero(soma("uteis"))}
                <div className="sub">
                  sendo {numero(soma("seg"))} seg–sex + {numero(soma("sab"))} sáb
                </div>
              </td>
              <td className={f.r}>
                {numero(soma("rep"))}
                <div className="sub">
                  inclui {numero(soma("feriadosUteis"))} feriado(s) em dia útil
                </div>
              </td>
              <td className={f.r}>{percentual((soma("rep") / soma("uteis")) * 100)}</td>
              <td className="sub">DSR médio do ano</td>
            </tr>
          </tbody>
        </table>
      </Secao>

      <Secao
        titulo={`Feriados de ${ano}`}
        sub={`${numero(feriadosAno.length)} datas · ${numero(soma("feriadosUteis"))} em dias úteis`}
      >
        <table className={f.tabela} aria-label={`Feriados de ${ano}`}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Dia</th>
              <th>Feriado</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {feriadosAno.map((x) => (
              <tr key={x.data}>
                <td>{fmtData(x.data)}</td>
                <td>{diaSemana(x.data)}</td>
                <td>{x.nome}</td>
                <td>
                  <Badge
                    tom={
                      x.tipo === "nacional" ? "escuro" : x.tipo === "empresa" ? "ambar" : "neutro"
                    }
                  >
                    {NOME_TIPO_FERIADO[x.tipo]}
                  </Badge>
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
  // Texto do reajuste validado só no envio: valor inválido nunca vira "0%" em silêncio.
  const [reajusteTxt, setReajusteTxt] = useState("0");
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    const a = Number(ano);
    if (!Number.isInteger(a) || a < 2000 || a > 2100)
      return setErro("Informe o ano da nova data-base (ex.: 2027).");
    if (datas.some((x) => x.ano === a))
      return setErro(`A data-base ${a} já existe. Escolha outro ano.`);
    const reajuste = parseNumero(reajusteTxt);
    if (reajuste === null || reajuste < -50 || reajuste > 100)
      return setErro("Informe um reajuste entre -50% e 100% (ex.: 6 ou 5,5).");
    setErro(null);
    criar.mutate({ ano: a, reajuste }, { onSuccess: () => setAno(String(a + 1)) });
  }

  function tornarVigente(x: DataBase) {
    const ok =
      !x.a_revisar ||
      window.confirm(
        `A data-base ${x.ano} ainda está "a revisar". Torná-la vigente muda os preços de todas as projeções e do custo atualizado. Continuar?`,
      );
    if (ok) atualizarParams.mutate({ data_base_vigente: x.ano });
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
                      onVigente={() => tornarVigente(x)}
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
          sub={`Copia a vigente (${vigente ?? "—"}): salários, benefícios, encargos e regras; aplica o reajuste em salários e benefícios.`}
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
              <Campo rotulo="Reajuste (%)">
                <input
                  className={`${f.input} ${f.num}`}
                  inputMode="decimal"
                  value={reajusteTxt}
                  onChange={(e) => setReajusteTxt(e.target.value)}
                />
              </Campo>
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
        <Botao pequeno variante="fantasma" onClick={() => atualizar.gravar({ a_revisar: false })}>
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
