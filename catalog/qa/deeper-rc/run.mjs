import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const AWS = require("aws-sdk");
const { chromium } = require("playwright");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function env(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function normalizeVersion(version) {
  return version.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function versionRegex(version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dashed = normalizeVersion(version).replace(/-/g, "[-.]?");
  const compact = version.replace(/[^a-z0-9]/gi, "");
  return new RegExp(`${escaped}|${dashed}|${compact}`, "i");
}

const target = env("QA_TARGET_URL", "https://nightly.quilttest.com").replace(/\/+$/, "");
const bucket = env("QA_BUCKET", "quilt-example-bucket");
const expectedVersion = env("QA_EXPECTED_VERSION", "1.70");
const normalizedVersion = normalizeVersion(expectedVersion);
const finalPackageName = env("QA_PACKAGE_NAME", `qa/nightly-${normalizedVersion}-rc-deeper-qa`);
const artifactPackageName = env(
  "QA_ARTIFACT_PACKAGE_NAME",
  `qa/nightly-${normalizedVersion}-rc-release-artifacts`,
);
const outputRoot = path.resolve(env("QA_OUTPUT_ROOT", path.join(process.cwd(), ".playwright-mcp")));
const profileDir = path.resolve(env("QA_PROFILE_DIR", path.join(outputRoot, "nightly-visible-profile")));
const authMode = env("QA_AUTH_MODE", "profile").toLowerCase();
const defaultEncryptedProfilePath = path.join(__dirname, "secrets", "deeper-rc-browser-profile.tgz.gpg");
const profileArchivePath = env("QA_BROWSER_PROFILE_TGZ");
const resolvedProfileArchivePath = profileArchivePath ? path.resolve(profileArchivePath) : "";
const encryptedProfileArchivePath = path.resolve(env("QA_BROWSER_PROFILE_GPG", defaultEncryptedProfilePath));
const profileArchiveB64 = env("QUILT_QA_BROWSER_PROFILE_TGZ_B64", env("QUILT_QA_BROWSER_PROFILE_B64"));
const profileArchiveSecretName = process.env.QUILT_QA_BROWSER_PROFILE_TGZ_B64
  ? "QUILT_QA_BROWSER_PROFILE_TGZ_B64"
  : process.env.QUILT_QA_BROWSER_PROFILE_B64
    ? "QUILT_QA_BROWSER_PROFILE_B64"
    : "";
const profileExportPath = path.resolve(
  env("QA_PROFILE_EXPORT_PATH", path.join(outputRoot, "deeper-rc-browser-profile.tgz")),
);
const profileB64ExportPath = path.resolve(
  env("QA_PROFILE_B64_EXPORT_PATH", profileExportPath.endsWith(".b64") ? profileExportPath : `${profileExportPath}.b64`),
);
const profileGpgExportPath = path.resolve(env("QA_PROFILE_GPG_EXPORT_PATH", defaultEncryptedProfilePath));
const profileEncryptPassphrase = env("QA_PROFILE_ENCRYPT_PASSPHRASE");
const writeLegacyB64 = ["1", "true", "yes"].includes(env("QA_PROFILE_WRITE_B64", "true").toLowerCase());
const interactiveLoginTimeoutMs = Number(env("QA_INTERACTIVE_LOGIN_TIMEOUT_MS", "900000"));
const qaUsername = env("QUILT_QA_USERNAME");
const qaPassword = env("QUILT_QA_PASSWORD");
const skipWait = ["1", "true", "yes"].includes(env("QA_SKIP_WAIT", "false").toLowerCase());
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const prefix = `qa-results/nightly-${normalizedVersion}-rc-deeper/${runId}/`;
const outDir = path.join(outputRoot, `nightly-${normalizedVersion}-deeper-qa-${runId}`);
const screenshotsDir = path.join(outDir, "screenshots");
const docsDir = path.join(outDir, "docs");
const dataDir = path.join(outDir, "data");
const tmpDir = path.join(outDir, "tmp");

if (process.argv.includes("--help")) {
  console.log(`Quilt RC deeper QA runner

Environment:
  QA_TARGET_URL=${target}
  QA_BUCKET=${bucket}
  QA_EXPECTED_VERSION=${expectedVersion}
  QA_PACKAGE_NAME=${finalPackageName}
  QA_ARTIFACT_PACKAGE_NAME=${artifactPackageName}
  QA_OUTPUT_ROOT=${outputRoot}
  QA_PROFILE_DIR=${profileDir}
  QA_AUTH_MODE=${authMode}
  QA_BROWSER_PROFILE_TGZ=${resolvedProfileArchivePath || "<unset>"}
  QA_BROWSER_PROFILE_GPG=${encryptedProfileArchivePath}
  QUILT_QA_BROWSER_PROFILE_TGZ_B64=${process.env.QUILT_QA_BROWSER_PROFILE_TGZ_B64 ? "<set>" : "<unset>"}
  QA_PROFILE_EXPORT_PATH=${profileExportPath}
  QA_PROFILE_GPG_EXPORT_PATH=${profileGpgExportPath}
  QA_PROFILE_ENCRYPT_PASSPHRASE=${profileEncryptPassphrase ? "<set>" : "<unset>"}
  QA_PROFILE_WRITE_B64=${writeLegacyB64}
  QUILT_QA_USERNAME=${qaUsername ? "<set legacy>" : "<unset>"}
  QUILT_QA_PASSWORD=${qaPassword ? "<set legacy>" : "<unset>"}

Auth modes:
  profile (default): restore a .tgz browser profile from QA_BROWSER_PROFILE_TGZ, or reuse
    QA_PROFILE_DIR for local runs. QUILT_QA_BROWSER_PROFILE_TGZ_B64 remains a legacy fallback.
  microsoft-interactive: local headed bootstrap. Complete Microsoft login in the browser, then the
    runner writes a plaintext .tgz profile to QA_PROFILE_EXPORT_PATH. Set QA_PROFILE_ENCRYPT_PASSPHRASE
    to also write an encrypted .tgz.gpg profile to QA_PROFILE_GPG_EXPORT_PATH for CI.
  credentials: legacy password login using QUILT_QA_USERNAME/QUILT_QA_PASSWORD.

The runner records QA findings in the report and exits nonzero only for runner or publishing failures.
`);
  process.exit(0);
}

for (const dir of [screenshotsDir, docsDir, dataDir, tmpDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const results = [];
const findings = [];
const pages = [];
const resources = [];
const blockers = [];
const cleanup = [];
const performance = [];
const accessibility = [];
const release = {};
const personaMatrix = [];
const lifecycle = {};
const adminCrud = {};
const searchEvidence = {};
const athenaEvidence = {
  mcp: {
    status: "blocked",
    reason: "MCP athena_query tool failed before this runner started: Failed to resolve dependency 'athena'.",
  },
};

let context;
let page;
let registryUrl;
let region = "us-east-1";
let authToken;
let s3;
let athena;
let originalRole;

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function shortRun() {
  return runId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18);
}

function record(status, name, details = {}) {
  const entry = { status, name, ...details };
  results.push(entry);
  const suffix = details.error ? ` - ${details.error}` : details.note ? ` - ${details.note}` : "";
  console.log(`${status.toUpperCase()} ${name}${suffix}`);
  return entry;
}

function addFinding(severity, area, type, summary, extra = {}) {
  findings.push({ severity, area, type, summary, ...extra });
}

function addBlocker(area, reason, extra = {}) {
  blockers.push({ area, reason, ...extra });
  addFinding("medium", area, "coverage gap", reason, extra);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSupportedAuthMode() {
  const supported = new Set(["profile", "credentials", "microsoft-interactive"]);
  if (!supported.has(authMode)) {
    throw new Error(`Unsupported QA_AUTH_MODE=${authMode}; expected profile, credentials, or microsoft-interactive`);
  }
  if (authMode === "microsoft-interactive" && process.env.GITHUB_ACTIONS) {
    throw new Error("QA_AUTH_MODE=microsoft-interactive is local-only and cannot complete in GitHub Actions");
  }
}

function runTar(args) {
  try {
    execFileSync("tar", args, { stdio: "pipe" });
  } catch (error) {
    const output = [error.stdout, error.stderr]
      .filter(Boolean)
      .map((value) => value.toString())
      .join("\n")
      .trim();
    throw new Error(`tar ${args.join(" ")} failed${output ? `: ${output}` : ""}`);
  }
}

function runGpg(args) {
  try {
    execFileSync("gpg", args, { stdio: "pipe" });
  } catch (error) {
    const output = [error.stdout, error.stderr]
      .filter(Boolean)
      .map((value) => value.toString())
      .join("\n")
      .trim();
    throw new Error(`gpg ${args.filter((arg) => arg !== profileEncryptPassphrase).join(" ")} failed${output ? `: ${output}` : ""}`);
  }
}

function restoreBrowserProfileFromArchive(archivePath) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`QA_BROWSER_PROFILE_TGZ points to missing profile archive: ${archivePath}`);
  }
  const stats = fs.statSync(archivePath);
  if (!stats.size) {
    throw new Error(`QA_BROWSER_PROFILE_TGZ points to an empty profile archive: ${archivePath}`);
  }

  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });
  runTar(["-xzf", archivePath, "-C", profileDir]);
  console.log(`Restored browser profile from ${archivePath} into ${profileDir}`);
  return true;
}

