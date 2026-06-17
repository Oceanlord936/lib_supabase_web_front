# Good Library — Backend Session Notes

## Project Goal (V1)

A Spring Boot REST API backend for a student-focused library app.
V1 covers: library map + basic info, Google OAuth login, save favorites.

Tech stack: Spring Boot (Java), PostgreSQL in Docker, JPA, Spring Security, Lombok.

---

## Backend Layer Structure

```
entity/        Java class = database table row (@Entity)
repository/    database access interface (extends JpaRepository)
service/       business logic
controller/    handles HTTP requests, returns JSON
dto/           safe response/request shapes for the HTTP boundary
config/        Spring configuration classes
```

Flow:

```
HTTP Request
    → Controller   (Jackson converts JSON ↔ Java object)
    → Service      (business logic)
    → Repository   (JPA talks to PostgreSQL)
    → Entity       (maps to a table row)
```

---

## Key Concepts

### Entity

Same idea as Android Room `@Entity`. The class describes the table shape.
JPA reads it and knows the schema. Must be a regular `class` (not record) because
JPA needs a no-arg constructor and mutable fields.

```java
@Entity
@Table(name = "libraries")
@Getter @Setter
public class Library {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    // ... fields
}
```

### Repository

Replaces the DAO pattern. Extend `JpaRepository<EntityType, PrimaryKeyType>` and
Spring generates the implementation at runtime. You get save(), findById(),
findAll(), deleteById(), existsById() for free.

```java
public interface LibraryRepository extends JpaRepository<Library, UUID> {
    // empty — all basic methods inherited
    // add custom methods here only when needed e.g. findByName(String name)
}
```

### Service

Business logic layer. Annotated with `@Service`. Uses constructor injection
to get the repository. Converts entities to DTOs before returning.

### Controller

Handles HTTP requests. Annotated with `@RestController`. Uses constructor
injection to get the service. Returns DTOs — Jackson converts them to JSON automatically.

```java
@RestController
@RequestMapping("/libraries")
public class LibraryController {
    @GetMapping               // GET /libraries
    @GetMapping("/{id}")      // GET /libraries/{id}  — @PathVariable UUID id
    @PostMapping              // POST /libraries       — @RequestBody CreateLibraryRequest
}
```

### DTO (Data Transfer Object)

Controls what data crosses the HTTP boundary. Use `record` for DTOs (immutable,
no boilerplate). Never expose raw entities — they may contain sensitive fields
(password hash) or JPA internals that break JSON serialization.

```java
public record LibraryDto(UUID id, String name, ...) {}          // response
public record CreateLibraryRequest(String name, ...) {}          // request (no id, no createdAt)
```

---

## UUID vs Auto-increment

UUID: randomly generated, unguessable (`550e8400-e29b-41d4-a716-446655440000`)
Auto-increment: sequential integers (1, 2, 3...) — attackers can iterate through them

Use UUID for web APIs. JPA generates it automatically with:

```java
@Id
@GeneratedValue(strategy = GenerationType.UUID)
private UUID id;
```

---

## BCrypt Password Hashing

- No secret key — uses a random salt embedded in the hash string itself
- One-way: cannot reverse the hash back to the original password
- Intentionally slow (cost factor) to make brute force impractical
- Comes with Spring Security — no extra dependency needed

```
Raw password "mypassword123"
    → BCrypt → "$2a$10$N9qo8ui..."   (raw password dies here)
    → stored in database
```

On login: BCrypt re-hashes the input with the embedded salt and compares.
Never store or log raw passwords.

---

## Spring Beans

`@Service`, `@Repository`, `@Controller`, `@Component` — all tell Spring to
manage the class as a singleton Bean. Spring creates it once at startup,
injects it wherever needed (Dependency Injection).

`@Bean` on a method in a `@Configuration` class — tells Spring to take the
returned object and manage it as a Bean. Used when configuring third-party
objects you don't own (e.g. SecurityFilterChain).

```java
@Configuration
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
```

---

## Jackson

Spring's default JSON serializer. Automatically converts Java objects to JSON
when returned from a `@RestController` method. No manual calls needed.

```java
return libraryDto;   // Jackson → {"id":"...","name":"...","latitude":43.6}
```

