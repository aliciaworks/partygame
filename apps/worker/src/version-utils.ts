/**
 * Client-side version utility functions for version compatibility checks
 * Used by both admin panel and game clients
 */

export interface VersionCheckResult {
  compatible: boolean;
  message: string;
  minVersion?: string;
  currentVersion?: string;
}

export interface ApiVersionInfo {
  apiVersion: string; // ISO date
  availableFeatures: string[];
  deprecatedEndpoints: Array<{
    path: string;
    removedAt: string;
    alternative?: string;
  }>;
  minClientVersion?: string;
}

/**
 * Parse SemVer version string into parts
 * @param version - Version string (e.g., "1.2.3")
 * @returns Parsed version object or null if invalid
 */
export function parseSemVer(version: string): {
  major: number;
  minor: number;
  patch: number;
} | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Check if client version meets minimum version requirement
 * @param clientVersion - Client version (SemVer)
 * @param minServerVersion - Minimum required version
 * @returns true if client version >= min version
 */
export function isClientVersionCompatible(
  clientVersion: string | undefined,
  minServerVersion: string | undefined,
): boolean {
  if (!minServerVersion || !clientVersion) return true;

  const client = parseSemVer(clientVersion);
  const server = parseSemVer(minServerVersion);

  if (!client || !server) return true;

  if (client.major !== server.major) {
    return client.major > server.major;
  }
  if (client.minor !== server.minor) {
    return client.minor > server.minor;
  }
  return client.patch >= server.patch;
}

/**
 * Extract API version info from response headers
 * @param response - Fetch Response object
 * @returns Extracted version info
 */
export function extractVersionInfo(response: Response): Partial<ApiVersionInfo> {
  const apiVersion = response.headers.get("X-API-Version");
  const availableFeaturesStr = response.headers.get("X-Available-Features");
  const deprecationDate = response.headers.get("X-Deprecation-Date");
  const deprecationAlternative = response.headers.get("X-Deprecation-Alternative");
  const minClientVersion = response.headers.get("X-Min-Client-Version");

  return {
    apiVersion: apiVersion ?? undefined,
    availableFeatures: availableFeaturesStr ? availableFeaturesStr.split(",") : [],
    minClientVersion: minClientVersion ?? undefined,
    deprecatedEndpoints:
      deprecationDate && response.url
        ? [
            {
              path: new URL(response.url).pathname,
              removedAt: deprecationDate,
              alternative: deprecationAlternative ?? undefined,
            },
          ]
        : [],
  };
}

/**
 * Check if specific feature is available based on response headers
 * @param featureName - Feature name (e.g., "hotFix", "leaderboard")
 * @param availableFeatures - List of available features from response header
 * @returns true if feature is available
 */
export function isFeatureAvailable(
  featureName: string,
  availableFeatures: string[],
): boolean {
  return availableFeatures.includes(featureName);
}

/**
 * Format deprecation warning for display
 * @param path - Deprecated API path
 * @param removedAt - ISO date when API will be removed
 * @param alternative - Recommended alternative path
 * @returns Human-readable deprecation message
 */
export function formatDeprecationWarning(
  path: string,
  removedAt: string,
  alternative?: string,
): string {
  const removedDate = new Date(removedAt);
  const now = new Date();
  const daysUntilRemoval = Math.ceil(
    (removedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  let msg = `⚠️ Endpoint "${path}" will be removed on ${removedAt}`;
  if (daysUntilRemoval > 0) {
    msg += ` (${daysUntilRemoval} days remaining)`;
  } else {
    msg += " (ALREADY REMOVED, URGENT upgrade needed)";
  }

  if (alternative) {
    msg += `\nPlease migrate to: ${alternative}`;
  }

  return msg;
}

/**
 * Build request headers with client version info
 * @param clientVersion - Client app version (SemVer)
 * @param compilationDate - When the client was compiled (ISO date)
 * @returns Headers object with version information
 */
export function buildVersionHeaders(
  clientVersion: string,
  compilationDate?: string,
): Record<string, string> {
  const versionStr = compilationDate ? `${clientVersion}+${compilationDate}` : clientVersion;

  return {
    "X-Client-Version": versionStr,
    "Accept-API-Version": ">=2024-01-01",
  };
}

/**
 * Create a version compatibility checker for a platform state response
 * @param platformResponse - Response from GET /api/platform
 * @param clientVersion - Client version (SemVer)
 * @returns Compatibility check result
 */
export async function checkVersionCompatibility(
  platformResponse: Response,
  clientVersion: string,
): Promise<VersionCheckResult> {
  try {
    const state = await platformResponse.json() as {
      apiVersion?: string;
      minClientVersion?: string;
    };

    if (!state.minClientVersion) {
      return { compatible: true, message: "No version requirement" };
    }

    if (!isClientVersionCompatible(clientVersion, state.minClientVersion)) {
      return {
        compatible: false,
        message: `Client version ${clientVersion} is below minimum required ${state.minClientVersion}`,
        minVersion: state.minClientVersion,
        currentVersion: clientVersion,
      };
    }

    return {
      compatible: true,
      message: "Version compatible",
      minVersion: state.minClientVersion,
      currentVersion: clientVersion,
    };
  } catch (error) {
    return {
      compatible: false,
      message: `Failed to check version compatibility: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
