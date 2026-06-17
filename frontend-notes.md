# Good Library — Frontend Session Notes

## Project Goal

Web frontend for the Good Library app.
Stack: Next.js + TypeScript + Tailwind CSS + shadcn/ui components.
Backend: Spring Boot on localhost:8080 (already built, all V1 endpoints working).

---

## Project Setup

- Framework: Next.js 16 with TypeScript and Tailwind CSS
- UI components: shadcn/ui (from v0.dev zip — includes button, input, label, card, etc.)
- Project folder: repo root `Library_web_frontend/` (was `login-screen-design/`, flattened)
- Start dev server: `npm run dev` from repo root
- View at: http://localhost:3000

### Key commands
```
npm install       — install all dependencies (run once after cloning or adding packages)
npm run dev       — start dev server with hot reload
npm run build     — compile for production
npm start         — serve production build
```

---

## Concepts Learned

### File structure
- `app/` folder — every subfolder = a URL route
- `app/page.tsx` — the / homepage
- `app/login/page.tsx` — the /login page
- `app/layout.tsx` — wraps every page (nav bar goes here)
- No HTML files — Next.js generates HTML from JSX automatically

### React component structure
Every page follows the same pattern:

```tsx
"use client"

// 1. STATE — variables that hold user input or fetched data
const [email, setEmail] = useState("")
const [loading, setLoading] = useState(false)
const [error, setError] = useState("")

// 2. ROUTER — for navigation between pages
const router = useRouter()

// 3. FUNCTIONS — what happens on user actions
const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  // call backend, handle response
}

// 4. UI — JSX with Tailwind classes
return (
  <div className="...">...</div>
)
```

### useState
- Returns [currentValue, setterFunction] via array destructuring
- TypeScript infers the type from the initial value
- Calling the setter triggers a re-render automatically

### async/await
- Use for any operation that takes time (fetch, etc.)
- Must mark function as `async` to use `await` inside it
- Always wrap in try/catch/finally

### try/catch/finally pattern
```tsx
try {
  // main logic — might fail
} catch {
  // network error — backend not running
} finally {
  setLoading(false)  // always runs — success or failure
}
```

### response.ok vs catch
- `!response.ok` — server replied with error (401 wrong password, 404 not found)
- `catch` — no reply at all (network down, backend not running)

### localStorage
- Built into the browser — no import needed
- Persists after page refresh and browser close
- Used to store the JWT token after login

```tsx
localStorage.setItem("token", data.token)  // save
localStorage.getItem("token")              // read later
localStorage.removeItem("token")           // delete on logout
```

### JSX rules
- `className` instead of `class`
- `{}` inside JSX = switch to JavaScript
- Self-closing tags for elements with no children: `<Input />`
- `<a href="">` = clickable link, `<button>` = clickable button
- `<form onSubmit={handler}>` — groups inputs, Enter submits, requires e.preventDefault()

---

## CORS Fix (Spring Boot)

