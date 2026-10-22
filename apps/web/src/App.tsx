import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Login } from "./auth/Login";
import { Protegida } from "./auth/Protegida";
import { SessaoProvider } from "./auth/sessao";
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
};

// O shell e as telas carregam sob demanda: a tela de login fica leve.
const router = createBrowserRouter([
  { path: "/entrar", element: <Login /> },
  {
    path: "/",
    hydrateFallbackElement: null,
    element: (
      <Protegida>
        <ShellPreguicoso />
      </Protegida>
    ),
    children: [
      { index: true, element: <Navigate to="/base" replace /> },
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
        lazy: async () => ({ Component: (await import("./paginas/telas")).TelaObra }),
      },
      {
        path: "projecoes/:id",
        lazy: async () => ({ Component: (await import("./paginas/telas")).TelaProjecao }),
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
