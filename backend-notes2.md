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

`GET /libraries/search?name=Octogone+Public&lat=45.5&lng=-73.6`

Uses PostgreSQL `pg_trgm` extension for fuzzy matching — handles typos, partial matches, case insensitive.

Enable once in DB:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Connect to Docker container:

```
docker exec -it goodlibrary-postgres-1 psql -U postgres -d goodlibrary
```

Repository query — distance first, similarity as tiebreaker:

```java
@Query(value = """
    SELECT * FROM libraries
    WHERE similarity(name, :query) > 0.3
    ORDER BY sqrt(
                 power((latitude  - :lat) * 111.0, 2) +
                 power((longitude - :lng) * 111.0 * cos(radians(:lat)), 2)
             ) ASC,
             similarity(name, :query) DESC
    LIMIT 20
    """, nativeQuery = true)
List<Library> searchByName(@Param("query") String query, @Param("lat") double lat, @Param("lng") double lng);
```

`similarity()` returns 0.0–1.0 — threshold `0.3` means "at least 30% similar". Tune higher for stricter matching.

Service flow:

1. Check if libraries exist near lat/lng (50km radius) — same cache logic as nearby search
2. If empty: fetch from Overpass, save to DB
3. Call `searchByName(name, lat, lng)` across whole DB
4. Return `List<LibraryDto>`

### Files Added (Session 6)

- `controller/UserController.java` — GET /users/me, PATCH /users/me
- `service/UserService.java` updated — getUserProfile(), updateUserProfile(UpdateMeRequest)
- `dto/MeDto.java` — record: email, displayName, authType, avatarUrl
- `dto/UpdateMeRequest.java` — record: displayName, avatarUrl
- `LibraryRepository` updated — added `searchByName()` native query with pg_trgm
- `LibraryService` updated — added `getLibraryByName(name, lat, lng)`
- `LibraryController` updated — GET /libraries/search
- `RatingService` updated — added getMyRating(libraryId)
- `RatingController` updated — GET /ratings/{libraryId}/me

### Working Endpoints (complete — ready for Android frontend)

```
POST   /auth/register                → 200 { token, user }         (public)
POST   /auth/login                   → 200 { token, user }         (public)
POST   /auth/google                  → 200 { token, user }         (public)
GET    /libraries                    → 200 List<LibraryDto>        (token required)
GET    /libraries/{id}               → 200 LibraryDto              (token required)
GET    /libraries/nearby             → 200 List<LibraryDto>        (token required)
GET    /libraries/search             → 200 List<LibraryDto>        (token required)
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

### Android Screen → Endpoint Mapping

| Screen           | Endpoints used                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Login / Register | POST /auth/login, /auth/register, /auth/google                                                          |
| Nearby map/list  | GET /libraries/nearby                                                                                   |
| Search           | GET /libraries/search                                                                                   |
| Library detail   | GET /libraries/{id}, GET /ratings/{libraryId}, GET /ratings/{libraryId}/me, POST /favorites/{libraryId} |
| Favorites        | GET /favorites                                                                                          |
| Profile          | GET /users/me, PATCH /users/me                                                                          |

---

---

## Session 7 — Chatroom (Discord-style, WebSocket + STOMP)

### Architecture

Each library has its own set of channels (like a Discord server). Each channel has real-time messages via WebSocket.

```
Library
└── Channel (ANNOUNCEMENT, GENERAL, ...)
    └── Message (content, userId, displayName, createdAt)
```

### Data Model

```
channels
├── id (UUID)
├── libraryId (UUID)
├── name (String)          ← unique per library (unique constraint on library_id + name)
├── channelType (enum)     ← ANNOUNCEMENT, GENERAL
└── createdAt

