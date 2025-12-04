import { describe, it, expect } from 'vitest'

import * as History from './History'
import * as Message from './Message'

describe('utils/AWS/Bedrock/History', () => {
  describe('historyCreate', () => {
    it('Creates new history with system prompt', () => {
      const history = History.historyCreate(Message.createMessage('foo bar'))
      expect(history.messages[0].role).toBe('system')
      expect(history.messages[1].content).toBe('foo bar')
    })
  })

  describe('historyAppend', () => {
    it('Appends messages to history', () => {
      const history = History.historyCreate(Message.createMessage('foo'))
      expect(history.messages.length).toBe(2)
      const newHistory = History.historyAppend(Message.createMessage('bar'), history)
      expect(newHistory.messages.length).toBe(3)
      expect(newHistory.messages[2].content).toBe('bar')
    })
  })

  describe('foldMessages', () => {
    it('Fold same-role messages', () => {
      const userFoo = Message.createMessage('foo')
      const userBar = Message.createMessage('bar')
      const assistantFoo = Message.createMessage('foo', 'assistant')
      const assistantBaz = Message.createMessage('baz', 'assistant')
      const list = History.foldMessages([userFoo, userBar, assistantFoo, assistantBaz])
      expect(list.length).toBe(2)
      expect(list[0].content).toBe('foo\nbar')
      expect(list[1].content).toBe('foo\nbaz')
    })

    it('Fold system and user messages', () => {
      const userFoo = Message.createMessage('foo')
      const userBar = Message.createMessage('bar')
      const systemFoo = Message.createMessage('foo', 'system')
      const systemBaz = Message.createMessage('baz', 'system')
      const list = History.foldMessages([userFoo, userBar, systemFoo, systemBaz])
      expect(list.length).toBe(1)
      expect(list[0].content).toBe('foo\nbar\nfoo\nbaz')
    })
  })
})
