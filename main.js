/* ============================================================
   Seismograph — earthquake simulator
   ============================================================
   Click the map to start a quake. Drag the slider to pick its
   magnitude. The wave radiates out from the epicenter; each city
   counts down to arrival, then the dot physically shakes in place.

   Bigger quakes really do move faster — the S-wave speed grows
   with magnitude because stronger quakes reach deeper, denser rock.
*/

/* ------------------------------------------------------------
   1. THE MAP
   ------------------------------------------------------------ */
const map = L.map("map", {
  worldCopyJump: true,
  minZoom: 2,
}).setView([5, 170], 3);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);


/* ------------------------------------------------------------
   2. TECTONIC PLATE BOUNDARIES
   ------------------------------------------------------------ */
let platePoints = [];
let glowingLayer = null;

const PLATE_STYLE = { color: "#ff7a00", weight: 1.5, opacity: 0.7 };

fetch("https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json")
  .then((r) => r.json())
  .then((data) => {
    const plateLayer = L.geoJSON(data, {
      style: PLATE_STYLE,
      interactive: false,
    }).addTo(map);

    plateLayer.eachLayer((layer) => {
      collectPoints(layer.feature.geometry.coordinates, layer, platePoints);
    });
  })
  .catch(() => console.warn("Plate data unavailable; click still works."));

function collectPoints(arr, layer, out) {
  if (typeof arr[0] === "number") {
    out.push({ lat: arr[1], lon: arr[0], layer });
    return;
  }
  for (const inner of arr) collectPoints(inner, layer, out);
}

function glowPlate(layer) {
  if (glowingLayer) glowingLayer.setStyle(PLATE_STYLE);
  glowingLayer = layer;
  if (layer) {
    layer.setStyle({ color: "#39ff14", weight: 4, opacity: 1 });
    layer.bringToFront();
  }
}

