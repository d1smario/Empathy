"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { StravaStyleMap } from "@/components/training/StravaStyleMap";

/**
 * Mappa GPS **3D reale** con MapLibre GL: base CartoDB dark + terreno estruso da
 * tile di elevazione gratuite (AWS Terrarium, no API key) + vista inclinata (pitch).
 * MapLibre caricato da CDN (come StravaStyleMap con Leaflet), nessuna dipendenza npm
 * e nessuna CSP che blocchi i tile. La traccia è drappeggiata sul terreno 3D.
 */
type LatLng = [number, number]; // [lat, lon] — coerente con StravaStyleMap

type SessionRoute3DMapProps = {
  route: LatLng[];
  height?: number;
};

// Tipi minimi per MapLibre da CDN (evita `any`).
type MlMap = {
  on: (ev: string, cb: () => void) => void;
  addSource: (id: string, src: unknown) => void;
  addLayer: (layer: unknown) => void;
  setTerrain: (t: unknown) => void;
  fitBounds: (b: unknown, opts?: unknown) => void;
  easeTo: (opts: unknown) => void;
  getBearing: () => number;
  addControl: (c: unknown, pos?: string) => void;
  remove: () => void;
};
type MlMarker = {
  setLngLat: (c: [number, number]) => MlMarker;
  addTo: (m: MlMap) => MlMarker;
};
type MlBounds = { extend: (c: [number, number]) => MlBounds };
type MapLibreApi = {
  Map: new (opts: unknown) => MlMap;
  Marker: new (opts?: unknown) => MlMarker;
  LngLatBounds: new (sw: [number, number], ne: [number, number]) => MlBounds;
  NavigationControl: new (opts?: unknown) => unknown;
};

declare global {
  interface Window {
    maplibregl?: MapLibreApi;
  }
}

const MAPLIBRE_VERSION = "4.7.1";

function ensureMapLibreCss() {
  if (document.getElementById("maplibre-css")) return;
  const link = document.createElement("link");
  link.id = "maplibre-css";
  link.rel = "stylesheet";
  link.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
  document.head.appendChild(link);
}

function loadMapLibreScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.maplibregl) {
      resolve();
      return;
    }
    const existing = document.getElementById("maplibre-js");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("MapLibre load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "maplibre-js";
    script.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("MapLibre load failed")), { once: true });
    document.head.appendChild(script);
  });
}

/** Stile MapLibre inline: base raster CartoDB + DEM terrarium (elevazione) + hillshade + sky. */
const MAP_STYLE = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© CARTO © OpenStreetMap",
    },
    terrainDem: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 14,
    },
  },
  layers: [
    { id: "carto", type: "raster", source: "carto" },
    {
      id: "hillshade",
      type: "hillshade",
      source: "terrainDem",
      paint: { "hillshade-exaggeration": 0.5, "hillshade-shadow-color": "#000000" },
    },
  ],
  // Orizzonte/atmosfera 3D: proprietà di stile MapLibre (NON un layer "sky", che è di Mapbox).
  sky: {
    "sky-color": "#0a0a12",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#1a1a2e",
    "horizon-fog-blend": 0.5,
    "fog-color": "#05050a",
    "fog-ground-blend": 0.5,
  },
} as const;