Incoming JSON body: use `@RequestBody` on the method parameter.
Jackson deserializes it into the DTO automatically.

---

## JPA Type Mappings (automatic)

```
String        → VARCHAR
Double        → FLOAT8
UUID          → UUID
LocalDateTime → TIMESTAMP
boolean       → BOOLEAN
```

Only specify `@Column(columnDefinition = ...)` for non-standard types like `text` or `jsonb`.

### Enum mapping

```java
@Enumerated(EnumType.STRING)   // stores "PUBLIC" not 0 — safer if enum order changes
private LibraryType type;
```

### openingHours note

Currently stored as `text` (simple string). Schema says `jsonb` but jsonb requires
extra Hibernate/Jackson wiring. Switch to jsonb in V3+ when you need to query
inside the JSON (e.g. "find libraries open on Monday").

---

## Lombok

Generates boilerplate at compile time.

- `@Getter` / `@Setter` on entity classes — generates all getters and setters
- Avoid `@Data` on JPA entities — its equals/hashCode breaks JPA entity tracking
- Records don't need Lombok — they generate everything automatically

---

## Optional\<T\>

`findById()` returns `Optional<Library>` — a wrapper that either contains a value
or is empty. Forces you to handle the "not found" case.

```java
// recommended pattern in service layer
Library library = repository.findById(id)
    .orElseThrow(() -> new RuntimeException("Library not found"));
```

---

## Streams

```java
// convert List<Library> to List<LibraryDto>
return libraryRepository.findAll()
    .stream()
    .map(l -> new LibraryDto(l.getId(), l.getName(), ...))
    .toList();
```

Same concept as Kotlin's `.map {}`. Java requires `.stream()` and `.toList()` explicitly.
Records use `.field()` not `.getField()` — no `get` prefix.

---

## Files Written

### Entities

- `entity/User.java` — id, email, displayName, authType, password, avatarUrl, createdAt
- `entity/Library.java` — id, name, address, latitude, longitude, libraryType, openingHours, website, createdAt
- `entity/AuthType.java` — enum: GOOGLE, LOCAL
- `entity/LibraryType.java` — enum: PUBLIC, UNIVERSITY

### Repositories

- `repository/LibraryRepository.java` — extends JpaRepository<Library, UUID>
- `repository/UserRepository.java` — extends JpaRepository<User, UUID>

### Services

- `service/LibraryService.java` — getAllLibraries(), getLibraryById(UUID), createLibrary(CreateLibraryRequest)

### Controllers

- `controller/LibraryController.java` — GET /libraries, GET /libraries/{id}, POST /libraries

### DTOs

- `dto/LibraryDto.java` — record: id, name, address, latitude, longitude, type, openingHours, website
- `dto/CreateLibraryRequest.java` — record: name, address, latitude, longitude, type, openingHours, website

### Config

- `config/SecurityConfig.java` — disables CSRF, permits all requests (placeholder until real auth)

---

## Configuration Files

### application.yaml

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/goodlibrary
    username: postgres
    password: postgres
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
  docker:
    compose:
      file: compose.yaml

server:
  port: 8080
```

`ddl-auto: update` — creates tables if they don't exist, keeps existing data on restart.
`show-sql: true` — prints every SQL query to the console, useful for learning.

### compose.yaml (project root)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: goodlibrary
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
```

Spring Boot starts this container automatically when the app runs.
Run `docker compose up -d` to keep it running independently.

---

## Working Endpoints (tested with Postman)

```
GET  /libraries          → returns [] or list of LibraryDto
GET  /libraries/{id}     → returns single LibraryDto or 500 if not found
POST /libraries          → inserts library, returns LibraryDto with generated UUID
```

POST body example:

```json
{
  "name": "Central Library",
  "address": "123 Main St, Toronto",
  "latitude": 43.6532,
  "longitude": -79.3832,
  "type": "PUBLIC",
  "openingHours": "{\"monday\": \"9am-9pm\"}",
  "website": "www.torontopubliclibrary.ca"
}
```

---

## Token-Based Auth (JWT)

### Why JWT

- Stateless — server doesn't store sessions
- Works for mobile and web clients equally
- No cookies needed — token sent manually in Authorization header

### JWT Structure

```
eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJ0ZXN0QGdtYWlsLmNvbSIsImlhdCI6MTc3OX0.signature
|___________________|.|_______________________________________________|.|_________|
       header                          payload                          signature
```

