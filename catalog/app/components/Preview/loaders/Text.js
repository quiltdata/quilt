import { basename } from 'path'

import hljs from 'highlight.js'
import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

const MAX_BYTES = 10 * 1024

const LANGS = {
  accesslog: /\.log$/,
  bash: /\.(ba|z)?sh$/,
  clojure: /\.clj$/,
  coffeescript: /\.(coffee|cson|iced)$/,
  coq: /\.v$/,
  'c-like': /\.((c(c|\+\+|pp|xx)?)|(h(\+\+|pp|xx)?))$/,
  csharp: /\.cs$/,
  css: /\.css$/,
  diff: /\.(diff|patch)$/,
  dockerfile: /^dockerfile$/,
  erlang: /\.erl$/,
  go: /\.go$/,
  haskell: /\.hs$/,
  ini: /\.(ini|toml)$/,
  java: /\.(java|jsp)$/,
  javascript: /\.m?jsx?$/,
  json: /\.jsonl?$/,
  lisp: /\.lisp$/,
  makefile: /^(gnu)?makefile$/,
  matlab: /\.m$/,
  ocaml: /\.mli?$/,
  perl: /\.pl$/,
  php: /\.php[3-7]?$/,
  plaintext: /((^license)|(^readme)|(^\.\w*(ignore|rc|config))|(\.txt)|(\.(c|t)sv)|(\.(big)?bed)|(\.cef)|(\.fa)|(\.fsa)|(\.fasta)|(\.(san)?fastq)|(\.fq)|(\.sam)|(\.gff(2|3)?)|(\.gtf)|(\.index)|(\.readme)|(changelog))$/,
  python: /\.(py|gyp)$/,
  r: /\.r$/,
  ruby: /\.rb$/,
  rust: /\.rs$/,
  scala: /\.scala$/,
  scheme: /\.s(s|ls|cm)$/,
  sql: /\.sql$/,
  typescript: /\.tsx?$/,
  xml: /\.(xml|x?html|rss|atom|xjb|xsd|xsl|plist)$/,
  yaml: /\.ya?ml$/,
}

const langPairs = Object.entries(LANGS)

const findLang = R.pipe(basename, R.toLower, utils.stripCompression, (name) =>
  langPairs.find(([, re]) => re.test(name)),
)

export const detect = R.pipe(findLang, Boolean)

const getLang = R.pipe(findLang, ([lang] = []) => lang)

const hl = (lang) => (contents) => hljs.highlight(lang, contents).value

const fetcher = utils.previewFetcher(
  'txt',
  ({ info: { data, note, warnings } }, { handle, forceLang }) => {
    const head = data.head.join('\n')
    const tail = data.tail.join('\n')
    const lang = forceLang || getLang(handle.key)
    const highlighted = R.map(hl(lang), { head, tail })
    return AsyncResult.Ok(
      PreviewData.Text({ head, tail, lang, highlighted, note, warnings }),
    )
  },
)

export const load = (handle, callback, extra) =>
  fetcher(handle, callback, { query: { max_bytes: MAX_BYTES }, ...extra })
