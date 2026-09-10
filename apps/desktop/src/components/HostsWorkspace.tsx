import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Backend,
  Host,
  HostGroup,
  SaveHostRequest,
  ImportPreview,
  ImportAction,
} from "../services/backend";
import { Download, Plus, Star, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { useDialogFocus } from "./useDialogFocus";

type PortbilityDialogState = {
  mode: "import" | "export";
  source: "openssh" | "workspace";
  content: string;
  preview?: ImportPreview;
  actions: ImportAction[];
  result?: string;
};

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
  const [portability, setPortbility] = useState<PortbilityDialogState>();
  const searchInput = useRef<HTMLInputElement>(null);
  const quickConnectInput = useRef<HTMLInputElement>(null);
  const hostDialogRef = useDialogFocus<HTMLFormElement>(
    Boolean(draft),
    searchInput,
  );
  const portabilityDialogRef = useDialogFocus<HTMLElement>(
    Boolean(portability),
    searchInput,
  );
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
      setError("Could not load Hosts.");
    }
  }, [backend, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 120);
    return () => window.clearTimeout(timer);
  }, [reload, refreshToken]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        quickConnectInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      setError(`Could not save the Host: ${String(reason)}`);
    }
  }

  async function removeHost(host: Host) {
    if (!backend.deleteHost || !window.confirm(`Delete Host “${host.name}”?`))
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
    const name = window.prompt("Group name", group.name)?.trim();
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
      `Delete group “”? Associated Hosts will be moved to Ungrouped.`,
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

  async function previewPortbility() {
    if (!portability?.content.trim() || !backend.previewImport) return;
    try {
      const preview = await backend.previewImport(
        portability.source,
        portability.content,
      );
      setPortbility({
        ...portability,
        preview,
        actions: preview.entries.map((entry) => entry.defaultAction),
        result: undefined,
      });
      setError(undefined);
    } catch (reason) {
      setError(`Could not analyze the import: ${String(reason)}`);
    }
  }

  async function applyPortbility() {
    if (!portability?.preview || !backend.applyImport) return;
    try {
      const result = await backend.applyImport(
        portability.preview.groups,
        portability.preview.settings,
        portability.preview.entries.map((entry, index) => ({
          host: entry.host,
          action: portability.actions[index] ?? entry.defaultAction,
        })),
      );
      setPortbility({
        ...portability,
        result: `${result.applied} Host(s) imported.${result.credentialsToConfigure ? ` Configure credentials for ${result.credentialsToConfigure} Host(s).` : ""}`,
      });
      await reload();
    } catch (reason) {
      setError(`Could not apply the import: ${String(reason)}`);
    }
  }

  async function exportPortbility() {
    if (!backend.exportWorkspace) return;
    try {
      const content = await backend.exportWorkspace();
      setPortbility({
        mode: "export",
        source: "workspace",
        content,
        actions: [],
        result: "Export is ready to copy and save as JSON.",
      });
    } catch (reason) {
      setError(`Could not export Hosts: ${String(reason)}`);
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
          aria-label={`${host.favorite ? "Remove" : "Add"} ${host.name} to favorites`}
          onClick={() => void toggleFavorite(host)}
          type="button"
        >
          {host.favorite ? "★" : "☆"}
        </button>
        <button
          aria-label={`Edit ${host.name}`}
          onClick={() => edit(host)}
          type="button"
        >
          ✎
        </button>
        <button
          aria-label={`Delete ${host.name}`}
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
      className="flex w-72 shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--sidebar-surface)] backdrop-blur-xl"
    >
      <div className="border-b border-[var(--hairline)] px-3.5 pt-3.5 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--strong-foreground)]">
            <span className="grid size-5 place-items-center rounded-md bg-[var(--subtle-surface)] text-[var(--primary)]">
              <Star className="size-3" />
            </span>
            Connections
          </h2>
          <div className="flex items-center gap-1">
            <button
              className="control-ghost h-7 text-xs"
              onClick={() =>
                setPortbility({
                  mode: "import",
                  source: "openssh",
                  content: "",
                  actions: [],
                })
              }
              type="button"
            >
              <Upload className="mr-1 inline size-3" />
              Import
            </button>
            <button
              className="control-ghost h-7 text-xs"
              onClick={() => void exportPortbility()}
              type="button"
            >
              <Download className="mr-1 inline size-3" />
              Export
            </button>
            <Button
              className="h-7 px-2 text-xs"
              onClick={() => setDraft({ ...emptyDraft })}
            >
              <Plus className="mr-1 size-3.5" />
              New
            </Button>
          </div>
        </div>
        <input
          aria-label="Search hosts"
          className="field"
          ref={searchInput}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search hosts…"
          value={search}
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <input
            checked={favoritesOnly}
            onChange={(event) => setFavoritesOnly(event.target.checked)}
            type="checkbox"
          />{" "}
          Favorites only
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {recentHosts.length > 0 ? (
          <section className="mb-3" aria-label="Recent connections">
            <div className="px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Recent
            </div>
            {rows(recentHosts)}
          </section>
        ) : null}
        {groups.map((group) => (
          <section className="mb-3" key={group.id}>
            <div className="flex items-center justify-between px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              <span>{group.name}</span>
              <div className="flex gap-2">
                <button
                  aria-label={"Rename group " + group.name}
                  onClick={() => void renameGroup(group)}
                  type="button"
                >
                  ✎
                </button>
                <button
                  aria-label={"Delete group " + group.name}
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
          <div className="px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Ungrouped
          </div>
          {rows(visibleHosts.filter((host) => !host.groupId))}
        </section>
        {visibleHosts.length === 0 ? (
          <div className="m-2 rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted-foreground)]">
            <p>No saved connections.</p>
            <button
              className="mt-2 text-[var(--primary)]"
              onClick={onOpenLocal}
              type="button"
            >
              Open a local shell
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="p-2 text-xs text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="border-t border-[var(--hairline)] bg-[var(--control-surface)] p-3">
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
            ref={quickConnectInput}
            onChange={(event) => setQuickConnect(event.target.value)}
            placeholder="user@host:port"
            value={quickConnect}
          />
          <Button className="h-8 px-2 text-xs" type="submit">
            Connect
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
            aria-label="New group"
            className="field"
            onChange={(event) => setNewGroup(event.target.value)}
            placeholder="New group"
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
            aria-label="Host form"
            ref={hostDialogRef}
            aria-modal="true"
            className="dialog"
            role="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void saveHost();
            }}
          >
            <h3 className="mb-4 font-semibold">
              {draft.id ? "Edit Host" : "New Host"}
            </h3>
            <label>
              Name
              <input
                autoFocus
                className="field"
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              Address
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
                User
                <input
                  className="field"
                  value={draft.username ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, username: event.target.value })
                  }
                />
              </label>
              <label>
                Port
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
              Group
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
                <option value="">Ungrouped</option>
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
                placeholder="production, linux"
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
              Authentication
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
                <option value="password">Password</option>
                <option value="private_key">Private key</option>
                <option value="none">No credential</option>
              </select>
            </label>
            {(draft.authKind ?? "password") === "password" ? (
              <label>
                Password{draft.id ? " (leave blank to keep)" : ""}
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
                  Private key path
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
                  Passphrase{draft.id ? " (leave blank to keep)" : ""}
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
              Favorite
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDraft(undefined)} type="button">
                Cancel
              </button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </div>
      ) : null}
      {portability ? (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-label="Import or export Hosts"
            ref={portabilityDialogRef}
            aria-modal="true"
            className="dialog"
            role="dialog"
          >
            <h3 className="mb-3 font-semibold">Import or export Hosts</h3>
            <label>
              Format
              <select
                className="field"
                disabled={portability.mode === "export"}
                onChange={(event) =>
                  setPortbility({
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
              Content
              <textarea
                data-dialog-initial
                autoFocus={portability.mode === "import"}
                className="field min-h-36 font-mono text-xs"
                onChange={(event) =>
                  setPortbility({
                    ...portability,
                    content: event.target.value,
                    preview: undefined,
                    actions: [],
                    result: undefined,
                  })
                }
                readOnly={portability.mode === "export"}
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
                  {entry.conflict ? " — already exists" : ""}
                </span>
                <select
                  aria-label={`Action for ${entry.host.name}`}
                  className="field w-24"
                  onChange={(event) => {
                    const actions = [...portability.actions];
                    actions[index] = event.target.value as ImportAction;
                    setPortbility({ ...portability, actions });
                  }}
                  value={portability.actions[index] ?? entry.defaultAction}
                >
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="skip">Skip</option>
                </select>
              </div>
            ))}
            {portability.preview?.ignored.length ? (
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                {portability.preview.ignored.length} ignored directive(s):{" "}
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
              <button onClick={() => setPortbility(undefined)} type="button">
                Close
              </button>
              {portability.mode === "import" ? (
                <>
                  <button
                    onClick={() => void previewPortbility()}
                    type="button"
                  >
                    Analyze
                  </button>
                  <Button
                    disabled={!portability.preview}
                    onClick={() => void applyPortbility()}
                    type="button"
                  >
                    Apply selection
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
