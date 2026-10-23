import { Fragment } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useSessao } from "../auth/sessao";
import { Badge } from "../ui/componentes";
import { BuscaGlobal } from "./BuscaGlobal";
import { Icone } from "./Icone";
import { Marca } from "./Marca";
import { MenuUsuario } from "./MenuUsuario";
import { useMenuRecolhido } from "./recolher";
import { GRUPOS, itemAtivo, menuDe } from "./rotas";
import s from "./Shell.module.css";

const AMBIENTES: Record<string, string> = {
  desenvolvimento: "Desenvolvimento",
  homologacao: "Homologação",
  producao: "Produção",
};
const AMBIENTE = (import.meta.env.VITE_AMBIENTE as string | undefined) ?? "desenvolvimento";

export function Shell() {
  const { pathname } = useLocation();
  const ativo = itemAtivo(pathname);
  const { erroUsuario, usuario } = useSessao();
  const menu = menuDe(usuario);
  const { recolhido, alternar } = useMenuRecolhido();

  return (
    <div className={s.app}>
      <div className={s.shell} data-recolhido={recolhido || undefined}>
        <nav className={s.lateral} aria-label="Menu">
          <div className={s.lateralTopo}>
            <Marca />
            <button
              type="button"
              className={s.recolher}
              aria-expanded={!recolhido}
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
              title={recolhido ? "Expandir menu" : "Recolher menu"}
              onClick={alternar}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d={recolhido ? "M6 3.5L10.5 8 6 12.5" : "M10 3.5L5.5 8 10 12.5"} />
              </svg>
            </button>
          </div>
          {GRUPOS.filter((g) => menu.some((d) => d.grupo === g)).map((g) => (
            <Fragment key={g}>
              <div className={s.grupo}>{g}</div>
              {menu
                .filter((d) => d.grupo === g)
                .map((d) => (
                  <Link
                    key={d.caminho}
                    to={d.caminho}
                    className={s.item}
                    aria-current={ativo === d.caminho ? "page" : undefined}
                    // recolhido: o nome aparece ao passar o mouse (e continua para o leitor de tela)
                    title={recolhido ? d.nome : undefined}
                  >
                    <Icone nome={d.icone} />
                    <span className={s.nomeItem}>{d.nome}</span>
                  </Link>
                ))}
            </Fragment>
          ))}
          <div className={s.rodape}>
            {AMBIENTE !== "producao" && (
              <Badge tom="ambar">{AMBIENTES[AMBIENTE] ?? AMBIENTE}</Badge>
            )}
            <Badge tom="escuro">Versão 0.1</Badge>
          </div>
        </nav>
        <div className={s.principal}>
          <header className={s.topo}>
            <BuscaGlobal />
            <span className={s.espaco} />
            <MenuUsuario />
          </header>
          {usuario && !usuario.ativo && (
            <p className={s.alerta} role="alert">
              Seu acesso ao ITO foi desativado. Fale com um administrador.
            </p>
          )}
          {erroUsuario && (
            <p className={s.alerta} role="alert">
              Seu cadastro no ITO está incompleto. Peça a um administrador para conferir o seu
              perfil.
            </p>
          )}
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