- Header — algorithm used (HS384)
- Payload — email (subject), issued at, expiry — readable but not encrypted
- Signature — header + payload hashed with secret key — tamper proof

### application.yaml JWT config

```yaml
jwt:
  secret: 404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
  expiration: 86400000 # 24 hours in milliseconds
```

Secret must be Base64 encoded, at least 256 bits. Never commit real secret to git.

### @Value

Reads values from application.yaml into fields:

```java
@Value("${jwt.secret}")
private String secretKey;
```

Use `org.springframework.beans.factory.annotation.Value` — NOT `lombok.Value`.

---

## JwtService (utility/JwtService.java)

Three responsibilities:

- `generateToken(email)` — builds JWT using JJWT builder, signs with secret key
- `extractEmail(token)` — parses token, verifies signature, returns subject (email)
- `isTokenValid(token)` — tries to parse, returns true/false, caller validates before extracting

```java
@Service
public class JwtService {
    @Value("${jwt.secret}") private String secretKey;
    @Value("${jwt.expiration}") private long expiration;

    public String generateToken(String email) {
        return Jwts.builder()
            .subject(email)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSigningKey())
            .compact();
    }

    public String extractEmail(String token) {
        return Jwts.parser().verifyWith(getSigningKey()).build()
            .parseSignedClaims(token).getPayload().getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token);
            return true;
        } catch (Exception e) { return false; }
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretKey));
    }
}
```

---

## Auth DTOs

```java
public record RegisterRequest(String email, String password, String displayName) {}
public record LoginRequest(String email, String password) {}
public record AuthResponse(String token, UserDto user) {}
public record UserDto(UUID id, String email, String displayName, AuthType authType, String avatarUrl) {}
```

Request DTOs carry raw password — travels over HTTPS, hashed immediately in service.
Response DTOs never include password — not even the hash.

---

## UserService (service/UserService.java)

Dependencies injected: `UserRepository`, `JwtService`, `PasswordEncoder`

**register flow:**

```
hash password with BCrypt
→ create User entity (AuthType.LOCAL, avatarUrl = null)
→ save to repository (returns savedUser with generated UUID)
→ generate JWT token
→ return AuthResponse(token, UserDto)
```

**login flow:**

```
find user by email → orElseThrow("User not found")
→ passwordEncoder.matches(rawPassword, storedHash)
→ if no match → throw RuntimeException("Invalid password")
→ generate JWT token
→ return AuthResponse(token, UserDto)
```

BCrypt note: never compare hashes with `.equals()` — use `passwordEncoder.matches()`.
BCrypt uses random salt per hash so same password produces different hashes each time.

---

## JwtAuthFilter (filter/JwtAuthFilter.java)

Extends `OncePerRequestFilter` — guaranteed to run exactly once per request.
Annotated `@Component` — not `@Service`, it's infrastructure not business logic.

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // no token → public endpoint → pass through
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);  // strip "Bearer "

        if (jwtService.isTokenValid(token)) {
            String email = jwtService.extractEmail(token);
            UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(email, null, List.of());
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }

        filterChain.doFilter(request, response);  // always pass to next filter
    }
}
```

`filterChain.doFilter()` — passes request to next step in chain. Must always be called.
`SecurityContextHolder.getContext().setAuthentication()` — tells Spring Security who the user is.
`UsernamePasswordAuthenticationToken(email, null, List.of())` — principal=email, credentials=null (already verified), authorities=empty (no roles yet).

---

## SecurityConfig (updated)

```java
@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()   // register + login public
                .anyRequest().authenticated()              // everything else needs token
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

CSRF disabled — correct for JWT/header-based auth. CSRF only applies to cookie-based sessions.
`addFilterBefore` — JwtAuthFilter runs before Spring's built-in auth filter so SecurityContext is set in time.

### Request flow

```
HTTP Request
    → JwtAuthFilter          reads token, sets authentication in SecurityContext
    → Spring built-in filter
    → SecurityConfig rules   /auth/** → allow, everything else → check authentication
    → Controller             only reached if authenticated
```

---

## HTTP Headers

An HTTP request has multiple sections:

