// Grammars load lazily on demand via ensureLanguages (Suspense throw, used by
// Markdown/Text/Json/Manifest/Code through HljsBoundary) and loadLanguages
// (async, used by ECharts/Igv). The `registered` Set below tracks what has
// been registered so each grammar chunk is fetched at most once.
import hljs from 'highlight.js/lib/core'

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
        /* v8 ignore next */
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
