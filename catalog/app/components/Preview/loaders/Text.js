import { basename } from 'path'

import hljs from 'highlight.js'
import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

const LANGS = {
  accesslog: /\.log$/,
  bash: /\.(ba|z)?sh$/,
  clojure: /\.clj$/,
  coffeescript: /\.(coffee|cson|iced)$/,
  coq: /\.v$/,
  cpp: /\.((c(c|\+\+|pp|xx)?)|(h(\+\+|pp|xx)?))$/,
  cs: /\.cs$/,
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
  plaintext: /((^license)|(^readme)|(^\.\w*(ignore|rc|config))|(\.txt)|(\.(c|t)sv))$/,
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

const findLang = R.pipe(
  basename,
  R.toLower,
  utils.stripCompression,
  (name) => langPairs.find(([, re]) => re.test(name)),
)

export const detect = R.pipe(
  findLang,
  Boolean,
)

const getLang = R.pipe(
  findLang,
  ([lang] = []) => lang,
)

const hl = (lang) => (contents) => hljs.highlight(lang, contents).value

export const load = utils.previewFetcher(
  'txt',
  ({ info: { data } }, { handle, forceLang }) => {
    const head = data.head.join('\n')
    const tail = data.tail.join('\n')
    const lang = forceLang || getLang(handle.key)
    const highlighted = R.map(hl(lang), { head, tail })
    return AsyncResult.Ok(PreviewData.Text({ head, tail, lang, highlighted }))
  },
)