Browser blocks requests from localhost:3000 to localhost:8080 by default.
Fix: add to `SecurityConfig.java`:

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/auth/**").permitAll()
            .anyRequest().authenticated()
        )
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
}

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:3000"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

---

## Pages Built

### Login page — app/(auth)/login/page.tsx (COMPLETE)

State: `email`, `password`, `error`, `loading`

Functions:
- `handleLogin` — POST /auth/login, saves token, navigates to /home
- `handleGoogleLogin(idToken)` — POST /auth/google, saves token, navigates to /home

Google OAuth setup:
- `@react-oauth/google` installed
- `GoogleOAuthProvider` wrapped in `app/providers.tsx`
- Authorized JavaScript origin `http://localhost:3000` added in Google Cloud Console

### Register page — app/(auth)/register/page.tsx (COMPLETE)

State: `displayName`, `email`, `password`, `confirmPassword`, `error`, `loading`

Functions:
- `handleRegister` — client-side password match check, POST /auth/register, saves token, navigates to /home

### Home page — app/(main)/home/page.tsx (COMPLETE)

State:
- `libraries` — fetched Library[] array
- `loading`, `error`
- `search` — name search input
- `radiusKm` — slider value, default 10
- `Location` — user GPS {lat, lng} from browser
- `advancedSearch` — toggles advanced search mode
- `useCurrentLocation` — uses GPS vs manual coords
- `manualLat`, `manualLng` — manual coordinate inputs
- `selectedPin` — coordinates of user's map click {lat, lng} | null
- `favoriteIds` — `Set<string>` of library ids the user has favorited

useEffects:
- Effect 1 `[]` — gets GPS location once via `navigator.geolocation.getCurrentPosition`
- Effect 2 `[Location, radiusKm, advancedSearch]` — fetches nearby libraries, skips when `advancedSearch` is ON
- Effect 3 `[]` — fetches GET /favorites on mount, extracts ids into `favoriteIds` Set so hearts render correctly on first load

Functions:
- `handleSearch(overrideRadius?)` — calls GET /libraries/library?name=&lat=&lng=&radiusKm=
  - Uses `overrideRadius` when called from slider (avoids stale state), falls back to `radiusKm` state when called from button
- `handleMapClick(lat, lng)` — sets `manualLat`, `manualLng`, and `selectedPin` when user clicks map in advanced mode
- `handleToggleFavorite(libraryId)` — POST /favorites/{id}, checks response `data.status`:
  - `"ADDED"` → `setFavoriteIds(prev => new Set(prev).add(libraryId))`
  - `"REMOVED"` → create new Set, call `.delete(libraryId)`, set state
  - Card stays in list, only heart fill changes

UI modes:
- Default (advancedSearch OFF): radius slider + map + nearby list
- Advanced (advancedSearch ON): name search bar + slider + useCurrentLocation checkbox + optional lat/lng inputs + Search button + map

Dynamic title:
- `!advancedSearch` → "Libraries Near You"
- `advancedSearch && useCurrentLocation` → "Search Libraries Near You"
- `advancedSearch && !useCurrentLocation` → "Search Libraries by Location"

### Map component — components/map.tsx (COMPLETE)

Library: `react-leaflet` + `leaflet` + `@types/leaflet`
Import: `dynamic(() => import("@/components/map"), { ssr: false })` — SSR disabled because Leaflet uses window/document

Props (MapProps):
- `center` — user GPS position, map centers here
- `libraries` — renders a blue marker per library
- `selectedPin` — renders a red dot where user clicked
- `onMapClick` — callback fired with lat/lng when map is clicked

Internal components:
- `ClickHandler` — uses `useMapEvents` to listen for clicks, calls `onMapClick`
- `MapCenterUpdater` — uses `useMap` to move the map view when `center` changes

Icon fix: Leaflet's default marker icons break in webpack/Turbopack — manually point to CDN URLs via `L.Icon.Default.mergeOptions`

Note: `useMapEvents` and `useMap` must be inside components rendered inside `MapContainer` to access Leaflet's internal context.

### Navbar — components/navbar.tsx (COMPLETE)

- Logo + nav links: Discover, Favorites, Profile
- Logout button: clears localStorage token, redirects to /login
- Active link indicator: uses `usePathname()` from next/navigation — `active={pathname === "/home"}` etc. Underline appears on current page automatically.

---

## Route Structure

```
app/
├── layout.tsx              — root layout (fonts, providers)
├── page.tsx                — / redirect to /login
├── (auth)/                 — unauthenticated pages
│   ├── login/page.tsx
│   └── register/page.tsx
└── (main)/                 — protected pages (auth guard in layout)
    ├── layout.tsx          — checks token, redirects to /login if missing
    ├── home/page.tsx
    └── favorites/page.tsx
```

---

### Favorites page — app/(main)/favorites/page.tsx (COMPLETE)

State: `libraries` (Library[]), `loading`, `error`

`fetchFavorites` is a standalone async function (not inside useEffect) so it can be called from multiple places.

useEffect `[]`: calls `fetchFavorites()` on mount

Functions:
- `handleRemoveFavorite(libraryId)` — POST /favorites/{id}, if `data.status === "REMOVED"` filters card from `libraries`
- `handleRatingSubmit(libraryId, rating, comment)` — POST /ratings/{id} with `{score, comment}`. If response not ok (duplicate key), DELETE /ratings/{id} then POST again. Calls `fetchFavorites()` after to refresh averages.

LibraryCard props passed: `isFavorite={true}`, `showRating={true}`, `onFavoriteClick={handleRemoveFavorite}`, `onRatingSubmit={handleRatingSubmit}`

### LibraryCard component — components/library-card.tsx (COMPLETE)

Props: `id`, `name`, `address`, `type`, `openingHours`, `website`, `rating`, `ratingCount`, `isFavorite?`, `onFavoriteClick?`, `showRating?`, `onRatingSubmit?`

**Heart icon** (top-right, absolute):
- `fill`/`stroke` driven by `isFavorite` prop
- `e.stopPropagation()` prevents bubbling
- fires `onFavoriteClick?.(id)` — page handles the backend call

**Visual stars** (display only):
- Gray stars layer + yellow stars layer clipped by `width: ${rating/5*100}%`
- Both layers have `pointer-events-none` so clicks don't get swallowed
- `flex-shrink-0` on yellow stars so they don't compress — `overflow-hidden` cuts them cleanly

**Rate button** (shown only when `showRating={true}`):
- Opens rating popup via local `showRatingPopup` state

**Rating popup** (local state, card owns it):
- Local state: `showRatingPopup`, `selectedRating`, `hoveredRating`, `comment`
- 5 clickable stars — `onMouseEnter/Leave` for hover preview, `onClick` locks selection
- `fill={i <= (hoveredRating || selectedRating) ? "currentColor" : "none"}` — hover takes priority
- Text input for comment, defaults to `"no comment"` via `comment || "no comment"`
- Submit fires `onRatingSubmit?.(id, selectedRating, comment || "no comment")` then resets state
- Cancel closes without submitting

**Comments button**:
- Fetches GET /ratings/{id} on click, stores result in local `comments` state
- Comments popup shows list of `{displayName, score, comment}` per rating
- `{"★".repeat(score)}` renders star characters for each rating
- All local to the card — favorites page knows nothing about comments

**Prop vs local state decision rule:**
- Page needs to know (re-render list, call backend) → callback prop, page implements handler
- Only card needs it (popup open/close, comments list) → local useState inside card

---

### Profile page — app/profile/page.tsx (COMPLETE)

Note: profile is outside `(main)/` — placed directly under `app/` (no auth group). Add to `(main)/` if auth guard is needed.

State: `userProfile` (type userProfile | null), `loading`, `error`, `favoritesCount`, `ratingsCount`, `isEditing`, `editValue`, `avatarValue`

Type:
```tsx
type userProfile = { email: string; displayName: string; authType: string; avatarUrl: string; }
```

useEffect `[]`: calls `handleProfileFetch()` and `fetchCounts()` in parallel on mount

Functions:
- `handleProfileFetch` — GET /users/me, sets `userProfile`
- `fetchCounts` — `Promise.all` fetches GET /favorites and GET /ratings/me simultaneously, sets counts from `data.length`
- `handleSave` — PATCH /users/me with `{displayName: editValue, avatarUrl: avatarValue}`, updates `userProfile` state from response
- `handleCancel` — sets `isEditing(false)`

Edit flow: pencil icon sets `isEditing(true)` + pre-fills `editValue`/`avatarValue` from current profile. Ternary swaps display text ↔ input fields inline (not a popup).

Initials derived inline: `userProfile?.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)`

Avatar URL shown as clickable `<a href>` link with `break-all` to wrap long URLs.

Dark mode toggle: `useTheme()` from `next-themes` — `checked={theme === "dark"}`, `onCheckedChange` calls `setTheme("dark"/"light")`.

### Dark mode setup (COMPLETE)

- Package: `next-themes` — `npm install next-themes`
- `ThemeProvider` added to `app/providers.tsx` wrapping the whole app: `attribute="class" defaultTheme="light"`
- `suppressHydrationWarning` added to `<html>` in `app/layout.tsx` — fixes hydration mismatch because theme class is applied client-side
- All hardcoded colors replaced with shadcn semantic tokens throughout: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-muted`

Semantic token map:
- `bg-[#f8f9fa]` → `bg-background`
- `text-[#111827]` → `text-foreground`
- `text-[#6b7280]` → `text-muted-foreground`
- `border-[#e5e7eb]` → `border-border`
- `bg-white` → `bg-card` (inside cards) or `bg-background` (page)
- `bg-[#f3f4f6]` → `bg-muted`

---

### Community page — app/community/page.tsx (IN PROGRESS — REST complete, WebSocket pending)

Discord-like layout: left sidebar (library list + channel list), right chat panel.

Exported types (shared across components — import from this file):
```tsx
export type Channel = { id: string; name: string; channelType: string; }
export type Library = { id: string; name: string; ...(full favorite fields)...; channels?: Channel[]; }
export type Message = { id: string; content: string; displayName: string; createdAt: string; }
```

State: `libraries` (Library[]), `loading`, `error`, `selectedLibraryId`, `selectedChannelId`, `messages`

Functions:
- `fetchFavorites` — GET /favorites, then calls `fetchAllChannels(data)`
- `fetchAllChannels(libs)` — `Promise.all` fetches GET /channels/{id} for every library simultaneously, embeds channels into each library with `{ ...lib, channels: data }`
- `handleLibrarySelect(id)` — sets selectedLibraryId, clears channel/messages
- `handleChannelSelect(id)` — sets selectedChannelId, fetches GET /chats/{id} for message history
- `handleSend(content)` — WebSocket publish (placeholder, not yet implemented)

`selectedChannel` derived inline: `libraries.find(l => l.id === selectedLibraryId)?.channels?.find(c => c.id === selectedChannelId)`

Layout:
```tsx
<div className="flex flex-col h-screen">
  <Navbar />
  <main className="flex flex-1 overflow-hidden bg-background">
    <ChatSidebar ... />
    <ChatPanel ... />
  </main>
</div>
```

Components:
- `ChatSidebar` — imports `Library` type from community/page. Shows library list + channel list for selected library. Uses `cn()` for conditional active highlight.
- `ChatPanel` — shows message history + input form. Time formatted with `new Date(createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })`. `onSend` callback wired to input (WebSocket pending).

WebSocket backend (STOMP):
- Connect: `ws://localhost:8080/ws?token=<jwt>`
- Send: `/app/chat/{channelId}` with `{content}`
- Subscribe: `/topic/channel/{channelId}`
- Package needed: `npm install @stomp/stompjs`

---

## Pages To Build

| Page | Route | Key endpoints |
|---|---|---|
| Library detail | /libraries/[id] | GET /libraries/{id}, GET /ratings/{libraryId} |

---

## Workflow Per Page

```
Phase 1 — UI only
    Generate with v0.dev or write JSX manually
    Use static/fake data in the return()
    Tweak Tailwind until it looks right

Phase 2 — Logic
    Add useState fields
    Write async handler functions
    Call Spring Boot API with fetch()
    Handle loading + error states

Phase 3 — Connect
    Wire up navigation with router.push()
    Pass token in Authorization header for protected routes
```

---

## Sending the JWT Token (for protected routes)

Every request after login needs the token in the Authorization header:

```tsx
const token = localStorage.getItem("token")

const response = await fetch("http://localhost:8080/libraries/nearby", {
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
})
```

---

## Backend Notes (search endpoint fix)

`GET /libraries/library?name=&lat=&lng=&radiusKm=`

The `searchByName` SQL query must include a distance `WHERE` clause — without it, the query searches all libraries in the DB globally. The ORDER BY alone is not a filter.

```sql
WHERE similarity(name, :query) > 0.3
AND sqrt(
    power((latitude - :lat) * 111.0, 2) +
    power((longitude - :lng) * 111.0 * cos(radians(:lat)), 2)
) < :radiusKm
```

`radiusKm` is a `@Param` passed from the controller (default 50).

---

## Key Patterns

### Slider triggering a fetch with fresh value
State updates are async — calling `setRadiusKm(val[0])` then immediately using `radiusKm` in a fetch still reads the old value. Fix: pass the new value directly as a parameter:

```tsx
onValueChange={(val) => {
  setRadiusKm(val[0]);
  if (advancedSearch && search.trim()) {
    handleSearch(val[0]); // fresh value, not stale state
  }
}}
```

### useEffect dependency array
- `[]` — run once on mount only
- `[a, b]` — run on mount + whenever a or b changes
- no array — runs after every render (almost always a bug)

### Async inside useEffect
useEffect cannot be async directly. Define an async function inside and call it:
```tsx
useEffect(() => {
  const doWork = async () => { ... };
  doWork();
}, []);
```

### onClick vs onSubmit
- `onSubmit` on `<form>` — catches button click AND Enter key in any input
- `onClick` on button — only catches click
- Always put handlers on the form, not the button

### Button onClick with a function that takes parameters
React passes a MouseEvent as the first arg to onClick handlers.
If your function has a typed parameter, wrap it:
```tsx
<Button onClick={() => handleSearch()}>Search</Button>  // correct
<Button onClick={handleSearch}>Search</Button>           // MouseEvent passed as overrideRadius — TypeScript error
```

### dynamic import for browser-only libraries
Leaflet and any library that uses window/document cannot run on the server.
Use dynamic import with ssr: false to load it only in the browser:
```tsx
import dynamic from "next/dynamic"
import type { MapProps } from "@/components/map"

const Map = dynamic<MapProps>(() => import("@/components/map"), { ssr: false })
```
The generic `<MapProps>` tells TypeScript what props the lazily loaded component has.

### MapContainer props are immutable after first render
Leaflet's MapContainer ignores prop changes after it first renders.
To move the map programmatically, use a child component with useMap():
```tsx
function MapCenterUpdater({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], map.getZoom())
  }, [center, map])
  return null
}
```

### Set for tracking ids
Use `Set<string>` when you need fast membership checks (is this id favorited?):
```tsx
const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

// add
setFavoriteIds(prev => new Set(prev).add(id));

// remove
setFavoriteIds(prev => { const next = new Set(prev); next.delete(id); return next; });

// check (in JSX)
isFavorite={favoriteIds.has(library.id)}
```
Must always create a new Set — mutating the existing one won't trigger re-render (React compares by reference).

### Callback props (passing functions as props)
The card holds no state. The page owns state. The card just fires a callback with data:
```tsx
// interface — slot definition
onFavoriteClick?: (id: string) => void;

// card JSX — fires the callback
onFavoriteClick?.(id);

// page JSX — fills the slot with a real function
<LibraryCard onFavoriteClick={handleToggleFavorite} />
```
The `?` makes it optional — safe to omit on pages that don't use favorites yet.

### Active nav link with usePathname
```tsx
import { usePathname } from "next/navigation";
const pathname = usePathname();

<NavLink href="/home" active={pathname === "/home"}>Discover</NavLink>
<NavLink href="/favorites" active={pathname === "/favorites"}>Favorites</NavLink>
```
`pathname` always matches the current URL — no manual tracking needed.

### Fractional star display (clip mask technique)
Two layers stacked with `absolute inset-0` — gray stars underneath, yellow stars on top clipped to a percentage width:
```tsx
<div className="relative inline-flex">
  <div className="flex text-gray-300 pointer-events-none">...</div>  {/* gray */}
  <div
    className="absolute inset-0 flex overflow-hidden text-yellow-400 pointer-events-none"
    style={{ width: `${(rating / 5) * 100}%` }}
  >
    {stars with flex-shrink-0}  {/* yellow, clipped */}
  </div>
