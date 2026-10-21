import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Login } from "./auth/Login";
import { Protegida } from "./auth/Protegida";
import { SessaoProvider, useSessao } from "./auth/sessao";
import { ToastProvider } from "./ui/toast";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Inicio() {
  const { usuario, sair } = useSessao();
  return (
    <main style={{ padding: 24 }}>
      <p>Olá, {usuario?.email}</p>
      <button onClick={() => void sair()}>Sair</button>
    </main>
  );
}

const router = createBrowserRouter([
  { path: "/entrar", element: <Login /> },
  {
    path: "/",
    element: (
      <Protegida>
        <Inicio />
      </Protegida>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

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
