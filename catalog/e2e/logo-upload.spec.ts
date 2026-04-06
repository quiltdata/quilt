/**
 * E2E test: logo file upload via Admin > Settings > Theme
 *
 * Covers the feature added in feat/logo-file-upload:
 *   - useUploadFile() uploads to s3://<serviceBucket>/catalog/logo.<ext>
 *   - ThemeEditor shows drag-and-drop InputFile instead of URL text field
 *   - The Logo component renders the uploaded image in the navbar
 *
 * Requires the catalog dev server running on http://localhost:3000
 * pointing at the quilt-staging stack in us-east-1.
 */

import * as fs from 'fs'

import { chromium, expect, type BrowserContext, type Page } from 'playwright'

const CATALOG_URL = 'http://localhost:3000'
const ADMIN_SETTINGS_URL = `${CATALOG_URL}/admin/settings`

// Tiny 1×1 red PNG (valid PNG, ~68 bytes)
const TEST_LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
const TEST_LOGO_PATH = '/tmp/test-logo-e2e.png'

async function getAuthenticatedPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage()
  await page.goto(CATALOG_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // If redirected to sign-in, complete Google SSO
  if (page.url().includes('signin') || page.url().includes('login')) {
    console.log('  → Sign-in required — clicking Google SSO…')
    const googleBtn = page.getByRole('button', { name: /google/i })
    await expect(googleBtn).toBeVisible({ timeout: 10_000 })
    await googleBtn.click()

    // Wait for Google OAuth redirect or direct redirect back to catalog
    try {
      await page.waitForURL(/accounts\.google\.com/, { timeout: 8_000 })
      // Google login — user may need to interact; wait up to 2 min
      console.log('  → Google OAuth page opened. Waiting for completion (up to 2 min)…')
      await page.waitForURL(/localhost:3000/, { timeout: 120_000 })
    } catch {
      // May have redirected directly back without showing google.com (e.g. already logged in)
      await page.waitForURL(/localhost:3000/, { timeout: 30_000 })
    }
    console.log('  → Signed in successfully')
  }

  // Wait for the app shell to load
  await page.waitForLoadState('networkidle', { timeout: 20_000 })
  return page
}