messages
├── id (UUID)
├── channelId (UUID)
├── userId (UUID)
├── displayName (String)   ← stored at send time, not joined — old messages keep old name
├── content (String)
└── createdAt
```

Unique constraint on channels: `(library_id, name)` — same library cannot have two channels with same name. Different libraries can both have "general".

`displayName` stored on message — same as Discord. If user renames, old messages keep old name.

### WebSocket Flow

```
Client connects:    ws://localhost:8080/ws?token=JWT_TOKEN
Client subscribes:  /topic/channel/{channelId}   ← listen for new messages
Client sends:       /app/chat/{channelId}         ← publish a message
Server:             saves to DB → broadcasts to /topic/channel/{channelId}
All subscribers receive the MessageDto automatically
```

Connection is persistent — token validated once at handshake, not per message.

### JWT Auth for WebSocket

Two classes handle auth during the HTTP→WebSocket upgrade:

**`JwtHandshakeInterceptor`** — reads `?token=` from query param, validates with `JwtService`, stores email in session attributes. Returns `false` (reject) if token invalid.

**`JwtHandshakeHandler`** — reads email from session attributes, wraps as `Principal`. Makes `principal.getName()` work in `@MessageMapping` methods.

`Principal` in WebSocket = same as `SecurityContextHolder` in REST — both give the email.

### STOMP vs @RequestBody

- `@RequestBody` — deserializes JSON from HTTP request body
- `@Payload` — deserializes JSON from WebSocket STOMP message frame
- `@DestinationVariable` — extracts path variable from STOMP destination (like `@PathVariable` for WebSocket)
- `@SendTo("/topic/channel/{channelId}")` — broadcasts return value to all subscribers

### Spring Simple Broker

`registry.enableSimpleBroker("/topic")` — Spring maintains an in-memory subscription map automatically:
```
/topic/channel/uuid-1  →  [user A, user B, user C]
/topic/channel/uuid-2  →  [user B, user D]
```
Same concept as a manual `HashMap<String, List<Session>>` but managed by Spring. Upgrade to RabbitMQ/Redis for production scale.

### Auto-seed Default Channels

First call to `GET /channels/{libraryId}` auto-creates ANNOUNCEMENT + GENERAL if none exist. No separate admin endpoint needed.

### Duplicate Channel Name

`DataIntegrityViolationException` thrown by `save()` when unique constraint violated. Caught in service and rethrown as `IllegalArgumentException("Channel name already exists in this library")`.

### Security Config

`/ws/**` added to `permitAll()` in `SecurityConfig` — Spring Security must let the handshake through. Token validation is handled by `JwtHandshakeInterceptor`, not the JWT filter.

### Testing

WebSocket cannot be tested from `file://` pages — browser blocks it. Serve via `npx serve .` and open `http://localhost:PORT/test.html`.

SockJS must be commented out for raw WebSocket testing with Postman or browser test page. Re-enable for Android/React clients.

### Files Added (Session 7)

- `chatroom/model/ChannelType.java` — enum: ANNOUNCEMENT, GENERAL
- `chatroom/model/entity/Channel.java` — id, libraryId, name, channelType, createdAt
- `chatroom/model/entity/Message.java` — id, channelId, userId, displayName, content, createdAt
- `chatroom/model/repository/ChannelRepository.java` — findByLibraryId
- `chatroom/model/repository/MessageRepository.java` — findByChannelId ordered by created_at DESC LIMIT 50
- `chatroom/model/dto/ChannelDto.java` — id, name, channelType
- `chatroom/model/dto/MessageDto.java` — id, content, displayName, createdAt
- `chatroom/model/dto/SendMessageRequest.java` — content
- `chatroom/model/dto/CreateChannelRequest.java` — name, channelType
- `chatroom/model/jwt/JwtHandshakeInterceptor.java` — validates token during HTTP handshake
- `chatroom/model/jwt/JwtHandshakeHandler.java` — sets Principal from session attributes
- `chatroom/config/WebSocketConfig.java` — STOMP endpoint /ws, broker /topic, app prefix /app
- `chatroom/service/ChannelService.java` — getChannels (with auto-seed), createChannel, seedDefaultChannels
- `chatroom/service/ChatService.java` — getRecentMessages, sendMessage
- `chatroom/controller/ChannelController.java` — GET/POST /channels/{libraryId}
- `chatroom/controller/ChatController.java` — GET /chats/{channelId}, @MessageMapping /chat/{channelId}
- `config/SecurityConfig.java` updated — added /ws/** to permitAll

### Working Endpoints (updated)

```
GET  /channels/{libraryId}        → 200 List<ChannelDto>   (token required, auto-seeds defaults)
POST /channels/{libraryId}        → 200 ChannelDto         (token required)
GET  /chats/{channelId}           → 200 List<MessageDto>   (token required, recent 50 messages)
WS   ws://localhost:8080/ws       → connect with ?token=JWT
     subscribe /topic/channel/{channelId}
     send to   /app/chat/{channelId}
```

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

---

---

## Session 8 — Supabase Rebuild (Learning Supabase)

### Goal

Rebuild the same Good Library backend using Supabase instead of Spring Boot.
Purpose: learn how Supabase works as a backend platform.

### What Supabase Is

Supabase is an open-source Firebase alternative. Create a project on supabase.com and you instantly get:

- Real PostgreSQL database (hosted, no Docker needed)
- Built-in Auth — handles register/login/Google OAuth/JWT automatically
- Auto-generated REST API via PostgREST — reads your tables and creates HTTP endpoints
- Realtime — WebSocket subscriptions built on PostgreSQL LISTEN/NOTIFY
- Storage — file uploads (avatars, photos)
- Edge Functions — serverless TypeScript/Deno functions for custom logic

### Spring Boot → Supabase Mapping

```
Spring Boot                    Supabase
─────────────────────────────────────────────────────
PostgreSQL + Docker        →   Supabase hosted PostgreSQL
JPA / @Entity              →   SQL CREATE TABLE (written manually)
JpaRepository              →   supabase.from('users').select()
BCrypt + JWT + JwtService  →   Supabase Auth (handles everything)
Google OAuth               →   Toggle in Supabase dashboard
Spring Security + RLS      →   Row Level Security (SQL policies in DB)
WebSocket + STOMP          →   Supabase Realtime channels
@Service business logic    →   Edge Functions (TypeScript/Deno)
application.yaml           →   Supabase dashboard config + .env
```

### Row Level Security (RLS)

RLS is PostgreSQL's feature that controls who can read/write each row.
Security check happens at the database level — more secure than application layer.

- Enabled automatically on new tables (enabled "automatic RLS" during project setup)
- Default with no policies = deny everything
- You write SQL policies to open specific access

```sql
-- Example: users can only read their own favorites
CREATE POLICY "users can read own favorites"
ON favorites
FOR SELECT
USING (auth.uid() = user_id);
```

`auth.uid()` — Supabase built-in function, returns logged-in user's UUID from JWT.
Equivalent to `SecurityContextHolder.getContext().getAuthentication().getName()` in Spring.

| | Spring Boot | Supabase |
|---|---|---|
| Auth check happens in | Application layer | Database layer |
| "Who is this user?" | `SecurityContextHolder` | `auth.uid()` |
| Access rules written in | Java (SecurityConfig) | SQL (RLS policies) |
| Default when no rules | depends on config | deny everything |

### Project Structure

```
supabase-goodlibrary/
└── supabase/
    ├── config.toml          ← project settings (created by supabase init)
    ├── migrations/          ← SQL files, one per schema change
    └── functions/           ← Edge Functions (TypeScript)
```

### CLI Setup

```bash
npm install -g supabase        # install CLI
supabase login                 # authorize with supabase.com account
supabase init                  # creates supabase/ folder in project
supabase link --project-ref YOUR_PROJECT_REF_ID   # connect to hosted project
```

Project Reference ID: Settings → General in supabase.com dashboard.

### Workflow

```
Browser (supabase.com dashboard)
    → SQL Editor: CREATE TABLE, RLS policies
    → Auth: configure Google OAuth, view users
    → Table Editor: inspect data
    → API Docs: auto-generated docs per table

VS Code (local)
    → supabase/migrations/*.sql     ← schema changes
    → supabase/functions/*/index.ts ← Edge Functions
    → supabase db push              ← push SQL to hosted project
