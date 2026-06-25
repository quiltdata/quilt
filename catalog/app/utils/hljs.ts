// TODO: load grammars on demand. All 35 are imported statically below, so they
// ship in one chunk (~250 KB) that loads as soon as any consumer of this
// module is reached. Switching to `() => import('highlight.js/lib/languages/X')`
// per language would split each grammar into its own chunk, fetched on first
// use. Blocker: Remarkable's `highlight` callback in Markdown.tsx is sync, so
// the caller would have to pre-register a fence's language before render (or
// render plain first, then re-render after registration). Same constraint for
// Text.js / Json.tsx / Manifest.tsx / Igv.ts / ECharts.jsx / Code.tsx — all
// call `hljs.highlight(...)` synchronously.
import hljs from 'highlight.js/lib/core'
import accesslog from 'highlight.js/lib/languages/accesslog'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import clojure from 'highlight.js/lib/languages/clojure'
import coffeescript from 'highlight.js/lib/languages/coffeescript'
import coq from 'highlight.js/lib/languages/coq'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import erlang from 'highlight.js/lib/languages/erlang'
import go from 'highlight.js/lib/languages/go'
import haskell from 'highlight.js/lib/languages/haskell'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import lisp from 'highlight.js/lib/languages/lisp'
import makefile from 'highlight.js/lib/languages/makefile'
import matlab from 'highlight.js/lib/languages/matlab'
import ocaml from 'highlight.js/lib/languages/ocaml'
import perl from 'highlight.js/lib/languages/perl'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import r from 'highlight.js/lib/languages/r'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scala from 'highlight.js/lib/languages/scala'
import scheme from 'highlight.js/lib/languages/scheme'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

export const REGISTERED_LANGUAGES = [
  'accesslog',
  'bash',
  'c',
  'clojure',
  'coffeescript',
  'coq',
  'cpp',
  'csharp',
  'css',
  'diff',
  'dockerfile',
  'erlang',
  'go',
  'haskell',
  'ini',
  'java',
  'javascript',
  'json',
  'lisp',
  'makefile',
  'matlab',
  'ocaml',
  'perl',
  'php',
  'plaintext',
  'python',
  'r',
  'ruby',
  'rust',
  'scala',
  'scheme',
  'sql',
  'typescript',
  'xml',
  'yaml',
] as const

export type RegisteredLanguage = (typeof REGISTERED_LANGUAGES)[number]

hljs.registerLanguage('accesslog', accesslog)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('c', c)
hljs.registerLanguage('clojure', clojure)
hljs.registerLanguage('coffeescript', coffeescript)
hljs.registerLanguage('coq', coq)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('css', css)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('erlang', erlang)
hljs.registerLanguage('go', go)
hljs.registerLanguage('haskell', haskell)
hljs.registerLanguage('ini', ini)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('lisp', lisp)
hljs.registerLanguage('makefile', makefile)
hljs.registerLanguage('matlab', matlab)
hljs.registerLanguage('ocaml', ocaml)
hljs.registerLanguage('perl', perl)
hljs.registerLanguage('php', php)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('python', python)
hljs.registerLanguage('r', r)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('scala', scala)
hljs.registerLanguage('scheme', scheme)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)

// One dynamic import per language. Keys are kept equal to REGISTERED_LANGUAGES by
// the spec tripwire in hljs.spec.ts.
export const LANG_LOADERS: Record<
  RegisteredLanguage,
  () => Promise<{ default: unknown }>
