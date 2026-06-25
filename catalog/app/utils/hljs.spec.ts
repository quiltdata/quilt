import { describe, it, expect, vi } from 'vitest'

import { LANGS } from 'components/Preview/loaders/Text'

import hljs, {
  REGISTERED_LANGUAGES,
  resolveLanguage,
  ensureLanguages,
  loadLanguages,
  LANG_LOADERS,
} from './hljs'

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

  it('LANG_LOADERS keys equal REGISTERED_LANGUAGES', () => {
    expect(Object.keys(LANG_LOADERS).sort()).toEqual([...REGISTERED_LANGUAGES].sort())
  })

  it('every ALIASES target is a registered language', () => {
    // resolveLanguage maps known aliases to canonical names
    expect(resolveLanguage('ts')).toBe('typescript')
    expect(resolveLanguage('yml')).toBe('yaml')
    expect(resolveLanguage('sh')).toBe('bash')
    expect(resolveLanguage('toml')).toBe('ini')
    expect(resolveLanguage('JSON')).toBe('json') // case-insensitive
    expect(resolveLanguage('kotlin')).toBeNull() // unsupported
  })

  it('ensureLanguages throws a promise for an unloaded language, then resolves', async () => {
    let thrown: unknown
    try {
      ensureLanguages(['rust'])
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Promise)
    await thrown
    expect(() => ensureLanguages(['rust'])).not.toThrow()
  })

  it('loadLanguages awaits registration without throwing', async () => {
    await loadLanguages(['go', 'unknown-lang'])
    expect(() => ensureLanguages(['go'])).not.toThrow()
  })
})
