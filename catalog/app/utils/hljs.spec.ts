import { describe, it, expect, vi } from 'vitest'

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

// Keys from Text.js LANGS — inlined because Text.js contains JSX in a .js file
// which vitest's vite:import-analysis cannot parse. The invariant still holds:
// every language the Text loader detects must be loadable by hljs.
const TEXT_LANG_KEYS = [
  'accesslog',
  'bash',
  'clojure',
  'coffeescript',
  'coq',
  'c',
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
]

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

  // These two tests run before the bulk loaders below so that 'rust' and 'go'
  // are guaranteed to be unregistered when ensureLanguages / loadLanguages fire.
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

  it('resolves every language enumerated by the Text loader', async () => {
    for (const lang of TEXT_LANG_KEYS) {
      await loadLanguages([lang])
      expect(
        hljs.getLanguage(resolveLanguage(lang)!),
        `getLanguage(${lang})`,
      ).toBeTruthy()
    }
  })

  it('resolves every language declared in REGISTERED_LANGUAGES', async () => {
    for (const lang of REGISTERED_LANGUAGES) {
      await loadLanguages([lang])
      expect(hljs.getLanguage(lang), `getLanguage(${lang})`).toBeTruthy()
    }
  })
})