function restoreBrowserProfileFromEnv() {
  if (!profileArchiveB64) return false;

  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const archivePath = path.join(tmpDir, "browser-profile.tgz");
  const decoded = Buffer.from(profileArchiveB64.replace(/\s/g, ""), "base64");
  if (!decoded.length) {
    throw new Error(`${profileArchiveSecretName || "QUILT_QA_BROWSER_PROFILE_TGZ_B64"} decoded to an empty profile archive`);
  }

  fs.writeFileSync(archivePath, decoded);
  runTar(["-xzf", archivePath, "-C", profileDir]);
  fs.rmSync(archivePath, { force: true });
  console.log(`Restored browser profile from ${profileArchiveSecretName} into ${profileDir}`);
  return true;
}

function prepareProfileAuth() {
  if (authMode !== "profile") return;
  if (resolvedProfileArchivePath) {
    restoreBrowserProfileFromArchive(resolvedProfileArchivePath);
    return;
  }
  if (restoreBrowserProfileFromEnv()) return;
  if (fs.existsSync(profileDir)) {
    console.log(`Using local browser profile at ${profileDir}`);
    return;
  }
  if (process.env.GITHUB_ACTIONS) {
    throw new Error(
      "QA_AUTH_MODE=profile in CI requires QA_BROWSER_PROFILE_TGZ restored from the encrypted profile file, or legacy QUILT_QA_BROWSER_PROFILE_TGZ_B64",
    );
  }
  console.log(`No profile archive secret supplied; local run will use ${profileDir}`);
}

function encryptBrowserProfileArchive(tgzPath) {
  fs.mkdirSync(path.dirname(profileGpgExportPath), { recursive: true });
  runGpg([
    "--symmetric",
    "--cipher-algo",
    "AES256",
    "--batch",
    "--yes",
    "--pinentry-mode",
    "loopback",
    "--passphrase",
    profileEncryptPassphrase,
    "-o",
    profileGpgExportPath,
    tgzPath,
  ]);
  console.log(`Wrote encrypted browser profile archive: ${profileGpgExportPath}`);
}

function printProfileTransportInstructions(tgzPath, b64Path) {
  const relativeTgz = path.relative(process.cwd(), tgzPath);
  const relativeGpg = path.relative(process.cwd(), profileGpgExportPath);
  console.log("");
  console.log("Recommended CI profile transport:");
  console.log("  PASSPHRASE=\"$(openssl rand -base64 32)\"");
  console.log(`  mkdir -p ${path.dirname(relativeGpg)}`);
  console.log(
    `  gpg --symmetric --cipher-algo AES256 --batch --yes --pinentry-mode loopback --passphrase "$PASSPHRASE" -o ${relativeGpg} ${relativeTgz}`,
  );
  console.log('  gh secret set QUILT_QA_BROWSER_PROFILE_PASSPHRASE --body "$PASSPHRASE"');
  console.log(`  git add ${relativeGpg}`);
  console.log("");
  console.log("Commit only the encrypted .tgz.gpg profile. Do not commit the plaintext .tgz profile.");
  if (b64Path) {
    console.log(
      `Legacy base64 export also written to ${path.relative(process.cwd(), b64Path)}, but it is usually too large for GitHub Actions secrets.`,
    );
  }
}

function createBrowserProfileArchive() {
  const tgzPath = profileExportPath.endsWith(".b64") ? profileExportPath.replace(/\.b64$/, "") : profileExportPath;
  const excludes = [
    "./Default/Cache",
    "./Default/Code Cache",
    "./Default/GPUCache",
    "./Default/Service Worker/CacheStorage",
    "./Default/blob_storage",
    "./GrShaderCache",
    "./ShaderCache",
    "./Crashpad",
  ];

  fs.mkdirSync(path.dirname(tgzPath), { recursive: true });
  const args = ["-czf", tgzPath];
  for (const exclude of excludes) {
    args.push("--exclude", exclude);
  }
  args.push("-C", profileDir, ".");
  runTar(args);
  console.log(`Wrote browser profile archive: ${tgzPath}`);
  let b64Path = "";
  if (writeLegacyB64) {
    fs.mkdirSync(path.dirname(profileB64ExportPath), { recursive: true });
    fs.writeFileSync(profileB64ExportPath, fs.readFileSync(tgzPath).toString("base64"));
    b64Path = profileB64ExportPath;
    console.log(`Wrote legacy GitHub secret payload: ${b64Path}`);
  }
  if (profileEncryptPassphrase) {
    encryptBrowserProfileArchive(tgzPath);
  }
  printProfileTransportInstructions(tgzPath, b64Path);
  return { tgzPath, b64Path };
}

async function run(name, fn) {
  const start = Date.now();
  try {
    const details = await fn();
    record("pass", name, { durationMs: Date.now() - start, ...details });
    return details;
  } catch (error) {
    const screenshot = page ? path.join(screenshotsDir, `${safeName(name)}-failed.png`) : null;
    if (page && screenshot) {
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    }
    addFinding("high", name, "functional", error.message, {
      evidence: screenshot ? path.relative(outDir, screenshot) : undefined,
    });
    record("fail", name, {
      durationMs: Date.now() - start,
      error: error.message,
      screenshot: screenshot ? path.relative(outDir, screenshot) : undefined,
    });
    return null;
  }
}

async function bodyText(targetPage = page) {
  return (await targetPage.locator("body").innerText({ timeout: 25000 }))
    .replace(/\s+/g, " ")
    .trim();
}

async function goto(routeOrUrl, targetPage = page) {
  const url = routeOrUrl.startsWith("http") ? routeOrUrl : `${target}${routeOrUrl}`;
  const response = await targetPage.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || !response.ok()) {
    throw new Error(`HTTP ${response && response.status()} for ${url}`);
  }
  await targetPage.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await targetPage.locator("body").waitFor({ timeout: 20000 });
  return response;
}