```

### Build Plan

```
Step 1 — Tables: CREATE TABLE for users profile, libraries, favorites, ratings, channels, messages
Step 2 — Auth: enable email/password + Google OAuth in dashboard
Step 3 — RLS: write policies for each table
Step 4 — Test auto REST API: PostgREST endpoints work with no extra code
Step 5 — Edge Functions: Overpass crawler, running average logic, custom business logic
Step 6 — Realtime: Supabase channels for chatroom (replaces WebSocket/STOMP)
```

---

## Session 9 — Migration, Schema, Postman Testing

### Migration Files

SQL migration files replace manual dashboard table creation. Same concept as Flyway in Spring Boot.

```
supabase/migrations/
  20260612000000_initial_schema.sql     ← all tables, indexes, triggers, RLS, GRANTs
  20260612000001_fix_trigger_search_path.sql  ← SECURITY DEFINER search_path fix
```

Run `supabase db push` to apply new migration files to the hosted project. Supabase tracks which files have already run — never re-applies old ones.

### Why SQL files instead of dashboard

- Schema is source code — tracked in git
- Reproducible — wipe DB and `db push` recreates everything
- Framework-agnostic — same SQL works in Spring Boot (Flyway), Supabase, raw psql
- Dashboard is for reading (inspecting data, logs) — writing goes through migration files

### Spring Boot Entity → SQL mapping

```
@Entity @Table(name="x")     →   CREATE TABLE x
@Id @GeneratedValue(UUID)     →   UUID PRIMARY KEY DEFAULT gen_random_uuid()
@Column(unique=true)          →   UNIQUE
@Enumerated(EnumType.STRING)  →   TEXT CHECK (col IN ('A', 'B'))
@UniqueConstraint             →   UNIQUE (col1, col2)
private Long osmId            →   BIGINT
private Double lat            →   DOUBLE PRECISION
private LocalDateTime         →   TIMESTAMPTZ DEFAULT NOW()
private int score             →   INTEGER NOT NULL  (primitive = not null)
private String comment        →   TEXT              (object = nullable)
```

### Why profiles instead of users

Supabase Auth owns `auth.users` — you cannot create your own users table.
`profiles` table holds the extra fields you own (display_name, avatar_url).
Email, password, authType all live in `auth.users` managed by Supabase.

```
Spring Boot users table  =  auth.users (Supabase) + public.profiles (yours)
```

### SECURITY DEFINER + search_path

Trigger functions that cross schemas (firing on `auth.users`, writing to `public.profiles`)
need `SET search_path = public` — otherwise the function can't resolve table names.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public       ← required
AS $$ ... $$;
```

