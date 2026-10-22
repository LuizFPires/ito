import "./estilo/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { aplicarTema, temaSalvo } from "./ui/tema";

// Antes do primeiro render, para o login e o carregamento não piscarem no tema errado.
aplicarTema(temaSalvo());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