```
POST /auth/login
Headers:
    Content-Type: application/json       ← body is JSON
    Authorization: Bearer eyJhbGci...    ← JWT token (protected requests only)
Body:
    { "email": "...", "password": "..." }
```

GET requests have no body. Authorization header only sent on protected endpoints.
Android app stores token after login, attaches it to every subsequent request.

---

## Files Added (Session 2)

- `utility/JwtService.java` — token generation, validation, email extraction
- `filter/JwtAuthFilter.java` — intercepts requests, validates token
- `service/UserService.java` — register + login with BCrypt + JWT
- `controller/AuthController.java` — POST /auth/register, POST /auth/login
- `dto/UserDto.java`, `RegisterRequest.java`, `LoginRequest.java`, `AuthResponse.java`
- `repository/UserRepository.java` — + custom findByEmail(String email)
- `config/SecurityConfig.java` — updated with JWT filter + route protection

build.gradle additions:

```groovy
implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'
```

---

## Working Endpoints (tested with Postman)

```
POST /auth/register     → 200, returns { token, user }         (no token needed)
POST /auth/login        → 200, returns { token, user }         (no token needed)
GET  /libraries         → 403 without token, 200 with token
POST /libraries         → inserts library (token required)
GET  /libraries/{id}    → get single library (token required)
GET  /libraries/nearby  → distance search (token required)
```

Postman: Authorization tab → Bearer Token → paste token from register/login response.

---

## Session 3 — Nearby Search + Library Crawler

### Nearby Search

`GET /libraries/nearby?lat=45.5017&lng=-73.5673&radiusKm=5`

Uses flat Euclidean distance formula (Haversine not needed — city-scale distances under 50km, Earth curvature error is negligible):

```sql
SELECT * FROM libraries
WHERE sqrt(
    power((latitude  - :lat) * 111.0, 2) +
    power((longitude - :lng) * 111.0 * cos(radians(:lat)), 2)
) < :radiusKm
```

- `111.0` — converts degrees to km (1° latitude ≈ 111km, always constant)
- `cos(radians(:lat))` — corrects longitude shrinkage at user's latitude (longitude degrees get smaller toward the poles)

### Flat vs Haversine

Latitude degrees are constant (~111km each) because all latitude lines are equally spaced.
Longitude degrees shrink toward the poles because longitude lines converge — like pizza slices getting narrower toward the center.
`cos(lat)` measures how much the longitude "crust" has shrunk at your latitude.

### Library Data Source — OpenStreetMap Overpass API

Libraries are stored in your PostgreSQL DB. Data comes from OpenStreetMap via Overpass API.

**Overpass API:**

- Free, no API key, no account needed
- Endpoint: `https://overpass-api.de/api/interpreter`
- Request: plain text query (Overpass QL), not JSON
- Response: JSON — parsed into `OverpassResponse` DTO via Jackson

Query by radius:

```
[out:json];
node["amenity"="library"](around:5000,45.5017,-73.5673);
out;
```

Query by country:

```
[out:json][timeout:60];
area["ISO3166-1"="CA"][admin_level=2]->.country;
node["amenity"="library"](area.country);
out;
```

Test queries live at: overpass-turbo.eu

### Architecture — DB as Cache

```
Canadian users  → always hits DB (pre-seeded) → fast
Outside Canada  → DB empty for area → fetchLibraries(lat, lng, radiusKm+50)
                → saves to DB → re-query with original radius → return
                → next search in same area hits DB → fast
```

DB grows organically as users from different countries search. No need to pre-import every country.
Storage is not a concern — all libraries on Earth ≈ 250MB total.

### Canada Startup Import

On app startup, if `libraryRepository.count() < 50`, imports all Canadian libraries automatically.
Canada has ~1338 libraries in OpenStreetMap. Imported once, never re-imported unless table is wiped.

Uses `@EventListener(ApplicationReadyEvent.class)` — fires after Spring fully initializes.

```java
@EventListener(ApplicationReadyEvent.class)
public void runOnStartup() {
    if (libraryRepository.count() < 50) {
        try {
            importByCountry("CA");
        } catch (Exception e) {
            log.warn("Overpass import failed on startup: {}", e.getMessage());
        }
    }
}
```

### Deduplication — osmId

