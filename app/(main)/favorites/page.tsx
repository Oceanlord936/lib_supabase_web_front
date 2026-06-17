"use client";

import { LibraryCard } from "@/components/library-card";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Library } from "@/lib/types";

export default function Page() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchFavorites = async () => {
    // Join favorites → libraries to get the full library rows
    const { data, error } = await supabase
      .from("favorites")
      .select("id, library_id, libraries(*)");

    if (error) {
      setError(error.message);
    } else {
      setLibraries(
        (data ?? [])
          .map((f) => f.libraries as unknown as Library)
          .filter(Boolean),
      );
    }
    setLoading(false);
  };

  // on mount fetch
  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (libraryId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // use user id , library id to remove that row from fav table
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("library_id", libraryId);

    // success remove , we build a new libarary state without that library
    // so it willtrigger re-render of the libarary cards
    if (!error) {
      setLibraries((prev) => prev.filter((lib) => lib.id !== libraryId));
    }
  };

  const handleRatingSubmit = async (
    libraryId: string,
    rating: number,
    comment: string,
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // first fetch profile, as we need the display name and user id for futher insert or update
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    // Try insert; if unique conflict (already rated) delete then re-insert
    const { error } = await supabase.from("ratings").insert({
      library_id: libraryId,
      user_id: user.id,
      score: rating,
      comment,
      display_name: profile?.display_name ?? "User",
    });

    if (error) {
      // Duplicate — remove existing rating and re-submit
      await supabase
        .from("ratings")
        .delete()
        .eq("user_id", user.id)
        .eq("library_id", libraryId);

      await supabase.from("ratings").insert({
        library_id: libraryId,
        user_id: user.id,
        score: rating,
        comment,
        display_name: profile?.display_name ?? "User",
      });
    }

    fetchFavorites();
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-bold text-foreground">My Favorites</h1>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loading && (
            <p className="text-center text-muted-foreground">
              Loading favorites...
            </p>
          )}
          {error && <p className="text-center text-red-500">{error}</p>}
          {!loading && !error && libraries.length === 0 && (
            <p className="text-center text-muted-foreground">
              No favorites yet.
            </p>
          )}
          {libraries.map((library) => (
            <LibraryCard
              key={library.id}
              id={library.id}
              name={library.name}
              address={library.address}
              libraryType={library.library_type}
              openingHours={library.opening_hours}
              website={library.website}
              rating={library.average_rating ?? 0}
              ratingCount={library.rating_count ?? 0}
              isFavorite={true}
              onFavoriteClick={handleRemoveFavorite}
              showRating={true}
              onRatingSubmit={handleRatingSubmit}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
