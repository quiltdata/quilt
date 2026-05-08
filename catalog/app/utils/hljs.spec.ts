import { describe, it, expect, vi } from 'vitest'

import { LANGS } from 'components/Preview/loaders/Text'

import hljs, { REGISTERED_LANGUAGES } from './hljs'

vi.mock('constants/config', () => ({
  default: {
    apiGatewayEndpoint: '',
  },
}))

describe('utils/hljs', () => {
  it('registers exactly the expected language set', () => {
    expect([...REGISTERED_LANGUAGES]).toEqual([
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
    ])
  })

  it('resolves every language enumerated by the Text loader', () => {
    for (const lang of Object.keys(LANGS)) {
      expect(hljs.getLanguage(lang), `getLanguage(${lang})`).toBeTruthy()
    }
  })

  it('resolves every language declared in REGISTERED_LANGUAGES', () => {
    for (const lang of REGISTERED_LANGUAGES) {
      expect(hljs.getLanguage(lang), `getLanguage(${lang})`).toBeTruthy()
    }
  })
})
