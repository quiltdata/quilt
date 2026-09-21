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
 * Render the hook and hand the latest value back through a ref-like box, so
 * tests can call the setters inside `act` and assert on the re-rendered
 * state (RTL v12 has no `renderHook`).
 */
function setupHook() {
  const box: { current: UserInstructions.UserInstructions | null } = { current: null }
  function Harness() {
    box.current = UserInstructions.useUserInstructions()
    return null
  }
  render(<Harness />)
  const current = () => {
    if (!box.current) throw new Error('hook not rendered')
    return box.current
  }
  return current
}

describe('components/Assistant/Model/UserInstructions', () => {
  beforeEach(() => {
    settings = null
    isAdmin = false
    writeSettings.mockReset()
    writeSettings.mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  describe('persistence (stack settings)', () => {
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

  describe('admin gate', () => {
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

    it('admins can edit', () => {
      isAdmin = true
      expect(setupHook()().canEdit).toBe(true)
    })
  })

  describe('toPromptBlock', () => {
    it('wraps the text in a user-instructions tag', () => {
      const block = UserInstructions.toPromptBlock('Answer in French')
      expect(block).toContain('<user-instructions>')
      expect(block).toContain('Answer in French')
      expect(block).toContain('</user-instructions>')
    })
  })

  describe('prompt injection', () => {
    it('lands in the prompt context as a visible <user-instructions> block, not in the system prompt', async () => {
      const ctx = Context.merge({
        messages: [UserInstructions.toPromptBlock('Answer in French')],
        markers: { userInstructions: true },
      })
      const prompt = await Eff.Effect.runPromise(Conversation.constructPrompt([], ctx))

      // the preamble (first user message) carries the block inside <context>
      const first = prompt.messages[0]
      expect(first.role).toBe('user')
      expect(first.content._tag).toBe('Text')
      if (first.content._tag !== 'Text') return
      const { text } = first.content
      expect(text).toContain('<user-instructions>')
      expect(text).toContain('Answer in French')
      expect(text.indexOf('<context>')).toBeLessThan(text.indexOf('<user-instructions>'))

      // visible context contribution, not a silent system string
      expect(prompt.system).not.toContain('Answer in French')
    })

    it('does not mention user-instructions when none are provided', async () => {
      const prompt = await Eff.Effect.runPromise(
        Conversation.constructPrompt([], Context.merge({})),
      )
      const first = prompt.messages[0]
      if (first.content._tag !== 'Text') throw new Error('expected text block')
      expect(first.content.text).not.toContain('<user-instructions>')
    })
  })
})
