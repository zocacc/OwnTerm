import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Backend,
  Host,
  HostGroup,
  SaveHostRequest,
  ImportPreview,
  ImportAction,
} from "../services/backend";
import {
  Download,
  Plus,
  Star,
  Upload,
  Server,
  Search,
  Pencil,
  X,
  Clock,
  Folder,
} from "lucide-react";
import { ActionMenu } from "./ActionMenu";
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
  activeHostId?: string;
  connectedHostIds?: string[];
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
  activeHostId,
  connectedHostIds = [],
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
        className={`host-row ${activeHostId === host.id ? "is-selected" : ""}`}
        key={host.id}
        onDoubleClick={() => onRequestConnection({ hostId: host.id })}
      >
        <button
          title={`${host.username ? `${host.username}@` : ""}${host.address}:${host.port}`}
          className="host-link"
          aria-current={activeHostId === host.id ? "true" : undefined}
          onClick={() => onRequestConnection({ hostId: host.id })}
          type="button"
        >
          <Server size={18} className="host-icon" aria-hidden="true" />
          <span className="host-label">
            <span className="host-name">{host.name}</span>
            <span className="host-address">
              {host.username ? `${host.username}@` : ""}
              {host.address}:{host.port}
            </span>
          </span>
          <span
            className={`host-connection-dot ${connectedHostIds.includes(host.id) ? "is-connected" : ""}`}
            title={
              connectedHostIds.includes(host.id)
                ? "Connected session"
                : "No connected session"
            }
          />
        </button>
        <div className="host-actions">
          <button
            aria-label={`${host.favorite ? "Remove" : "Add"} ${host.name} to favorites`}
            onClick={() => void toggleFavorite(host)}
            type="button"
          >
            <Star size={13} fill={host.favorite ? "currentColor" : "none"} />
          </button>
          <button
            aria-label={`Edit ${host.name}`}
            onClick={() => edit(host)}
            type="button"
          >
            <Pencil size={13} />
          </button>
          <button
            aria-label={`Delete ${host.name}`}
            onClick={() => void removeHost(host)}
            type="button"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    ));

  return (
    <aside aria-label="Hosts" className="connections-sidebar">
      <div className="connections-header">
        <div className="connections-heading">
          <h2>Connections</h2>
          <div className="flex items-center gap-1">
            <button
              aria-label="New"
              title="New connection"
              className="control-icon"
              onClick={() => setDraft({ ...emptyDraft })}
              type="button"
            >
              <Plus size={17} />
            </button>
            <ActionMenu label="Connection actions">
              <button
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
                <Upload size={14} />
                Import
              </button>
              <button onClick={() => void exportPortbility()} type="button">
                <Download size={14} />
                Export
              </button>
              <label className="menu-checkbox">
                <input
                  checked={favoritesOnly}
                  onChange={(event) => setFavoritesOnly(event.target.checked)}
                  type="checkbox"
                />
                Favorites only
              </label>
            </ActionMenu>
          </div>
        </div>
        <div className="host-search">
          <Search size={14} aria-hidden="true" />
          <input
            aria-label="Search hosts"
            ref={searchInput}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hosts…"
            value={search}
          />
          <kbd>Ctrl F</kbd>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {visibleHosts.some((host) => host.favorite) ? (
          <section className="mb-4" aria-label="Favorite connections">
            <div className="host-section-heading">
              <Star size={13} /> Favorites
            </div>
            {rows(visibleHosts.filter((host) => host.favorite))}
          </section>
        ) : null}
        {!favoritesOnly &&
        recentHosts.some(
          (host) =>
            !host.favorite &&
            visibleHosts.some((visible) => visible.id === host.id),
        ) ? (
          <section className="mb-3" aria-label="Recent connections">
            <div className="host-section-heading">
              <Clock size={13} /> Recent
            </div>
            {rows(
              recentHosts.filter(
                (host) =>
                  !host.favorite &&
                  visibleHosts.some((visible) => visible.id === host.id),
              ),
            )}
          </section>
        ) : null}
        {groups.map((group) => (
          <section className="mb-3" key={group.id}>
            <div className="host-section-heading justify-between">
              <span>{group.name}</span>
              <div className="flex gap-2">
                <button
                  aria-label={"Rename group " + group.name}
                  onClick={() => void renameGroup(group)}
                  type="button"
                >
                  <Pencil size={13} />
                </button>
                <button
                  aria-label={"Delete group " + group.name}
                  onClick={() => void removeGroup(group)}
                  type="button"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            {rows(
              visibleHosts.filter(
                (host) => host.groupId === group.id && !host.favorite,
              ),
            )}
          </section>
        ))}
        {visibleHosts.some(
          (host) =>
            !host.groupId &&
            !host.favorite &&
            !recentHosts.some((recent) => recent.id === host.id),
        ) ? (
          <section>
            <div className="host-section-heading">
              <Folder size={13} /> Ungrouped
            </div>
            {rows(
              visibleHosts.filter(
                (host) =>
                  !host.groupId &&
                  !host.favorite &&
                  !recentHosts.some((recent) => recent.id === host.id),
              ),
            )}
          </section>
        ) : null}
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
      <div className="connections-footer">
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
          <Button
            variant="secondary"
            className="h-8 px-2 text-xs"
            type="submit"
          >
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
