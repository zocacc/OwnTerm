import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { TitleBar } from "@/components/ownterm/TitleBar";
import { NavigationRail } from "@/components/ownterm/NavigationRail";
import { ConnectionsSidebar } from "@/components/ownterm/ConnectionsSidebar";
import { SessionToolbar } from "@/components/ownterm/SessionToolbar";
import { TerminalView } from "@/components/ownterm/TerminalView";
import { QuickCommands, QuickCommandsHandle } from "@/components/ownterm/QuickCommands";
import { StatusBar } from "@/components/ownterm/StatusBar";
import { tabs } from "@/data/ownterm";
import wallpaper from "@/assets/wallpaper.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OwnTerm — Desktop SSH & Terminal Workspace" },
      {
        name: "description",
        content:
          "OwnTerm is a dark, native-feeling desktop terminal workspace with SSH connection management, tabbed sessions and quick commands.",
      },
      { property: "og:title", content: "OwnTerm — Desktop SSH & Terminal Workspace" },
      {
        property: "og:description",
        content:
          "A high-fidelity desktop prototype: tabbed SSH sessions, connections sidebar and a compact status bar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnTermApp,
});

function OwnTermApp() {
  const [activeTabId, setActiveTabId] = useState(tabs[0]!.id);
  const [railSection, setRailSection] = useState("terminals");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickOpen, setQuickOpen] = useState(false);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0]!,
    [activeTabId],
  );

  const selectHost = (hostId: string) => {
    const tab = tabs.find((t) => t.hostId === hostId);
    if (tab) setActiveTabId(tab.id);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <img
        src={wallpaper}
        alt=""
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="relative flex h-full w-full items-center justify-center p-8">
        <main className="flex h-full max-h-[860px] w-full max-w-[1500px] flex-col overflow-hidden rounded-[10px] border border-foreground/10 bg-shell shadow-[0_32px_80px_-24px_oklch(0_0_0/0.85)] backdrop-blur-2xl">
          <TitleBar tabs={tabs} activeTabId={activeTabId} onSelectTab={setActiveTabId} />

          <div className="flex min-h-0 flex-1">
            <NavigationRail active={railSection} onChange={setRailSection} />
            {sidebarOpen && (
              <ConnectionsSidebar selectedHostId={activeTab.hostId} onSelectHost={selectHost} />
            )}

            <section className="relative flex min-w-0 flex-1 flex-col">
              <SessionToolbar
                tab={activeTab}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen((v) => !v)}
              />
              <TerminalView tab={activeTab} />
              {quickOpen ? (
                <QuickCommands onClose={() => setQuickOpen(false)} />
              ) : (
                <QuickCommandsHandle onOpen={() => setQuickOpen(true)} />
              )}
            </section>
          </div>

          <StatusBar tab={activeTab} />
        </main>
      </div>
    </div>
  );
}
