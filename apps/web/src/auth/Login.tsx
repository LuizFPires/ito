import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { supabase } from "../lib/supabase";
import { Botao } from "../ui/componentes";
import { Marca } from "../shell/Marca";
import { useSessao } from "./sessao";
import s from "./Login.module.css";
import { mensagemDeErro } from "./mensagens";

export function Login() {
  const { sessao } = useSessao();
  const local = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const de = (local.state as { de?: unknown } | null)?.de;
  // Só caminhos internos ("/x", nunca "//host").
  const destino = typeof de === "string" && /^\/(?!\/)/.test(de) ? de : "/base";
  if (sessao) return <Navigate to={destino} replace />;

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro("Informe o e-mail e a senha.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setEnviando(false);
    if (error) setErro(mensagemDeErro(error.code, error.message));
  }

  async function esqueci() {
    if (!email.trim()) {
      setErro("Informe o e-mail para receber o link de nova senha.");
      return;
    }
    setErro(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    if (error) setErro(mensagemDeErro(error.code, error.message));
    // mesma resposta para e-mail cadastrado ou não (não revela quem tem conta)
    else
      setAviso(
        "Se o e-mail tiver acesso ao ITO, chega um link para definir a senha (vale por 1 hora).",
      );
  }

  return (
    <main className={s.pagina}>
      <form className={s.cartao} onSubmit={entrar} noValidate>
        <Marca />
        <div>
          <p className="rotulo">Histórico de mão de obra</p>
          <h1 className={s.titulo}>Entrar no ITO</h1>
        </div>
        <label className={s.campo}>
          E-mail
          <input
            className={s.input}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label className={s.campo}>
          Senha
          <input
            className={s.input}
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {erro && (
          <p className={s.erro} role="alert">
            {erro}
          </p>
        )}
        <Botao variante="primario" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Botao>
        {aviso && (
          <p className="sub" role="status">
            {aviso}
          </p>
        )}
        <Botao variante="fantasma" pequeno onClick={() => void esqueci()}>
          Esqueci a senha
        </Botao>
        <p className="sub">O acesso é por convite. Sem conta? Fale com a controladoria.</p>
      </form>
    </main>
  );
}
