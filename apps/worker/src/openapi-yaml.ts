/**
 * Embedded OpenAPI 3.0.3 YAML specification.
 *
 * Cloudflare Workers cannot read files at runtime, so the full spec is
 * inlined here as a template-literal string.  Keep in sync with the
 * canonical source at `openapi.yaml` in the repo root.
 */
export const OPENAPI_YAML = `openapi: 3.0.3
info:
  title: PartyGame Backend API
  description: |-
    OpenAPI specification for the PartyGame serverless game-server platform.
    Designed for auto-generating native SDKs and AI-agent integration.

    ## Authentication

    - **Player endpoints** use \`Authorization: Bearer <JWT>\` (obtained via \`/auth/*\`).
    - **Admin endpoints** require \`Authorization: Bearer <ADMIN_SECRET>\` (or \`X-Admin-Token\` header).

    ## AI-Agent Discovery

    Visit \`/.well-known/agent-config.json\` (no auth) for a machine-readable
    manifest describing available protocols and configuration endpoints.
  version: 1.0.0
servers:
  - url: http://localhost:8787
    description: Local development server
  - url: https://your-worker.workers.dev
    description: Production Cloudflare Worker

paths:
  # ──────────────────────────────────────────── Root / Meta ─────────────────────
  /:
    get:
      summary: Root info
      operationId: getRootInfo
      responses:
        "200":
          description: Worker metadata and enabled modules
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/RootInfo"

  /health:
    get:
      summary: Health check
      operationId: healthCheck
      responses:
        "200":
          description: Service healthy
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/HealthStatus"

  # ──────────────────────────────────────── AI-Agent Discovery ──────────────────
  /.well-known/agent-config.json:
    get:
      summary: AI-agent discoverable manifest
      description: |-
        Machine-readable manifest describing how AI agents interact with PartyGame.
        No authentication required.
      operationId: getAgentConfig
      security: []
      responses:
        "200":
          description: Agent configuration manifest
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AgentConfig"

  # ──────────────────────────────────────── OpenAPI Spec ────────────────────────
  /openapi.yaml:
    get:
      summary: OpenAPI specification (YAML)
      operationId: getOpenApiYaml
      security: []
      responses:
        "200":
          description: Full OpenAPI 3.0.3 spec in YAML
          content:
            text/yaml:
              schema:
                type: string

  /openapi.json:
    get:
      summary: OpenAPI specification (JSON)
      operationId: getOpenApiJson
      security: []
      responses:
        "200":
          description: Full OpenAPI 3.0.3 spec as JSON
          content:
            application/json:
              schema:
                type: object

  # ──────────────────────────────────────── Authentication ──────────────────────
  /auth/login:
    post:
      summary: Login via Player ID / Name
      operationId: authLogin
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/LoginRequest"
      responses:
        "200":
          description: Successful login
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"

  /auth/google:
    post:
      summary: Login via Google ID Token
      operationId: authLoginGoogle
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [idToken]
              properties:
                idToken:
                  type: string
                  description: Google ID token from OAuth flow
      responses:
        "200":
          description: Successful login
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"

  /auth/apple:
    post:
      summary: Login via Apple ID Token
      operationId: authLoginApple
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [idToken]
              properties:
                idToken:
                  type: string
                  description: Apple ID token from Sign in with Apple
                name:
                  type: string
                  description: Display name (often provided on first login)
      responses:
        "200":
          description: Successful login
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"

  # ──────────────────────────────────────── Platform State ──────────────────────
  /api/platform:
    get:
      summary: Get public platform state
      description: Returns current feature flags, API version, server tiers, and seasons. No auth required.
      operationId: getPlatformState
      security: []
      responses:
        "200":
          description: Current platform state
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PlatformState"

  # ──────────────────────────────────────── Admin: Platform ─────────────────────
  /admin/platform:
    get:
      summary: Get full platform state (admin)
      description: Returns the complete platform state including deprecations and revision number.
      operationId: adminGetPlatformState
      security:
        - AdminSecret: []
      responses:
        "200":
          description: Complete platform state
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PlatformState"
        "401":
          $ref: "#/components/responses/Unauthorized"
    patch:
      summary: Update platform state
      description: |-
        Full patch of platform state. Supports optimistic concurrency via
        \`If-Match\` header containing the expected \`revision\` number.
        Returns 409 \`CONFLICT\` on revision mismatch.
      operationId: adminPatchPlatformState
      security:
        - AdminSecret: []
      parameters:
        - name: If-Match
          in: header
          schema:
            type: integer
          description: Expected revision for optimistic concurrency
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PlatformStatePatch"
      responses:
        "200":
          description: Updated platform state
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PlatformState"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "409":
          $ref: "#/components/responses/Conflict"

  /admin/platform/features:
    patch:
      summary: Update feature flags only
      description: |-
        Lightweight endpoint to enable/disable specific features.
        Supports optimistic concurrency via \`If-Match\` header.
      operationId: adminPatchPlatformFeatures
      security:
        - AdminSecret: []
      parameters:
        - name: If-Match
          in: header
          schema:
            type: integer
          description: Expected revision for optimistic concurrency
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PlatformFeatures"
      responses:
        "200":
          description: Updated platform state
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PlatformState"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "409":
          $ref: "#/components/responses/Conflict"

  # ──────────────────────────────────────── Admin: Modules ──────────────────────
  /admin/modules:
    get:
      summary: List all modules
      description: Returns module manifests with their enabled/disabled status based on feature flags.
      operationId: adminListModules
      security:
        - AdminSecret: []
      responses:
        "200":
          description: Module list
          content:
            application/json:
              schema:
                type: object
                properties:
                  modules:
                    type: array
                    items:
                      $ref: "#/components/schemas/ModuleManifest"
        "401":
          $ref: "#/components/responses/Unauthorized"

  /admin/modules/{moduleId}/manifest:
    get:
      summary: Get module manifest
      operationId: adminGetModuleManifest
      security:
        - AdminSecret: []
      parameters:
        - name: moduleId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Module manifest
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ModuleManifest"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  # ──────────────────────────────────────── Admin: Players ──────────────────────
  /admin/players:
    get:
      summary: List players
      operationId: adminListPlayers
      security:
        - AdminSecret: []
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        "200":
          description: Paginated player list with ban status
          content:
            application/json:
              schema:
                type: object
                properties:
                  players:
                    type: array
                    items:
                      $ref: "#/components/schemas/PlayerWithBan"
                  cursor:
                    type: string
                    nullable: true
        "401":
          $ref: "#/components/responses/Unauthorized"

  /admin/players/{playerId}:
    get:
      summary: Get player details
      operationId: adminGetPlayer
      security:
        - AdminSecret: []
      parameters:
        - name: playerId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Player details with account, ban, and progress
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PlayerDetail"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  /admin/players/{playerId}/ban:
    post:
      summary: Ban a player
      operationId: adminBanPlayer
      security:
        - AdminSecret: []
      parameters:
        - name: playerId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                reason:
                  type: string
                  description: Reason for the ban
                expiresAt:
                  type: string
                  format: date-time
                  description: Optional expiration time
      responses:
        "200":
          description: Ban applied
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  ban:
                    $ref: "#/components/schemas/BanRecord"
        "401":
          $ref: "#/components/responses/Unauthorized"
    delete:
      summary: Unban a player
      operationId: adminUnbanPlayer
      security:
        - AdminSecret: []
      parameters:
        - name: playerId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Ban removed
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
        "401":
          $ref: "#/components/responses/Unauthorized"

  /admin/players/{playerId}/kick:
    post:
      summary: Kick a player
      description: Force-disconnect a player (audited).
      operationId: adminKickPlayer
      security:
        - AdminSecret: []
      parameters:
        - name: playerId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Kick request recorded
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
        "401":
          $ref: "#/components/responses/Unauthorized"

  /admin/audit:
    get:
      summary: List audit records
      operationId: adminListAudit
      security:
        - AdminSecret: []
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        "200":
          description: Paginated audit records
          content:
            application/json:
              schema:
                type: object
                properties:
                  records:
                    type: array
                    items:
                      $ref: "#/components/schemas/AuditRecord"
                  cursor:
                    type: string
                    nullable: true
        "401":
          $ref: "#/components/responses/Unauthorized"

  # ──────────────────────────────────────── Admin: Assets ───────────────────────
  /admin/assets:
    get:
      summary: List all assets
      operationId: adminListAssets
      security:
        - AdminSecret: []
      responses:
        "200":
          description: Asset index with all manifests
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AssetIndex"
        "401":
          $ref: "#/components/responses/Unauthorized"
    post:
      summary: Create a new asset
      operationId: adminCreateAsset
      security:
        - AdminSecret: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateAssetRequest"
      responses:
        "200":
          description: Asset created with upload URLs
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateAssetResponse"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"

  /admin/assets/{assetId}:
    delete:
      summary: Delete an asset and all its variants
      operationId: adminDeleteAsset
      security:
        - AdminSecret: []
      parameters:
        - name: assetId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Asset deleted
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  /admin/assets/{assetId}/variant/{variantIndex}/upload:
    put:
      summary: Upload a variant binary
      description: |-
        Upload raw binary for a specific variant index. If watermark is enabled,
        the uploaded data MUST contain a valid watermark block matching the variant
        index, or the upload will be rejected.
      operationId: adminUploadVariant
      security:
        - AdminSecret: []
      parameters:
        - name: assetId
          in: path
          required: true
          schema:
            type: string
        - name: variantIndex
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
      responses:
        "200":
          description: Variant uploaded
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  assetId:
                    type: string
                  variantIndex:
                    type: integer
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  /admin/assets/forensic/watermark:
    post:
      summary: Forensic watermark extraction
      description: Extract variant index and payload from a watermarked binary. Used to trace leaks.
      operationId: adminForensicWatermark
      security:
        - AdminSecret: []
      requestBody:
        required: true
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
      responses:
        "200":
          description: Watermark extraction result
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/WatermarkResult"
        "401":
          $ref: "#/components/responses/Unauthorized"

  # ──────────────────────────────────────── Public: Assets ──────────────────────
  /api/assets/{assetId}:
    get:
      summary: Serve an asset variant
      description: |-
        Deterministic variant selection based on userId and assetId.
        Returns the binary asset with variant headers.
      operationId: getAsset
      security: []
      parameters:
        - name: assetId
          in: path
          required: true
          schema:
            type: string
        - name: userId
          in: query
          schema:
            type: string
          description: Player ID for deterministic variant selection
      responses:
        "200":
          description: Asset binary with watermark headers
          headers:
            X-Asset-Variant:
              schema:
                type: integer
              description: Selected variant index
            X-Asset-Variant-Count:
              schema:
                type: integer
              description: Total variant count
          content:
            application/octet-stream:
              schema:
                type: string
                format: binary
        "404":
          $ref: "#/components/responses/NotFound"

  # ──────────────────────────────────────── Hotfix / Game Updates ───────────────
  /hotfix/upload:
    post:
      summary: Upload a hotfix patch
      description: |-
        Upload a new game patch (multipart/form-data or JSON with base64).
        Auto-promotes to latest unless \`?autoPromote=false\`.
      operationId: hotfixUpload
      security:
        - AdminSecret: []
      parameters:
        - name: autoPromote
          in: query
          schema:
            type: boolean
            default: true
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                version:
                  type: string
                gameVersionMin:
                  type: string
                checksum:
                  type: string
                file:
                  type: string
                  format: binary
          application/json:
            schema:
              $ref: "#/components/schemas/HotfixUploadJson"
      responses:
        "200":
          description: Hotfix uploaded
          content:
            application/json:
              schema:
                type: object
                properties:
                  manifest:
                    $ref: "#/components/schemas/HotfixManifest"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          description: Feature disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureDisabled"
        "413":
          description: Patch too large

  /hotfix/list:
    get:
      summary: List all hotfix versions
      operationId: hotfixList
      security:
        - AdminSecret: []
      responses:
        "200":
          description: Hotfix version list
          content:
            application/json:
              schema:
                type: object
                properties:
                  versions:
                    type: array
                    items:
                      $ref: "#/components/schemas/HotfixManifest"
                  latest:
                    type: string
                    nullable: true
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          description: Feature disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureDisabled"

  /hotfix/latest:
    get:
      summary: Get latest hotfix
      operationId: hotfixLatest
      security: []
      responses:
        "200":
          description: Latest hotfix manifest
          content:
            application/json:
              schema:
                type: object
                properties:
                  manifest:
                    $ref: "#/components/schemas/HotfixManifest"
        "403":
          description: Feature disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureDisabled"
        "404":
          $ref: "#/components/responses/NotFound"

  /hotfix/{version}/patch:
    get:
      summary: Download a hotfix patch
      operationId: hotfixDownloadPatch
      security: []
      parameters:
        - name: version
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Patch zip file
          content:
            application/zip:
              schema:
                type: string
                format: binary
        "403":
          description: Feature disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureDisabled"
        "404":
          $ref: "#/components/responses/NotFound"

  /hotfix/promote/{version}:
    post:
      summary: Promote a hotfix to latest
      operationId: hotfixPromote
      security:
        - AdminSecret: []
      parameters:
        - name: version
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Hotfix promoted
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  latest:
                    type: string
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          description: Feature disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureDisabled"
        "404":
          $ref: "#/components/responses/NotFound"

  /hotfix/rollback/{version}:
    post:
      summary: Rollback to a previous hotfix version
      description: Sets the specified version as the latest.
      operationId: hotfixRollback
      security:
        - AdminSecret: []
      parameters:
        - name: version
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Rollback applied
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  latest:
                    type: string
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          description: Feature disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureDisabled"
        "404":
          $ref: "#/components/responses/NotFound"

  /hotfix/{version}:
    delete:
      summary: Delete a hotfix version
      operationId: hotfixDelete
      security:
        - AdminSecret: []
      parameters:
        - name: version
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Hotfix deleted
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          description: Feature disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureDisabled"

  # ──────────────────────────────────────── Matchmaking ─────────────────────────
  /matchmaking/join:
    post:
      summary: Join matchmaking queue
      operationId: joinMatchmaking
      security:
        - PlayerToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                playerId:
                  type: string
                gameType:
                  type: string
                  default: moba
      responses:
        "200":
          description: Joined queue
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean

  /matchmaking/status:
    get:
      summary: Check matchmaking status
      operationId: getMatchmakingStatus
      security:
        - PlayerToken: []
      parameters:
        - name: playerId
          in: query
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Current match status
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MatchmakingStatus"

  # ──────────────────────────────────────── Leaderboard ─────────────────────────
  /leaderboard/{id}:
    get:
      summary: Get leaderboard
      operationId: getLeaderboard
      security: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Top players
          content:
            application/json:
              schema:
                type: object
                properties:
                  entries:
                    type: array
                    items:
                      $ref: "#/components/schemas/LeaderboardEntry"
                  updatedAt:
                    type: string
                    format: date-time

  /leaderboard/{id}/submit:
    post:
      summary: Submit score
      operationId: submitScore
      security:
        - PlayerToken: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SubmitScoreRequest"
      responses:
        "200":
          description: Score submitted
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean

  # ──────────────────────────────────────── Player Profile ──────────────────────
  /profile/{id}:
    get:
      summary: Get player profile
      operationId: getProfile
      security: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Player profile data
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PlayerProfile"
    patch:
      summary: Update player profile
      operationId: updateProfile
      security:
        - PlayerToken: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ProfileUpdateRequest"
      responses:
        "200":
          description: Profile updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  profile:
                    $ref: "#/components/schemas/PlayerProfile"

# ──────────────────────────────────────────── Components ────────────────────────
components:
  securitySchemes:
    AdminSecret:
      type: http
      scheme: bearer
      description: |-
        Admin API key. Set via \`ADMIN_SECRET\` or \`ADMIN_TOKEN\` env variable.
        Can also be passed as \`X-Admin-Token\` header.

    PlayerToken:
      type: http
      scheme: bearer
      description: JWT obtained from \`/auth/*\` endpoints.

  responses:
    Unauthorized:
      description: Missing or invalid admin secret
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    Conflict:
      description: Revision conflict (optimistic concurrency)
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ConflictResponse"
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

  schemas:
    # ── Generic ────────────────────────────────────────────────────────────────
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
        message:
          type: string

    ConflictResponse:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        expectedRevision:
          type: integer
        actualRevision:
          type: integer

    FeatureDisabled:
      type: object
      properties:
        error:
          type: string
        feature:
          type: string

    # ── Root / Meta ────────────────────────────────────────────────────────────
    RootInfo:
      type: object
      properties:
        name:
          type: string
        version:
          type: string
        modules:
          type: array
          items:
            $ref: "#/components/schemas/ModuleManifest"

    HealthStatus:
      type: object
      properties:
        status:
          type: string
        timestamp:
          type: number

    ModuleManifest:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        icon:
          type: string
        enabled:
          type: boolean
          description: Whether required feature flags are active

    # ── Agent Config ───────────────────────────────────────────────────────────
    AgentConfig:
      type: object
      properties:
        engine:
          type: string
        version:
          type: string
        agentProtocols:
          type: object
          properties:
            rest:
              type: object
              properties:
                baseUrl:
                  type: string
                openApiSpec:
                  type: string
                authHeader:
                  type: string
                authScheme:
                  type: string
            cli:
              type: object
              properties:
                package:
                  type: string
                command:
                  type: string
        configEndpoints:
          type: object
          properties:
            platform:
              type: object
            modules:
              type: string
            assets:
              type: object
            players:
              type: object
            hotfix:
              type: object
        featureFlags:
          type: object

    # ── Auth ───────────────────────────────────────────────────────────────────
    LoginRequest:
      type: object
      properties:
        playerId:
          type: string
        playerName:
          type: string

    AuthResponse:
      type: object
      properties:
        token:
          type: string
          description: JWT for subsequent API calls
        playerId:
          type: string
        playerName:
          type: string
        expiresAt:
          type: string
          format: date-time

    # ── Platform State ─────────────────────────────────────────────────────────
    PlatformFeatures:
      type: object
      properties:
        voiceChat:
          type: boolean
        textChat:
          type: boolean
        gameUpdates:
          type: boolean
        matchmaking:
          type: boolean
        leaderboard:
          type: boolean
        friends:
          type: boolean
        playerProfile:
          type: boolean
        seasons:
          type: boolean
        replays:
          type: boolean
        guilds:
          type: boolean
        watermark:
          type: boolean

    PlatformState:
      type: object
      properties:
        features:
          $ref: "#/components/schemas/PlatformFeatures"
        currencies:
          type: object
          additionalProperties:
            $ref: "#/components/schemas/CurrencyDef"
        seasons:
          type: object
          properties:
            currentSeasonId:
              type: string
            endsAt:
              type: string
              format: date-time
        apiVersion:
          type: string
        minClientVersion:
          type: string
        deprecations:
          type: array
          items:
            $ref: "#/components/schemas/Deprecation"
        maintenance:
          $ref: "#/components/schemas/MaintenanceWindow"
        serverTiers:
          type: array
          items:
            $ref: "#/components/schemas/ServerTierDef"
        revision:
          type: integer
          description: Monotonic revision for optimistic concurrency
        updatedAt:
          type: string
          format: date-time

    PlatformStatePatch:
      type: object
      properties:
        features:
          $ref: "#/components/schemas/PlatformFeatures"
        currencies:
          type: object
          additionalProperties:
            $ref: "#/components/schemas/CurrencyDef"
        seasons:
          type: object
        apiVersion:
          type: string
        minClientVersion:
          type: string
        deprecations:
          type: array
          items:
            $ref: "#/components/schemas/Deprecation"
        maintenance:
          $ref: "#/components/schemas/MaintenanceWindow"
        serverTiers:
          type: array
          items:
            $ref: "#/components/schemas/ServerTierDef"
        revision:
          type: integer

    Deprecation:
      type: object
      properties:
        path:
          type: string
        removedAt:
          type: string
        alternative:
          type: string
        reason:
          type: string

    MaintenanceWindow:
      type: object
      properties:
        enabled:
          type: boolean
        startTime:
          type: string
          format: date-time
        endTime:
          type: string
          format: date-time
        message:
          type: string

    CurrencyDef:
      type: object
      properties:
        name:
          type: string
        type:
          type: string
          enum: [hard, soft]

    ServerTierDef:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        isDefault:
          type: boolean

    # ── Players ────────────────────────────────────────────────────────────────
    PlayerWithBan:
      type: object
      properties:
        playerId:
          type: string
        playerName:
          type: string
        ban:
          $ref: "#/components/schemas/BanRecord"

    PlayerDetail:
      type: object
      properties:
        account:
          type: object
        ban:
          $ref: "#/components/schemas/BanRecord"
        progress:
          type: object

    BanRecord:
      type: object
      properties:
        playerId:
          type: string
        reason:
          type: string
        bannedBy:
          type: string
        bannedAt:
          type: string
          format: date-time
        expiresAt:
          type: string
          format: date-time

    AuditRecord:
      type: object
      properties:
        action:
          type: string
        targetPlayerId:
          type: string
        adminId:
          type: string
        detail:
          type: string
        timestamp:
          type: string
          format: date-time

    # ── Assets ─────────────────────────────────────────────────────────────────
    AssetIndex:
      type: object
      properties:
        assets:
          type: array
          items:
            $ref: "#/components/schemas/AssetManifest"
        updatedAt:
          type: string
          format: date-time

    AssetManifest:
      type: object
      properties:
        assetId:
          type: string
        name:
          type: string
        tags:
          type: array
          items:
            type: string
        variantCount:
          type: integer
        watermarkEnabled:
          type: boolean
        serverTiers:
          type: array
          items:
            type: string
        originalSize:
          type: integer
        uploadedAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    CreateAssetRequest:
      type: object
      required: [name]
      properties:
        name:
          type: string
        watermarkEnabled:
          type: boolean
          default: false
        variantCount:
          type: integer
          default: 4
        tags:
          type: array
          items:
            type: string
        serverTiers:
          type: array
          items:
            type: string

    CreateAssetResponse:
      type: object
      properties:
        assetId:
          type: string
        manifest:
          $ref: "#/components/schemas/AssetManifest"
        uploadUrls:
          type: array
          items:
            type: object
            properties:
              variantIndex:
                type: integer
              uploadUrl:
                type: string
        variantCount:
          type: integer

    WatermarkResult:
      type: object
      properties:
        found:
          type: boolean
        variantIndex:
          type: integer
        payload:
          type: string
          description: Hex-encoded payload bytes
        message:
          type: string

    # ── Hotfix ─────────────────────────────────────────────────────────────────
    HotfixManifest:
      type: object
      properties:
        version:
          type: string
        gameVersionMin:
          type: string
        files:
          type: array
          items:
            type: string
        checksum:
          type: string
        uploadedAt:
          type: string
          format: date-time

    HotfixUploadJson:
      type: object
      required: [contentBase64]
      properties:
        version:
          type: string
        gameVersionMin:
          type: string
        checksum:
          type: string
        contentBase64:
          type: string
          format: byte
          description: Base64-encoded patch zip

    # ── Matchmaking ────────────────────────────────────────────────────────────
    MatchmakingStatus:
      type: object
      properties:
        status:
          type: string
          enum: [queued, matched, none]
        roomId:
          type: string
        gameType:
          type: string

    # ── Leaderboard ────────────────────────────────────────────────────────────
    LeaderboardEntry:
      type: object
      properties:
        playerId:
          type: string
        playerName:
          type: string
        score:
          type: number
        timestamp:
          type: string
          format: date-time

    SubmitScoreRequest:
      type: object
      required: [playerId, score]
      properties:
        playerId:
          type: string
        playerName:
          type: string
        score:
          type: number

    # ── Profile ────────────────────────────────────────────────────────────────
    PlayerProfile:
      type: object
      properties:
        playerId:
          type: string
        playerName:
          type: string
        level:
          type: number
        winRate:
          type: number
        items:
          type: array
          items:
            type: string
        lastSeen:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    ProfileUpdateRequest:
      type: object
      properties:
        playerId:
          type: string
        level:
          type: number
        winRate:
          type: number
`;