Each library stores the OpenStreetMap node ID (`osmId`) as a unique column.
On import, `findByOsmId()` checks if a node already exists — skips if so.
Prevents duplicates on monthly refresh or repeated imports.

```java
@Column(unique = true)
private Long osmId;
```

`LibraryRepository` custom method:

```java
Optional<Library> findByOsmId(Long osmId);
```

### Files Added (Session 3)

- `overpass/OverpassService.java` — fetchLibraries() (radius), importByCountry() (full country), startup import
- `dto/OverpassResponse.java` — `List<OverpassElement> elements`
- `dto/OverpassElement.java` — `long id, double lat, double lon, OverpassTags tags`
- `dto/OverpassTags.java` — `name, openingHours, website, operator, houseNumber, street, city`
- `Library` entity updated — added `osmId` field
- `LibraryRepository` updated — added `findWithinRadius()` native query, `findByOsmId()`
- `LibraryService` updated — `getLibrariesNearby()` with DB-first + Overpass fallback
- `LibraryController` updated — `GET /libraries/nearby` endpoint
- `SecurityConfig` updated — added `RestTemplate` bean with 120s read timeout
- `application.yaml` updated — added `overpass.url`

### RestTemplate timeout config

```java
@Bean
public RestTemplate restTemplate() {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(10000);   // 10s connect
    factory.setReadTimeout(120000);     // 120s read (country queries take 30-60s)
    return new RestTemplate(factory);
}
```

### Future improvements

- `POST /admin/import?countryCode=US` — trigger country import manually
- `DELETE /libraries/{id}` — admin removes bad OSM entries (e.g. Foundation Center tagged as library)
- Blocklist bad osmIds so they don't re-import on monthly crawl
- `@Scheduled(cron = "0 0 0 1 * *")` — monthly refresh (already noted, add when needed)

---

## Session 4 — Favorites, Google OAuth, Exception Handler

### Favorites

Toggle endpoint — one POST handles both add and remove:

```
POST /favorites/{libraryId}   → ADDED if not favorited, REMOVED if already favorited
GET  /favorites               → returns List<LibraryDto> of user's saved libraries
```

Current user extracted from JWT via `SecurityContextHolder` — never pass userId in request body:

```java
String email = SecurityContextHolder.getContext().getAuthentication().getName();
User user = userRepository.findByEmail(email).orElseThrow(...);
```

`FavoriteRepository` custom methods:

```java
List<Favorite> findByUserId(UUID userId);

@Transactional  // required for custom delete queries
void deleteByUserIdAndLibraryId(UUID userId, UUID libraryId);
```

`@Transactional` note: built-in JPA methods (deleteById) have it automatically. Custom derived delete methods need it declared explicitly.

### Google OAuth

Flow:

```
Android → Google (sign in) → Google ID token
       → POST /auth/google { idToken: "..." }
       → backend verifies with GoogleIdTokenVerifier
       → extract email, name, avatar from payload
       → find or create User with AuthType.GOOGLE, password = null
       → generate YOUR JWT → return AuthResponse
```

After first login, Google is never involved again — same JWT flow as local auth.

Google users cannot login with email + password — check `AuthType` in `UserService.login()`:

```java
if (user.getAuthType() == AuthType.GOOGLE) {
    throw new InvalidCredentialsException("Please sign in with Google");
}
```

Verification:

```java
GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(transport, jsonFactory)
    .setAudience(Collections.singletonList(clientId))
    .build();

try {
    GoogleIdToken googleIdToken = verifier.verify(idToken);
} catch (GeneralSecurityException | IOException | IllegalArgumentException e) {
    throw new InvalidCredentialsException("Invalid Google token");
}
```

`@Value("${google.client-id}")` — client ID in application.yaml. Client secret not needed on backend for token verification.

Testing: get `id_token` from Google OAuth Playground (developers.google.com/oauthplayground).
Add `https://developers.google.com/oauthplayground` to authorized redirect URIs in Google Console.

build.gradle:

```groovy
implementation 'com.google.api-client:google-api-client:2.2.0'
```

### Global Exception Handler

`exception/GlobalExceptionHandler.java` — `@ControllerAdvice` applies to every controller automatically:

```java
@ExceptionHandler(ResourceNotFoundException.class)   → 404
@ExceptionHandler(InvalidCredentialsException.class) → 401
@ExceptionHandler(RuntimeException.class)            → 500 (catch-all)
```