function nearestPlate(lat, lon) {
  let best = null, bestDist = Infinity;
  for (const p of platePoints) {
    const d = haversine(lat, lon, p.lat, p.lon);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}


/* ------------------------------------------------------------
   3. CITIES  — 50 cities, weighted toward the Pacific Rim
   ------------------------------------------------------------ */
const CITIES = [
  // East Asia
  { name: "Tokyo",           lat:  35.68, lon:  139.69 },
  { name: "Osaka",           lat:  34.69, lon:  135.50 },
  { name: "Sapporo",         lat:  43.06, lon:  141.35 },
  { name: "Seoul",           lat:  37.57, lon:  126.98 },
  { name: "Busan",           lat:  35.10, lon:  129.04 },
  { name: "Beijing",         lat:  39.91, lon:  116.39 },
  { name: "Shanghai",        lat:  31.23, lon:  121.47 },
  { name: "Hong Kong",       lat:  22.30, lon:  114.18 },
  { name: "Taipei",          lat:  25.03, lon:  121.57 },

  // Southeast Asia
  { name: "Manila",          lat:  14.60, lon:  120.98 },
  { name: "Singapore",       lat:   1.35, lon:  103.82 },
  { name: "Jakarta",         lat:  -6.21, lon:  106.85 },
  { name: "Bangkok",         lat:  13.75, lon:  100.52 },
  { name: "Kuala Lumpur",    lat:   3.14, lon:  101.69 },
  { name: "Ho Chi Minh City",lat:  10.82, lon:  106.63 },
  { name: "Hanoi",           lat:  21.03, lon:  105.85 },
  { name: "Yangon",          lat:  16.87, lon:   96.19 },

  // South Asia / Indian Ocean
  { name: "Colombo",         lat:   6.93, lon:   79.86 },
  { name: "Chennai",         lat:  13.08, lon:   80.27 },
  { name: "Mumbai",          lat:  19.08, lon:   72.88 },
  { name: "Karachi",         lat:  24.86, lon:   67.01 },
  { name: "Delhi",           lat:  28.61, lon:   77.21 },
  { name: "Dhaka",           lat:  23.72, lon:   90.41 },

  // Middle East
  { name: "Tehran",          lat:  35.69, lon:   51.39 },
  { name: "Istanbul",        lat:  41.01, lon:   28.95 },
  { name: "Dubai",           lat:  25.20, lon:   55.27 },
  { name: "Riyadh",          lat:  24.69, lon:   46.72 },
  { name: "Baghdad",         lat:  33.34, lon:   44.40 },

  // Africa
  { name: "Cairo",           lat:  30.04, lon:   31.24 },
  { name: "Casablanca",      lat:  33.57, lon:   -7.59 },
  { name: "Lagos",           lat:   6.52, lon:    3.38 },
  { name: "Accra",           lat:   5.56, lon:   -0.20 },
  { name: "Kinshasa",        lat:  -4.32, lon:   15.32 },
  { name: "Nairobi",         lat:  -1.29, lon:   36.82 },
  { name: "Addis Ababa",     lat:   9.03, lon:   38.74 },
  { name: "Dar es Salaam",   lat:  -6.79, lon:   39.21 },
  { name: "Johannesburg",    lat: -26.20, lon:   28.04 },
  { name: "Cape Town",       lat: -33.93, lon:   18.42 },
  { name: "Maputo",          lat: -25.97, lon:   32.59 },
  { name: "Antananarivo",    lat: -18.91, lon:   47.54 },

  // Europe (reachable by large quakes)
  { name: "Athens",          lat:  37.98, lon:   23.73 },
  { name: "Rome",            lat:  41.90, lon:   12.50 },
  { name: "Lisbon",          lat:  38.72, lon:   -9.14 },
  { name: "Madrid",          lat:  40.42, lon:   -3.70 },
  { name: "London",          lat:  51.51, lon:   -0.13 },
  { name: "Paris",           lat:  48.85, lon:    2.35 },
  { name: "Moscow",          lat:  55.75, lon:   37.62 },

  // Russia / North Pacific
  { name: "Vladivostok",     lat:  43.12, lon:  131.90 },
  { name: "Petropavlovsk",   lat:  53.01, lon:  158.65 },

  // Oceania
  { name: "Sydney",          lat: -33.87, lon:  151.21 },
  { name: "Melbourne",       lat: -37.81, lon:  144.96 },
  { name: "Brisbane",        lat: -27.47, lon:  153.02 },
  { name: "Perth",           lat: -31.95, lon:  115.86 },
  { name: "Auckland",        lat: -36.85, lon:  174.76 },
  { name: "Wellington",      lat: -41.29, lon:  174.78 },
  { name: "Port Moresby",    lat:  -9.44, lon:  147.18 },
  { name: "Suva",            lat: -18.14, lon:  178.44 },

  // Pacific islands
  { name: "Honolulu",        lat:  21.31, lon: -157.86 },
  { name: "Guam",            lat:  13.44, lon:  144.79 },

  // North America — west coast
  { name: "Anchorage",       lat:  61.22, lon: -149.90 },
  { name: "Vancouver",       lat:  49.28, lon: -123.12 },
  { name: "Seattle",         lat:  47.61, lon: -122.33 },
  { name: "Portland",        lat:  45.52, lon: -122.68 },
  { name: "San Francisco",   lat:  37.77, lon: -122.42 },
  { name: "Los Angeles",     lat:  34.05, lon: -118.24 },
  { name: "San Diego",       lat:  32.72, lon: -117.16 },

  // Central America / Caribbean
  { name: "Mexico City",     lat:  19.43, lon:  -99.13 },
  { name: "Guatemala City",  lat:  14.64, lon:  -90.51 },
  { name: "Managua",         lat:  12.13, lon:  -86.29 },
  { name: "Panama City",     lat:   8.99, lon:  -79.52 },

  // South America — west coast
  { name: "Bogotá",          lat:   4.71, lon:  -74.07 },
  { name: "Quito",           lat:  -0.23, lon:  -78.52 },
  { name: "Lima",            lat: -12.05, lon:  -77.04 },
  { name: "Santiago",        lat: -33.45, lon:  -70.67 },
  { name: "Valparaíso",      lat: -33.05, lon:  -71.62 },
];

for (const city of CITIES) {
  city.marker = L.circleMarker([city.lat, city.lon], {
    radius: 5,
    color: "#ffffff",
    weight: 1,
    fillColor: "#8a93a6",
    fillOpacity: 1,
  }).addTo(map);

  city.marker.bindTooltip(city.name, {
    permanent: true,
    direction: "right",
    className: "city-label",
    offset: [7, 0],
  });
}


/* ------------------------------------------------------------
   4. THE HAVERSINE FORMULA
   ------------------------------------------------------------
   The Earth is a ball, not a flat sheet. Haversine gives the
   great-circle distance (shortest path over the curved surface)
   between two lat/lon points, in kilometres. */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}


