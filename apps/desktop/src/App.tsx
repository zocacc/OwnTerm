import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { defaultBackend, type AppInfo, type Backend } from "./services/backend";

type AppProps = {
  backend?: Backend;
};

function App({ backend = defaultBackend }: AppProps) {
  const [appInfo, setAppInfo] = useState<AppInfo>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void backend
      .appInfo()
      .then((info) => {
        if (active) {
          setAppInfo(info);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível iniciar o core do OwnTerm.");
        }
      });

    return () => {
      active = false;
    };
  }, [backend]);

  const coreStatus =
    error ??
    (appInfo ? appInfo.name + " " + appInfo.version : "Iniciando core…");

  return (
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
      <section className="mx-auto flex min-h-[420px] max-w-3xl flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl shadow-black/20">
        <div className="space-y-5">
          <p className="font-mono text-sm text-[var(--primary)]">
            OwnTerm / foundation
          </p>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Terminal local-first
            </h1>
            <p className="mt-3 max-w-xl text-[var(--muted-foreground)]">
              O scaffold desktop está conectado ao core Rust por um adapter
              Tauri mínimo, pronto para os próximos slices de Hosts e Sessions.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4 font-mono text-sm">
            {coreStatus}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm text-[var(--muted-foreground)]">
          <span>React + Vite + Tailwind + xterm.js + Tauri 2</span>
          <Button onClick={() => window.location.reload()} variant="secondary">
            Recarregar
          </Button>
        </div>
      </section>
    </main>
  );
}

export default App;
