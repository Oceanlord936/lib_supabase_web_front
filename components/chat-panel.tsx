"use client";

import { Button } from "@/components/ui/button";
import { Hash, Send } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/lib/types";

interface ChatPanelProps {
  messages: Message[];
  onSend: (content: string) => void;
  channelName: string;
}

export function ChatPanel({ messages, onSend, channelName }: ChatPanelProps) {
  const [text, setText] = useState("");

  return (
    <section className="flex flex-1 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-6">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-sm font-semibold text-foreground">{channelName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-5">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {message.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {message.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{message.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="shrink-0 px-6 pb-6 pt-2">
        <form
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onSend(text.trim());
            setText("");
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            type="text"
            placeholder={`Message #${channelName}`}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </section>
  );
}