/* ------------------------------------------------------------
   5. MIN-HEAP  (priority queue — pop always gives next arrival)
   ------------------------------------------------------------ */
class MinHeap {
  constructor() { this.items = []; }
  size() { return this.items.length; }

  push(item) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.items[i].time >= this.items[p].time) break;
      [this.items[i], this.items[p]] = [this.items[p], this.items[i]];
      i = p;
    }
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      while (true) {
        let s = i;
        const l = 2 * i + 1, r = 2 * i + 2, n = this.items.length;
        if (l < n && this.items[l].time < this.items[s].time) s = l;
        if (r < n && this.items[r].time < this.items[s].time) s = r;
        if (s === i) break;
        [this.items[i], this.items[s]] = [this.items[s], this.items[i]];
        i = s;
      }
    }
    return top;
  }
}


/* ------------------------------------------------------------
   6. HELPERS
   ------------------------------------------------------------ */

// Bigger quakes reach deeper, denser rock and travel faster.
// M4 ≈ 2.5 km/s, M9 ≈ 5.5 km/s.
function sWaveSpeed(magnitude) {
  return 2.5 + (magnitude - 4) * 0.6;
}

function magnitudeCategory(m) {
  if (m < 4) return "Minor";
  if (m < 5) return "Light";
  if (m < 6) return "Moderate";
  if (m < 7) return "Strong";
  if (m < 8) return "Major";
  return "Great";
}

// Felt zone grows steeply with magnitude.
function feltRadiusKm(magnitude) {
  return 45 * Math.pow(1.85, magnitude);
}

// Colour by shaking strength.
function shakingColor(strength) {
  if (strength > 75) return "#d11507";
  if (strength > 50) return "#f0712b";
  if (strength > 25) return "#f2c037";
  if (strength > 10) return "#9acd32";
  return "#3aa856";
}

// Plain-language shaking description (like a real bulletin).
function intensityWord(strength) {
  if (strength > 80) return "violent shaking";
  if (strength > 60) return "severe shaking";
  if (strength > 40) return "strong shaking";
  if (strength > 20) return "moderate shaking";
  if (strength > 8)  return "light shaking";
  return "faint shaking";
}

// Make the city dot physically move around its original position.
// durationMs: how long to keep shaking (scales with quake size and
// how early the wave arrives — cities hit first shake longest).
function shakeMarker(city, strength, durationMs) {
  const origLat = city.lat;
  const origLon = city.lon;
  const amp = 0.3 + (strength / 100) * 0.9; // 0.3 (weak) → 1.2 (violent) degrees
  const STEP = 80; // ms between jitter frames
  const steps = Math.ceil(durationMs / STEP);
  let n = 0;
  const id = setInterval(() => {
    n++;
    // Decay slowly — stays lively for most of the duration, then settles.
    const decay = Math.pow(1 - n / steps, 0.5);
    city.marker.setLatLng([
      origLat + (Math.random() * 2 - 1) * amp * decay,
      origLon + (Math.random() * 2 - 1) * amp * decay,
    ]);
    if (n >= steps) {
      clearInterval(id);
      city.marker.setLatLng([origLat, origLon]);
    }
  }, STEP);
  activeIntervals.push(id);
}

// Page elements.
const statusEl  = document.getElementById("status");
const logEl     = document.getElementById("log");
const triggerBtn = document.getElementById("trigger");
const magSlider = document.getElementById("mag");
const magValue  = document.getElementById("mag-value");

magSlider.addEventListener("input", () => {
  magValue.textContent = Number(magSlider.value).toFixed(1);
});

let activeIntervals = [];
let waveCircle = null;
let epiMarker  = null;
let currentRun = 0;

const SCREEN_SECONDS = 18; // how long the animation plays


/* ------------------------------------------------------------
   7. THE QUAKE
   ------------------------------------------------------------ */
