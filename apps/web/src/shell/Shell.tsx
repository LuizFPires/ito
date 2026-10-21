import { Fragment } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Badge } from "../ui/componentes";
import { BuscaGlobal } from "./BuscaGlobal";
import { Icone } from "./Icone";
import { Marca } from "./Marca";
import { MenuUsuario } from "./MenuUsuario";
import { GRUPOS, itemAtivo, MENU } from "./rotas";
import s from "./Shell.module.css";

const AMBIENTE = (import.meta.env.VITE_AMBIENTE as string | undefined) ?? "desenvolvimento";

export function Shell() {
  const { pathname } = useLocation();
  const ativo = itemAtivo(pathname);

  return (
    <div className={s.app}>
      <div className={s.shell}>
        <nav className={s.lateral} aria-label="Menu">
          <Marca />
          {GRUPOS.map((g) => (
            <Fragment key={g}>
              <div className={s.grupo}>{g}</div>
              {MENU.filter((d) => d.grupo === g).map((d) => (
                <Link
                  key={d.caminho}
                  to={d.caminho}
                  className={s.item}
                  aria-current={ativo === d.caminho ? "page" : undefined}
                >
                  <Icone nome={d.icone} />
                  {d.nome}
                </Link>
              ))}
            </Fragment>
          ))}
          <div className={s.rodape}>
            {AMBIENTE !== "producao" && <Badge tom="ambar">{AMBIENTE}</Badge>}
            <Badge tom="escuro">Versão 0.1</Badge>
          </div>
        </nav>
        <div className={s.principal}>
          <header className={s.topo}>
            <BuscaGlobal />
            <span className={s.espaco} />
            <MenuUsuario />
          </header>
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