</div>
```
`flex-shrink-0` on each star prevents compression — `overflow-hidden` on parent cuts with a straight line.
`pointer-events-none` on both layers so the wrapper div can receive clicks.

### Extracting fetch out of useEffect for reuse
When a fetch needs to be called from multiple places (mount + after an action), define it as a standalone function and call it from useEffect:
```tsx
const fetchData = async () => { ... };
useEffect(() => { fetchData(); }, []);
// then also call fetchData() after submit
```

### Immutable state updates
Never mutate state directly — React won't detect the change:
```tsx
// arrays — use filter/map/spread, not splice/push
setLibraries(prev => prev.filter(lib => lib.id !== id));

// Sets — always create a new Set from the old one
setFavoriteIds(prev => new Set(prev).add(id));
```

### Promise.all for parallel fetches
When you need data from two endpoints and neither depends on the other, fetch both at the same time:
```tsx
const [res1, res2] = await Promise.all([
  fetch("http://localhost:8080/favorites", { headers: { Authorization: `Bearer ${token}` } }),
  fetch("http://localhost:8080/ratings/me", { headers: { Authorization: `Bearer ${token}` } }),
]);
```
Faster than sequential fetches — both requests fly at once.

### Inline edit swap (ternary UI)
For single editable fields, swap between display and edit mode with a boolean state — no popup needed:
```tsx
{isEditing ? (
  <input value={editValue} onChange={...} />  // edit mode
) : (
  <span>{value} <PencilIcon onClick={() => setIsEditing(true)} /></span>  // display mode
)}
```
Use popups when many instances exist (cards in a list). Use inline swap for single sections (profile fields).

### Sharing types across files
Define and export types once, import everywhere — no duplicates:
```tsx
// community/page.tsx
export type Library = { ... };