async function run() {
  fs.writeFileSync(TEST_LOGO_PATH, TEST_LOGO_PNG)

  const CHROME_EXEC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const CHROME_USER_DATA = `${process.env.HOME}/Library/Application Support/Google/Chrome`

  const ctx = await chromium.launchPersistentContext(CHROME_USER_DATA, {
    headless: false,
    executablePath: CHROME_EXEC,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
    ],
    viewport: { width: 1400, height: 900 },
  })

  let passed = 0
  const results: Array<{ name: string; ok: boolean; err?: string }> = []

  function check(name: string, ok: boolean, err?: string) {
    results.push({ name, ok, err })
    if (ok) {
      passed++
      console.log(`  ✅ ${name}`)
    } else {
      console.log(`  ❌ ${name}${err ? ': ' + err : ''}`)
    }
  }

  const page = await getAuthenticatedPage(ctx)

  // ── TEST 1: Admin Settings loads ───────────────────────────────────────
  console.log('\n[1/5] Admin Settings page loads…')
  await page.goto(ADMIN_SETTINGS_URL, { waitUntil: 'networkidle', timeout: 30_000 })
  const themeVisible = await page
    .getByText(/theme/i)
    .first()
    .isVisible()
    .catch(() => false)
  check('Admin Settings page loaded with Theme section', themeVisible)

  // ── TEST 2: Dialog opens with drop-zone, not URL text field ───────────
  console.log('\n[2/5] Configure theme dialog opens with drop-zone…')
  const configureBtn = page.getByRole('button', { name: /configure theme/i })
  const editBtn = page.getByRole('button', { name: /^edit$/i })
  if (await configureBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await configureBtn.click()
  } else if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await editBtn.click()
  } else {
    check('Configure/Edit button found', false, 'Neither button visible')
    await ctx.close()
    summarize(results, passed)
    return
  }

  const dropZoneText = page.getByText(/drop logo here/i)
  const dropZoneVisible = await dropZoneText.isVisible({ timeout: 5_000 }).catch(() => false)
  check('Drop-zone InputFile rendered (not URL text field)', dropZoneVisible)

  // Verify URL text field is NOT present
  const urlInput = page.getByLabel(/logo url/i)
  const urlFieldGone = !(await urlInput.isVisible({ timeout: 1_000 }).catch(() => false))
  check('URL text field is absent (replaced by file drop-zone)', urlFieldGone)

  // ── TEST 3: File selection shows preview ──────────────────────────────
  console.log('\n[3/5] File selection shows preview image…')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(TEST_LOGO_PATH)
  await page.waitForTimeout(500)
  // An <img> with an object URL should appear in the dialog
  const previewImg = page.locator('.MuiDialog-root img')
  const previewVisible = await previewImg.isVisible({ timeout: 5_000 }).catch(() => false)
  check('Logo preview img visible after file selection', previewVisible)

  // ── TEST 4: Save → S3 upload + settings.json written ─────────────────
  console.log('\n[4/5] Saving uploads to S3 and persists settings…')
  const s3PutRequests: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'PUT') {
      const url = decodeURIComponent(req.url())
      if (url.includes('catalog/logo') || url.includes('catalog%2Flogo')) {
        s3PutRequests.push(url)
        console.log('    → S3 PUT:', url.substring(0, 100))
      }
    }
  })

  const saveBtn = page.getByRole('button', { name: /^save$/i })
  await saveBtn.click()

  // Wait for dialog to close (save completed)
  await page
    .getByRole('dialog')
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => {})
  const dialogClosed = !(await page
    .getByRole('dialog')
    .isVisible()
    .catch(() => false))
  check('Dialog closed after Save (settings written)', dialogClosed)
  check(
    'S3 PUT to catalog/logo.<ext> observed',
    s3PutRequests.length > 0,
    s3PutRequests.length === 0 ? 'No PUT request captured (may use different signing)' : undefined,
  )

  // ── TEST 5: Navbar shows the uploaded logo ────────────────────────────
  console.log('\n[5/5] Navbar renders the uploaded logo…')
  await page.waitForTimeout(1000) // let settings reload
  const navImg = page.locator('header img, [class*="NavBar"] img, [class*="Logo"] img').first()
  const navLogoVisible = await navImg.isVisible({ timeout: 8_000 }).catch(() => false)
  check('Logo image visible in navbar', navLogoVisible)
  if (navLogoVisible) {
    const src = await navImg.getAttribute('src')
    console.log('    → Logo src:', (src ?? '').substring(0, 80))
  }

  // ── Cleanup: remove custom theme ──────────────────────────────────────
  console.log('\n[cleanup] Removing custom theme to leave staging clean…')
  await page.goto(ADMIN_SETTINGS_URL, { waitUntil: 'networkidle' })
  const removeBtn = page.getByRole('button', { name: /remove/i })
  if (await removeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    page.once('dialog', (d) => d.accept())
    await removeBtn.click()
    await expect(page.getByText(/not configured/i)).toBeVisible({ timeout: 10_000 })
    console.log('  ✅ Custom theme removed')
  } else {
    console.log('  ℹ Remove button not found (theme may already be removed)')
  }

  await ctx.close()
  fs.unlinkSync(TEST_LOGO_PATH)

  summarize(results, passed)
  if (passed < results.length) process.exit(1)
}

function summarize(results: Array<{ name: string; ok: boolean; err?: string }>, passed: number) {
  console.log('\n══════════════════════════════════════════════════════')
  console.log(`Test results: ${passed}/${results.length} passed`)
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.err ? ' — ' + r.err : ''}`)
  }
  console.log('══════════════════════════════════════════════════════\n')
}

run().catch((err) => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
