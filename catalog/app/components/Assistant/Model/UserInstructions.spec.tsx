import * as Eff from 'effect'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogSettings } from 'utils/CatalogSettings'

vi.mock('constants/config', () => ({ default: {} }))

let settings: CatalogSettings | null = null
const writeSettings = vi.fn<
  (s: CatalogSettings, expected?: CatalogSettings | null) => Promise<void>
>(async () => {})

vi.mock('utils/CatalogSettings', () => ({
  use: () => settings,
  useWriteSettings: () => writeSettings,
  SettingsConflictError: class extends Error {},
}))

let isAdmin = false
vi.mock('react-redux', () => ({ useSelector: () => isAdmin }))

import * as Context from './Context'
import * as Conversation from './Conversation'
import * as UserInstructions from './UserInstructions'

/**
 * Render a hook and hand the latest value back through a ref-like box, so
 * tests can call the setters inside `act` and assert on the re-rendered
 * state (RTL v12 has no `renderHook`).
 */
function setupHook(
  useHook: () => UserInstructions.Instructions = UserInstructions.useGlobalInstructions,
) {
  const box: { current: UserInstructions.Instructions | null } = { current: null }
  function Harness() {
    box.current = useHook()
    return null
  }
  render(<Harness />)
  const current = () => {
    if (!box.current) throw new Error('hook not rendered')
    return box.current
  }
  return current
}

/** Both layers at once, as `Assistant.tsx` mounts them. */
function setupBoth() {
  const box: { current: UserInstructions.DualInstructions | null } = { current: null }
  function Harness() {
    box.current = {
      global: UserInstructions.useGlobalInstructions(),
      personal: UserInstructions.usePersonalInstructions(),
    }
    return null
  }
  render(<Harness />)
  return () => {
    if (!box.current) throw new Error('hook not rendered')
    return box.current
  }
}