### GRANT vs RLS

```
GRANT   — can this role (anon/authenticated) touch this table at all?
RLS     — of all rows in that table, which ones can this specific user see/change?
```

Two-layer check — both must pass:
```
Request
  → GRANT:  is SELECT allowed for authenticated on favorites?  YES
  → RLS:    only return rows where user_id = auth.uid()
```

- GRANT = front door (who can enter the building)
- RLS = room locks (which rooms belong to you)

Spring Boot equivalent:
```
SecurityConfig.java  →  GRANT   (who can access the endpoint)
Service layer check  →  RLS     (which rows belong to this user)
```

### PostgREST auto-generated endpoints (no code needed)

```
GET  /rest/v1/libraries                     → all libraries (RLS: public read)
GET  /rest/v1/libraries?id=eq.{uuid}        → single library
POST /rest/v1/libraries                     → insert library
GET  /rest/v1/favorites                     → your favorites only (RLS auto-filters)
POST /rest/v1/favorites                     → add favorite
GET  /rest/v1/ratings?library_id=eq.{uuid}  → ratings for a library
POST /rest/v1/ratings                       → add rating
GET  /rest/v1/profiles                      → your profile only (RLS auto-filters)
PATCH /rest/v1/profiles?id=eq.{uuid}        → update profile
POST /rest/v1/rpc/nearby_libraries          → nearby search RPC
POST /rest/v1/rpc/search_libraries          → fuzzy name search RPC
```

### Postman setup

Headers on every request:
```
apikey:        {anon public key from Settings → API}
Authorization: Bearer {access_token from login/signup}
Content-Type:  application/json
```

Add `Prefer: return=representation` to POST requests to get the created row back in the response.

### Auth endpoints

```
POST /auth/v1/signup                           → register (body: email, password)
POST /auth/v1/token?grant_type=password        → login   (body: email, password)
```

Returns `access_token` + `user.id` in response body.

### Writing rows with user_id

Tables with `user_id` column need it in the POST body. RLS verifies it matches the token:

```json
POST /rest/v1/favorites
{ "user_id": "{your-uuid}", "library_id": "{uuid}" }

POST /rest/v1/ratings
{ "user_id": "{your-uuid}", "library_id": "{uuid}", "score": 4, "comment": "..." }
```

GET requests don't need user_id — RLS filters automatically from the token.

### handle_new_user trigger explained

Fires after every INSERT on auth.users (every signup). Creates the profiles row automatically.
`NEW` = the auth.users row just inserted.

```sql
COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
```
- Google signup → uses full_name from OAuth metadata
- Email signup  → falls back to part before @ in email

### What still needs Edge Functions

```
overpass-import   — Overpass crawler (HTTP call to OSM + DB cache logic)
favorites-toggle  — returns ADDED/REMOVED status
seed-channels     — auto-creates ANNOUNCEMENT + GENERAL on first channel fetch
```

### Working endpoints (tested with Postman)

```
POST /auth/v1/signup                          → 200 { access_token, user }
POST /auth/v1/token?grant_type=password       → 200 { access_token, user }
GET  /rest/v1/libraries                       → 200 List<Library>
POST /rest/v1/libraries                       → 201 Library (with Prefer header)
POST /rest/v1/rpc/nearby_libraries            → 200 List<Library>
POST /rest/v1/favorites                       → 201 Favorite
GET  /rest/v1/favorites                       → 200 List<Favorite> (own rows only)
POST /rest/v1/ratings                         → 201 Rating (triggers average update)
GET  /rest/v1/profiles                        → 200 Profile (own row only)
```