Custom exception classes in `exception/` package:

- `ResourceNotFoundException` — user not found, library not found
- `InvalidCredentialsException` — wrong password, invalid Google token

Both extend `RuntimeException`. Message passed via constructor → `super(message)` → retrieved via `e.getMessage()` in handler.

### Files Added (Session 4)

- `entity/Favorite.java` — id, userId, libraryId, createdAt
- `repository/FavoriteRepository.java` — findByUserId, deleteByUserIdAndLibraryId
- `dto/FavoriteResponse.java` — record: FavoriteStatus, libraryId
- `dto/FavoriteStatus.java` — enum: ADDED, REMOVED
- `service/FavoriteService.java` — getAllFavorite, toggleFavorite, getFavoriteStatus
- `controller/FavoriteController.java` — GET /favorites, POST /favorites/{libraryId}
- `dto/GoogleAuthRequest.java` — record: idToken
- `service/GoogleAuthService.java` — verifies Google token, find-or-create user, returns AuthResponse
- `AuthController.java` updated — POST /auth/google
- `exception/GlobalExceptionHandler.java` — @ControllerAdvice with 404/401/500 handlers
- `exception/ResourceNotFoundException.java`
- `exception/InvalidCredentialsException.java`
- `UserService.java` updated — AuthType check before password verification

### Working Endpoints (full V1)

```
POST /auth/register              → 200 { token, user }       (public)
POST /auth/login                 → 200 { token, user }       (public)
POST /auth/google                → 200 { token, user }       (public)
GET  /libraries                  → 200 List<LibraryDto>      (token required)
GET  /libraries/{id}             → 200 LibraryDto            (token required)
GET  /libraries/nearby           → 200 List<LibraryDto>      (token required)
POST /favorites/{libraryId}      → 200 { status, libraryId } (token required)
GET  /favorites                  → 200 List<LibraryDto>      (token required)
```

---

## Session 5 — Ratings

### Rating Design

Separate `ratings` table — one row per user per library. Average stored on `Library` entity for fast reads.

```
ratings
├── id (UUID)
├── libraryId (UUID)
├── userId (UUID)
├── score (int)        ← 1-5
├── comment (String)   ← nullable
└── createdAt

Library (updated)
├── ...existing fields...
├── averageRating (Double)   ← null until first rating
└── ratingCount (Integer)    ← null until first rating
```

Unique constraint prevents one user rating the same library twice:

```java
@UniqueConstraint(columnNames = {"user_id", "library_id"})
```

Note: use snake_case in `columnNames` — JPA maps camelCase fields to snake_case columns in PostgreSQL.

### Running Average Math

Avoids recalculating from all rows on every add/delete:

```java
// add:
int newCount = count + 1;
Double newAverage = (currentAverage * count + score) / newCount;

// delete:
int newCount = count - 1;
Double newAverage = newCount == 0 ? null : (curAverage * count - score) / newCount;
```

Null guard required — first rating has `averageRating = null`, `ratingCount = null`:

```java
Double currentAverage = library.getAverageRating() != null ? library.getAverageRating() : 0.0;
int count = library.getRatingCount() != null ? library.getRatingCount() : 0;
```

### Endpoints

```
POST   /ratings/{libraryId}   → add rating, returns RatingDto
GET    /ratings/{libraryId}   → get all ratings for a library, returns List<RatingDto>
DELETE /ratings/{libraryId}   → remove current user's rating
```

`RatingDto` — id, score, comment, displayName, createdAt
`RatingRequest` — score, comment (no userId — extracted from JWT)

### LibraryDto Updated

Added `averageRating` and `ratingCount` to `LibraryDto` — frontend sees rating info directly in nearby search results without extra calls.

`ratingCount` matters for display — "4.2 ★ (23 ratings)" vs "4.2 ★ (1 rating)" carry different weight.

### Files Added (Session 5)

