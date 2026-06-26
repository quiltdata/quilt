import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { LANGS } from 'components/Preview/loaders/Text'

import hljs, {
  REGISTERED_LANGUAGES,
  resolveLanguage,
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

  // The lazy gate (suspend / async-load) must start from an empty registration
  // cache. These import a fresh module per test so they don't depend on whether
  // the bulk-load tests below have already registered 'rust' / 'go'.
  describe('lazy registration gate (isolated module)', () => {
    afterEach(() => {
      vi.resetModules()
    })

    async function freshHljs() {
      vi.resetModules()
      vi.doMock('constants/config', () => ({ default: { apiGatewayEndpoint: '' } }))
      return import('./hljs')
    }

    it('ensureLanguages throws a promise for an unloaded language, then resolves', async () => {
      const mod = await freshHljs()
      let thrown: unknown
      try {
        mod.ensureLanguages(['rust'])
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(Promise)
      await thrown
      expect(() => mod.ensureLanguages(['rust'])).not.toThrow()
    })

    it('loadLanguages awaits registration without throwing', async () => {
      const mod = await freshHljs()
      await mod.loadLanguages(['go', 'unknown-lang'])
      expect(() => mod.ensureLanguages(['go'])).not.toThrow()
    })
  })

  it('resolves every language enumerated by the Text loader', async () => {
    for (const lang of Object.keys(LANGS)) {
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

  // Uses a fresh module import per test to avoid shared `registered`/`failed` Set
  // pollution from the bulk loaders above. vi.doMock is used (not vi.mock) so the
  // constants/config stub is scoped to this dynamic import, not hoisted globally.
  describe('degrade-to-plain on load failure', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
      vi.resetModules()
    })

    it('degrades to plain (never rejects/throws) when a grammar chunk fails to load', async () => {
      vi.resetModules()
      vi.doMock('constants/config', () => ({ default: { apiGatewayEndpoint: '' } }))

      const mod = await import('./hljs')

      // Intercept registerLanguage to verify the failed load does NOT register.
      // We use a fresh module but the hljs singleton is shared, so we spy here.
      const registerSpy = vi.spyOn(mod.default, 'registerLanguage')
      mod.LANG_LOADERS.scala = () => Promise.reject(new Error('chunk load failed'))

      // loadLanguages resolves (does not reject) even when the import fails
      await expect(mod.loadLanguages(['scala'])).resolves.toBeUndefined()

      // ensureLanguages no longer throws for the failed language (settled/give up)
      expect(() => mod.ensureLanguages(['scala'])).not.toThrow()

      // The failed load must NOT have called registerLanguage for 'scala'
      expect(
        registerSpy.mock.calls.some((args) => args[0] === 'scala'),
        'registerLanguage("scala") must not be called on a failed load',
      ).toBe(false)

      // failure was logged once
      expect(consoleSpy).toHaveBeenCalledOnce()
      expect(consoleSpy).toHaveBeenCalledWith(
        '[hljs] failed to load grammar "scala":',
        expect.any(Error),
      )

      registerSpy.mockRestore()
    })
  })
})
