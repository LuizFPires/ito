import { describe, expect, it } from "vitest";
import { calendarioMes, diasEDsr, feriadosDoAno, pascoa } from "./calendario";

const PADRAO = { carnaval: false, corpusChristi: true, feriadosEmpresa: [] };

describe("pascoa (Meeus/Butcher)", () => {
  it.each([
    [2017, "2017-04-16"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
  ])("%i → %s", (ano, iso) => {
    expect(pascoa(ano)).toBe(iso);
  });
});

describe("feriadosDoAno", () => {
  it("nacionais fixos + Sexta-feira Santa + Corpus Christi (padrão)", () => {
    const f = feriadosDoAno(2017, PADRAO).map((x) => x.data);
    expect(f).toContain("2017-04-14"); // Sexta-feira Santa
    expect(f).toContain("2017-06-15"); // Corpus Christi
    expect(f).not.toContain("2017-02-27"); // Carnaval desligado por padrão
    expect(f).not.toContain("2017-11-20"); // Consciência Negra só a partir de 2024
    expect(f).toHaveLength(10);
  });

  it("Consciência Negra a partir de 2024", () => {
    expect(feriadosDoAno(2024, PADRAO).map((x) => x.data)).toContain("2024-11-20");
  });

  it("Carnaval opcional (segunda e terça) e Corpus Christi desligável", () => {
    const f = feriadosDoAno(2017, { carnaval: true, corpusChristi: false, feriadosEmpresa: [] });
    const datas = f.map((x) => x.data);
    expect(datas).toContain("2017-02-27");
    expect(datas).toContain("2017-02-28");
    expect(datas).not.toContain("2017-06-15");
  });

  it("feriados da empresa entram só no próprio ano, em ordem", () => {
    const f = feriadosDoAno(2026, {
      ...PADRAO,
      feriadosEmpresa: [
        { data: "2026-12-24", nome: "Véspera de Natal" },
        { data: "2025-12-24", nome: "Outro ano" },
      ],
    });
    expect(f.find((x) => x.data === "2026-12-24")).toMatchObject({ tipo: "empresa" });
    expect(f.some((x) => x.data === "2025-12-24")).toBe(false);
    const datas = f.map((x) => x.data);
    expect(datas).toEqual([...datas].sort());
  });
});

describe("calendarioMes — golden SPEC §8", () => {
  it("fev/2017 → 24 úteis e 4 repousos", () => {
    const c = calendarioMes(2017, 2, PADRAO);
    expect(c.uteis).toBe(24);
    expect(c.rep).toBe(4);
  });
  it("abr/2017 → 23 úteis e 7 repousos (14/04 e 21/04)", () => {
    const c = calendarioMes(2017, 4, PADRAO);
    expect(c.uteis).toBe(23);
    expect(c.rep).toBe(7);
    expect(c.feriados.map((f) => f.data)).toEqual(["2017-04-14", "2017-04-21"]);
  });
  it("mai/2017 → 26 úteis e 5 repousos", () => {
    const c = calendarioMes(2017, 5, PADRAO);
    expect(c.uteis).toBe(26);
    expect(c.rep).toBe(5);
  });
});

describe("calendarioMes — detalhes", () => {
  it("separa seg-sex e sábados úteis; DSR% = rep ÷ úteis", () => {
    const c = calendarioMes(2017, 5, PADRAO);
    expect(c.dias).toBe(31);
    expect(c.seg + c.sab).toBe(26);
    expect(c.sab).toBe(4);
    expect(c.dsrPct).toBeCloseTo((5 / 26) * 100, 10);
  });

  it("feriado em domingo conta uma vez só (como domingo)", () => {
    // 21/04/2019 foi domingo
    const c = calendarioMes(2019, 4, PADRAO);
    expect(c.feriadosUteis).toBe(1); // só a Sexta-feira Santa (19/04)
  });

  it("feriado municipal soma aos nacionais", () => {
    const sem = calendarioMes(2024, 6, PADRAO);
    const com = calendarioMes(2024, 6, PADRAO, [{ data: "2024-06-24", nome: "Municipal" }]);
    expect(com.rep).toBe(sem.rep + 1);
    expect(com.uteis).toBe(sem.uteis - 1);
  });

  it("feriado municipal repetido com nacional não conta duas vezes", () => {
    const sem = calendarioMes(2024, 9, PADRAO);
    const com = calendarioMes(2024, 9, PADRAO, [{ data: "2024-09-07", nome: "Repetido" }]);
    expect(com.rep).toBe(sem.rep);
  });

  it("rejeita mês fora de 1 a 12", () => {
    expect(() => calendarioMes(2024, 0, PADRAO)).toThrow(/1 a 12/);
  });
});

describe("diasEDsr", () => {
  const mai17 = calendarioMes(2017, 5, PADRAO);

  it("modo calendário: dias = seg-sex; DSR do calendário", () => {
    const r = diasEDsr(mai17, {
      modoDias: "calendario",
      sabadoTrabalhado: false,
      diasFixos: 22,
      dsrFixoPct: 20,
    });
    expect(r.diasTrabalhados).toBe(mai17.seg);
    expect(r.dsr).toBeCloseTo(5 / 26, 12);
  });

  it("sábado trabalhado soma os sábados úteis", () => {
    const r = diasEDsr(mai17, {
      modoDias: "calendario",
      sabadoTrabalhado: true,
      diasFixos: 22,
      dsrFixoPct: 20,
    });
    expect(r.diasTrabalhados).toBe(26);
  });

  it("modo fixo usa dias e DSR da tabela (percentual 0–100 vira fração)", () => {
    const r = diasEDsr(mai17, {
      modoDias: "fixo",
      sabadoTrabalhado: false,
      diasFixos: 22,
      dsrFixoPct: 20,
    });
    expect(r).toEqual({ diasTrabalhados: 22, dsr: 0.2 });
  });
});
