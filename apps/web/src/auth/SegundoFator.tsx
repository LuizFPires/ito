import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Marca } from "../shell/Marca";
import { Botao } from "../ui/componentes";
import s from "./Login.module.css";
import { useSessao } from "./sessao";

type Estado =
  | { modo: "carregando" }
  | { modo: "inscrever"; fator: string; qr: string; segredo: string }
  | { modo: "codigo"; fator: string }
  | { modo: "erro"; mensagem: string };

/**
 * Segundo fator (M13): administrador, controladoria e diretoria só entram no ITO com o código do
 * aplicativo autenticador. Na primeira vez, a pessoa lê o QR code e confirma um código; depois,
 * só o código. Sem isso, o banco não libera nada para a conta (RLS exige AAL2).
 */
export function SegundoFator() {
  const { sair } = useSessao();
  const [estado, setEstado] = useState<Estado>({ modo: "carregando" });
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const iniciado = useRef(false);

  useEffect(() => {
    // uma inscrição por tela (o StrictMode roda o efeito duas vezes)
    if (iniciado.current) return;
    iniciado.current = true;
    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setEstado({ modo: "erro", mensagem: "Não foi possível falar com o login. Tente de novo." });
        return;
      }
      const verificado = data.totp.find((f) => f.status === "verified");
      if (verificado) {
        setEstado({ modo: "codigo", fator: verificado.id });
        return;
      }
      // inscrição deixada pela metade: recomeça do zero
      for (const f of data.all.filter((x) => x.status === "unverified"))
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      const novo = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `ITO ${new Date().toISOString().slice(0, 10)}`,
      });
      if (novo.error) {
        setEstado({ modo: "erro", mensagem: "Não foi possível gerar o QR code. Tente de novo." });
        return;
      }
      setEstado({
        modo: "inscrever",
        fator: novo.data.id,
        qr: novo.data.totp.qr_code,
        segredo: novo.data.totp.secret,
      });
    })();
  }, []);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (estado.modo !== "inscrever" && estado.modo !== "codigo") return;
    const c = codigo.replace(/\D/g, "");
    if (c.length !== 6) {
      setErro("Digite os 6 números que aparecem no aplicativo.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: estado.fator,
      code: c,
    });
    setEnviando(false);
    // com o código certo, a sessão vira AAL2 e o ITO abre sozinho
    if (error) setErro("Código incorreto ou vencido. Digite o código que está aparecendo agora.");
  }

  return (
    <main className={s.pagina}>
      <form className={s.cartao} onSubmit={confirmar} noValidate aria-label="Segundo fator">
        <Marca />
        <h1 className={s.titulo}>
          {estado.modo === "inscrever" ? "Ative o segundo fator" : "Código de acesso"}
        </h1>
        {estado.modo === "carregando" && <p className="sub">Carregando…</p>}
        {estado.modo === "erro" && (
          <p className={s.erro} role="alert">
            {estado.mensagem}
          </p>
        )}
        {estado.modo === "inscrever" && (
          <>
            <p className="sub">
              Sua conta administra ou aprova no ITO e precisa de um código além da senha. Abra um
              aplicativo autenticador (Google Authenticator, Microsoft Authenticator…), leia o QR
              code e digite o código de 6 números.
            </p>
            <img
              src={estado.qr}
              alt="QR code para o aplicativo autenticador"
              width={180}
              height={180}
              style={{ alignSelf: "center", background: "#fff", borderRadius: 12, padding: 8 }}
            />
            <p className="sub">
              Sem câmera? Digite esta chave no aplicativo:{" "}
              <code data-segredo style={{ userSelect: "all", wordBreak: "break-all" }}>
                {estado.segredo}
              </code>
            </p>
          </>
        )}
        {estado.modo === "codigo" && (
          <p className="sub">Digite o código de 6 números do seu aplicativo autenticador.</p>
        )}
        {(estado.modo === "inscrever" || estado.modo === "codigo") && (
          <>
            <label className={s.campo}>
              Código do aplicativo
              <input
                className={s.input}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                autoFocus
              />
            </label>
            {erro && (
              <p className={s.erro} role="alert">
                {erro}
              </p>
            )}
            <Botao variante="primario" type="submit" disabled={enviando}>
              {enviando ? "Conferindo…" : "Entrar"}
            </Botao>
          </>
        )}
        <Botao variante="fantasma" type="button" onClick={() => void sair()}>
          Sair
        </Botao>
        <p className="sub">
          Perdeu o celular? Peça a um administrador para zerar o seu segundo fator.
        </p>
      </form>
    </main>
  );
}