> = {
  accesslog: () => import('highlight.js/lib/languages/accesslog'),
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  clojure: () => import('highlight.js/lib/languages/clojure'),
  coffeescript: () => import('highlight.js/lib/languages/coffeescript'),
  coq: () => import('highlight.js/lib/languages/coq'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  erlang: () => import('highlight.js/lib/languages/erlang'),
  go: () => import('highlight.js/lib/languages/go'),
  haskell: () => import('highlight.js/lib/languages/haskell'),
  ini: () => import('highlight.js/lib/languages/ini'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  lisp: () => import('highlight.js/lib/languages/lisp'),
  makefile: () => import('highlight.js/lib/languages/makefile'),
  matlab: () => import('highlight.js/lib/languages/matlab'),
  ocaml: () => import('highlight.js/lib/languages/ocaml'),
  perl: () => import('highlight.js/lib/languages/perl'),
  php: () => import('highlight.js/lib/languages/php'),
  plaintext: () => import('highlight.js/lib/languages/plaintext'),
  python: () => import('highlight.js/lib/languages/python'),
  r: () => import('highlight.js/lib/languages/r'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  scala: () => import('highlight.js/lib/languages/scala'),
  scheme: () => import('highlight.js/lib/languages/scheme'),
  sql: () => import('highlight.js/lib/languages/sql'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
}

// Fence label / Text.js key -> canonical name. Derived from each grammar's
// declared `.aliases`; only aliases whose target is in REGISTERED_LANGUAGES.
const ALIASES: Record<string, RegisteredLanguage> = {
  atom: 'xml',
  cc: 'cpp',
  'c++': 'cpp',
  'c#': 'csharp',
  cjs: 'javascript',
  clj: 'clojure',
  coffee: 'coffeescript',
  cs: 'csharp',
  cson: 'coffeescript',
  cts: 'typescript',
  cxx: 'cpp',
  docker: 'dockerfile',
  edn: 'clojure',
  erl: 'erlang',
  gemspec: 'ruby',
  golang: 'go',
  gyp: 'python',
  h: 'c',
  'h++': 'cpp',
  hh: 'cpp',
  hpp: 'cpp',
  hs: 'haskell',
  html: 'xml',
  hxx: 'cpp',
  iced: 'coffeescript',
  ipython: 'python',
  irb: 'ruby',
  js: 'javascript',
  jsp: 'java',
  jsx: 'javascript',
  make: 'makefile',
  mak: 'makefile',
  mjs: 'javascript',
  mk: 'makefile',
  ml: 'ocaml',
  mts: 'typescript',
  patch: 'diff',
  plist: 'xml',
  pl: 'perl',
  pm: 'perl',
  podspec: 'ruby',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  rss: 'xml',
  scm: 'scheme',
  sh: 'bash',
  svg: 'xml',
  text: 'plaintext',
  thor: 'ruby',
  toml: 'ini',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'plaintext',
  wsf: 'xml',
  xhtml: 'xml',
  xjb: 'xml',
  xsd: 'xml',
  xsl: 'xml',
  yml: 'yaml',
}

const registered = new Set<RegisteredLanguage>()
const inflight = new Map<RegisteredLanguage, Promise<void>>()

export function resolveLanguage(label: string): RegisteredLanguage | null {
  const lc = label.toLowerCase()
  if ((REGISTERED_LANGUAGES as readonly string[]).includes(lc))
    return lc as RegisteredLanguage
  return ALIASES[lc] ?? null
}

function loadLanguage(name: RegisteredLanguage): Promise<void> {
  if (registered.has(name)) return Promise.resolve()
  if (!inflight.has(name)) {
    inflight.set(
      name,
      LANG_LOADERS[name]().then((m) => {
        // istanbul ignore else
        if (!hljs.getLanguage(name)) hljs.registerLanguage(name, m.default as $TSFixMe)
        registered.add(name)
      }),
    )
  }
  return inflight.get(name) as Promise<void>
}

function missing(labels: string[]): RegisteredLanguage[] {
  const canonical = labels
    .map(resolveLanguage)
    .filter((x): x is RegisteredLanguage => x != null)
  return [...new Set(canonical)].filter((n) => !registered.has(n))
}

export function ensureLanguages(labels: string[]): void {
  const todo = missing(labels)
  if (todo.length) throw Promise.all(todo.map(loadLanguage))
}

export async function loadLanguages(labels: string[]): Promise<void> {
  await Promise.all(missing(labels).map(loadLanguage))
}

export default hljs
