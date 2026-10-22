import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Login } from "./auth/Login";
import { Protegida } from "./auth/Protegida";
import { SessaoProvider } from "./auth/sessao";
import { veioDoConvite } from "./lib/supabase";
import { MENU } from "./shell/rotas";
import { ToastProvider } from "./ui/toast";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// Telas que já têm conteúdo; as demais mostram "chega no Mx".
const TELAS: Record<string, () => Promise<{ Component: () => React.ReactNode }>> = {
  "/funcoes": async () => ({ Component: (await import("./paginas/Funcoes")).TelaFuncoes }),
  "/rubricas": async () => ({ Component: (await import("./paginas/Rubricas")).TelaRubricas }),
  "/cidades": async () => ({
    Component: (await import("./paginas/cidades/TelaCidades")).TelaCidades,
  }),
  "/parametros": async () => ({
    Component: (await import("./paginas/Parametros")).TelaParametros,
  }),
  "/base": async () => ({
    Component: (await import("./paginas/base/TelaBase")).TelaBase,
  }),
  "/comparar": async () => ({
    Component: (await import("./paginas/comparar/TelaComparar")).TelaComparar,
  }),
  "/projecoes": async () => ({
    Component: (await import("./paginas/projecoes/TelaProjecoes")).TelaProjecoes,
  }),
  "/auditoria": async () => ({
    Component: (await import("./paginas/Auditoria")).TelaAuditoria,
  }),
  "/usuarios": async () => ({
    Component: (await import("./paginas/Usuarios")).TelaUsuarios,
  }),
  "/carga": async () => ({
    Component: (await import("./paginas/carga/TelaCarga")).TelaCarga,
  }),
};

// O shell e as telas carregam sob demanda: a tela de login fica leve.
const router = createBrowserRouter([
  { path: "/entrar", element: <Login /> },
  // link do convite (M10): a sessão vem no endereço; a pessoa define a senha
  {
    path: "/definir-senha",
    hydrateFallbackElement: null,
    lazy: async () => ({ Component: (await import("./auth/DefinirSenha")).DefinirSenha }),
  },
  // resumo para imprimir (PDF): fora do shell, sem menu
  {
    path: "/projecoes/:id/imprimir",
    hydrateFallbackElement: null,
    lazy: async () => {
      const { ImprimirProjecao } = await import("./paginas/projecoes/ImprimirProjecao");
      return {
        element: (
          <Protegida>
            <ImprimirProjecao />
          </Protegida>
        ),
      };
    },
  },
  {
    path: "/",
    hydrateFallbackElement: null,
    element: (
      <Protegida>
        <ShellPreguicoso />
      </Protegida>
    ),
    children: [
      {
        index: true,
        element: <Navigate to={veioDoConvite ? "/definir-senha" : "/base"} replace />,
      },
      ...MENU.map((d) => ({
        path: d.caminho.slice(1),
        lazy:
          TELAS[d.caminho] ??
          (async () => {
            const { TelaDoMenu } = await import("./paginas/telas");
            return { element: <TelaDoMenu caminho={d.caminho} /> };
          }),
      })),
      {
        path: "obras/:id",
        lazy: async () => ({ Component: (await import("./paginas/obra/TelaObra")).TelaObra }),
      },
      {
        path: "projecoes/nova",
        lazy: async () => ({
          Component: (await import("./paginas/projecoes/Assistente")).TelaNovaProjecao,
        }),
      },
      {
        path: "projecoes/comparar",
        lazy: async () => ({
          Component: (await import("./paginas/projecoes/CompararProjecoes")).CompararProjecoes,
        }),
      },
      {
        path: "projecoes/:id",
        lazy: async () => ({
          Component: (await import("./paginas/projecoes/TelaProjecao")).TelaProjecao,
        }),
      },
      {
        path: "projecoes/:id/editar",
        lazy: async () => ({
          Component: (await import("./paginas/projecoes/Assistente")).TelaEditarProjecao,
        }),
      },
      { path: "*", element: <Navigate to="/base" replace /> },
    ],
  },
]);

const Shell = lazy(() => import("./shell/Shell").then((m) => ({ default: m.Shell })));
function ShellPreguicoso() {
  return (
    <Suspense fallback={null}>
      <Shell />
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessaoProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessaoProvider>
    </QueryClientProvider>
  );
}
