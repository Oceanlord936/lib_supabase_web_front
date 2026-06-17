"use client";

import { cn } from "@/lib/utils";
import { Hash, Library as LibraryIcon } from "lucide-react";
import type { LibraryWithChannels } from "@/app/community/page";

interface ChatSidebarProps {
  libraries: LibraryWithChannels[];
  selectedLibraryId: string | null;
  selectedChannelId: string | null;
  onLibrarySelect: (id: string) => void;
  onChannelSelect: (id: string) => void;
}

export function ChatSidebar({
  libraries,
  selectedLibraryId,
  selectedChannelId,
  onLibrarySelect,
  onChannelSelect,
}: ChatSidebarProps) {
  const selectedLibrary = libraries.find((l) => l.id === selectedLibraryId);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex flex-col gap-1 overflow-y-auto p-3">
        <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Libraries
        </h2>
        {libraries.map((library) => {
          const isActive = library.id === selectedLibraryId;
          return (
            <button
              key={library.id}
              type="button"
              onClick={() => onLibrarySelect(library.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent/50",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <LibraryIcon className="h-4 w-4" />
              </span>
              <span className="truncate font-medium">{library.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-3 border-t border-border" />

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {selectedLibrary?.name ?? "Channels"}
        </h2>
        {selectedLibrary?.channels?.map((channel) => {
          const isActive = channel.id === selectedChannelId;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onChannelSelect(channel.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Hash className="h-4 w-4 shrink-0" />
              <span className="truncate">{channel.name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
