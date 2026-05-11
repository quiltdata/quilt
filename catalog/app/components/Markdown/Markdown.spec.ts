import { JSDOM } from 'jsdom'
import { describe, it, expect } from 'vitest'

import { getRenderer } from './Markdown'

const win = new JSDOM('').window
const processLink = (attr: string) => `https://link/${attr}`
const processImg = (attr: string) => `https://image/${attr}`

describe('components/Markdown', () => {
  describe('getRenderer', () => {
    const render = getRenderer({ processImg, processLink, win: win as $TSFixMe })
    it('Processes only images and links', () => {
      const input = `Something

[link](anything)
![](anything)

<span href="anything" src="anything">don't touch</span>
<a href="anything">link</a>
<img src="anything"/>`
      expect(render(input)).toMatchInlineSnapshot(`
        "<p>Something</p>
        <p><a rel="nofollow" href="https://link/anything">link</a>
        <img alt="" src="https://image/anything"></p>
        <p><span src="anything" href="anything">don’t touch</span>
        <a rel="nofollow" href="https://link/anything">link</a>
        <img src="https://image/anything"></p>
        "
      `)
    })

    it('Preserves HTML attributes', () => {
      const input = `Something

[link](anything)
![Alternative text](anything)

<span href="anything" src="anything" data-dont-touch>don't touch</span>
<a rel="nofollow base" title="Link title" href="anything">link</a>
<img alt="Alternative text" src="anything"/>`
      expect(render(input)).toMatchInlineSnapshot(`
        "<p>Something</p>
        <p><a rel="nofollow" href="https://link/anything">link</a>
        <img alt="Alternative text" src="https://image/anything"></p>
        <p><span data-dont-touch="" src="anything" href="anything">don’t touch</span>
        <a href="https://link/anything" title="Link title" rel="nofollow base nofollow">link</a>
        <img src="https://image/anything" alt="Alternative text"></p>
        "
      `)
    })
    it('Avoids XSS', () => {
      const hack = getRenderer({
        processImg,
        processLink: () => 'javascript:alert(0)',
        win: win as $TSFixMe,
      })
      expect(hack('<a href="anything">l</a>')).toMatchInlineSnapshot(`
        "<p><a rel="nofollow">l</a></p>
        "
      `)
    })

    it('Strips invalid attributes', () => {
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
      expect(withInvalidAttributes(input)).toMatchInlineSnapshot(`
        "<p><a rel="nofollow">title</a> <img alt=""></p>
        "
      `)
    })

    it('Highlights fenced code via highlight.js', () => {
      const input = '```js\nconst x = 1\n```'
      expect(render(input)).toMatchInlineSnapshot(`
        "<pre><code class="language-js"><span class="hljs-keyword">const</span> x = <span class="hljs-number">1</span>
        </code></pre>
        "
      `)
    })

    it('Autolinks bare URLs', () => {
      const input = 'see https://example.com'
      expect(render(input)).toMatchInlineSnapshot(`
        "<p>see <a rel="nofollow" href="https://link/https://example.com">https://example.com</a></p>
        "
      `)
    })

    it('Adds nofollow rel to links', () => {
      const input = '[x](https://example.com)'
      expect(render(input)).toMatchInlineSnapshot(`
        "<p><a rel="nofollow" href="https://link/https://example.com">x</a></p>
        "
      `)
    })

    it('Renders tasklist glyphs', () => {
      const input = '- [x] done\n- [ ] todo\n- [] none'
      expect(render(input)).toMatchInlineSnapshot(`
        "<ul>
        <li>☑ done</li>
        <li>☐ todo</li>
        <li>☐ none</li>
        </ul>
        "
      `)
    })

    it('Skips tasklist glyph for escaped brackets', () => {
      const input = '\\[x] not a checkbox'
      expect(render(input)).toMatchInlineSnapshot(`
        "<p>[x] not a checkbox</p>
        "
      `)
    })

    it('Skips tasklist glyph mid-word', () => {
      const input = 'foo[x]bar'
      expect(render(input)).toMatchInlineSnapshot(`
        "<p>foo[x]bar</p>
        "
      `)
    })

    it('Applies typographer replacements', () => {
      const input = '(c) -- test'
      expect(render(input)).toMatchInlineSnapshot(`
        "<p>© – test</p>
        "
      `)
    })

    it('Strips <script> via DOMPurify', () => {
      const input = '<script>alert(1)</script>'
      expect(render(input)).toMatchInlineSnapshot(`""`)
    })
  })
})
