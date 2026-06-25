import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

  it('ALIASES tripwire: every alias key resolves to a REGISTERED_LANGUAGES entry', () => {
    // Spot-check a representative cross-section of the ALIASES map.
    // resolveLanguage is the public surface; ALIASES itself is private.
    const aliasChecks: Array<[string, string]> = [
      ['ts', 'typescript'],
      ['tsx', 'typescript'],
      ['cts', 'typescript'],
      ['mts', 'typescript'],
      ['js', 'javascript'],
      ['jsx', 'javascript'],
      ['cjs', 'javascript'],
      ['mjs', 'javascript'],
      ['yml', 'yaml'],
      ['sh', 'bash'],
      ['toml', 'ini'],
      ['py', 'python'],
      ['rb', 'ruby'],
      ['rs', 'rust'],
      ['golang', 'go'],
      ['h', 'c'],
      ['cc', 'cpp'],
      ['c++', 'cpp'],
      ['hh', 'cpp'],
      ['hpp', 'cpp'],
      ['hxx', 'cpp'],
      ['cxx', 'cpp'],
      ['html', 'xml'],
      ['svg', 'xml'],
      ['xhtml', 'xml'],
      ['rss', 'xml'],
      ['atom', 'xml'],
      ['plist', 'xml'],
      ['xsd', 'xml'],
      ['xsl', 'xml'],
      ['xjb', 'xml'],
      ['wsf', 'xml'],
      ['docker', 'dockerfile'],
      ['make', 'makefile'],
      ['mak', 'makefile'],
      ['mk', 'makefile'],
      ['coffee', 'coffeescript'],
      ['cson', 'coffeescript'],
      ['iced', 'coffeescript'],
      ['clj', 'clojure'],
      ['edn', 'clojure'],
      ['erl', 'erlang'],
      ['hs', 'haskell'],
      ['ml', 'ocaml'],
      ['pl', 'perl'],
      ['pm', 'perl'],
      ['scm', 'scheme'],
      ['text', 'plaintext'],
      ['txt', 'plaintext'],
      ['patch', 'diff'],
      ['gemspec', 'ruby'],
      ['irb', 'ruby'],
      ['podspec', 'ruby'],
      ['thor', 'ruby'],
      ['gyp', 'python'],
      ['ipython', 'python'],
      ['jsp', 'java'],
      ['cs', 'csharp'],
      ['c#', 'csharp'],
      ['JSON', 'json'], // case-insensitive
    ]

    for (const [alias, expected] of aliasChecks) {
      const resolved = resolveLanguage(alias)
      expect(resolved, `resolveLanguage('${alias}')`).toBe(expected)
      expect(
        (REGISTERED_LANGUAGES as readonly string[]).includes(resolved!),
        `REGISTERED_LANGUAGES includes target of '${alias}'`,
      ).toBe(true)
    }
  })
})
