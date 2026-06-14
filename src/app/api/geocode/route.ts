import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";

const schema = z.object({
  query: z.string().trim().min(2).max(80),
});

const CITY_FALLBACKS = [
  { label: "Bengaluru, India", lat: 12.9716, lng: 77.5946 },
  { label: "Mumbai, India", lat: 19.076, lng: 72.8777 },
  { label: "Delhi, India", lat: 28.6139, lng: 77.209 },
  { label: "Hyderabad, India", lat: 17.385, lng: 78.4867 },
  { label: "Chennai, India", lat: 13.0827, lng: 80.2707 },
  { label: "Kolkata, India", lat: 22.5726, lng: 88.3639 },
  { label: "Ahmedabad, India", lat: 23.0225, lng: 72.5714 },
  { label: "Pune, India", lat: 18.5204, lng: 73.8567 },
  { label: "New York, USA", lat: 40.7128, lng: -74.006 },
  { label: "San Francisco, USA", lat: 37.7749, lng: -122.4194 },
  { label: "London, United Kingdom", lat: 51.5072, lng: -0.1276 },
  { label: "Tokyo, Japan", lat: 35.6764, lng: 139.65 },
  { label: "Sydney, Australia", lat: -33.8688, lng: 151.2093 },
  { label: "Paris, France", lat: 48.8566, lng: 2.3522 },
  { label: "Singapore", lat: 1.3521, lng: 103.8198 },
];

type OpenMeteoResult = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fallbackLookup(query: string) {
  const normalized = normalize(query);
  return CITY_FALLBACKS.find((city) => normalize(city.label).includes(normalized));
}

function labelFor(result: OpenMeteoResult) {
  return [result.name, result.admin1, result.country].filter(Boolean).join(", ");
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return jsonError("Enter at least two letters of a city name.");

  const query = parsed.data.query;
  const fallback = fallbackLookup(query);
  if (fallback) {
    return jsonOk(
      { location: { ...fallback, source: "local" } },
      { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const res = await fetch(url, { signal: controller.signal });
    const data = (await res.json()) as { results?: OpenMeteoResult[] };
    const first = data.results?.[0];
    if (!res.ok || !first) {
      return jsonError("I could not find that city. Try a nearby major city or use Advanced location.");
    }

    return jsonOk(
      {
        location: {
          label: labelFor(first),
          lat: first.latitude,
          lng: first.longitude,
          source: "open-meteo",
        },
      },
      { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } }
    );
  } catch {
    return jsonError("City lookup is unavailable right now. Try again or use Advanced location.");
  } finally {
    clearTimeout(timeout);
  }
}
