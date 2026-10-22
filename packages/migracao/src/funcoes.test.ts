import { describe, expect, it } from "vitest";
import { funcaoDoHistorico } from "./funcoes";

const vazio = new Map<string, string>();
const id = (texto: string, classe = "") => funcaoDoHistorico(texto, classe, vazio, vazio).id;

describe("função da planilha histórica → função do ITO", () => {
  it("variações vão para a função existente", () => {
    expect(id('PEDREIRO "A"')).toBe("ped");
    expect(id("PEDREIRO2")).toBe("ped");
    expect(id("MEIO OFICIAL")).toBe("ped");
    expect(id("CARPINTEIRO II")).toBe("carp");
    expect(id("ENCARREGADO TERRAPLANAGEM")).toBe("encar");
    expect(id("SUB ENC ALMOXARIFE")).toBe("almox");
    expect(id("VIGIA _NOITE")).toBe("vigia");
    expect(id("TECNICOM EM SEGURANCA TRABALHO")).toBe("tecseg");
    expect(id("TEC SEGURANÇA")).toBe("tecseg");
    expect(id("TECNICO EM EDIFICAÇÕES")).toBe("auxeng");
    expect(id("ASSISTENTE ENGENHARIA")).toBe("auxeng");
    expect(id("ESTAGIÁRIA TEC SEG TRABALHO")).toBe("estag");
    expect(id("AUX. ADMINISTRATIVO")).toBe("admin");
  });

  it("funções fora das 14 viram as novas", () => {
    expect(id("ENGENHEIRO TRAINE")).toBe("eng");
    expect(id("GERENTE ADMINSITRATIVA")).toBe("geradm");
    expect(id("AUXILIAR DE COMPRAS")).toBe("compr");
    expect(id("ASSISTENTE DE PESSOAL")).toBe("rh");
    expect(id("ANALISTA RH")).toBe("rh");
    expect(id("OPERADOR  DE BETONEIRA")).toBe("opbet");
    expect(id('SERRALHEIRO "B"')).toBe("serralh");
    expect(id("AUXILIAR DE TOPOGRAFIA")).toBe("topog");
    expect(id("TECNICO ENF. DO TRABALHO")).toBe("tecenf");
    expect(id("AUX DE SERVICOS GERAIS")).toBe("auxger");
    expect(id("SUPERVISOR DE OBRAS")).toBe("superv");
  });

  it("sem pista no texto: a classe desempata; sem nada, 'outras'", () => {
    expect(id("SEM FUNÇÃO ESPECIFICA", "SERVENTE")).toBe("serv");
    expect(id("PROGRAMAS MEDICOS", "N/A")).toBe("outras");
  });

  it("tabela revisada e sinônimo cadastrado mandam sobre as regras", () => {
    const tabela = new Map([["PEDREIRO B", "carp"]]);
    const sin = new Map([["MEIO OFICIAL", "serv"]]);
    expect(funcaoDoHistorico("pedreiro b", "", tabela, sin)).toEqual({
      id: "carp",
      origem: "tabela",
    });
    expect(funcaoDoHistorico("MEIO OFICIAL", "", tabela, sin)).toEqual({
      id: "serv",
      origem: "sinonimo",
    });
  });
});
