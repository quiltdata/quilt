import { basename } from 'path'

import hljs from 'highlight.js'
import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

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
  plaintext:
    /((^license)|(^readme)|(^\.\w*(ignore|rc|config))|(\.txt)|(\.(c|t)sv)|(\.(big)?bed)|(\.cef)|(\.fa)|(\.fsa)|(\.fasta)|(\.(san)?fastq)|(\.fq)|(\.sam)|(\.gff(2|3)?)|(\.gtf)|(\.index)|(\.readme)|(changelog)|(.*notes)|(\.pdbqt)|(\.results)(\.(inn|out)ie))$/,
  python: /\.(py|gyp)$/,
  r: /\.r$/,
  ruby: /\.rb$/,
  rust: /\.rs$/,
  scala: /\.scala$/,
  scheme: /\.s(s|ls|cm)$/,
  sql: /\.sql$/,
  typescript: /\.tsx?$/,
  xml: /\.(xml|x?html|rss|atom|xjb|xsd|xsl|plist)$/,
  yaml: /((\.ya?ml$)|(^snakefile))/,
}

const langPairs = Object.entries(LANGS)

const findLang = R.pipe(R.unary(basename), R.toLower, utils.stripCompression, (name) =>
  langPairs.find(([, re]) => re.test(name)),
)

export const detect = R.pipe(findLang, Boolean)

const getLang = R.pipe(findLang, ([lang] = []) => lang)

const hl = (language) => (contents) => hljs.highlight(contents, { language }).value

export const Loader = function TextLoader({ handle, forceLang, children }) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      const lang = forceLang || getLang(handle.logicalKey || handle.key)
      const highlighted = R.map(hl(lang), { head, tail })
      return PreviewData.Text({ head, tail, lang, highlighted, note, warnings })
    },
    [forceLang, handle.logicalKey, handle.key],
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
