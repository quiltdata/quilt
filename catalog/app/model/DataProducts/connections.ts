/**
 * Catalog connections: where an admin says which external catalog to talk to and
 * how to authenticate against it.
 *
 * **No secret is ever held here.** `secretRef` is a pointer -- a Secrets Manager
 * ARN, an SSM parameter name -- resolved server-side by whoever actually makes
 * the call. The catalog is a static SPA served from S3, so a platform token
 * reachable from this layer is a token in a browser, and no amount of care in the
 * UI fixes that. Server-side exchange is the byte broker's job, not the
 * frontend's.
 *
 * The interesting content of this file is `AUTH_METHODS`: what each platform can
 * actually be authenticated against. The three platforms disagree sharply, and
 * that asymmetry is the "edge" the UI has to make visible rather than paper over
 * with a uniform "Connect" button that means three different things.
 */

import type { PlatformKind } from './types'

export type AuthMethod = 'IAM_ROLE' | 'OAUTH_M2M' | 'OAUTH_U2M' | 'API_KEY'

export type ConnectionState = 'READY' | 'UNVERIFIED' | 'ERROR'

export interface Connection {
  id: string
  /** Admin-facing label, not an identifier. */
  title: string
  platform: PlatformKind
  /**
   * Where to reach it: a DataZone domain id, a Unity workspace host, a Snowflake
   * account locator. Shape depends on the platform; opaque here so adding a
   * platform does not reshape this type.
   */
  endpoint: string
  authMethod: AuthMethod
  /** Pointer to where the credential lives. Never the credential. */
  secretRef: string | null
  state: ConnectionState
  /** Why it is in `ERROR`, or what `UNVERIFIED` is waiting on. */
  statusMessage: string | null
  /** When a check last ran. Null means never checked. */
  lastCheckedAt: Date | null
}

export interface AuthMethodInfo {
  method: AuthMethod
  label: string
  /** What the admin has to supply, in one line. */
  requires: string
  /**
   * Why this method is or is not available on this platform. Shown in the UI
   * rather than kept in a comment: an admin who cannot find an OAuth button
   * deserves to know whether that is a missing feature or a platform that has no
   * such concept.
   */
  note: string
}

/**
 * What each platform can be authenticated against, and what that costs the
 * admin.
 *
 * Ordered most-preferred first, so a UI can default to `[0]`.
 *
 * The load-bearing asymmetry, which is why this is data and not a single
 * `['OAUTH_U2M', 'API_KEY']` list:
 *
 * - **DataZone has no user-OAuth path at all.** It is SigV4; a human signs in
 *   through Identity Center or the caller assumes a role. There is no
 *   authorization-code flow to offer, so rendering a "Connect with OAuth" button
 *   for DataZone would be inventing a capability.
 * - **Databricks documents a browser-capable U2M flow** (authorization code +
 *   PKCE), which is the only place an OAuth button is honest today.
 * - **Snowflake has OAuth**, but which grant types its API access supports is
 *   unverified here. Listed as available with the uncertainty stated rather than
 *   silently promoted or silently dropped.
 */
export const AUTH_METHODS: Record<PlatformKind, AuthMethodInfo[]> = {
  datazone: [
    {
      method: 'IAM_ROLE',
      label: 'Assume an IAM role',
      requires:
        'A role ARN Quilt may assume, trusted to call DataZone and Lake Formation',
      note: 'DataZone authenticates with SigV4. There is no OAuth flow to offer — a human reaches it through Identity Center, and a service reaches it by assuming a role.',
    },
  ],
  'unity-schema': [
    {
      method: 'OAUTH_U2M',
      label: 'Sign in with Databricks',
      requires: 'A workspace host, and each user signs in as themselves',
      note: 'Databricks documents an authorization-code flow with PKCE, so this is the one platform where a browser sign-in is a real option. Acting as the signed-in user also means the catalog never sees more than that person may see.',
    },
    {
      method: 'OAUTH_M2M',
      label: 'Service principal',
      requires: 'A client ID and a secret reference',
      note: 'One identity for every Quilt user. Simpler to operate, but every reader shares its permissions, so what the UI shows stops matching what the reader may query.',
    },
    {
      method: 'API_KEY',
      label: 'Personal access token',
      requires: 'A PAT reference',
      note: 'Works, and is the quickest thing to test with. Tokens are long-lived and tied to one person, so it is the weakest of the three for anything but a spike.',
    },
  ],
  'unity-share': [
    {
      method: 'OAUTH_U2M',
      label: 'Sign in with Databricks',
      requires: 'A workspace host, and each user signs in as themselves',
      note: 'Same flow as a Unity schema — a share is addressed through the same workspace API.',
    },
    {
      method: 'API_KEY',
      label: 'Personal access token',
      requires: 'A PAT reference',
      note: 'Quickest for a spike; long-lived and person-bound.',
    },
  ],
  'snowflake-listing': [
    {
      method: 'OAUTH_M2M',
      label: 'OAuth client credentials',
      requires: 'A client ID and a secret reference',
      note: 'Snowflake supports OAuth. Which grant types its API access accepts is not verified here, so treat this as needing a connection check before trusting it.',
    },
    {
      method: 'API_KEY',
      label: 'Key-pair / token',
      requires: 'A key or token reference',
      note: 'Key-pair auth is the well-trodden path for programmatic Snowflake access.',
    },
  ],
}

/** Whether a platform can offer a browser sign-in at all. */
export function supportsBrowserSignIn(platform: PlatformKind): boolean {
  return AUTH_METHODS[platform].some((m) => m.method === 'OAUTH_U2M')
}

/**
 * Whether a connection is usable for reads right now.
 *
 * `UNVERIFIED` is deliberately *not* usable-by-assumption. A connection nobody
 * has exercised is a configuration guess, and treating it as working produces an
 * empty product list that looks like "this catalog has no products" rather than
 * "we never reached the catalog".
 */
export function isUsable(connection: Connection): boolean {
  return connection.state === 'READY'
}

/**
 * What to tell an admin about a connection's state, in one line.
 *
 * Never returns an empty string: a blank status reads as fine, and the two
 * non-READY states are both "you are not getting data yet".
 */
export function stateSummary(connection: Connection): string {
  switch (connection.state) {
    case 'READY':
      return connection.lastCheckedAt
        ? `Last verified ${connection.lastCheckedAt.toLocaleString()}`
        : 'Verified'
    case 'ERROR':
      return connection.statusMessage ?? 'Last check failed'
    case 'UNVERIFIED':
      return (
        connection.statusMessage ??
        'Never verified — products from this catalog will not load until a check succeeds'
      )
    default:
      return 'Unknown state'
  }
}
