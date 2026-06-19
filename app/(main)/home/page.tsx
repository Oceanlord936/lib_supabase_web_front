"use client";

import { Search } from "lucide-react";
import { LibraryCard } from "@/components/library-card";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import type { MapProps } from "@/components/map";
import { supabase } from "@/lib/supabase";
import type { Library } from "@/lib/types";

const Map = dynamic<MapProps>(() => import("@/components/map"), { ssr: false });

export default function Page() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [debouncedRadius, setDebouncedRadius] = useState(10);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [advancedSearch, setAdvancedSearch] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [selectedPin, setSelectedPin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // functions ====================================

  // Debouncing : wait till user input end so we don't send too many request to backend when drap slider
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRadius(radiusKm), 300);
    return () => clearTimeout(timer);
  }, [radiusKm]);

  useEffect(() => {
    if (!advancedSearch || !search.trim()) return;
    handleSearch();
  }, [debouncedRadius]);

  const title = !advancedSearch
    ? "Libraries Near You"
    : useCurrentLocation
      ? "Search Libraries Near You"
      : "Search Libraries by Location";

  // Get user GPS location once on mount

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setError("Location access denied");
        setLoading(false);
      },
    );
  }, []);

  // Fetch nearby libraries when location or radius changes (not in advanced search mode)
  useEffect(() => {
    if (!location || advancedSearch) return;

    const fetchNearby = async () => {
      setLoading(true);
      setError("");

      // call the edge function request for supabase: .../rpc/nearby_libraries
      const { data, error } = await supabase.rpc("nearby_libraries", {
        lat: location.lat,
        lng: location.lng,
        radius_km: debouncedRadius,
      });
      if (error) {
        setError(error.message);
      } else {
        // success , setLibraries states , use type Library
        setLibraries((data as Library[]) ?? []);
      }
      setLoading(false);
    };

    fetchNearby();
  }, [location, debouncedRadius, advancedSearch]);

  // Load favorite IDs once on mount so hearts render correctly
  useEffect(() => {
    const loadFavoriteIds = async () => {
      // GET

      const { data } = await supabase.from("favorites").select("library_id");
      if (data) {
        setFavoriteIds(new Set(data.map((f) => f.library_id as string)));
      }
    };
    loadFavoriteIds();
  }, []);

  const handleSearch = async (overrideRadius?: number) => {
    // if not override , use state number
    // we use debouncedRadius to update
    const radius = overrideRadius ?? debouncedRadius;
    if (!search.trim()) return;

    const centerLat = useCurrentLocation
      ? location?.lat
      : parseFloat(manualLat);
    const centerLng = useCurrentLocation
      ? location?.lng
      : parseFloat(manualLng);
    if (!centerLat || !centerLng) return;

    setLoading(true);
    setError("");

    // call the rpc edge function from supabase, use radius
    const { data, error } = await supabase.rpc("search_libraries", {
      query: search,
      lat: centerLat,
      lng: centerLng,
      radius_km: radius, // add  (radius is already computed )
    });

    if (error) {
      setError(error.message);
    } else {
      setLibraries((data as Library[]) ?? []);
    }
    setLoading(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    // only use when we click the advance search check box , not using cur gps location
    if (advancedSearch && !useCurrentLocation) {
      setManualLat(lat.toString());
      setManualLng(lng.toString());
      setSelectedPin({ lat, lng });
    }
  };

  const handleToggleFavorite = async (libraryId: string) => {
    // call supabase getUser , as we need the user id to fetch favorite of that user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // supabase PostgREST to GET
    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("library_id", libraryId)
      .maybeSingle();

    if (existing) {
      // if already "favorite" , delete to toggle -> this remove from backend db
      await supabase.from("favorites").delete().eq("id", existing.id);

      // now handle front end remove
      setFavoriteIds((prev) => {
        // build a set without that removed favorite, to update the FavoriteIds
        const s = new Set(prev);
        s.delete(libraryId);
        return s;
      });
    } else {
      // not yet fav , we toggle it

      // first add to db via supabase
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, library_id: libraryId });

      // then set favorites id state for front end
      setFavoriteIds((prev) => new Set(prev).add(libraryId));
    }
  };

  // jsx =========================================
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {/* show user input place when advance search is on  */}
        {advancedSearch && (
          <div className="relative mt-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="Search libraries by name..."
              className="h-11 w-full pl-10"
            />
          </div>
        )}
        {/* slider */}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-muted-foreground w-28">
            Radius: {radiusKm} km
          </span>
          <Slider
            min={1}
            max={50}
            step={1}
            value={[radiusKm]}
            onValueChange={(val) => {
              setRadiusKm(val[0]);
            }}
            className="flex-1"
          />
        </div>
        {/* when advance check box is on  */}
        {advancedSearch && (
          <div className="mt-3 flex items-center gap-2">
            <Checkbox
              id="useCurrentLocation"
              checked={useCurrentLocation}
              onCheckedChange={(val) => setUseCurrentLocation(val as boolean)}
            />
            <label
              htmlFor="useCurrentLocation"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Use Current Location
            </label>
          </div>
        )}
        {advancedSearch && !useCurrentLocation && (
          <div className="mt-3 flex gap-3">
            <Input
              placeholder="Latitude"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
            />
            <Input
              placeholder="Longitude"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
            />
          </div>
        )}
        {advancedSearch && (
          <Button className="mt-3" onClick={() => handleSearch()}>
            Search
          </Button>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Checkbox
            id="advancedSearch"
            checked={advancedSearch}
            onCheckedChange={(val) => {
              setAdvancedSearch(val as boolean);
              setLibraries([]);
            }}
          />
          <label
            htmlFor="advancedSearch"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Advanced Manual Search
          </label>
        </div>
        <div className="mt-6">
          <Map
            center={location}
            libraries={libraries}
            selectedPin={selectedPin}
            onMapClick={handleMapClick}
          />
        </div>
        <div className="mt-8 flex flex-col gap-4">
          {loading && (
            <p className="text-center text-muted-foreground">
              Finding libraries near you...
            </p>
          )}
          {error && <p className="text-center text-red-500">{error}</p>}
          {!loading && !error && libraries.length === 0 && (
            <p className="text-center text-muted-foreground">
              No libraries found.
            </p>
          )}

          {/* render all the libraries card components  */}
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
              isFavorite={favoriteIds.has(library.id)}
              onFavoriteClick={handleToggleFavorite}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
