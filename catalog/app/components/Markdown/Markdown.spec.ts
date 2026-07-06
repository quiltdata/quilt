import { JSDOM } from 'jsdom'
import { describe, it, expect, vi } from 'vitest'

import hljs from 'utils/hljs'
import log from 'utils/Logging'

import { getRenderer } from './Markdown'

const win = new JSDOM('').window
const processLink = (attr: string) => `https://link/${attr}`
const processImg = (attr: string) => `https://image/${attr}`

async function resolved(render: (s: string) => string, input: string): Promise<string> {
  // getRenderer throws a Promise (Suspense protocol) when a fence needs an
  // unloaded grammar; await it and retry until rendering completes.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return render(input)
    } catch (e) {
      if (e instanceof Promise) await e
      else throw e
    }
  }
}

describe('components/Markdown', () => {
  describe('getRenderer', () => {
    const render = getRenderer({ processImg, processLink, win: win as $TSFixMe })
    it('Processes only images and links', async () => {
      const input = `Something

[link](anything)
![](anything)

<span href="anything" src="anything">don't touch</span>
<a href="anything">link</a>
<img src="anything"/>`
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p>Something</p>
        <p><a href="https://link/anything" rel="nofollow">link</a>
        <img src="https://image/anything" alt=""></p>
        <p><span href="anything" src="anything">don’t touch</span>
        <a href="https://link/anything" rel="nofollow">link</a>
        <img src="https://image/anything"></p>
        "
      `)
    })

    it('Preserves HTML attributes', async () => {
      const input = `Something

[link](anything)
![Alternative text](anything)

<span href="anything" src="anything" data-dont-touch>don't touch</span>
<a rel="nofollow base" title="Link title" href="anything">link</a>
<img alt="Alternative text" src="anything"/>`
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p>Something</p>
        <p><a href="https://link/anything" rel="nofollow">link</a>
        <img src="https://image/anything" alt="Alternative text"></p>
        <p><span href="anything" src="anything" data-dont-touch="">don’t touch</span>
        <a rel="nofollow base nofollow" title="Link title" href="https://link/anything">link</a>
        <img alt="Alternative text" src="https://image/anything"></p>
        "
      `)
    })
    it('Avoids XSS', async () => {
      const hack = getRenderer({
        processImg,
        processLink: () => 'javascript:alert(0)',
        win: win as $TSFixMe,
      })
      expect(await resolved(hack, '<a href="anything">l</a>')).toMatchInlineSnapshot(`
        "<p><a rel="nofollow">l</a></p>
        "
      `)
    })

    it('Strips invalid attributes', async () => {
      const withInvalidAttributes = getRenderer({
        processImg: () => {
          throw new Error('processImg error')
        },
        processLink: () => {
          throw new Error('processLink error')
        },
        win: win as $TSFixMe,
      })

      const input = `[title](link-url) ![](img-url)`
      expect(() => withInvalidAttributes(input)).not.toThrow()
      expect(await resolved(withInvalidAttributes, input)).toMatchInlineSnapshot(`
        "<p><a rel="nofollow">title</a> <img alt=""></p>
        "
      `)
    })

    it('Highlights fenced code via highlight.js', async () => {
      const input = '```js\nconst x = 1\n```'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<pre><code class="language-js"><span class="hljs-keyword">const</span> x = <span class="hljs-number">1</span>
        </code></pre>
        "
      `)
    })

    it('Highlights a ```ts fence as typescript', async () => {
      const out = await resolved(render, '```ts\nconst x: number = 1\n```')
      expect(out).toContain('hljs-keyword')
    })

    it('Degrades to plain text when hljs.highlight throws', async () => {
      const highlightSpy = vi.spyOn(hljs, 'highlight').mockImplementation(() => {
        throw new Error('hljs boom')
      })
      const logSpy = vi.spyOn(log, 'error').mockImplementation(() => {})
      // The fence still renders, just unhighlighted (no hljs-* spans), instead
      // of the throw propagating out of render.
      const out = await resolved(render, '```js\nconst x = 1\n```')
      expect(out).toContain('language-js')
      expect(out).not.toContain('hljs-')
      expect(logSpy).toHaveBeenCalled()
      highlightSpy.mockRestore()
      logSpy.mockRestore()
    })

    it('Autolinks bare URLs', async () => {
      const input = 'see https://example.com'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p>see <a href="https://link/https://example.com" rel="nofollow">https://example.com</a></p>
        "
      `)
    })

    it('Adds nofollow rel to links', async () => {
      const input = '[x](https://example.com)'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p><a href="https://link/https://example.com" rel="nofollow">x</a></p>
        "
      `)
    })

    it('Renders tasklist glyphs', async () => {
      const input = '- [x] done\n- [ ] todo\n- [] none'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<ul>
        <li>☑ done</li>
        <li>☐ todo</li>
        <li>☐ none</li>
        </ul>
        "
      `)
    })

    it('Skips tasklist glyph for escaped brackets', async () => {
      const input = '\\[x] not a checkbox'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p>[x] not a checkbox</p>
        "
      `)
    })

    it('Skips tasklist glyph mid-word', async () => {
      const input = 'foo[x]bar'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p>foo[x]bar</p>
        "
      `)
    })

    it('Applies typographer replacements', async () => {
      const input = '(c) -- test'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p>© – test</p>
        "
      `)
    })

    it('Strips <script> via DOMPurify', async () => {
      const input = '<script>alert(1)</script>'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`""`)
    })

    // Regression for the silent-mode bug in `parseTasklist`: when markdown-it's
    // `parseLinkLabel` calls `skipToken` to scan past inner tokens, our rule
    // must not push tokens — otherwise the image label is corrupted.
    it('Renders tasklist nested inside image label', async () => {
      const input = '![ [x] image](url)'
      expect(await resolved(render, input)).toMatchInlineSnapshot(`
        "<p><img src="https://image/url" alt="image"></p>
        "
      `)
    })
  })
})
