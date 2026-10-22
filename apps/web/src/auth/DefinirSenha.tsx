import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { Marca } from "../shell/Marca";
import { Botao } from "../ui/componentes";
import s from "./Login.module.css";
import { mensagemDeErro } from "./mensagens";
import { useSessao } from "./sessao";

/** Quem chega pelo link do convite (M10) define a senha e entra. */
export function DefinirSenha() {
  const { sessao } = useSessao();
  const navegar = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = "Definir senha · ITO";
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro("Use pelo menos 8 caracteres.");
    if (senha !== confirma) return setErro("As duas senhas não são iguais. Digite de novo.");
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemDeErro(error.code, error.message));
    navegar("/base", { replace: true });
  }

  return (
    <main className={s.pagina}>
      <form className={s.cartao} onSubmit={salvar} noValidate>
        <Marca />
        <div>
          <p className="rotulo">Primeiro acesso</p>
          <h1 className={s.titulo}>Definir senha</h1>
        </div>
        {sessao === undefined ? (
          <p className="sub">Conferindo o convite…</p>
        ) : !sessao ? (
          <p className="sub" role="alert">
            O link do convite expirou ou já foi usado. Peça a um administrador para reenviar o
            convite.
          </p>
        ) : (
          <>
            <p className="sub">{sessao.user.email}</p>
            <label className={s.campo}>
              Nova senha
              <input
                className={s.input}
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoFocus
              />
            </label>
            <label className={s.campo}>
              Confirme a senha
              <input
                className={s.input}
                type="password"
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
              />
            </label>
            {erro && (
              <p className={s.erro} role="alert">
                {erro}
              </p>
            )}
            <Botao variante="primario" type="submit" disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar e entrar"}
            </Botao>
          </>
        )}
      </form>
    </main>
  );
}