function startQuake(epiLat, epiLon, faultLayer) {
  currentRun++;
  const runId = currentRun;

  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
  if (waveCircle) map.removeLayer(waveCircle);
  if (epiMarker)  map.removeLayer(epiMarker);

  for (const city of CITIES) {
    city.marker.setStyle({ fillColor: "#8a93a6", radius: 5 });
    city.marker.setLatLng([city.lat, city.lon]); // reset any leftover jitter
  }
  logEl.innerHTML = "";

  glowPlate(faultLayer);

  const magnitude = Number(magSlider.value);
  const speed     = sWaveSpeed(magnitude);   // km/s — varies with magnitude
  const radius    = feltRadiusKm(magnitude);
  const maxStrength = (magnitude / 9) * 100;

  epiMarker = L.marker([epiLat, epiLon], { title: "Epicenter" }).addTo(map);

  // Build the priority queue with cities inside the felt zone.
  const heap = new MinHeap();
  for (const city of CITIES) {
    const distance = haversine(epiLat, epiLon, city.lat, city.lon);
    if (distance > radius) continue;
    heap.push({
      city,
      distance,
      time:     distance / speed,                    // real seconds
      strength: maxStrength * (1 - distance / radius),
    });
  }

  const count = heap.size();
  statusEl.textContent =
    `M${magnitude.toFixed(1)} ${magnitudeCategory(magnitude)} — ` +
    `${count} of the ${CITIES.length} mapped cities in range.` +
    (count === 0 ? " Try a larger magnitude or click nearer a city." : "");

  if (count === 0) return;

  // Drain the heap in arrival order.
  const affected = [];
  while (heap.size() > 0) affected.push(heap.pop());

  const maxRealTime = affected[affected.length - 1].time;
  const scale = (SCREEN_SECONDS * 1000) / maxRealTime;

  // Create a log row for every affected city, in arrival order.
  for (const item of affected) {
    item.screenMs = item.time * scale;
    item.arrived  = false;
    item.li = document.createElement("li");
    logEl.appendChild(item.li);
  }

  // Expanding wave ring.
  waveCircle = L.circle([epiLat, epiLon], {
    radius: 0, color: "#e8453c", weight: 2, fill: false,
  }).addTo(map);

  triggerBtn.disabled = true;
  let startMs = null;

  function tick(now) {
    if (runId !== currentRun) return;
    if (startMs === null) startMs = now;
    const elapsed = now - startMs;

    waveCircle.setRadius(
      Math.min((elapsed / scale) * speed * 1000, radius * 1000)
    );

    for (const item of affected) {
      const remaining = item.screenMs - elapsed;
      if (remaining > 0) {
        // Countdown — show whole seconds.
        item.li.textContent = `${item.city.name}  ·  ${Math.ceil(remaining / 1000)} s`;
      } else if (!item.arrived) {
        item.arrived = true;
        const r = 5 + item.strength / 14;
        item.city.marker.setStyle({ fillColor: shakingColor(item.strength), radius: r });
        // Shake for however long is left in the animation, minimum 4 s.
        const remainingMs = Math.max(SCREEN_SECONDS * 1000 - elapsed, 4000);
        shakeMarker(item.city, item.strength, remainingMs);

        // Plain arrivals log entry — no emoji, no exclamation mark.
        item.li.textContent = `${item.city.name}  —  ${intensityWord(item.strength)}`;
        item.li.style.color = shakingColor(item.strength);
      }
    }

    if (elapsed < SCREEN_SECONDS * 1000 + 200) {
      requestAnimationFrame(tick);
    } else {
      triggerBtn.disabled = false;
    }
  }
  requestAnimationFrame(tick);
}

// Button: random quake on a fault.
triggerBtn.addEventListener("click", () => {
  if (platePoints.length > 0) {
    const p = platePoints[Math.floor(Math.random() * platePoints.length)];
    startQuake(p.lat, p.lon, p.layer);
  } else {
    startQuake(Math.random() * 120 - 60, Math.random() * 360 - 180, null);
  }
});

// Click the map to place the quake.
map.on("click", (e) => {
  const f = nearestPlate(e.latlng.lat, e.latlng.lng);
  startQuake(e.latlng.lat, e.latlng.lng, f ? f.layer : null);
});
