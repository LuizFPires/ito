import "./estilo/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { recarregarUmaVez } from "./ui/versao";
import { aplicarTema, temaSalvo } from "./ui/tema";

// Antes do primeiro render, para o login e o carregamento não piscarem no tema errado.
aplicarTema(temaSalvo());

// arquivo da versão anterior que não existe mais (depois de uma publicação): recarrega uma vez
window.addEventListener("vite:preloadError", (ev) => {
  if (recarregarUmaVez()) ev.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