---

## Session 10 — Edge Function: overpass-import (in progress)

### What is an Edge Function

Supabase Edge Functions run on Deno (not Node.js). Each function is one file:

```
supabase/functions/overpass-import/index.ts  →  POST /functions/v1/overpass-import
supabase/functions/favorites-toggle/index.ts →  POST /functions/v1/favorites-toggle
```

Folder name = URL path. One `Deno.serve()` per file = the single endpoint entry point.
Helper functions inside the file are private — never exposed directly.

### Deno vs Node

- No `npm install` — import packages by URL: `import { x } from 'https://esm.sh/pkg@2'`
- Runs TypeScript natively — no compile step
- `Deno.serve()` = entry point (same as `@RestController` in Spring Boot)
- `fetch()` built-in — no axios/RestTemplate needed
- `Deno.env.get('KEY')` = reads environment variables (like `@Value` in Spring Boot)

### Spring Boot → Deno mapping

```
@PostMapping + @RequestBody     →   Deno.serve(async (req) => { req.json() })
RestTemplate.postForObject()    →   fetch(url, { method: 'POST', body: query })
Jackson .class deserialize      →   response.json() as MyInterface
List<T>.stream().filter()       →   array.filter(Boolean)
Collectors.joining(", ")        →   array.join(", ")
str.contains()                  →   str.includes()
ResponseEntity.ok(data)         →   Response.json(data)
```

### TypeScript concepts learned

**Union type = enum**
```ts
type LibraryType = "PUBLIC" | "UNIVERSITY"   // same as Java enum LibraryType
```
Value must be exactly one of the listed strings. Enforced at compile time.

**`string | null`** = nullable String in Java (object type, not primitive)

**`?` on interface field** = nullable/optional — field may be undefined:
```ts
interface OverpassTags {
  name?: string        // may or may not exist in OSM data
  opening_hours?: string
}
```

**`.filter(Boolean)`** = removes undefined, null, "" from an array:
```ts
["475", undefined, "Montreal"].filter(Boolean)  // → ["475", "Montreal"]
// same as Java: .filter(s -> s != null && !s.isEmpty())
```

**`await`** = required on every line that does IO (network, DB). Without it you get a Promise, not the actual data.

### Interfaces defined (two kinds)

```ts
// What Overpass API gives us (incoming)
interface OverpassTags    { name?, opening_hours?, website?, operator?, addr:housenumber?, addr:street?, addr:city? }
interface OverpassElement { id: number, lat: number, lon: number, tags: OverpassTags }
interface OverpassResponse { elements: OverpassElement[] }

// What we insert into the libraries table (must match column names)
interface LibraryInsert   { osm_id, name, address, latitude, longitude, library_type, opening_hours, website }
```

`id`, `average_rating`, `rating_count`, `created_at` excluded from LibraryInsert — all auto-generated by DB.

### Helper functions written (private, called inside Deno.serve)

**`buildAddress(element)`** — joins non-null address parts:
```ts
const parts = [housenumber, street, city].filter(Boolean)
return parts.length > 0 ? parts.join(", ") : null
```

**`findLibraryType(element)`** — checks operator tag for university keywords:
```ts
let type: "PUBLIC" | "UNIVERSITY" = "PUBLIC"
if (operator includes "university"/"université"/"polytechnique"/"college") type = "UNIVERSITY"
return type
```

**`fetchLibraries(lat, lng, radiusKm)`** — calls Overpass API, returns raw OSM elements:
```ts
const query = `[out:json];node["amenity"="library"](around:${radiusKm * 1000},${lat},${lng});out;`
fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query })
→ returns OverpassElement[]
```

### Still to do in overpass-import

1. Loop through `elements`, skip nulls (no name) and duplicates (osm_id exists in DB)
2. Build `LibraryInsert` object for each element using `buildAddress` + `findLibraryType`
3. Insert batch into `libraries` table via Supabase client
4. Return inserted libraries to caller

### Still to build (other Edge Functions)

```
favorites-toggle   — POST /functions/v1/favorites-toggle  → returns ADDED/REMOVED
seed-channels      — POST /functions/v1/seed-channels     → auto-creates ANNOUNCEMENT + GENERAL
```

### Note on frontend

