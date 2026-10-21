import { describe, expect, it } from "vitest";
import { VERSAO_MOTOR } from "./index";

describe("motor", () => {
  it("expõe a versão", () => {
    expect(VERSAO_MOTOR).toBe("0.0.0");
  });
});
