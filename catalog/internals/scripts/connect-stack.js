#!/usr/bin/env node
/* eslint-disable no-console */
// Connect the local catalog to a live stack:
//   1. Fetch <url>/config.js and write it to static-dev/config.js
//   2. Emit static-dev/bookmarks.html with two auth-shuttle bookmarklets
//   3. Launch `npm start`
//
// Usage:
//   node internals/scripts/connect-stack.js [https://live.catalog.url]
// or (interactive):
//   node internals/scripts/connect-stack.js

const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const os = require('os')
const path = require('path')
const readline = require('readline')

const CATALOG_DIR = path.resolve(__dirname, '../..')
const CONFIG_PATH = path.join(CATALOG_DIR, 'static-dev/config.js')
const BOOKMARKS_PATH = path.join(CATALOG_DIR, 'static-dev/bookmarks.html')
const LOG_PATH = path.join(os.tmpdir(), 'connect-stack.log')
const NODE20_BIN = '/opt/homebrew/opt/node@20/bin'
const PORT = 3000

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a.trim()) }))
}

async function fetchConfig(url) {
  const configUrl = `${url}/config.js`
  console.log(`Fetching ${configUrl}`)
  const res = await fetch(configUrl)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
  const body = await res.text()
  if (!body.includes('QUILT_CATALOG_CONFIG')) {
    throw new Error(`Response from ${configUrl} does not look like a Quilt catalog config.js`)
  }
  fs.writeFileSync(CONFIG_PATH, `// Fetched ${new Date().toISOString()} from ${configUrl}\n${body}`)
  console.log(`Wrote ${path.relative(CATALOG_DIR, CONFIG_PATH)}`)
}

function writeBookmarks(url) {
  const copy =
    "javascript:(async()=>{const d={USER:localStorage.USER,TOKENS:localStorage.TOKENS};" +
    "if(!d.USER||!d.TOKENS){alert('No Quilt auth in localStorage');return}" +
    "await navigator.clipboard.writeText(JSON.stringify(d));alert('Quilt auth copied')})();"
  const paste =
    "javascript:(async()=>{try{const d=JSON.parse(await navigator.clipboard.readText());" +
    "if(!d.USER||!d.TOKENS)throw 0;" +
    "localStorage.USER=d.USER;localStorage.TOKENS=d.TOKENS;location.reload()}" +
    "catch(e){alert('Clipboard does not contain Quilt auth JSON')}})();"
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Quilt Auth Bookmarklets</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;line-height:1.5}
  .b{display:inline-block;background:#ffcb00;color:#000;padding:8px 14px;border-radius:4px;text-decoration:none;font-weight:bold}
  code{background:#eee;padding:2px 6px;border-radius:3px}
  ol li{margin:8px 0}
</style></head><body>
<h1>Quilt Auth Bookmarklets</h1>
<p>Drag each yellow link to your bookmarks bar, then:</p>
<ol>
  <li>Visit <a href="${url}">${url}</a>, log in, click <b>Copy Quilt Auth</b>.</li>
  <li>Visit <a href="http://localhost:3000">http://localhost:3000</a>, click <b>Paste Quilt Auth</b>. Page reloads signed in.</li>
</ol>
<p><a class="b" href="${copy}">Copy Quilt Auth</a> &nbsp; <a class="b" href="${paste}">Paste Quilt Auth</a></p>
<p><small>Tokens expire. Repeat when your local session goes stale.</small></p>
</body></html>`
  fs.writeFileSync(BOOKMARKS_PATH, html)
  console.log(`Wrote ${path.relative(CATALOG_DIR, BOOKMARKS_PATH)}`)
}

function inferDefaultUrl() {
  // Derive the catalog URL from registryUrl in the existing config.js, dropping "-registry".
  //   https://unstable-registry.dev.quilttest.com  ->  https://unstable.dev.quilttest.com
  let text
  try { text = fs.readFileSync(CONFIG_PATH, 'utf8') } catch { return null }
  const m = text.match(/["']registryUrl["']\s*:\s*["'](https?:\/\/[^"']+)["']/)
  return m ? m[1].replace(/-registry\./, '.') : null
}

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: '127.0.0.1' })
    sock.once('connect', () => { sock.destroy(); resolve(true) })
    sock.once('error', () => resolve(false))
  })
}

async function main() {
  let url = process.argv[2]
  if (!url) {
    const dflt = inferDefaultUrl()
    const q = dflt
      ? `Live catalog URL [${dflt}]: `
      : 'Live catalog URL (e.g. https://nightly.quilttest.com): '
    const answer = await prompt(q)
    url = answer || dflt || ''
  }
  url = url.replace(/\/+$/, '')
  if (!/^https?:\/\//.test(url)) throw new Error('URL must start with http(s)://')

  await fetchConfig(url)
  writeBookmarks(url)

  if (await portInUse(PORT)) {
    console.log('\nDev server already running on port 3000.')
    printInstructions(url)
    console.log('Reload http://localhost:3000 to pick up the new config.js.\n')
    return
  }

  console.log(`\nBuilding catalog (this takes ~30s; full log: ${LOG_PATH})...`)
  await startDevServer()
  printInstructions(url)
}

function printInstructions(url) {
  console.log('')
  console.log('Dev server is live at http://localhost:3000')
  console.log('')
  console.log('To log in:')
  console.log(`  1. Open http://localhost:3000/bookmarks.html — drag both bookmarklets to your bookmarks bar`)
  console.log(`  2. Visit ${url}, log in, click "Copy Quilt Auth"`)
  console.log(`  3. Visit http://localhost:3000, click "Paste Quilt Auth"`)
  console.log('')
}

function startDevServer() {
  return new Promise((resolve, reject) => {
    const logStream = fs.createWriteStream(LOG_PATH)
    const env = { ...process.env, PATH: `${NODE20_BIN}:${process.env.PATH}` }
    const child = spawn('npm', ['start'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: CATALOG_DIR, env })

    // Keep child alive after this script exits? No — user will Ctrl-C the npm process.
    // We intentionally do NOT exit on ready; we keep watching so child stays attached.
    process.on('SIGINT', () => child.kill('SIGINT'))

    let ready = false
    const onLine = (line) => {
      logStream.write(line + '\n')
      if (ready) return
      if (/compiled successfully/i.test(line)) {
        ready = true
        resolve()
      }
      if (/EADDRINUSE|compilation failed|Error:/i.test(line) && !ready) {
        reject(new Error(`Dev server failed to start; see ${LOG_PATH}`))
      }
    }

    const splitLines = (stream) => {
      let buf = ''
      stream.on('data', (chunk) => {
        buf += chunk.toString()
        let i
        while ((i = buf.indexOf('\n')) >= 0) {
          onLine(buf.slice(0, i))
          buf = buf.slice(i + 1)
        }
      })
    }
    splitLines(child.stdout)
    splitLines(child.stderr)

    child.on('exit', (code) => {
      logStream.end()
      if (!ready) reject(new Error(`npm start exited with code ${code}; see ${LOG_PATH}`))
    })
  })
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
