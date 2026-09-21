import * as Eff from 'effect'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import * as Context from './Context'
import * as Conversation from './Conversation'
import * as UserInstructions from './UserInstructions'

const KEY = UserInstructions.STORAGE_KEY
const ENABLED_KEY = UserInstructions.ENABLED_STORAGE_KEY

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
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  describe('persistence', () => {
    it('defaults to empty text, enabled, inactive', () => {
      const current = setupHook()
      expect(current().text).toBe('')
      expect(current().enabled).toBe(true)
      expect(current().active).toBe(false)
    })

    it('persists text to localStorage under the qurator.userInstructions key', () => {
      const current = setupHook()
      act(() => current().setText('Answer in French'))
      expect(window.localStorage.getItem(KEY)).toBe('Answer in French')
      expect(current().text).toBe('Answer in French')
      expect(current().active).toBe(true)
    })

    it('rehydrates persisted text and enabled flag on mount', () => {
      window.localStorage.setItem(KEY, 'Be terse')
      window.localStorage.setItem(ENABLED_KEY, '0')
      const current = setupHook()
      expect(current().text).toBe('Be terse')
      expect(current().enabled).toBe(false)
      expect(current().active).toBe(false)
    })

    it('clear removes the stored value and deactivates', () => {
      window.localStorage.setItem(KEY, 'Be terse')
      const current = setupHook()
      expect(current().active).toBe(true)
      act(() => current().clear())
      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect(current().text).toBe('')
      expect(current().active).toBe(false)
    })

    it('disabling keeps the text but deactivates; re-enabling restores', () => {
      const current = setupHook()
      act(() => current().setText('Cite revisions'))
      act(() => current().setEnabled(false))
      expect(window.localStorage.getItem(KEY)).toBe('Cite revisions')
      expect(window.localStorage.getItem(ENABLED_KEY)).toBe('0')
      expect(current().active).toBe(false)
      act(() => current().setEnabled(true))
      expect(window.localStorage.getItem(ENABLED_KEY)).toBeNull()
      expect(current().active).toBe(true)
    })

    it('whitespace-only text does not count as active', () => {
      const current = setupHook()
      act(() => current().setText('   \n  '))
      expect(current().active).toBe(false)
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