- `entity/Rating.java` — id, libraryId, userId, score, comment, createdAt + unique constraint
- `repository/RatingRepository.java` — findByLibraryId, findByUserIdAndLibraryId, deleteByUserIdAndLibraryId
- `dto/RatingRequest.java` — score, comment
- `dto/RatingDto.java` — id, score, comment, displayName, createdAt
- `service/RatingService.java` — getRatings, addRating, deleteRating + running average logic
- `controller/RatingController.java` — GET/POST/DELETE /ratings/{libraryId}
- `entity/Library.java` updated — added averageRating, ratingCount fields
- `dto/LibraryDto.java` updated — added averageRating, ratingCount
- `service/LibraryService.java` updated — all LibraryDto constructors include averageRating, ratingCount
- `service/FavoriteService.java` updated — LibraryDto constructor includes averageRating, ratingCount

### Working Endpoints (full V2 so far)

```
POST   /auth/register                → 200 { token, user }         (public)
POST   /auth/login                   → 200 { token, user }         (public)
POST   /auth/google                  → 200 { token, user }         (public)
GET    /libraries                    → 200 List<LibraryDto>        (token required)
GET    /libraries/{id}               → 200 LibraryDto              (token required)
GET    /libraries/nearby             → 200 List<LibraryDto>        (token required)
POST   /favorites/{libraryId}        → 200 { status, libraryId }  (token required)
GET    /favorites                    → 200 List<LibraryDto>        (token required)
POST   /ratings/{libraryId}          → 200 RatingDto              (token required)
GET    /ratings/{libraryId}          → 200 List<RatingDto>        (token required)
DELETE /ratings/{libraryId}          → 200 void                   (token required)
```

---

---

## Session 6 — User Profile + Search by Name

### User Profile Endpoints

```
GET   /users/me   → returns MeDto (email, displayName, authType, avatarUrl)
PATCH /users/me   → update displayName and avatarUrl, returns MeDto
```

`MeDto` — record: email, displayName, authType, avatarUrl
`UpdateMeRequest` — record: displayName, avatarUrl (email excluded — it is the identity key, changing it breaks JWT auth)

Current user always extracted from `SecurityContextHolder` — never passed in request body.

### HTTP Request Anatomy

| Part of HTTP request               | How you read it in Spring   |
| ---------------------------------- | --------------------------- |
| URL path `/libraries/{id}`         | `@PathVariable`             |
| URL query `?lat=45&lng=-73`        | `@RequestParam`             |
| Body `{ "score": 4 }`              | `@RequestBody` + DTO        |
| Header `Authorization: Bearer xxx` | `JwtAuthFilter` (automatic) |

- `@PathVariable` — identifies a specific resource (ID in the path)
- `@RequestParam` — filters/options in query string; can have `defaultValue` and `required = false`
- `@RequestBody` — entire JSON body deserialized into a DTO; only for POST/PUT/PATCH
- GET requests have no body — body is ignored if sent

### Search by Name

`GET /libraries/library?name=Octogone+Public&lat=45.5&lng=-73.6&radiusKm=50`

Note: endpoint path is `/libraries/library` not `/libraries/search`.

Uses PostgreSQL `pg_trgm` extension for fuzzy matching — handles typos, partial matches, case insensitive.

Enable once in DB:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Connect to Docker container:

```
docker exec -it goodlibrary-postgres-1 psql -U postgres -d goodlibrary
```

Repository query — filters by radius AND similarity, orders by distance then similarity:

```java
@Query(value = """
    SELECT * FROM libraries
    WHERE similarity(name, :query) > 0.3
    AND sqrt(
        power((latitude  - :lat) * 111.0, 2) +
        power((longitude - :lng) * 111.0 * cos(radians(:lat)), 2)
    ) < :radiusKm
    ORDER BY sqrt(
                 power((latitude  - :lat) * 111.0, 2) +
                 power((longitude - :lng) * 111.0 * cos(radians(:lat)), 2)
             ) ASC,
             similarity(name, :query) DESC
    LIMIT 20
    """, nativeQuery = true)
List<Library> searchByName(@Param("query") String query, @Param("lat") double lat, @Param("lng") double lng, @Param("radiusKm") double radiusKm);
```

Bug fixed: original query had no distance WHERE clause — it searched all libraries globally and only sorted by distance. Fixed by adding `AND sqrt(...) < :radiusKm`.

`similarity()` returns 0.0–1.0 — threshold `0.3` means "at least 30% similar". Tune higher for stricter matching.

Service signature (updated):

```java
public List<LibraryDto> getLibraryByName(String name, double lat, double lng, double radiusKm)
```