// chat-sidebar.tsx
import type { Library } from "@/app/community/page";
```
Use `type` (not `interface`) for shared data shapes. Use `interface` for component props.

### Chained optional access on arrays
```tsx
libraries
  .find(l => l.id === selectedLibraryId)  // Library | undefined
  ?.channels                               // Channel[] | undefined
  ?.find(c => c.id === selectedChannelId) // Channel | undefined
```
Each `?.` short-circuits to `undefined` if the previous step returned undefined.

### Embedding related data into parent array items
When child data (channels) belongs to a parent (library), embed it with spread:
```tsx
const updated = await Promise.all(
  libs.map(async (lib) => {
    const data = await fetchChannels(lib.id);
    return { ...lib, channels: data };
  })
);
setLibraries(updated);
```

### Formatting ISO timestamp to time only
```tsx
new Date(createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
// "2026-06-05T20:23:24.235758" → "8:23 PM"
```
Pass `undefined` as locale to use the browser's default.

### JSX requires {} for any JavaScript expression
Plain text renders as-is. Everything else needs `{}`:
```tsx
<span>Hello</span>              // literal text — no braces
<span>{name}</span>             // variable — braces
<span>{new Date().toString()}</span>  // function call — braces
```

### Shadcn semantic color tokens
Use these instead of hardcoded hex so dark mode works automatically:
- `bg-background` / `bg-card` / `bg-muted` — page, card, subtle backgrounds
- `text-foreground` / `text-muted-foreground` — primary and secondary text
- `border-border` — dividers and outlines

### Dev mode vs production CPU usage
- `npm run dev` — 80% CPU, keeps compiler + file watcher running, use while writing code
- `npm run build` + `npm start` — 4% CPU idle, compiled static files, use when testing

---

## WebSocket / Chatroom (Session 7)

### Backend chatroom endpoints
```
GET  /channels/{libraryId}        → List<ChannelDto>    — get channels, auto-seeds ANNOUNCEMENT + GENERAL
POST /channels/{libraryId}        → ChannelDto          — create a new channel
GET  /chats/{channelId}           → List<MessageDto>    — recent 50 messages (history on load)
WS   ws://localhost:8080/ws?token=JWT  — real-time connection
```

### STOMP over WebSocket

Install:
```
npm install @stomp/stompjs
```

Connect, subscribe, and send:
```tsx
import { Client } from "@stomp/stompjs"

const token = localStorage.getItem("token")

const client = new Client({
  brokerURL: `ws://localhost:8080/ws?token=${token}`,
  onConnect: () => {
    // subscribe to receive messages
    client.subscribe(`/topic/channel/${channelId}`, (msg) => {
      const message = JSON.parse(msg.body)
      setMessages(prev => [...prev, message])
    })
  },
  onStompError: (frame) => console.error("STOMP error", frame)
})

client.activate()   // connect
client.deactivate() // disconnect (call in useEffect cleanup)
```

Send a message:
```tsx
client.publish({
  destination: `/app/chat/${channelId}`,
  body: JSON.stringify({ content: "Hello" })
})
```

### useEffect pattern for WebSocket

```tsx
useEffect(() => {
  const client = new Client({
    brokerURL: `ws://localhost:8080/ws?token=${token}`,
    onConnect: () => {
      client.subscribe(`/topic/channel/${channelId}`, (msg) => {
        setMessages(prev => [...prev, JSON.parse(msg.body)])
      })
    }
  })
  client.activate()
  return () => { client.deactivate() }  // cleanup on unmount or channelId change
}, [channelId])  // re-run when user switches channel
```

### Page flow for chatroom

1. `GET /channels/{libraryId}` on mount → render channel list sidebar
2. User clicks a channel → set `selectedChannelId`
3. `GET /chats/{channelId}` → load message history into state
4. WebSocket subscribes to `/topic/channel/{channelId}` → new messages append to state
5. User types + submits → `client.publish(...)` → backend saves + broadcasts → received via subscription

### Token in WebSocket URL

JWT goes as query param, not Authorization header:
```
ws://localhost:8080/ws?token=eyJhbGci...
```
Backend validates it during the HTTP→WebSocket handshake. After connection, no re-auth per message.

### SockJS note

Backend has `.withSockJS()` commented out for raw WebSocket testing. When building the real frontend, re-enable SockJS on the backend and use SockJS client:
```
npm install sockjs-client
```
```tsx
import SockJS from "sockjs-client"

const client = new Client({
  webSocketFactory: () => new SockJS(`http://localhost:8080/ws?token=${token}`)
})
```
SockJS provides fallback for environments that don't support native WebSocket.