async function capture(name, routeOrUrl, targetPage = page) {
  if (routeOrUrl) await goto(routeOrUrl, targetPage);
  const file = path.join(screenshotsDir, `${safeName(name)}.png`);
  const text = await bodyText(targetPage);
  const url = targetPage.url();
  const diagnostics = await targetPage.evaluate(() => {
    const doc = document.documentElement;
    const nav = performance.getEntriesByType("navigation")[0];
    const controls = Array.from(
      document.querySelectorAll("button, a, input, textarea, select, [role='button'], [role='tab'], [role='link']"),
    );
    const clipped = controls
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = (
          el.textContent ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.getAttribute("placeholder") ||
          ""
        )
          .trim()
          .replace(/\s+/g, " ");
        return {
          label: label.slice(0, 120),
          tag: el.tagName,
          role: el.getAttribute("role"),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          outsideViewport:
            rect.right < 0 ||
            rect.bottom < 0 ||
            rect.left > window.innerWidth ||
            rect.top > window.innerHeight ||
            rect.right > window.innerWidth + 24,
        };
      })
      .filter((item) => item.outsideViewport || item.width === 0 || item.height === 0)
      .slice(0, 25);
    const unlabeledInputs = Array.from(
      document.querySelectorAll("input:not([type='hidden']), textarea, select"),
    )
      .filter((el) => {
        const id = el.getAttribute("id");
        const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        return !hasLabel && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.getAttribute("placeholder");
      })
      .map((el) => ({ tag: el.tagName, type: el.getAttribute("type"), name: el.getAttribute("name") }))
      .slice(0, 20);
    const buttonsWithoutNames = controls
      .filter((el) => /^(BUTTON|A)$/.test(el.tagName) || el.getAttribute("role") === "button")
      .filter((el) => {
        const text = (el.textContent || "").trim();
        return !text && !el.getAttribute("aria-label") && !el.getAttribute("title");
      })
      .map((el) => ({ tag: el.tagName, role: el.getAttribute("role"), href: el.getAttribute("href") }))
      .slice(0, 20);
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: doc.scrollWidth,
      scrollHeight: doc.scrollHeight,
      overflowX: doc.scrollWidth - window.innerWidth,
      clipped,
      accessibility: { unlabeledInputs, buttonsWithoutNames },
      timing: nav
        ? {
            domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
            loadEventMs: Math.round(nav.loadEventEnd),
            transferSize: nav.transferSize,
            encodedBodySize: nav.encodedBodySize,
          }
        : null,
    };
  });
  await targetPage.screenshot({ path: file, fullPage: true });
  const recordPage = {
    name,
    url,
    screenshot: path.relative(outDir, file),
    textStart: text.slice(0, 1400),
    visual: {
      viewportWidth: diagnostics.viewportWidth,
      viewportHeight: diagnostics.viewportHeight,
      scrollWidth: diagnostics.scrollWidth,
      scrollHeight: diagnostics.scrollHeight,
      overflowX: diagnostics.overflowX,
      clipped: diagnostics.clipped,
    },
    accessibility: diagnostics.accessibility,
    timing: diagnostics.timing,
  };
  pages.push(recordPage);
  performance.push({ name, url, ...diagnostics.timing });
  accessibility.push({ name, url, ...diagnostics.accessibility });
  if (diagnostics.overflowX > 8) {
    addFinding("medium", name, "visual", `Horizontal overflow detected (${diagnostics.overflowX}px beyond viewport).`, {
      evidence: recordPage.screenshot,
    });
  }
  if (diagnostics.accessibility.unlabeledInputs.length) {
    addFinding("low", name, "accessibility", "Visible form controls without accessible labels were found.", {
      evidence: recordPage.screenshot,
      details: diagnostics.accessibility.unlabeledInputs,
    });
  }
  if (diagnostics.accessibility.buttonsWithoutNames.length) {
    addFinding("low", name, "accessibility", "Buttons or links without accessible names were found.", {
      evidence: recordPage.screenshot,
      details: diagnostics.accessibility.buttonsWithoutNames,
    });
  }
  return { text, file, diagnostics };
}

async function configureFromPage({ requireAuthToken = true } = {}) {
  await goto("/");
  const config = await page.evaluate(() => window.QUILT_CATALOG_CONFIG);
  release.config = config;
  registryUrl = config.registryUrl;
  region = config.region || "us-east-1";
  authToken = await page.evaluate(() => {
    const raw = localStorage.getItem("TOKENS");
    return raw ? JSON.parse(raw).token : null;
  });
  if (requireAuthToken) {
    assert(authToken, "No auth token found after catalog authentication");
  }
}

