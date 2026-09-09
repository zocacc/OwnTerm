import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Backend,
  Host,
  HostGroup,
  SaveHostRequest,
  ImportPreview,
  ImportAction,
} from "../services/backend";
import { Button } from "./ui/button";

type Props = {
  backend: Backend;
  onOpenLocal: () => void;
  refreshToken?: number;
  onRequestConnection: (target: {
    hostId?: string;
    destination?: string;
  }) => void;
};

const emptyDraft: SaveHostRequest = {
  name: "",
  address: "",
  port: 22,
  username: "",
  groupId: undefined,
  tags: [],
  favorite: false,
  authKind: "password",
};

export function HostsWorkspace({
  backend,
  onOpenLocal,
  onRequestConnection,
  refreshToken,
}: Props) {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [groups, setGroups] = useState<HostGroup[]>([]);
  const [recentHosts, setRecentHosts] = useState<Host[]>([]);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [quickConnect, setQuickConnect] = useState("");
  const [draft, setDraft] = useState<SaveHostRequest>();
  const [newGroup, setNewGroup] = useState("");
  const [error, setError] = useState<string>();
  const [portability, setPortability] = useState<{
    source: "openssh" | "workspace";
    content: string;
    preview?: ImportPreview;
    actions: ImportAction[];
    result?: string;
  }>();
  const passwordInput = useRef<HTMLInputElement>(null);
  const passphraseInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!backend.listHosts || !backend.listHostGroups) return;
    try {
      const [nextHosts, nextGroups, nextRecent] = await Promise.all([
        backend.listHosts(search || undefined),
        backend.listHostGroups(),
        backend.listRecentHosts?.(8) ?? Promise.resolve([]),
      ]);
      setHosts(nextHosts);
      setGroups(nextGroups);
      setRecentHosts(nextRecent);
      setError(undefined);
    } catch {
      setError("Não foi possível carregar os Hosts.");
    }
  }, [backend, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 120);
    return () => window.clearTimeout(timer);
  }, [reload, refreshToken]);

  const visibleHosts = useMemo(
    () => hosts.filter((host) => !favoritesOnly || host.favorite),
    [favoritesOnly, hosts],
  );

  async function saveHost() {
    if (!draft || !backend.saveHost) return;
    try {
      const password = passwordInput.current?.value;
      const passphrase = passphraseInput.current?.value;
      await backend.saveHost({
        ...draft,
        password: password || undefined,
        passphrase: passphrase || undefined,
      });
      setDraft(undefined);
      await reload();
    } catch (reason) {
      setError(`Não foi possível salvar o Host: ${String(reason)}`);
    }
  }

  async function removeHost(host: Host) {
    if (
      !backend.deleteHost ||
      !window.confirm(`Excluir o Host “${host.name}”?`)
    )
      return;
    await backend.deleteHost(host.id);
    await reload();
  }

  async function toggleFavorite(host: Host) {
    if (!backend.saveHost) return;
    await backend.saveHost({
      id: host.id,
      name: host.name,
      address: host.address,
      port: host.port,
      username: host.username,
      groupId: host.groupId,
      tags: host.tags,
      favorite: !host.favorite,
    });
    await reload();
  }

  async function addGroup() {
    if (!newGroup.trim() || !backend.saveHostGroup) return;
    await backend.saveHostGroup({ name: newGroup, sortOrder: groups.length });
    setNewGroup("");
    await reload();
  }

  async function renameGroup(group: HostGroup) {
    if (!backend.saveHostGroup) return;
    const name = window.prompt("Nome do grupo", group.name)?.trim();
    if (!name || name === group.name) return;
    await backend.saveHostGroup({
      id: group.id,
      name,
      sortOrder: group.sortOrder,
    });
    await reload();
  }

  async function removeGroup(group: HostGroup) {
    if (!backend.deleteHostGroup) return;
    const confirmed = window.confirm(
      `Excluir o grupo “”? Hosts associados serão movidos para Sem grupo.`,
    );
    if (!confirmed) return;
    await backend.deleteHostGroup(group.id, true);
    await reload();
  }

  const edit = (host: Host) =>
    setDraft({
      id: host.id,
      name: host.name,
      address: host.address,
      port: host.port,
      username: host.username,
      groupId: host.groupId,
      tags: host.tags,
      favorite: host.favorite,
      authKind: host.authKind === "agent" ? "none" : host.authKind,
      privateKeyPath: host.privateKeyPath,
    });

  async function previewPortability() {
    if (!portability?.content.trim() || !backend.previewImport) return;
    try {
      const preview = await backend.previewImport(
        portability.source,
        portability.content,
      );
      setPortability({
        ...portability,
        preview,
        actions: preview.entries.map((entry) => entry.defaultAction),
        result: undefined,
      });
      setError(undefined);
    } catch (reason) {
      setError(`Não foi possível analisar a importação: ${String(reason)}`);
    }
  }

  async function applyPortability() {
    if (!portability?.preview || !backend.applyImport) return;
    try {
      const result = await backend.applyImport(
        portability.preview.groups,
        portability.preview.entries.map((entry, index) => ({
          host: entry.host,
          action: portability.actions[index] ?? entry.defaultAction,
        })),
      );
      setPortability({
        ...portability,
        result: `${result.applied} Host(s) importado(s).${result.credentialsToConfigure ? ` Configure credenciais para ${result.credentialsToConfigure} Host(s).` : ""}`,
      });
      await reload();
    } catch (reason) {
      setError(`Não foi possível aplicar a importação: ${String(reason)}`);
    }
  }

  async function exportPortability() {
    if (!backend.exportWorkspace) return;
    try {
      const content = await backend.exportWorkspace();
      setPortability({
        source: "workspace",
        content,
        actions: [],
        result: "Exportação pronta para copiar e salvar como JSON.",
      });
    } catch (reason) {
      setError(`Não foi possível exportar os Hosts: ${String(reason)}`);
    }
  }

  const rows = (items: Host[]) =>
    items.map((host) => (
      <div
        className="host-row"
        key={host.id}
        onDoubleClick={() => onRequestConnection({ hostId: host.id })}
      >
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => onRequestConnection({ hostId: host.id })}
          type="button"
        >
          <span className="block truncate text-xs font-medium">
            {host.name}
          </span>
          <span className="block truncate text-[11px] text-[var(--muted-foreground)]">
            {host.username ? `${host.username}@` : ""}
            {host.address}:{host.port}
          </span>
        </button>
        <button
          aria-label={`${host.favorite ? "Remover" : "Adicionar"} ${host.name} dos favoritos`}
          onClick={() => void toggleFavorite(host)}
          type="button"
        >
          {host.favorite ? "★" : "☆"}
        </button>
        <button
          aria-label={`Editar ${host.name}`}
          onClick={() => edit(host)}
          type="button"
        >
          ✎
        </button>
        <button
          aria-label={`Excluir ${host.name}`}
          onClick={() => void removeHost(host)}
          type="button"
        >
          ×
        </button>
      </div>
    ));

  return (
    <aside
      aria-label="Hosts"
      className="flex w-80 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="border-b border-[var(--border)] p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">
            Hosts
          </h2>
          <div className="flex gap-1">
            <button
              className="px-1 text-xs text-[var(--muted-foreground)]"
              onClick={() =>
                setPortability({ source: "openssh", content: "", actions: [] })
              }
              type="button"
            >
              Importar
            </button>
            <button
              className="px-1 text-xs text-[var(--muted-foreground)]"
              onClick={() => void exportPortability()}
              type="button"
            >
              Exportar
            </button>
            <Button
              className="h-7 px-2 text-xs"
              onClick={() => setDraft({ ...emptyDraft })}
            >
              Novo
            </Button>
          </div>
        </div>
        <input
          aria-label="Buscar Hosts"
          className="field"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar nome, endereço, usuário, grupo ou tag"
          value={search}
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <input
            checked={favoritesOnly}
            onChange={(event) => setFavoritesOnly(event.target.checked)}
            type="checkbox"
          />{" "}
          Somente favoritos
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {recentHosts.length > 0 ? (
          <section className="mb-3" aria-label="Hosts recentes">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Recentes
            </div>
            {rows(recentHosts)}
          </section>
        ) : null}
        {groups.map((group) => (
          <section className="mb-3" key={group.id}>
            <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <span>{group.name}</span>
              <div className="flex gap-2">
                <button
                  aria-label={"Renomear grupo " + group.name}
                  onClick={() => void renameGroup(group)}
                  type="button"
                >
                  ✎
                </button>
                <button
                  aria-label={"Excluir grupo " + group.name}
                  onClick={() => void removeGroup(group)}
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>
            {rows(visibleHosts.filter((host) => host.groupId === group.id))}
          </section>
        ))}
        <section>
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Sem grupo
          </div>
          {rows(visibleHosts.filter((host) => !host.groupId))}
        </section>
        {visibleHosts.length === 0 ? (
          <div className="m-2 rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted-foreground)]">
            <p>Nenhum Host cadastrado.</p>
            <button
              className="mt-2 text-[var(--primary)]"
              onClick={onOpenLocal}
              type="button"
            >
              Ignorar importação e abrir shell local
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="p-2 text-xs text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="border-t border-[var(--border)] p-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (quickConnect.trim())
              onRequestConnection({ destination: quickConnect.trim() });
          }}
        >
          <input
            aria-label="Quick Connect"
            className="field"
            onChange={(event) => setQuickConnect(event.target.value)}
            placeholder="usuário@host:porta"
            value={quickConnect}
          />
          <Button className="h-8 px-2 text-xs" type="submit">
            Conectar
          </Button>
        </form>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void addGroup();
          }}
        >
          <input
            aria-label="Novo grupo"
            className="field"
            onChange={(event) => setNewGroup(event.target.value)}
            placeholder="Novo grupo"
            value={newGroup}
          />
          <button className="px-2 text-[var(--primary)]" type="submit">
            +
          </button>
        </form>
      </div>
      {draft ? (
        <div className="dialog-backdrop" role="presentation">
          <form
            aria-label="Formulário de Host"
            className="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void saveHost();
            }}
          >
            <h3 className="mb-4 font-semibold">
              {draft.id ? "Editar Host" : "Novo Host"}
            </h3>
            <label>
              Nome
              <input
                className="field"
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              Endereço
              <input
                className="field"
                required
                value={draft.address}
                onChange={(event) =>
                  setDraft({ ...draft, address: event.target.value })
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                Usuário
                <input
                  className="field"
                  value={draft.username ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, username: event.target.value })
                  }
                />
              </label>
              <label>
                Porta
                <input
                  className="field"
                  max="65535"
                  min="1"
                  required
                  type="number"
                  value={draft.port}
                  onChange={(event) =>
                    setDraft({ ...draft, port: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Grupo
              <select
                className="field"
                value={draft.groupId ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    groupId: event.target.value || undefined,
                  })
                }
              >
                <option value="">Sem grupo</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tags
              <input
                className="field"
                placeholder="produção, linux"
                value={draft.tags.join(", ")}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Autenticação
              <select
                className="field"
                value={draft.authKind ?? "password"}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    authKind: event.target.value as
                      "password" | "private_key" | "none",
                  })
                }
              >
                <option value="password">Senha</option>
                <option value="private_key">Chave privada</option>
                <option value="none">Sem credencial</option>
              </select>
            </label>
            {(draft.authKind ?? "password") === "password" ? (
              <label>
                Senha{draft.id ? " (deixe vazia para manter)" : ""}
                <input
                  autoComplete="new-password"
                  className="field"
                  type="password"
                  defaultValue=""
                  ref={passwordInput}
                />
              </label>
            ) : null}
            {draft.authKind === "private_key" ? (
              <>
                <label>
                  Caminho da chave privada
                  <input
                    className="field"
                    required
                    value={draft.privateKeyPath ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, privateKeyPath: event.target.value })
                    }
                  />
                </label>
                <label>
                  Frase secreta{draft.id ? " (deixe vazia para manter)" : ""}
                  <input
                    autoComplete="new-password"
                    className="field"
                    type="password"
                    defaultValue=""
                    ref={passphraseInput}
                  />
                </label>
              </>
            ) : null}
            <label className="flex-row items-center">
              <input
                checked={draft.favorite}
                onChange={(event) =>
                  setDraft({ ...draft, favorite: event.target.checked })
                }
                type="checkbox"
              />{" "}
              Favorito
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDraft(undefined)} type="button">
                Cancelar
              </button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </div>
      ) : null}
      {portability ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-label="Importar ou exportar Hosts" className="dialog">
            <h3 className="mb-3 font-semibold">Importar ou exportar Hosts</h3>
            <label>
              Formato
              <select
                className="field"
                disabled={Boolean(portability.result?.startsWith("Exportação"))}
                onChange={(event) =>
                  setPortability({
                    ...portability,
                    source: event.target.value as "openssh" | "workspace",
                    preview: undefined,
                    actions: [],
                    result: undefined,
                  })
                }
                value={portability.source}
              >
                <option value="openssh">OpenSSH config</option>
                <option value="workspace">OwnTerm JSON</option>
              </select>
            </label>
            <label>
              Conteúdo
              <textarea
                className="field min-h-36 font-mono text-xs"
                onChange={(event) =>
                  setPortability({
                    ...portability,
                    content: event.target.value,
                    preview: undefined,
                    actions: [],
                    result: undefined,
                  })
                }
                readOnly={Boolean(portability.result?.startsWith("Exportação"))}
                value={portability.content}
              />
            </label>
            {portability.preview?.entries.map((entry, index) => (
              <div
                className="mt-2 flex items-center gap-2 text-xs"
                key={entry.host.name}
              >
                <span className="min-w-0 flex-1 truncate">
                  {entry.host.name} ({entry.host.address}:{entry.host.port})
                  {entry.conflict ? " — já existe" : ""}
                </span>
                <select
                  aria-label={`Ação para ${entry.host.name}`}
                  className="field w-24"
                  onChange={(event) => {
                    const actions = [...portability.actions];
                    actions[index] = event.target.value as ImportAction;
                    setPortability({ ...portability, actions });
                  }}
                  value={portability.actions[index] ?? entry.defaultAction}
                >
                  <option value="create">Criar</option>
                  <option value="update">Atualizar</option>
                  <option value="skip">Pular</option>
                </select>
              </div>
            ))}
            {portability.preview?.ignored.length ? (
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                {portability.preview.ignored.length} diretiva(s) ignorada(s):{" "}
                {portability.preview.ignored
                  .map((item) => item.directive)
                  .join(", ")}
              </p>
            ) : null}
            {portability.result ? (
              <p className="mt-3 text-xs" role="status">
                {portability.result}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPortability(undefined)} type="button">
                Fechar
              </button>
              {!portability.result?.startsWith("Exportação") ? (
                <>
                  <button
                    onClick={() => void previewPortability()}
                    type="button"
                  >
                    Analisar
                  </button>
                  <Button
                    disabled={!portability.preview}
                    onClick={() => void applyPortability()}
                    type="button"
                  >
                    Aplicar seleção
                  </Button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