export function SessionRoute3DMap({ route, height = 340 }: SessionRoute3DMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  // Se MapLibre non renderizza (WebGL software/assente, CDN bloccato…) si ripiega
  // sulla mappa 2D Leaflet — sempre funzionante — così qualcosa si vede comunque.
  const [fallback2d, setFallback2d] = useState(false);
  // true quando il 3D ha davvero renderizzato: finché è false mostriamo un placeholder
  // (utile mentre la scheda è nascosta e il render-loop rAF è in pausa).
  const [ready, setReady] = useState(false);
  // Vista 3D (pitch inclinato) vs 2D (dall'alto). La bussola di MapLibre appiattiva il pitch a 0
  // senza modo di tornare al 3D: questo toggle RIMETTE il pitch, e un pulsante ruota la mappa.
  const [is3d, setIs3d] = useState(true);

  const toggle3d = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3d;
    map.easeTo({ pitch: next ? 62 : 0, bearing: next ? -18 : 0, duration: 500 });
    setIs3d(next);
  };
  const rotateMap = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: map.getBearing() - 45, duration: 450 });
  };

  const mapBtnStyle: CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(10,10,18,0.78)",
    color: "#e5e7eb",
    fontSize: "0.72rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
  };

  const lngLat = useMemo<[number, number][]>(
    () => (route.length >= 2 ? route.map(([lat, lon]) => [lon, lat]) : [[9.19, 45.4642], [9.205, 45.472]]),
    [route],
  );

  useEffect(() => {
    if (fallback2d) return;
    let cancelled = false;
    let loaded = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function init() {
      ensureMapLibreCss();
      await loadMapLibreScript();
      if (cancelled || !containerRef.current || !window.maplibregl) return;

      const ml = window.maplibregl;
      if (mapRef.current) mapRef.current.remove();

      let minLon = Infinity;
      let minLat = Infinity;
      let maxLon = -Infinity;
      let maxLat = -Infinity;
      for (const [lon, lat] of lngLat) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
      const center: [number, number] = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];

      const map = new ml.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center,
        zoom: 11,
        pitch: 62,
        bearing: -18,
        attributionControl: false,
        antialias: true,
      });
      mapRef.current = map;
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-left");

      map.on("load", () => {
        if (cancelled) return;
        loaded = true;
        clearTimeout(timeout);
        map.setTerrain({ source: "terrainDem", exaggeration: 1.6 });

        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: lngLat },
          },
        });
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#000000", "line-width": 7, "line-opacity": 0.5 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ff6a00", "line-width": 4 },
        });

        new ml.Marker({ color: "#34d399" }).setLngLat(lngLat[0]!).addTo(map);
        new ml.Marker({ color: "#f43f5e" }).setLngLat(lngLat[lngLat.length - 1]!).addTo(map);

        const bounds = new ml.LngLatBounds([minLon, minLat], [maxLon, maxLat]);
        map.fitBounds(bounds, { padding: 60, pitch: 62, bearing: -18, duration: 0, maxZoom: 15 });
        if (!cancelled) setReady(true);
      });
    }

    // MapLibre avanza il caricamento di stile/tile nel render-loop requestAnimationFrame,
    // che il browser METTE IN PAUSA quando la scheda è in background (document.hidden).
    // Perciò inizializziamo — e armiamo il timeout di fallback — SOLO a scheda visibile:
    // così l'utente vede sempre il 3D quando guarda la pagina e non si ripiega sul 2D solo
    // perché la scheda era nascosta (altra tab in primo piano, automazione, prerender…).
    // Ripiega sul 2D SOLO se, a scheda VISIBILE, "load" non arriva entro 12s (WebGL assente).
    // A scheda nascosta il render-loop è in pausa: non è un errore ⇒ non conteggiare, riprova.
    function armFallbackTimer() {
      timeout = setTimeout(function check() {
        if (loaded || cancelled) return;
        if (typeof document !== "undefined" && document.hidden) {
          timeout = setTimeout(check, 4000);
          return;
        }
        setFallback2d(true);
      }, 12000);
    }

    function startWhenVisible() {
      if (cancelled) return;
      armFallbackTimer();
      init().catch(() => {
        if (!cancelled) setFallback2d(true);
      });
    }

    let onVis: (() => void) | undefined;
    if (typeof document !== "undefined" && document.hidden) {
      onVis = () => {
        if (!document.hidden) {
          if (onVis) document.removeEventListener("visibilitychange", onVis);
          startWhenVisible();
        }
      };
      document.addEventListener("visibilitychange", onVis);
    } else {
      startWhenVisible();
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (onVis) document.removeEventListener("visibilitychange", onVis);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lngLat, fallback2d]);

  if (fallback2d) {
    return <StravaStyleMap route={route} height={height} />;
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {!ready ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(160deg,#0a0a12,#05050a)",
            color: "rgba(255,255,255,0.45)",
            fontSize: "0.7rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          Percorso 3D · caricamento…
        </div>
      ) : null}
      {ready ? (
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6, zIndex: 2 }}>
          <button
            type="button"
            onClick={toggle3d}
            style={mapBtnStyle}
            title={is3d ? "Vista dall'alto (2D)" : "Vista inclinata (3D)"}
          >
            {is3d ? "2D" : "3D"}
          </button>
          <button
            type="button"
            onClick={rotateMap}
            style={{ ...mapBtnStyle, fontSize: "1rem" }}
            title="Ruota la mappa 45°"
            aria-label="Ruota la mappa"
          >
            ↻
          </button>
        </div>
      ) : null}
    </div>
  );
}