async function signInWithPasswordCredentials() {
  await goto(`/signin?next=${encodeURIComponent("/")}`);
  await page.locator('input[name="username"]').fill(qaUsername, { timeout: 20000 });
  await page.locator('input[name="password"]').fill(qaPassword, { timeout: 20000 });
  await page.getByRole("button", { name: /^sign in$/i }).click({ timeout: 20000 });
  await page.waitForFunction(() => Boolean(localStorage.getItem("TOKENS")), null, { timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
}

async function authenticateCatalog() {
  await configureFromPage({ requireAuthToken: false });
  if (authToken) {
    console.log("Using existing authenticated browser profile");
    return;
  }

  if (authMode === "credentials") {
    if (!qaUsername || !qaPassword) {
      throw new Error("QA_AUTH_MODE=credentials requires legacy QUILT_QA_USERNAME and QUILT_QA_PASSWORD");
    }
    console.log("Signing in with legacy QUILT_QA_USERNAME/QUILT_QA_PASSWORD");
    await signInWithPasswordCredentials();
    await configureFromPage({ requireAuthToken: true });
    return;
  }

  const profileExists = fs.existsSync(profileDir);
  throw new Error(
    profileExists
      ? `No auth token found in ${profileDir}; refresh the Microsoft browser profile with QA_AUTH_MODE=microsoft-interactive`
      : `No browser profile found at ${profileDir}; set QA_BROWSER_PROFILE_TGZ in CI or run QA_AUTH_MODE=microsoft-interactive locally`,
  );
}

async function runMicrosoftInteractiveBootstrap() {
  if (resolvedProfileArchivePath) restoreBrowserProfileFromArchive(resolvedProfileArchivePath);
  else if (profileArchiveB64) restoreBrowserProfileFromEnv();

  console.log(`Launching headed browser with profile ${profileDir}`);
  console.log("Complete Microsoft federated login in the browser window. The runner will wait for the Quilt auth token.");
  context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page = context.pages()[0] || await context.newPage();

  await configureFromPage({ requireAuthToken: false });
  if (!authToken) {
    await goto(`/signin?next=${encodeURIComponent("/")}`);
    await page.getByRole("button", { name: /sign in with microsoft/i }).click({ timeout: 10000 }).catch(() => {
      console.log("Click the Sign in with Microsoft button manually if it was not opened automatically.");
    });
    await page.waitForFunction(() => Boolean(localStorage.getItem("TOKENS")), null, {
      timeout: interactiveLoginTimeoutMs,
    });
    await configureFromPage({ requireAuthToken: true });
  }

  console.log("Microsoft login captured in the persistent browser profile.");
  await context.close();
  context = null;
  createBrowserProfileArchive();
}

async function getAwsCredentials() {
  const credentialResult = await page.evaluate(async ({ registryUrl, authToken }) => {
    const response = await fetch(`${registryUrl}/api/auth/get_credentials`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }, { registryUrl, authToken });
  if (!credentialResult.ok) {
    throw new Error(`Credential endpoint returned ${credentialResult.status}: ${credentialResult.text.slice(0, 300)}`);
  }
  const creds = JSON.parse(credentialResult.text);
  const credentials = new AWS.Credentials({
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
  });
  s3 = new AWS.S3({ region, credentials });
  athena = new AWS.Athena({ region, credentials });
}

async function graphql(query, variables = {}) {
  const result = await page.evaluate(async ({ registryUrl, authToken, query, variables }) => {
    const response = await fetch(`${registryUrl}/graphql`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: authToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }, { registryUrl, authToken, query, variables });
  if (!result.ok) throw new Error(`GraphQL HTTP ${result.status}: ${result.text.slice(0, 500)}`);
  const parsed = JSON.parse(result.text);
  if (parsed.errors) throw new Error(`GraphQL errors: ${JSON.stringify(parsed.errors)}`);
  return parsed.data;
}

async function queryMe() {
  const data = await graphql(`
    query QaMe {
      me {
        name
        email
        isAdmin
        role { name }
        roles { name }
      }
    }
  `);
  return data.me;
}

async function switchRole(roleName) {
  const data = await graphql(`
    mutation QaSwitchRole($roleName: String!) {
      switchRole(roleName: $roleName) {
        __typename
        ... on Me {
          name
          isAdmin
          role { name }
          roles { name }
        }
        ... on InvalidInput { errors { name path message } }
        ... on OperationError { name message }
      }
    }
  `, { roleName });
  const result = data.switchRole;
  if (result.__typename !== "Me") {
    throw new Error(`Switch role failed: ${JSON.stringify(result)}`);
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await configureFromPage();
  return result;
}

function contentTypeFor(file) {
  if (file.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (file.endsWith(".csv")) return "text/csv; charset=utf-8";
  return "binary/octet-stream";
}

async function uploadFile(localPath, key) {
  const body = fs.readFileSync(localPath);
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentTypeFor(localPath),
  }).promise();
  return {
    logicalKey: path.relative(outDir, localPath).replace(/\\/g, "/"),
    physicalKey: `s3://${bucket}/${key}`,
    hash: null,
    meta: null,
    size: body.length,
  };
}

async function putTextObject(key, content, contentType = "text/plain; charset=utf-8") {
  await s3.putObject({ Bucket: bucket, Key: key, Body: content, ContentType: contentType }).promise();
  resources.push({ type: "s3-object", bucket, key, cleanup: "left-in-place-if-package-source" });
  return `s3://${bucket}/${key}`;
}

async function uploadLifecycleEntry(localPath, key, logicalKey, meta = null) {
  const body = fs.readFileSync(localPath);
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentTypeFor(localPath),
  }).promise();
  resources.push({ type: "s3-object", bucket, key, cleanup: "left-in-place-if-package-source" });
  return {
    logicalKey,
    physicalKey: `s3://${bucket}/${key}`,
    hash: null,
    meta,
    size: body.length,
  };
}

async function deleteObject(key, note) {
  try {
    await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    cleanup.push({ type: "s3-object", bucket, key, status: "deleted", note });
  } catch (error) {
    cleanup.push({ type: "s3-object", bucket, key, status: "delete-failed", error: error.message, note });
  }
}

async function packageConstruct(packageName, entries, message, meta = {}) {
  const mutation = `
    mutation QaPackageConstruct($params: PackagePushParams!, $src: PackageConstructSource!) {
      packageConstruct(params: $params, src: $src) {
        __typename
        ... on PackagePushSuccess {
          revision { hash modified }
          package { bucket name }
        }
        ... on OperationError { message }
        ... on InvalidInput { errors { path message } }
      }
    }
  `;
  const publish = await graphql(mutation, {
    params: {
      bucket,
      name: packageName,
      message,
      userMeta: meta,
      workflow: null,
    },
    src: { entries },
  });
  const result = publish.packageConstruct;
  if (result.__typename !== "PackagePushSuccess") {
    throw new Error(`Package construct failed: ${JSON.stringify(result)}`);
  }
  return result.revision.hash;
}

async function runAdminCrud() {
  const suffix = shortRun();
  const policyTitle = `e2e-nightly-policy-${suffix}`;
  const policyTitleUpdated = `${policyTitle}-updated`;
  const roleName = `e2e_role_${suffix}`;
  const roleNameUpdated = `e2e_role_${suffix}_updated`;
  const userName = `e2e_user_${suffix}`;
  const userEmail = `${userName}@example.com`;
  const userEmailUpdated = `${userName}+updated@example.com`;
  const created = { policyId: null, roleId: null, userName: null };

  try {
    const createPolicy = await graphql(`
      mutation QaPolicyCreate($input: ManagedPolicyInput!) {
        policyCreate: policyCreateManaged(input: $input) {
          __typename
          ... on Policy {
            id
            title
            arn
            managed
            permissions { bucket { name } level }
            roles { id name }
          }
          ... on InvalidInput { errors { path message } }
          ... on OperationError { message }
        }
      }
    `, {
      input: {
        title: policyTitle,
        permissions: [{ bucket, level: "READ" }],
        roles: [],
      },
    });
    const policyResult = createPolicy.policyCreate;
    assert(policyResult.__typename === "Policy", `Policy create returned ${JSON.stringify(policyResult)}`);
    created.policyId = policyResult.id;
    resources.push({ type: "policy", name: policyTitle, id: created.policyId, cleanup: "pending" });

    const createRole = await graphql(`
      mutation QaRoleCreate($input: ManagedRoleInput!) {
        roleCreate: roleCreateManaged(input: $input) {
          __typename
          ... on RoleCreateSuccess {
            role {
              __typename
              ... on ManagedRole {
                id
                name
                arn
                permissions { bucket { name } level }
                policies { id title }
              }
            }
          }
        }
      }
    `, { input: { name: roleName, policies: [created.policyId] } });
    const roleResult = createRole.roleCreate;
    assert(roleResult.__typename === "RoleCreateSuccess", `Role create returned ${JSON.stringify(roleResult)}`);
    created.roleId = roleResult.role.id;
    resources.push({ type: "role", name: roleName, id: created.roleId, cleanup: "pending" });

    const updatePolicy = await graphql(`
      mutation QaPolicyUpdate($id: ID!, $input: ManagedPolicyInput!) {
        policyUpdate: policyUpdateManaged(id: $id, input: $input) {
          __typename
          ... on Policy {
            id
            title
            permissions { bucket { name } level }
            roles { id name }
          }
          ... on InvalidInput { errors { path message } }
          ... on OperationError { message }
        }
      }
    `, {
      id: created.policyId,
      input: {
        title: policyTitleUpdated,
        permissions: [{ bucket, level: "READ_WRITE" }],
        roles: [created.roleId],
      },
    });
    assert(updatePolicy.policyUpdate.__typename === "Policy", `Policy update returned ${JSON.stringify(updatePolicy.policyUpdate)}`);

    const updateRole = await graphql(`
      mutation QaRoleUpdate($id: ID!, $input: ManagedRoleInput!) {
        roleUpdate: roleUpdateManaged(id: $id, input: $input) {
          __typename
          ... on RoleUpdateSuccess {
            role {
              __typename
              ... on ManagedRole { id name policies { id title } permissions { bucket { name } level } }
            }
          }
        }
      }
    `, { id: created.roleId, input: { name: roleNameUpdated, policies: [created.policyId] } });
    assert(updateRole.roleUpdate.__typename === "RoleUpdateSuccess", `Role update returned ${JSON.stringify(updateRole.roleUpdate)}`);

    const createUser = await graphql(`
      mutation QaUserCreate($input: UserInput!) {
        admin {
          user {
            create(input: $input) {
              __typename
              ... on User {
                name
                email
                isActive
                isAdmin
                role { __typename ... on ManagedRole { id name } ... on UnmanagedRole { id name } }
                extraRoles { __typename ... on ManagedRole { id name } ... on UnmanagedRole { id name } }
              }
              ... on InvalidInput { errors { path message name context } }
              ... on OperationError { message name context }
            }
          }
        }
      }
    `, { input: { name: userName, email: userEmail, role: roleNameUpdated, extraRoles: [] } });
    const userResult = createUser.admin.user.create;
    assert(userResult.__typename === "User", `User create returned ${JSON.stringify(userResult)}`);
    created.userName = userName;
    resources.push({ type: "user", name: userName, cleanup: "pending" });

    const updateUser = await graphql(`
      mutation QaUserSetEmail($name: String!, $email: String!) {
        admin {
          user {
            mutate(name: $name) {
              setEmail(email: $email) {
                __typename
                ... on User { name email }
                ... on InvalidInput { errors { path message name context } }
                ... on OperationError { message name context }
              }
            }
          }
        }
      }
    `, { name: userName, email: userEmailUpdated });
    assert(updateUser.admin.user.mutate.setEmail.__typename === "User", `User update returned ${JSON.stringify(updateUser.admin.user.mutate.setEmail)}`);

    adminCrud.created = { policyTitle, roleName, userName };
    adminCrud.updated = { policyTitle: policyTitleUpdated, roleName: roleNameUpdated, userEmail: userEmailUpdated };
    return { created: adminCrud.created, updated: adminCrud.updated };
  } finally {
    if (created.userName) {
      try {
        const del = await graphql(`
          mutation QaUserDelete($name: String!) {
            admin { user { mutate(name: $name) { delete { __typename ... on InvalidInput { errors { path message name context } } ... on OperationError { message name context } } } } }
          }
        `, { name: created.userName });
        cleanup.push({ type: "user", name: created.userName, status: del.admin.user.mutate.delete.__typename === "OperationSuccess" ? "deleted" : "delete-requested", result: del.admin.user.mutate.delete });
      } catch (error) {
        cleanup.push({ type: "user", name: created.userName, status: "delete-failed", error: error.message });
      }
    }
    if (created.roleId) {
      try {
        const del = await graphql(`mutation QaRoleDelete($id: ID!) { roleDelete(id: $id) { __typename } }`, { id: created.roleId });
        cleanup.push({ type: "role", id: created.roleId, status: "delete-requested", result: del.roleDelete });
      } catch (error) {
        cleanup.push({ type: "role", id: created.roleId, status: "delete-failed", error: error.message });
      }
    }
    if (created.policyId) {
      try {
        const del = await graphql(`
          mutation QaPolicyDelete($id: ID!) {
            policyDelete(id: $id) {
              __typename
              ... on InvalidInput { errors { path message } }
              ... on OperationError { message }
            }
          }
        `, { id: created.policyId });
        cleanup.push({ type: "policy", id: created.policyId, status: "delete-requested", result: del.policyDelete });
      } catch (error) {
        cleanup.push({ type: "policy", id: created.policyId, status: "delete-failed", error: error.message });
      }
    }
  }
}

async function runPersonaMatrix() {
  const me = await queryMe();
  originalRole = me.role.name;
  const availableRoles = Array.from(new Set(me.roles.map((role) => role.name)));
  const preferred = ["executives", "engineering_demo", "demo", "test", originalRole];
  const probeRoles = Array.from(new Set(preferred.concat(availableRoles))).filter((role) => availableRoles.includes(role)).slice(0, 8);
  const probes = [];

  for (const role of probeRoles) {
    try {
      await switchRole(role);
      const overview = await capture(`persona-${role}-overview`, `/b/${bucket}`);
      const tree = await capture(`persona-${role}-tree`, `/b/${bucket}/tree/`);
      const packages = await capture(`persona-${role}-packages`, `/b/${bucket}/packages/`);
      const entry = {
        role,
        accessDenied: /Access Denied|don't have access|not authorized/i.test(`${overview.text} ${tree.text} ${packages.text}`),
        hasUpload: /Add files|Create package|Upload files/i.test(tree.text),
        canSeePackages: /package|packages|Create new package|No packages/i.test(packages.text) && !/Access Denied/i.test(packages.text),
      };
      probes.push(entry);
      personaMatrix.push(entry);
    } catch (error) {
      probes.push({ role, error: error.message });
      personaMatrix.push({ role, error: error.message });
    }
  }

  const admin = { persona: "admin", role: originalRole, isAdmin: me.isAdmin, covered: true };
  const readWrite = probes.find((p) => !p.error && !p.accessDenied && p.hasUpload);
  const readOnly = probes.find((p) => !p.error && !p.accessDenied && !p.hasUpload);
  const restricted = probes.find((p) => !p.error && p.accessDenied);
  const anonymous = { persona: "anonymous", covered: false };

  personaMatrix.push(admin);
  if (!readWrite) addBlocker("Persona matrix", "No assigned role produced a clear read-write persona during role switching.", { roles: probeRoles });
  if (!readOnly) addBlocker("Persona matrix", "No assigned role produced a clear read-only persona during role switching.", { roles: probeRoles });
  if (!restricted) addBlocker("Persona matrix", "No assigned role produced a restricted persona during role switching.", { roles: probeRoles });
  personaMatrix.push(
    { persona: "read-write", role: readWrite && readWrite.role, covered: Boolean(readWrite) },
    { persona: "read-only", role: readOnly && readOnly.role, covered: Boolean(readOnly) },
    { persona: "restricted", role: restricted && restricted.role, covered: Boolean(restricted) },
    anonymous,
  );

  if (originalRole) await switchRole(originalRole);
  return { roles: probeRoles, readWrite: readWrite && readWrite.role, readOnly: readOnly && readOnly.role, restricted: restricted && restricted.role };
}

async function runAnonymousChecks() {
  const anon = await chromium.launch({ channel: "chrome", headless: true });
  const anonContext = await anon.newContext({ viewport: { width: 1440, height: 1000 } });
  const anonPage = await anonContext.newPage();
  try {
    const home = await capture("anonymous-home", "/", anonPage);
    const admin = await capture("anonymous-admin-gated", "/admin", anonPage);
    const bucketPage = await capture("anonymous-bucket", `/b/${bucket}`, anonPage);
    const gatedAdmin = /sign in|login|not authorized|authorization|authenticate|SIGN IN WITH/i.test(admin.text);
    const bucketNotAdmin = !/Add files|Create package|Users and roles|Admin/i.test(bucketPage.text);
    personaMatrix.push({ persona: "anonymous", covered: true, gatedAdmin, bucketNotAdmin });
    assert(gatedAdmin, "Anonymous admin route did not clearly require auth");
    return { homeStart: home.text.slice(0, 200), gatedAdmin, bucketNotAdmin };
  } finally {
    await anonContext.close().catch(() => {});
    await anon.close().catch(() => {});
  }
}

async function runPackageLifecycle() {
  const suffix = shortRun();
  const packageName = `qa/e2e-nightly-${normalizedVersion}-lifecycle-${suffix}`;
  const base = `e2e-nightly-${normalizedVersion}-lifecycle/${runId}`;
  const lifecycleTmp = path.join(tmpDir, "package-lifecycle");
  fs.mkdirSync(lifecycleTmp, { recursive: true });
  const readmeFile = path.join(lifecycleTmp, "README.md");
  const dataFile = path.join(lifecycleTmp, "data-file.txt");
  const oddFile = path.join(lifecycleTmp, "odd-file.txt");
  const revFile = path.join(lifecycleTmp, "extra.csv");
  fs.writeFileSync(readmeFile, `# E2E lifecycle package\n\nrun=${runId}\n`);
  fs.writeFileSync(dataFile, `initial package object\nrun=${runId}\n`);
  fs.writeFileSync(oddFile, `odd logical filename package object\nrun=${runId}\n`);
  fs.writeFileSync(revFile, "id,value\n1,nightly\n");

  const initialEntries = [
    await uploadLifecycleEntry(readmeFile, `${base}/initial/readme.md`, "README.md", { stage: "initial" }),
    await uploadLifecycleEntry(dataFile, `${base}/initial/data-file.txt`, "nested/files/data file.txt", { stage: "initial" }),
    await uploadLifecycleEntry(oddFile, `${base}/initial/odd-file.txt`, "nested odd/odd-file_[1].txt", { oddFilename: true }),
  ];
  const rev1 = await packageConstruct(packageName, initialEntries, `e2e lifecycle initial revision (${runId})`, {
    qaRunId: runId,
    qaStage: "initial",
  });

  const revisedEntries = initialEntries.concat([
    await uploadLifecycleEntry(revFile, `${base}/revision-2/extra.csv`, "revision-2/extra.csv", { stage: "revision-2" }),
  ]);
  const rev2 = await packageConstruct(packageName, revisedEntries, `e2e lifecycle revised package (${runId})`, {
    qaRunId: runId,
    qaStage: "revision-2",
  });

  lifecycle.packageName = packageName;
  lifecycle.packageUrl = `${target}/b/${bucket}/packages/${packageName}`;
  lifecycle.revisions = [rev1, rev2];
  lifecycle.leftInPlace = {
    reason: "Package revisions require their backing S3 package source objects to remain addressable for inspection.",
    packageName,
    s3Prefix: `s3://${bucket}/${base}/`,
  };
  resources.push({ type: "package", bucket, name: packageName, cleanup: "left-in-place", revisions: [rev1, rev2] });

  const detail = await capture("lifecycle-package-detail", `/b/${bucket}/packages/${packageName}`);
  assert(/README|nested|revision-2|Get package|Download|quilt3|Files|Entries/i.test(detail.text), "Lifecycle package detail did not expose expected files/get affordance");
  const revisions = await capture("lifecycle-package-revisions", `/b/${bucket}/packages/${packageName}/revisions`);
  assert(revisions.text.includes(rev1.slice(0, 8)) || revisions.text.includes(rev2.slice(0, 8)) || /revision|latest|hash/i.test(revisions.text), "Lifecycle package revisions UI did not show revision history");

  return { packageName, revisions: [rev1, rev2], packageUrl: lifecycle.packageUrl };
}

async function runUploadDownloadCleanup() {
  const fileName = `e2e-deeper-nightly-${normalizedVersion}-${runId}.txt`;
  const key = `e2e-playwright/${fileName}`;
  const localFile = path.join(tmpDir, fileName);
  fs.writeFileSync(localFile, `Quilt nightly ${expectedVersion} deeper QA\nrun=${runId}\nbucket=${bucket}\n`);

  await goto(`/b/${bucket}/tree/e2e-playwright/`);
  await page.getByRole("button", { name: /add files/i }).click({ timeout: 15000 });
  await page.getByText(/upload files/i).click({ timeout: 15000 });
  await page.locator("input[type='file']").setInputFiles(localFile, { timeout: 15000 });
  await page.getByRole("button", { name: /^upload$/i }).click({ timeout: 15000 });
  await page.getByText(/successfully uploaded 1 file/i).waitFor({ timeout: 60000 });
  await capture("deeper-upload-success");
  await page.getByRole("button", { name: /^close$/i }).click({ timeout: 15000 }).catch(() => {});

  const view = await capture("deeper-uploaded-file-view", `/b/${bucket}/tree/${key}`);
  assert(view.text.includes(fileName), "Uploaded file name is not visible");
  await page.getByRole("button", { name: /get file/i }).click({ timeout: 15000 });
  const downloadLink = page.getByRole("link", { name: /download file/i }).first();
  assert(await downloadLink.count(), "Download file link not found");
  const href = await downloadLink.getAttribute("href");
  const response = await page.request.get(href, { timeout: 45000 });
  assert(response.ok(), `Download URL returned ${response.status()}`);
  const downloaded = await response.text();
  assert(downloaded.includes(runId), "Downloaded file did not contain run id");
  fs.writeFileSync(path.join(outDir, "downloaded-upload.txt"), downloaded);
  await deleteObject(key, "Uploaded UI smoke-test object");
  await capture("deeper-upload-cleanup-verification", `/b/${bucket}/tree/${key}`);
  return { key, bytes: downloaded.length };
}

async function fillSearchInput(value) {
  const inputs = page.locator("input:visible, textarea:visible");
  const count = await inputs.count();
  const deferred = [];
  for (let i = 0; i < count; i += 1) {
    const input = inputs.nth(i);
    const type = ((await input.getAttribute("type").catch(() => "")) || "").toLowerCase();
    const placeholder = (await input.getAttribute("placeholder").catch(() => "")) || "";
    const aria = (await input.getAttribute("aria-label").catch(() => "")) || "";
    const disabled = await input.isDisabled().catch(() => true);
    if (disabled || ["checkbox", "radio", "hidden", "submit", "button"].includes(type)) continue;
    const candidate = { input, placeholder, aria, type };
    if (/go to bucket/i.test(placeholder)) deferred.push(candidate);
    else {
      try {
        await input.fill(value, { timeout: 5000 });
        return { filled: true, placeholder, aria, type };
      } catch (_) {
        // Try the next visible text input.
      }
    }
  }
  for (const candidate of deferred) {
    try {
      await candidate.input.fill(value, { timeout: 5000 });
      return {
        filled: true,
        placeholder: candidate.placeholder,
        aria: candidate.aria,
        type: candidate.type,
        fallback: "go-to-bucket-input",
      };
    } catch (_) {
      // Try the next deferred candidate.
    }
  }
  return { filled: false, reason: "No fillable visible text input found" };
}

async function runSearchAndFiltering() {
  const global = await capture("global-search-initial", "/search");
  const globalFill = await fillSearchInput("quilt-example-bucket");
  if (globalFill.filled) {
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
  const globalAfter = await capture("global-search-query");
  searchEvidence.global = { url: page.url(), fill: globalFill, textStart: globalAfter.text.slice(0, 500) };
  assert(/search|result|bucket|quilt-example/i.test(`${global.text} ${globalAfter.text}`), "Global search did not render recognizable results or empty state");

  const packages = await capture("package-search-initial", `/b/${bucket}/packages/`);
  const packageFill = await fillSearchInput("qa");
  if (packageFill.filled) {
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
  const packagesAfter = await capture("package-search-qa");
  searchEvidence.packages = { url: page.url(), fill: packageFill, textStart: packagesAfter.text.slice(0, 500) };
  assert(/package|filter|search|qa|No packages|result/i.test(`${packages.text} ${packagesAfter.text}`), "Package search/filter UI did not render recognizable state");

  await goto(`/b/${bucket}/tree/`);
  const treeFill = await fillSearchInput("definitely-no-e2e-result");
  if (treeFill.filled) {
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
  const empty = await capture("bucket-filter-empty-results");
  searchEvidence.empty = { url: page.url(), fill: treeFill, textStart: empty.text.slice(0, 500) };
  return searchEvidence;
}

async function chooseAthenaWorkgroup() {
  const listed = await athena.listWorkGroups({ MaxResults: 20 }).promise();
  const names = (listed.WorkGroups || []).map((w) => w.Name).filter(Boolean);
  for (const name of names) {
    try {
      const details = await athena.getWorkGroup({ WorkGroup: name }).promise();
      const wg = details.WorkGroup;
      if (wg && wg.State === "ENABLED" && wg.Configuration && wg.Configuration.ResultConfiguration && wg.Configuration.ResultConfiguration.OutputLocation) {
        return name;
      }
    } catch (error) {
      athenaEvidence.workgroupProbeError = error.message;
    }
  }
  return names[0] || null;
}

async function waitForQuery(executionId) {
  for (let i = 0; i < 45; i += 1) {
    const result = await athena.getQueryExecution({ QueryExecutionId: executionId }).promise();
    const execution = result.QueryExecution || {};
    const state = execution.Status && execution.Status.State;
    if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(state)) return execution;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Athena query ${executionId} did not finish within timeout`);
}

async function startAthena(sql, workgroup) {
  const start = await athena.startQueryExecution({
    QueryString: sql,
    ResultConfiguration: {
      EncryptionConfiguration: { EncryptionOption: "SSE_S3" },
    },
    WorkGroup: workgroup,
  }).promise();
  const executionId = start.QueryExecutionId;
  assert(executionId, "Athena did not return a QueryExecutionId");
  const execution = await waitForQuery(executionId);
  let rows = [];
  if (execution.Status.State === "SUCCEEDED") {
    const result = await athena.getQueryResults({ QueryExecutionId: executionId, MaxResults: 10 }).promise();
    rows = (result.ResultSet && result.ResultSet.Rows) || [];
  }
  return {
    executionId,
    state: execution.Status.State,
    reason: execution.Status.StateChangeReason,
    rows,
    workgroup,
  };
}

async function runAthenaChecks() {
  const ui = await capture("athena-ui", `/b/${bucket}/queries/athena`);
  athenaEvidence.uiTextStart = ui.text.slice(0, 800);
  const workgroup = await chooseAthenaWorkgroup();
  if (!workgroup) {
    addBlocker("Athena execution", "No Athena workgroup was listable from the temporary catalog credentials.", {
      evidence: "screenshots/athena-ui.png",
    });
    return athenaEvidence;
  }
  athenaEvidence.workgroup = workgroup;

  try {
    const valid = await startAthena("SELECT 1 AS nightly_qa_probe", workgroup);
    athenaEvidence.valid = valid;
    assert(valid.state === "SUCCEEDED", `Expected SELECT 1 to succeed, got ${valid.state}: ${valid.reason || ""}`);
  } catch (error) {
    athenaEvidence.valid = { status: "blocked-or-failed", error: error.message };
    addFinding("medium", "Athena execution", "functional", `SELECT 1 could not be executed successfully: ${error.message}`, {
      evidence: "screenshots/athena-ui.png",
    });
  }

  try {
    const invalid = await startAthena("SELECT * FROM definitely_missing_e2e_qa_table", workgroup);
    athenaEvidence.invalid = invalid;
    assert(invalid.state === "FAILED", `Expected invalid SQL to fail, got ${invalid.state}`);
  } catch (error) {
    athenaEvidence.invalid = { status: "error-during-invalid-query", error: error.message };
    addFinding("low", "Athena invalid SQL", "diagnostic", `Invalid SQL path could not be verified cleanly: ${error.message}`, {
      evidence: "screenshots/athena-ui.png",
    });
  }
  return athenaEvidence;
}

async function runReleaseValidation() {
  const home = await capture("release-home", "/");
  const footerMatch = home.text.match(/Version:\s*([^\s]+)/i);
  release.displayedVersion = footerMatch ? footerMatch[1] : null;
  release.target = target;
  release.expectedRelease = expectedVersion;
  if (!release.displayedVersion || !versionRegex(expectedVersion).test(release.displayedVersion)) {
    addFinding("medium", "Release/version display", "release validation", `The nightly footer reports ${release.displayedVersion || "no visible version"}, which does not visibly identify the expected ${expectedVersion} release candidate.`, {
      evidence: "screenshots/release-home.png",
    });
  }
  return release;
}

function writeJson(name, value) {
  const file = path.join(dataDir, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

function processDoc() {
  return `# Nightly ${expectedVersion} RC Deeper QA Process

## Scope

This playbook validates the target catalog environment at ${target} using the configured writable bucket \`${bucket}\`. It intentionally does not create a dedicated QA stack or bucket. Temporary users, roles, policies, S3 objects, and packages use \`e2e-\` prefixes where the target system permits that naming.

## Layers Covered

- Persona and permission matrix: current admin account, switchable assigned roles, restricted role if available, and anonymous browser checks.
- Package lifecycle: create a package, create a second revision, inspect package detail and revisions, verify nested and odd filenames, and preserve package/source objects as durable evidence.
- Admin CRUD: create/update/delete a managed policy, managed role, and invite/update/delete an e2e user through catalog GraphQL.
- Athena execution: load the Athena route, run a harmless \`SELECT 1\` query with catalog temporary AWS credentials, and run invalid SQL to verify failure handling. MCP Athena evidence is also recorded.
- Visual regression seed: capture screenshots, viewport dimensions, overflow, and clipped controls for key routes. These screenshots are the baseline seed for a future pixel-diff system.
- Search and filtering: global search, package search/filtering, bucket filtering/empty state, and URL state capture.
- Release validation: footer version and runtime catalog config.
- Accessibility/performance smoke: lightweight DOM checks for unlabeled controls/buttons and navigation timing metrics. No heavy accessibility dependency is installed.

## Handoff And Failure Policy

This v1 automation is package-only. It publishes the report package \`${finalPackageName}\` and does not create GitHub issues, Slack messages, or Asana tasks. QA findings are encoded in \`README.md\` and \`qa-summary.json\`; findings do not make the runner fail. The runner exits nonzero only when it cannot complete or publish due to an infrastructure or automation bug.

## How To Run

From \`catalog\`:

\`\`\`bash
npm run qa:deeper-rc
\`\`\`

Prerequisites:

- In CI, set \`QA_AUTH_MODE=profile\`, commit the encrypted browser profile at \`catalog/qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg\`, and set repository secret \`QUILT_QA_BROWSER_PROFILE_PASSPHRASE\`.
- The encrypted profile is a GPG-encrypted \`.tgz\` of a Chrome/Playwright profile captured after an interactive Microsoft federated login. The workflow decrypts it to \`QA_BROWSER_PROFILE_TGZ\` before invoking the runner.
- \`QUILT_QA_BROWSER_PROFILE_TGZ_B64\` remains a legacy fallback, but browser profile payloads are usually too large for GitHub Actions secrets and can fail with HTTP 422 \`Value is too large\`.
- For local development, either refresh the authenticated profile at \`${path.relative(process.cwd(), profileDir)}\` or run \`QA_AUTH_MODE=microsoft-interactive npm run qa:deeper-rc\` to create a new profile export.
- \`QA_AUTH_MODE=credentials\` remains available only as a legacy path for environments that still have \`QUILT_QA_USERNAME\` and \`QUILT_QA_PASSWORD\`; it is not required for Microsoft federation.
- \`playwright\` and \`aws-sdk\` must be resolvable from the catalog app install.

Microsoft federated login is browser-interactive and may require MFA or conditional access. GitHub Actions cannot complete that flow unaided. V1 CI therefore reuses a pre-established encrypted browser session profile. Rotate the encrypted \`.tgz.gpg\` file and \`QUILT_QA_BROWSER_PROFILE_PASSPHRASE\` whenever the Microsoft/Quilt session expires, access changes, or the test identity is rotated.

To bootstrap or rotate the CI profile locally from \`catalog\`:

\`\`\`bash
npm ci
npx playwright install chrome
QA_AUTH_MODE=microsoft-interactive npm run qa:deeper-rc

PASSPHRASE="$(openssl rand -base64 32)"
mkdir -p qa/deeper-rc/secrets
gpg --symmetric --cipher-algo AES256 --batch --yes --pinentry-mode loopback \\
  --passphrase "$PASSPHRASE" \\
  -o qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg \\
  .playwright-mcp/deeper-rc-browser-profile.tgz
gh secret set QUILT_QA_BROWSER_PROFILE_PASSPHRASE --body "$PASSPHRASE"
git add qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg
\`\`\`

The runner can also encrypt during bootstrap when \`QA_PROFILE_ENCRYPT_PASSPHRASE\` is set:

\`\`\`bash
PASSPHRASE="$(openssl rand -base64 32)"
QA_AUTH_MODE=microsoft-interactive \\
  QA_PROFILE_ENCRYPT_PASSPHRASE="$PASSPHRASE" \\
  npm run qa:deeper-rc
gh secret set QUILT_QA_BROWSER_PROFILE_PASSPHRASE --body "$PASSPHRASE"
git add qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg
\`\`\`

Commit only the encrypted \`.tgz.gpg\` profile. Do not commit the plaintext \`.tgz\` profile or legacy \`.b64\` export.

A better future option is a dedicated machine/test identity with compatible conditional-access policy, or a Quilt-issued service token / OIDC exchange if the product adds a supported non-interactive auth path.

## How To Interpret Results

- \`data/qa-summary.json\` is the machine-readable summary.
- \`screenshots/\` contains visual evidence for each route and failed check.
- Findings are ordered by severity in \`README.md\`.
- Cleanup status is explicit in \`data/cleanup.json\`. Package lifecycle objects are intentionally left in place when they are package sources.
- Release artifacts are included in the deeper QA package for v1; \`${artifactPackageName}\` is reserved for a future separate package if needed.

## Future Baseline Diffs

Promote this package revision to the first baseline by storing expected screenshots and dimensions under a stable prefix. A follow-up runner should download the previous baseline package, compare screenshots with a pixel threshold, and publish a diff artifact package that links back to both revisions.
`;
}

function summaryObject(packageRevision = null) {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  return {
    target,
    bucket,
    authMode,
    expectedVersion,
    normalizedVersion,
    packageName: finalPackageName,
    artifactPackageName,
    runId,
    prefix,
    packageUrl: `${target}/b/${bucket}/packages/${finalPackageName}`,
    packageRevision,
    outputDirectory: outDir,
    skipWait,
    counts: {
      passed,
      failed,
      findings: findings.length,
      blockers: blockers.length,
      screenshots: pages.length,
    },
    results,
    findings: findings.slice().sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    }),
    blockers,
    resources,
    cleanup,
    release,
    personaMatrix,
    lifecycle,
    searchEvidence,
    athenaEvidence,
    performance,
    accessibility,
    pages,
  };
}

function markdownReport(packageRevision = null) {
  const summary = summaryObject(packageRevision);
  const findingLines = summary.findings.length
    ? summary.findings
        .map((f, i) => `### ${i + 1}. ${f.summary}

- Severity: ${f.severity}
- Area: ${f.area}
- Type: ${f.type}
- Evidence: \`${f.evidence || "data/qa-summary.json"}\`${f.details ? `
- Details: \`${JSON.stringify(f.details).slice(0, 1200)}\`` : ""}`)
        .join("\n\n")
    : "No functional, visual, release, accessibility, or diagnostic findings were recorded.";

  return `# Nightly ${expectedVersion} RC Deeper QA Report

- Target: ${target}
- Results bucket: ${bucket}
- Package: ${bucket}/${finalPackageName}
- Expected version: ${expectedVersion}
- Run ID: ${runId}
- Test date: ${new Date().toISOString()}
- Final revision: ${packageRevision ? `\`${packageRevision}\`` : "pending at initial upload time"}

## Summary

- Passed checks: ${summary.counts.passed}
- Failed checks: ${summary.counts.failed}
- Findings: ${summary.counts.findings}
- Blockers / limitations: ${summary.counts.blockers}
- Screenshots captured: ${summary.counts.screenshots}

This package contains both the durable process in \`docs/qa-process.md\` and the evidence from this run under \`data/\` and \`screenshots/\`.

## Findings

${findingLines}

## Persona Coverage

${personaMatrix.map((p) => `- ${p.persona || p.role}: ${p.covered === false ? "not fully covered" : "covered/probed"}${p.role ? ` via role \`${p.role}\`` : ""}${p.error ? ` - ${p.error}` : ""}`).join("\n")}

## Lifecycle Resources

- Lifecycle package: ${lifecycle.packageUrl || "not created"}
- Revisions: ${(lifecycle.revisions || []).map((r) => `\`${r}\``).join(", ") || "n/a"}
- Left in place: ${lifecycle.leftInPlace ? lifecycle.leftInPlace.reason : "n/a"}

## Cleanup

${cleanup.length ? cleanup.map((item) => `- ${item.type} ${item.name || item.id || item.key || ""}: ${item.status}`).join("\n") : "No cleanup actions were recorded."}

## Checks

${results.map((r) => `- ${r.status.toUpperCase()}: ${r.name}${r.error ? ` - ${r.error}` : ""}${r.note ? ` - ${r.note}` : ""}`).join("\n")}
`;
}

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else files.push(full);
  }
  return files;
}

async function publishFinalPackage() {
  fs.copyFileSync(__filename, path.join(outDir, `automation-nightly-${normalizedVersion}-deeper-qa.mjs`));
  fs.writeFileSync(path.join(docsDir, "qa-process.md"), processDoc());
  const releasePrompt = path.join(__dirname, "docs", "release-artifacts-prompt.md");
  if (fs.existsSync(releasePrompt)) {
    fs.copyFileSync(releasePrompt, path.join(docsDir, "release-artifacts-prompt.md"));
  }
  writeJson("results.json", results);
  writeJson("findings.json", findings);
  writeJson("blockers.json", blockers);
  writeJson("resources.json", resources);
  writeJson("cleanup.json", cleanup);
  writeJson("persona-matrix.json", personaMatrix);
  writeJson("package-lifecycle.json", lifecycle);
  writeJson("athena.json", athenaEvidence);
  writeJson("search.json", searchEvidence);
  writeJson("release.json", release);
  writeJson("performance.json", performance);
  writeJson("accessibility.json", accessibility);
  fs.writeFileSync(path.join(outDir, "qa-summary.json"), JSON.stringify(summaryObject(null), null, 2));
  fs.writeFileSync(path.join(outDir, "README.md"), markdownReport(null));

  const entries = [];
  for (const file of walkFiles(outDir)) {
    const rel = path.relative(outDir, file).replace(/\\/g, "/");
    entries.push(await uploadFile(file, `${prefix}${rel}`));
  }

  const revision = await packageConstruct(
    finalPackageName,
    entries,
    `Nightly ${expectedVersion} RC deeper QA report (${runId})`,
    {
      target,
      runId,
      releaseCandidate: expectedVersion,
      qaType: "deeper-browser-playwright",
      findings: findings.length,
      failures: results.filter((r) => r.status === "fail").length,
    },
  );

  const finalSummary = summaryObject(revision);
  fs.writeFileSync(path.join(outDir, "qa-summary.json"), JSON.stringify(finalSummary, null, 2));
  fs.writeFileSync(path.join(outDir, "README.md"), markdownReport(revision));
  fs.writeFileSync(path.join(outDir, "publish-result.json"), JSON.stringify(finalSummary, null, 2));
  await uploadFile(path.join(outDir, "README.md"), `${prefix}README.md`);
  await uploadFile(path.join(outDir, "qa-summary.json"), `${prefix}qa-summary.json`);
  await uploadFile(path.join(outDir, "publish-result.json"), `${prefix}publish-result.json`);

  return finalSummary;
}

(async () => {
  assertSupportedAuthMode();
  if (authMode === "microsoft-interactive") {
    await runMicrosoftInteractiveBootstrap();
    return;
  }
  prepareProfileAuth();

  context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page = context.pages()[0] || await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ url: page.url(), text: msg.text() });
  });
  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      error: request.failure() && request.failure().errorText,
    });
  });

  await authenticateCatalog();
  await getAwsCredentials();

  await run("release validation and home visual baseline", runReleaseValidation);
  await run("admin CRUD for e2e user role policy", runAdminCrud);
  await run("persona and permission matrix", runPersonaMatrix);
  await run("anonymous access checks", runAnonymousChecks);
  await run("full package lifecycle create revise inspect", runPackageLifecycle);
  await run("UI upload download cleanup lifecycle", runUploadDownloadCleanup);
  await run("search and filtering smoke", runSearchAndFiltering);
  await run("Athena execution and invalid SQL", runAthenaChecks);

  await run("admin routes visual baseline", async () => {
    await capture("admin-users", "/admin");
    await capture("admin-buckets", "/admin/buckets");
    await capture("admin-status", "/admin/status");
    return {};
  });

  if (consoleErrors.length) {
    addFinding("low", "Browser console", "diagnostic", `${consoleErrors.length} console error(s) observed during QA run.`, {
      evidence: "data/qa-summary.json",
      details: consoleErrors.slice(0, 20),
    });
  }
  if (requestFailures.length) {
    addFinding("medium", "Network", "diagnostic", `${requestFailures.length} failed network request(s) observed during QA run.`, {
      evidence: "data/qa-summary.json",
      details: requestFailures.slice(0, 20),
    });
  }

  const finalSummary = await publishFinalPackage();
  await capture("final-qa-package-route", `/b/${bucket}/packages/${finalPackageName}`);
  finalSummary.finalRouteLoaded = page.url();
  fs.writeFileSync(path.join(outDir, "publish-result.json"), JSON.stringify(finalSummary, null, 2));

  console.log("DEEPER_QA_PUBLISH_RESULT", JSON.stringify({
    passed: finalSummary.counts.passed,
    failed: finalSummary.counts.failed,
    findings: finalSummary.counts.findings,
    blockers: finalSummary.counts.blockers,
    packageUrl: finalSummary.packageUrl,
    packageRevision: finalSummary.packageRevision,
    outDir,
  }, null, 2));

  await context.close();
})().catch(async (error) => {
  console.error("DEEPER_QA_ERROR", error.stack || error.message);
  try {
    addFinding("high", "runner", "fatal", error.message);
    const fatalSummary = summaryObject(null);
    fatalSummary.runnerError = error.stack || error.message;
    fs.writeFileSync(path.join(outDir, "qa-summary.json"), JSON.stringify(fatalSummary, null, 2));
    fs.writeFileSync(path.join(outDir, "README.md"), markdownReport(null));
    fs.writeFileSync(path.join(outDir, "publish-result.json"), JSON.stringify(fatalSummary, null, 2));
    console.log("DEEPER_QA_LOCAL_RESULT", JSON.stringify({
      failed: fatalSummary.counts.failed,
      findings: fatalSummary.counts.findings,
      blockers: fatalSummary.counts.blockers,
      outDir,
    }, null, 2));
  } catch (_) {
    // best-effort fatal summary
  }
  if (context) await context.close().catch(() => {});
  process.exit(1);
});