Cache check still uses 50km fixed radius to ensure area is seeded. Then `searchByName` uses the caller-supplied `radiusKm`.

Controller (updated):

```java
@GetMapping("/library")
public List<LibraryDto> searchByName(
    @RequestParam String name,
    @RequestParam double lat,
    @RequestParam double lng,
    @RequestParam(defaultValue = "50") double radiusKm
) {
    return libraryService.getLibraryByName(name, lat, lng, radiusKm);
}
```

Service flow:

1. Check if libraries exist near lat/lng (50km radius) — same cache logic as nearby search
2. If empty: fetch from Overpass, save to DB
3. Call `searchByName(name, lat, lng, radiusKm)` — filters by both name similarity AND radius
4. Return `List<LibraryDto>`

### Files Added (Session 6)

- `controller/UserController.java` — GET /users/me, PATCH /users/me
- `service/UserService.java` updated — getUserProfile(), updateUserProfile(UpdateMeRequest)
- `dto/MeDto.java` — record: email, displayName, authType, avatarUrl
- `dto/UpdateMeRequest.java` — record: displayName, avatarUrl
- `LibraryRepository` updated — added `searchByName()` native query with pg_trgm
- `LibraryService` updated — added `getLibraryByName(name, lat, lng)`
- `LibraryController` updated — GET /libraries/library (was /libraries/search)
- `RatingService` updated — added getMyRating(libraryId)
- `RatingController` updated — GET /ratings/{libraryId}/me

### Session 7 — Web Frontend (2026-05-28)

- `LibraryRepository.searchByName` — added `radiusKm` param, added distance WHERE clause
- `LibraryService.getLibraryByName` — added `radiusKm` param, passes to repository
- `LibraryController` — endpoint renamed `/library`, added `radiusKm` query param (default 50)

### Working Endpoints

```
POST   /auth/register                → 200 { token, user }         (public)
POST   /auth/login                   → 200 { token, user }         (public)
POST   /auth/google                  → 200 { token, user }         (public)
GET    /libraries                    → 200 List<LibraryDto>        (token required)
GET    /libraries/{id}               → 200 LibraryDto              (token required)
GET    /libraries/nearby             → 200 List<LibraryDto>        (token required)
GET    /libraries/library            → 200 List<LibraryDto>        (token required)
POST   /favorites/{libraryId}        → 200 { status, libraryId }  (token required)
GET    /favorites                    → 200 List<LibraryDto>        (token required)
GET    /favorites/{libraryId}        → 200 FavoriteStatus          (token required)
POST   /ratings/{libraryId}          → 200 RatingDto              (token required)
GET    /ratings/{libraryId}          → 200 List<RatingDto>        (token required)
GET    /ratings/{libraryId}/me       → 200 RatingDto or 404       (token required)
DELETE /ratings/{libraryId}          → 200 void                   (token required)
GET    /users/me                     → 200 MeDto                  (token required)
PATCH  /users/me                     → 200 MeDto                  (token required)
```

### Screen → Endpoint Mapping

| Screen           | Endpoints used                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Login / Register | POST /auth/login, /auth/register, /auth/google                                                          |
| Nearby map/list  | GET /libraries/nearby                                                                                   |
| Search           | GET /libraries/library                                                                                  |
| Library detail   | GET /libraries/{id}, GET /ratings/{libraryId}, GET /ratings/{libraryId}/me, POST /favorites/{libraryId} |
| Favorites        | GET /favorites                                                                                          |
| Profile          | GET /users/me, PATCH /users/me                                                                          |

---

## V2 Remaining

- `PATCH /libraries/{id}` — let admins correct library type, opening hours
- `DELETE /libraries/{id}` — admin removes bad OSM entries
- `POST /admin/import?countryCode=US` — trigger country import manually
- Blocklist bad osmIds so they don't re-import on monthly crawl
- `@Scheduled(cron = "0 0 0 1 * *")` — monthly library data refresh
- Library photos — users upload photos

## V3 Ideas

- Switch `openingHours` from `text` to `jsonb` — enables querying "open now" or "open on Monday"
- Push notifications — notify users when a favorited library changes hours
- Apple Sign-In — same pattern as Google OAuth
- Admin role — separate admin endpoints protected by role-based access control
