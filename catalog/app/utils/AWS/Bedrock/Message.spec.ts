import * as Message from './Message'

describe('utils/AWS/Bedrock/Message', () => {
  describe('createMessage', () => {
    it('Creates user role message', () => {
      expect(Message.createMessage('foo')).toMatchObject({
        role: 'user',
        content: 'foo',
      })
    })

    it('Creates any role message', () => {
      expect(Message.createMessage('foo', 'system')).toMatchObject({
        role: 'system',
        content: 'foo',
      })
    })
  })

  describe('bedrockBodyToMessage', () => {
    it('Support application/json only', async () => {
      await expect(Message.bedrockBodyToMessage('foo', 'text/html')).rejects.toThrow(
        'Unsupported content type',
      )
    })

    it('Throws on invalid formats', async () => {
      await expect(
        Message.bedrockBodyToMessage('foo', 'application/json'),
      ).rejects.toThrow('is not valid JSON')

      await expect(
        Message.bedrockBodyToMessage('{"foo": "bar"}', 'application/json'),
      ).rejects.toThrow('`content` is empty')

      await expect(
        Message.bedrockBodyToMessage('{"content": {"foo": "bar"}}', 'application/json'),
      ).rejects.toThrow('Unsupported `content` type')

      await expect(
        Message.bedrockBodyToMessage('{"content": []}', 'application/json'),
      ).rejects.toThrow('`content` list is empty')

      await expect(
        Message.bedrockBodyToMessage(
          '{"content": [{"type": "foo"}]}',
          'application/json',
        ),
      ).rejects.toThrow('`content` list is empty')
    })

    it('Accept `content` string', async () => {
      const message = await Message.bedrockBodyToMessage(
        '{"content": "foo"}',
        'application/json',
      )
      expect(message.content).toBe('foo')
    })

    it('Accept `content` item as string', async () => {
      const message = await Message.bedrockBodyToMessage(
        '{"content": ["foo bar"]}',
        'application/json',
      )
      expect(message.content).toBe('foo bar')
    })

    it('Accept regular `content` object', async () => {
      const message = await Message.bedrockBodyToMessage(
        '{"content": [{"type": "text", "text": "foo bar"}]}',
        'application/json',
      )
      expect(message.content).toBe('foo bar')
    })

    it('Accept blobs', async () => {
      const json = '{ "content": [{ "type": "text", "text": "foo bar" }] }'
      const blob = new Blob([json], { type: 'text/plain' })
      const message = await Message.bedrockBodyToMessage(blob, 'application/json')
      expect(message.content).toBe('foo bar')
    })

    it('Accept ArrayBuffers', async () => {
      const json = '{ "content": [{ "type": "text", "text": "foo bar" }] }'
      const blob = new Blob([json], { type: 'text/plain' })
      const arrayBuffer = await blob.arrayBuffer()
      const message = await Message.bedrockBodyToMessage(arrayBuffer, 'application/json')
      expect(message.content).toBe('foo bar')
    })
  })
})
