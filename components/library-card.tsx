"use client";

import { Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Rating } from "@/lib/types";

interface LibraryCardProps {
  id: string;
  name: string;
  address: string | null;
  libraryType: "PUBLIC" | "UNIVERSITY" | null;
  openingHours: string | null;
  website: string | null;
  rating: number;
  ratingCount: number;
  isFavorite?: boolean;
  onFavoriteClick?: (id: string) => void;
  showRating?: boolean;
  onRatingSubmit?: (id: string, rating: number, comment: string) => void;
}

export function LibraryCard({
  id,
  name,
  address,
  libraryType,
  openingHours,
  website,
  rating,
  ratingCount,
  isFavorite,
  onFavoriteClick,
  showRating,
  onRatingSubmit,
}: LibraryCardProps) {
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showCommentsPopup, setShowCommentsPopup] = useState(false);
  const [comments, setComments] = useState<Rating[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const fetchComments = async () => {
    setCommentsLoading(true);
    setShowCommentsPopup(true);

    const { data } = await supabase
      .from("ratings")
      .select("id, score, comment, display_name, created_at")
      .eq("library_id", id)
      .order("created_at", { ascending: false });

    setComments((data as Rating[]) ?? []);
    setCommentsLoading(false);
  };

  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="text-lg font-bold text-foreground">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{address}</p>

      {openingHours && (
        <p className="mt-1 text-sm text-muted-foreground">{openingHours}</p>
      )}
      {website && (
        <a href={website} target="_blank" className="mt-1 text-sm text-blue-500 hover:underline block">
          {website}
        </a>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground font-medium">
          {libraryType ?? "LIBRARY"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          ⭐ {rating.toFixed(1)} ({ratingCount} ratings)
        </span>
      </div>

      {/* Favorite heart button */}
      <button
        className="absolute top-2 right-3 text-gray-400 hover:text-red-500"
        onClick={(e) => {
          e.stopPropagation();
          onFavoriteClick?.(id);
        }}
      >
        <Heart
          className="h-5 w-5"
          fill={isFavorite ? "red" : "none"}
          stroke={isFavorite ? "red" : "currentColor"}
        />
      </button>

      {/* Fractional star display */}
      <div className="mt-2 relative inline-flex">
        <div className="flex text-gray-300 pointer-events-none">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-4 w-4" fill="currentColor" />
          ))}
        </div>
        <div
          className="absolute inset-0 flex overflow-hidden text-yellow-400 pointer-events-none"
          style={{ width: `${(rating / 5) * 100}%` }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-4 w-4 flex-shrink-0" fill="currentColor" />
          ))}
        </div>
      </div>

      {showRating && (
        <button
          className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
          onClick={() => setShowRatingPopup(true)}
        >
          Rate
        </button>
      )}

      {/* Rating popup */}
      {showRatingPopup && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/95 rounded-lg z-10">
          <p className="text-sm font-medium text-foreground mb-3">Rate this library</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className="h-7 w-7 cursor-pointer text-yellow-400"
                fill={i <= (hoveredRating || selectedRating) ? "currentColor" : "none"}
                stroke="currentColor"
                onMouseEnter={() => setHoveredRating(i)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setSelectedRating(i)}
              />
            ))}
          </div>
          <input
            type="text"
            placeholder="Add a comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-3 w-48 border border-border rounded px-2 py-1 text-sm text-foreground bg-background placeholder:text-muted-foreground"
          />
          <div className="mt-4 flex gap-2">
            <button
              className="px-3 py-1 text-sm bg-foreground text-background rounded"
              onClick={() => {
                onRatingSubmit?.(id, selectedRating, comment || "no comment");
                setShowRatingPopup(false);
                setComment("");
              }}
            >
              Submit
            </button>
            <button
              className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowRatingPopup(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Comments button */}
      <button
        className="mt-1 ml-2 text-xs text-muted-foreground hover:text-foreground underline"
        onClick={fetchComments}
      >
        Comments
      </button>

      {/* Comments popup */}
      {showCommentsPopup && (
        <div className="absolute inset-0 flex flex-col bg-card/95 rounded-lg z-10 p-4 overflow-y-auto">
          <h3 className="font-semibold text-foreground mb-3">Comments</h3>
          {commentsLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="mb-3 border-b border-border pb-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-foreground">
                  {c.display_name ?? "User"}
                </span>
                <span className="text-xs text-yellow-500">{"★".repeat(c.score)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{c.comment}</p>
            </div>
          ))}
          <button
            className="mt-auto text-xs text-muted-foreground hover:text-foreground underline self-end"
            onClick={() => setShowCommentsPopup(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
