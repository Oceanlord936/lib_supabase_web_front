"use client";

import { Navbar } from "@/components/navbar";
import { useState, useEffect } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { supabase } from "@/lib/supabase";
import type { Library, Channel, Message } from "@/lib/types";

export type LibraryWithChannels = Library & { channels?: Channel[] };

export default function Page() {
  const [libraries, setLibraries] = useState<LibraryWithChannels[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Fetch favorites and their channels on mount
  const fetchFavorites = async () => {
    const { data, error } = await supabase
      .from("favorites")
      .select("library_id, libraries(*)");

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const libs = (data ?? [])
      .map((f) => f.libraries as unknown as Library)
      .filter(Boolean);

    const withChannels = await Promise.all(
      libs.map(async (lib) => {
        const channels = await getOrSeedChannels(lib.id);
        return { ...lib, channels };
      }),
    );

    setLibraries(withChannels);
    setLoading(false);
  };

  // Get channels for a library, auto-seeding GENERAL + ANNOUNCEMENT if none exist
  const getOrSeedChannels = async (libraryId: string): Promise<Channel[]> => {
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("library_id", libraryId)
      .order("created_at");

    if (data && data.length > 0) return data as Channel[];

    // First visit — seed default channels
    const { data: seeded } = await supabase
      .from("channels")
      .insert([
        { library_id: libraryId, name: "general", channel_type: "GENERAL" },
        { library_id: libraryId, name: "announcements", channel_type: "ANNOUNCEMENT" },
      ])
      .select();

    return (seeded as Channel[]) ?? [];
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleLibrarySelect = (id: string) => {
    setSelectedLibraryId(id);
    setSelectedChannelId(null);
    setMessages([]);
  };

  const handleChannelSelect = async (id: string) => {
    setSelectedChannelId(id);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", id)
      .order("created_at", { ascending: true })
      .limit(50);

    setMessages((data as Message[]) ?? []);
  };

  // Supabase Realtime — subscribe when selected channel changes
  useEffect(() => {
    if (!selectedChannelId) return;

    // Enable realtime for messages table in Supabase dashboard or via SQL:
    // ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    const subscription = supabase
      .channel(`messages:${selectedChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${selectedChannelId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedChannelId]);

  const handleSend = async (content: string) => {
    if (!selectedChannelId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    await supabase.from("messages").insert({
      channel_id: selectedChannelId,
      user_id: user.id,
      display_name: profile?.display_name ?? "User",
      content,
    });
    // Realtime subscription picks up the new message — no manual state update needed
  };

  const selectedChannel = libraries
    .find((l) => l.id === selectedLibraryId)
    ?.channels?.find((c) => c.id === selectedChannelId);

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <main className="flex flex-1 overflow-hidden bg-background">
        {loading ? (
          <p className="m-auto text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="m-auto text-red-500">{error}</p>
        ) : (
          <>
            <ChatSidebar
              libraries={libraries}
              selectedLibraryId={selectedLibraryId}
              selectedChannelId={selectedChannelId}
              onLibrarySelect={handleLibrarySelect}
              onChannelSelect={handleChannelSelect}
            />
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              channelName={selectedChannel?.name ?? ""}
            />
          </>
        )}
      </main>
    </div>
  );
}
