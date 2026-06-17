"use client";

import { Navbar } from "@/components/navbar";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Moon, Heart, Star, Pencil, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserProfile = {
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [avatarValue, setAvatarValue] = useState("");
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();

  // load profile
  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();

    setUserProfile({
      email: user.email ?? "",
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    });
    setLoading(false);
  };

  // load count number states
  const fetchCounts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ count: favCount }, { count: ratCount }] = await Promise.all([
      supabase
        .from("favorites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("ratings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    setFavoritesCount(favCount ?? 0);
    setRatingsCount(ratCount ?? 0);
  };

  // update profile
  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // first update back end
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: editValue, avatar_url: avatarValue || null })
      .eq("id", user.id);

    if (!error) {
      // then update front end state for re-render
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              display_name: editValue,
              avatar_url: avatarValue || null,
            }
          : null,
      );
    } else {
      setError(error.message);
    }
    setIsEditing(false);
  };

  const handleCancel = () => setIsEditing(false);

  // on mount , load profile and fetchcount
  useEffect(() => {
    loadProfile();
    fetchCounts();
  }, []);

  const initials = userProfile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-muted/50 p-4 sm:p-6 lg:p-8">
      <Navbar />
      <div className="mx-auto max-w-2xl space-y-6 mt-6">
        <h1 className="text-2xl font-semibold text-foreground">Profile</h1>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <section className="rounded-xl bg-card p-6 shadow-sm">
          <h2 className="mb-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Account
          </h2>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
              {loading ? "…" : initials}
            </div>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Display Name
                </label>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") handleCancel();
                      }}
                      placeholder="Display name"
                    />
                    <input
                      type="text"
                      value={avatarValue}
                      onChange={(e) => setAvatarValue(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") handleCancel();
                      }}
                      placeholder="Avatar URL"
                    />
                    <button
                      onClick={handleSave}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
                    <span className="text-base font-medium text-foreground">
                      {userProfile?.display_name ?? "—"}
                    </span>
                    <button
                      onClick={() => {
                        setEditValue(userProfile?.display_name ?? "");
                        setAvatarValue(userProfile?.avatar_url ?? "");
                        setIsEditing(true);
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Avatar URL
                </label>
                <a
                  href={userProfile?.avatar_url ?? "#"}
                  target="_blank"
                  className="text-sm text-blue-500 hover:underline break-all block"
                >
                  {userProfile?.avatar_url || "No avatar set"}
                </a>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <span className="text-sm text-foreground">
                  {userProfile?.email}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2 sm:justify-start">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <Heart className="h-3.5 w-3.5" />
                  <span>{favoritesCount} Favorites</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3.5" />
                  <span>{ratingsCount} Ratings</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-card p-6 shadow-sm">
          <h2 className="mb-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Settings
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Dark Mode
              </span>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
