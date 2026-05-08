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

export default hljs