Project has switched from Android to web frontend.

---

## Session 10 — Edge Function: nearby-libraries (COMPLETED)

### Final file structure

```
supabase/functions/
├── _shared/
│   └── overpass.ts          ← all Overpass logic (private, not deployed as endpoint)
├── nearby-libraries/
│   └── index.ts             ← only public endpoint: POST /functions/v1/nearby-libraries
└── overpass-import/
    └── index.ts             ← returns 404, no longer used
seed.ts                      ← run locally once to seed DB from Overpass
```

### nearby-libraries flow

```
POST /functions/v1/nearby-libraries { lat, lng, radiusKm }
  → query DB: nearby_libraries RPC
  → if results found → return immediately (DB cache hit)
  → if empty → return [] (Overpass disabled, Canada-only for now)
```

### Overpass blocked from cloud IPs

Overpass API (overpass-api.de) blocks all cloud server IPs (AWS, GCP, Azure).
406 Not Acceptable is returned regardless of headers, method, or Content-Type.
Solution: run seed.ts locally — your machine IP is not blocked.

### seed.ts — one-time local import

```
deno run --allow-net seed.ts
```

- Calls Overpass from local machine (not blocked)
- Uses importByCountry("CA", supabase) from _shared/overpass.ts
- Inserts directly into Supabase via service_role key
- Result: 1,324 Canadian libraries in DB

User-Agent header required — Overpass rejects Deno's default agent:
```ts
headers: {
  "User-Agent": "GoodLibraryApp/1.0 (educational project)",
  "Accept": "*/*",
}
```

### _shared/overpass.ts — functions (all still there, not deleted)

```
buildAddress(element)          → joins addr:housenumber, addr:street, addr:city
findLibraryType(element)       → PUBLIC or UNIVERSITY based on operator tag
fetchLibraries(lat, lng, km)   → GET request to Overpass, returns OverpassElement[]
saveLibraries(elements, db)    → deduplicates by osm_id, inserts LibraryInsert[]
importByCountry(code, db)      → fetches entire country, calls saveLibraries
overpassFetch(query)           → shared fetch helper with User-Agent header
```

### Supabase client query syntax

```ts
supabase.from('libraries').select('*')                    // SELECT *
supabase.from('libraries').select('id').eq('osm_id', id).maybeSingle()  // WHERE + single row
supabase.from('libraries').insert(result)                  // INSERT
supabase.from('libraries').select('*', { count: 'exact', head: true })  // COUNT(*)
supabase.rpc('nearby_libraries', { lat, lng, radius_km }) // call SQL function
```

### Working endpoint

```
POST https://lqvanfeoizlglnqfndbd.supabase.co/functions/v1/nearby-libraries
Headers: Authorization: Bearer <access_token>, Content-Type: application/json
Body:    { "lat": 45.5017, "lng": -73.5673, "radiusKm": 5 }
→ returns List of libraries from DB
```

---

## Session 11 — Frontend Plan (React + Tailwind)

### Existing frontend

User has a React + Tailwind frontend built for the Spring Boot project.
All fetch URLs point to localhost Spring Boot endpoints.

### Plan for Supabase frontend

New frontend needed (can borrow components, all backend fetches must be rewritten).

Spring Boot → Supabase URL mapping:
```
POST /auth/login                    → supabase.auth.signInWithPassword()
POST /auth/register                 → supabase.auth.signUp()
POST /auth/google                   → supabase.auth.signInWithOAuth({ provider: 'google' })
GET  /libraries/nearby              → POST /functions/v1/nearby-libraries
GET  /libraries/search              → POST /rest/v1/rpc/search_libraries
GET  /libraries/{id}                → supabase.from('libraries').select().eq('id', id)
POST /favorites/{libraryId}         → needs favorites-toggle Edge Function (not built yet)
GET  /favorites                     → supabase.from('favorites').select()
POST /ratings/{libraryId}           → supabase.from('ratings').insert()
GET  /ratings/{libraryId}           → supabase.from('ratings').select().eq('library_id', id)
GET  /users/me                      → supabase.auth.getUser() + profiles table
PATCH /users/me                     → supabase.from('profiles').update()
```

Auth tokens are handled automatically by the Supabase JS client — no manual
Authorization header needed unlike Spring Boot.

### Still to build (Edge Functions)

```
favorites-toggle   → POST /functions/v1/favorites-toggle  → returns ADDED/REMOVED
seed-channels      → POST /functions/v1/seed-channels     → auto-creates ANNOUNCEMENT + GENERAL
```
