import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Backend, Host, HostGroup } from "../services/backend";
import { HostsWorkspace } from "./HostsWorkspace";

function backendFixture(hosts: Host[] = [], groups: HostGroup[] = []) {
  const state = { hosts: [...hosts], groups: [...groups] };
  const backend = {
    listHosts: vi.fn(async (search?: string) =>
      state.hosts.filter(
        (host) =>
          !search ||
          [host.name, host.address, host.username ?? "", ...host.tags]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    ),
    listHostGroups: vi.fn(async () => state.groups),
    saveHost: vi.fn(async (request) => {
      const host: Host = {
        ...request,
        id: request.id ?? "host-new",
        authKind: request.password ? "password" : "none",
      };
      state.hosts = request.id
        ? state.hosts.map((item) => (item.id === host.id ? host : item))
        : [...state.hosts, host];
      return host;
    }),
    deleteHost: vi.fn(async (id: string) => {
      state.hosts = state.hosts.filter((host) => host.id !== id);
    }),
    saveHostGroup: vi.fn(async (request) => ({
      id: request.id ?? "group-new",
      name: request.name,
      sortOrder: request.sortOrder,
    })),
    deleteHostGroup: vi.fn(async () => undefined),
  } as unknown as Backend;
  return { backend, state };
}

afterEach(cleanup);

describe("Hosts workspace", () => {
  it("onboards an empty workspace into a local shell", async () => {
    const { backend } = backendFixture();
    const openLocal = vi.fn();
    render(
      <HostsWorkspace
        backend={backend}
        onOpenLocal={openLocal}
        onRequestConnection={vi.fn()}
      />,
    );
    await screen.findByText("Nenhum Host cadastrado.");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Ignorar importação e abrir shell local",
      }),
    );
    expect(openLocal).toHaveBeenCalledOnce();
  });

  it("creates a Host without retaining or displaying its password", async () => {
    const user = userEvent.setup();
    const { backend } = backendFixture();
    render(
      <HostsWorkspace
        backend={backend}
        onOpenLocal={vi.fn()}
        onRequestConnection={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Novo" }));
    await user.type(screen.getByLabelText("Nome"), "Gateway");
    await user.type(screen.getByLabelText("Endereço"), "gateway.example.com");
    await user.type(screen.getByLabelText(/^Senha/), "super-secret");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(backend.saveHost).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Gateway", password: "super-secret" }),
    );
    expect(await screen.findByText("Gateway")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("super-secret")).not.toBeInTheDocument();
  });

  it("routes saved Hosts and Quick Connect through the same connection callback", async () => {
    const user = userEvent.setup();
    const host: Host = {
      id: "host-1",
      name: "Router",
      address: "router.local",
      port: 22,
      tags: ["network"],
      favorite: true,
      authKind: "none",
    };
    const { backend } = backendFixture([host]);
    const connect = vi.fn();
    render(
      <HostsWorkspace
        backend={backend}
        onOpenLocal={vi.fn()}
        onRequestConnection={connect}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /^Router/ }));
    await user.type(screen.getByLabelText("Quick Connect"), "root@edge:2222");
    await user.click(screen.getByRole("button", { name: "Conectar" }));
    expect(connect).toHaveBeenNthCalledWith(1, { hostId: "host-1" });
    expect(connect).toHaveBeenNthCalledWith(2, {
      destination: "root@edge:2222",
    });
  });

  it("debounces search and confirms destructive Host removal", async () => {
    const user = userEvent.setup();
    const host: Host = {
      id: "host-1",
      name: "Database",
      address: "db.local",
      port: 22,
      username: "dba",
      tags: ["production"],
      favorite: false,
      authKind: "none",
    };
    const { backend } = backendFixture([host]);
    window.confirm = vi.fn(() => true);
    render(
      <HostsWorkspace
        backend={backend}
        onOpenLocal={vi.fn()}
        onRequestConnection={vi.fn()}
      />,
    );
    await screen.findByText("Database");
    await user.type(screen.getByLabelText("Buscar Hosts"), "production");
    await waitFor(() =>
      expect(backend.listHosts).toHaveBeenLastCalledWith("production"),
    );
    await user.click(screen.getByRole("button", { name: "Excluir Database" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(backend.deleteHost).toHaveBeenCalledWith("host-1");
  });
});
