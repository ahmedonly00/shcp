import React, { useState, useRef, useEffect } from "react";
import { Search, MapPin, Loader2, ExternalLink } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPickerProps {
  /** Current latitude value (controlled) */
  latitude: number | undefined;
  /** Current longitude value (controlled) */
  longitude: number | undefined;
  /** Called when user selects a location */
  onSelect: (lat: number, lon: number) => void;
  /** Pre-fill the search box (e.g. pharmacy address + district) */
  searchHint?: string;
  /** Label shown above the picker */
  label?: string;
}

/**
 * GPS location picker backed by Nominatim (OpenStreetMap).
 * Free, no API key required. Rwanda-scoped by default.
 *
 * The admin types a place name or address and picks from geocoded results.
 * Coordinates are auto-populated — no manual lat/lng entry.
 */
export const LocationPicker: React.FC<LocationPickerProps> = ({
  latitude,
  longitude,
  onSelect,
  searchHint = "",
  label = "GPS Location",
}) => {
  const [query, setQuery] = useState(searchHint);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keep search box in sync with hint when parent changes (e.g. form reset)
  useEffect(() => {
    if (searchHint) setQuery(searchHint);
  }, [searchHint]);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Append ", Rwanda" so results stay country-scoped
      const term = q.toLowerCase().includes("rwanda") ? q : `${q}, Rwanda`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=json&limit=6&addressdetails=0`;

      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "SHCP-HealthPlatform/1.0" },
      });
      if (!res.ok) throw new Error("Search failed");

      const data: NominatimResult[] = await res.json();
      if (data.length === 0) {
        setError("No results found. Try a more specific name.");
      } else {
        setResults(data);
        setOpen(true);
      }
    } catch {
      setError("Could not reach geocoding service. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (r: NominatimResult) => {
    onSelect(parseFloat(r.lat), parseFloat(r.lon));
    setQuery(r.display_name);
    setOpen(false);
    setResults([]);
  };

  const osmLink = latitude && longitude
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=16`
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-green-700" />
        <span className="text-xs font-semibold text-green-800">{label}</span>
        {latitude && longitude && (
          <span className="ml-auto text-xs text-green-700 font-mono">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        )}
      </div>

      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(false); }}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), search())}
            placeholder="Type pharmacy name, address or district…"
            className="text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={search}
            disabled={loading}
            className="shrink-0 border-green-300 text-green-700 hover:bg-green-50"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Search className="h-4 w-4 mr-1" />Find</>
            }
          </Button>
        </div>

        {/* Results dropdown */}
        {open && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.place_id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-border/50 last:border-0"
                onClick={() => handleSelect(r)}
              >
                <span className="block font-medium text-foreground truncate">{r.display_name}</span>
                <span className="text-xs text-muted-foreground">
                  {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {latitude && longitude && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-700">Location set</span>
          {osmLink && (
            <a
              href={osmLink}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View on map <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Powered by OpenStreetMap · No API key required · Rwanda-scoped search
      </p>
    </div>
  );
};