describe('components/Assistant/Model/UserInstructions', () => {
  beforeEach(() => {
    settings = null
    isAdmin = false
    writeSettings.mockReset()
    writeSettings.mockResolvedValue(undefined)
    window.localStorage.clear()
  })
  afterEach(cleanup)

  describe('global layer: persistence (stack settings)', () => {
    it('defaults to empty text, enabled, inactive when the stack has no settings', () => {
      const current = setupHook()
      expect(current().text).toBe('')
      expect(current().enabled).toBe(true)
      expect(current().active).toBe(false)
    })

    it('reads text and enabled flag from settings.qurator', () => {
      settings = { qurator: { instructions: 'Be terse', instructionsEnabled: false } }
      const current = setupHook()
      expect(current().text).toBe('Be terse')
      expect(current().enabled).toBe(false)
      expect(current().active).toBe(false)
    })

    it('is active when text is set and the flag is absent (enabled by default)', () => {
      settings = { qurator: { instructions: 'Be terse' } }
      expect(setupHook()().active).toBe(true)
    })

    it('whitespace-only text does not count as active', () => {
      settings = { qurator: { instructions: '   \n  ' } }
      expect(setupHook()().active).toBe(false)
    })

    it('setText writes the whole document with the snapshot as expected prior state', async () => {
      isAdmin = true
      settings = { beta: true, qurator: { instructionsEnabled: false } }
      const current = setupHook()
      await act(() => current().setText('Answer in French'))
      // Other keys and the sibling qurator flag survive; the second argument is
      // what makes the write refuse rather than revert a concurrent change.
      expect(writeSettings).toHaveBeenCalledWith(
        {
          beta: true,
          qurator: { instructionsEnabled: false, instructions: 'Answer in French' },
        },
        settings,
      )
    })

    it('setEnabled keeps the text and only flips the flag', async () => {
      isAdmin = true
      settings = { qurator: { instructions: 'Cite revisions' } }
      const current = setupHook()
      await act(() => current().setEnabled(false))
      expect(writeSettings).toHaveBeenCalledWith(
        { qurator: { instructions: 'Cite revisions', instructionsEnabled: false } },
        settings,
      )
    })

    it('clear writes empty text', async () => {
      isAdmin = true
      settings = { qurator: { instructions: 'Be terse' } }
      const current = setupHook()
      await act(() => current().clear())
      expect(writeSettings).toHaveBeenCalledWith(
        { qurator: { instructions: '' } },
        settings,
      )
    })

    it('never touches localStorage', async () => {
      isAdmin = true
      settings = { qurator: { instructions: 'Be terse' } }
      const spy = vi.spyOn(Storage.prototype, 'setItem')
      const current = setupHook()
      await act(() => current().setText('Answer in French'))
      expect(spy).not.toHaveBeenCalled()
      expect(window.localStorage.length).toBe(0)
      spy.mockRestore()
    })
  })

  describe('global layer: admin gate', () => {
    it('non-admins cannot edit but still receive the instructions', () => {
      settings = { qurator: { instructions: 'Be terse' } }
      const current = setupHook()
      expect(current().canEdit).toBe(false)
      expect(current().active).toBe(true)
    })

    it('non-admin writes are rejected before reaching the stack', async () => {
      settings = { qurator: { instructions: 'Be terse' } }
      const current = setupHook()
      await expect(current().setText('x')).rejects.toThrow(/admins/)
      expect(writeSettings).not.toHaveBeenCalled()
    })

    it('non-admin mute and clear are rejected too', async () => {
      settings = { qurator: { instructions: 'Be terse' } }
      const current = setupHook()
      await expect(current().setEnabled(false)).rejects.toThrow(/admins/)
      await expect(current().clear()).rejects.toThrow(/admins/)
      expect(writeSettings).not.toHaveBeenCalled()
    })

    it('admins can edit', () => {
      isAdmin = true
      expect(setupHook()().canEdit).toBe(true)
    })
  })

  describe('personal layer: persistence (localStorage)', () => {
    const personal = () => setupHook(UserInstructions.usePersonalInstructions)

    it('defaults to empty text, enabled, inactive', () => {
      const current = personal()
      expect(current().text).toBe('')
      expect(current().enabled).toBe(true)
      expect(current().active).toBe(false)
    })

    it('reads notes written before this session, under #5310 keys', () => {
      window.localStorage.setItem(
        UserInstructions.PERSONAL_STORAGE_KEY,
        'I work on RNA-seq',
      )
      const current = personal()
      expect(current().text).toBe('I work on RNA-seq')
      expect(current().active).toBe(true)
    })

    it('setText persists and survives a remount', async () => {
      const current = personal()
      await act(() => current().setText('Prefer Parquet'))
      expect(current().text).toBe('Prefer Parquet')
      expect(window.localStorage.getItem(UserInstructions.PERSONAL_STORAGE_KEY)).toBe(
        'Prefer Parquet',
      )

      cleanup()
      expect(personal()().text).toBe('Prefer Parquet')
    })

    it('muting keeps the text under its own key', async () => {
      const current = personal()
      await act(() => current().setText('Prefer Parquet'))
      await act(() => current().setEnabled(false))
      expect(current().text).toBe('Prefer Parquet')
      expect(current().enabled).toBe(false)
      expect(current().active).toBe(false)
      expect(window.localStorage.getItem(UserInstructions.PERSONAL_STORAGE_KEY)).toBe(
        'Prefer Parquet',
      )
    })

    it('whitespace-only notes do not count as active', async () => {
      const current = personal()
      await act(() => current().setText('  \n '))
      expect(current().active).toBe(false)
    })

    it('clear removes the stored note', async () => {
      const current = personal()
      await act(() => current().setText('Prefer Parquet'))
      await act(() => current().clear())
      expect(current().text).toBe('')
      expect(
        window.localStorage.getItem(UserInstructions.PERSONAL_STORAGE_KEY),
      ).toBeNull()
    })

    it('is always editable, admin or not', () => {
      expect(personal()().canEdit).toBe(true)
      cleanup()
      isAdmin = true
      expect(personal()().canEdit).toBe(true)
    })

    it('never writes to the stack settings', async () => {
      const current = personal()
      await act(() => current().setText('Prefer Parquet'))
      expect(writeSettings).not.toHaveBeenCalled()
    })
  })

  describe('layer independence', () => {
    it('a non-admin sets personal notes while global stays admin-only', async () => {
      settings = { qurator: { instructions: 'Be terse' } }
      const both = setupBoth()
      await act(() => both().personal.setText('Prefer Parquet'))
      expect(both().personal.active).toBe(true)
      expect(both().global.text).toBe('Be terse')
      expect(both().global.canEdit).toBe(false)
      expect(writeSettings).not.toHaveBeenCalled()
    })

    it('clearing personal leaves global intact', async () => {
      settings = { qurator: { instructions: 'Be terse' } }
      const both = setupBoth()
      await act(() => both().personal.setText('Prefer Parquet'))
      await act(() => both().personal.clear())
      expect(both().personal.text).toBe('')
      expect(both().global.text).toBe('Be terse')
      expect(both().global.active).toBe(true)
    })

    it('clearing global leaves personal notes intact', async () => {
      isAdmin = true
      settings = { qurator: { instructions: 'Be terse' } }
      const both = setupBoth()
      await act(() => both().personal.setText('Prefer Parquet'))
      await act(() => both().global.clear())
      expect(writeSettings).toHaveBeenCalledWith(
        { qurator: { instructions: '' } },
        settings,
      )
      expect(both().personal.text).toBe('Prefer Parquet')
      expect(window.localStorage.getItem(UserInstructions.PERSONAL_STORAGE_KEY)).toBe(
        'Prefer Parquet',
      )
    })

    it('muting one layer leaves the other injecting', async () => {
      settings = { qurator: { instructions: 'Be terse' } }
      const both = setupBoth()
      await act(() => both().personal.setText('Prefer Parquet'))
      await act(() => both().personal.setEnabled(false))
      expect(both().personal.active).toBe(false)
      expect(both().global.active).toBe(true)
    })
  })

  describe('prompt blocks', () => {
    it('wraps global text in a user-instructions tag', () => {
      const block = UserInstructions.toPromptBlock('Answer in French')
      expect(block).toContain('<user-instructions>')
      expect(block).toContain('Answer in French')
      expect(block).toContain('</user-instructions>')
    })

    it('wraps personal text in a distinct personal-instructions tag', () => {
      const block = UserInstructions.toPersonalPromptBlock('Prefer Parquet')
      expect(block).toContain('<personal-instructions>')
      expect(block).toContain('Prefer Parquet')
      expect(block).toContain('</personal-instructions>')
      expect(block).not.toContain('<user-instructions>')
    })
  })

  describe('prompt injection', () => {
    const promptText = async (ctx: Partial<Context.ContextShape>) => {
      const prompt = await Eff.Effect.runPromise(
        Conversation.constructPrompt([], Context.merge(ctx)),
      )
      const first = prompt.messages[0]
      expect(first.role).toBe('user')
      if (first.content._tag !== 'Text') throw new Error('expected text block')
      return { text: first.content.text, system: prompt.system }
    }

    it('lands in the prompt context as a visible <user-instructions> block, not in the system prompt', async () => {
      const { text, system } = await promptText({
        messages: [UserInstructions.toPromptBlock('Answer in French')],
        markers: { userInstructions: true },
      })
      // the preamble (first user message) carries the block inside <context>
      expect(text).toContain('<user-instructions>')
      expect(text).toContain('Answer in French')
      expect(text.indexOf('<context>')).toBeLessThan(text.indexOf('<user-instructions>'))
      // visible context contribution, not a silent system string
      expect(system).not.toContain('Answer in French')
    })

    it('injects both layers as separate blocks, global first', async () => {
      const { text, system } = await promptText({
        messages: [
          UserInstructions.toPromptBlock('Answer in French'),
          UserInstructions.toPersonalPromptBlock('Prefer Parquet'),
        ],
        markers: { userInstructions: true, personalInstructions: true },
      })
      expect(text).toContain('Answer in French')
      expect(text).toContain('Prefer Parquet')
      expect(text.indexOf('<user-instructions>')).toBeLessThan(
        text.indexOf('<personal-instructions>'),
      )
      expect(system).not.toContain('Prefer Parquet')
    })

    it('injects personal alone when no global instructions are set', async () => {
      const { text } = await promptText({
        messages: [UserInstructions.toPersonalPromptBlock('Prefer Parquet')],
        markers: { personalInstructions: true },
      })
      expect(text).toContain('<personal-instructions>')
      expect(text).not.toContain('<user-instructions>')
    })

    it('mentions neither tag when no layer is active', async () => {
      const { text } = await promptText({})
      expect(text).not.toContain('<user-instructions>')
      expect(text).not.toContain('<personal-instructions>')
    })
  })
})
