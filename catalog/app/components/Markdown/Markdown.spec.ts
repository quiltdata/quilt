import { JSDOM } from 'jsdom'
import { describe, it, expect } from 'vitest'

import { getRenderer } from './Markdown'

const win = new JSDOM('').window
const processLink = (attr: string) => `LINK ${attr}`
const processImg = (attr: string) => `IMAGE ${attr}`

describe('components/Markdown', () => {
  describe('getRenderer', () => {
    const render = getRenderer({ processImg, processLink, win: win as $TSFixMe })
    it('Process only images and links', () => {
      const input = `Something

[link](anything)
![](anything)

<span href="anything" src="anything">don't touch</span>
<a href="anything">link</a>
<img src="anything"/>`
      const output = `<p>Something</p>
<p><a rel="nofollow" href="LINK anything">link</a>
<img alt="" src="IMAGE anything"></p>
<p><span src="anything" href="anything">don’t touch</span>
<a rel="nofollow" href="LINK anything">link</a>
<img src="IMAGE anything"></p>
`
      expect(render(input)).toBe(output)
    })

    it('Preserve HTML attributes', () => {
      const input = `Something

[link](anything)
![Alternative text](anything)

<span href="anything" src="anything" data-dont-touch>don't touch</span>
<a rel="nofollow base" title="Link title" href="anything">link</a>
<img alt="Alternative text" src="anything"/>`
      const output = `<p>Something</p>
<p><a rel="nofollow" href="LINK anything">link</a>
<img alt="Alternative text" src="IMAGE anything"></p>
<p><span data-dont-touch="" src="anything" href="anything">don’t touch</span>
<a href="LINK anything" title="Link title" rel="nofollow base nofollow">link</a>
<img src="IMAGE anything" alt="Alternative text"></p>
`
      expect(render(input)).toBe(output)
    })
    it('Avoid XSS', () => {
      const hack = getRenderer({
        processImg,
        processLink: () => 'javascript:alert(0)',
        win: win as $TSFixMe,
      })
      expect(hack('<a href="anything">l</a>')).toBe('<p><a rel="nofollow">l</a></p>\n')
    })

    it('Strip invalid attributes', () => {
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

      const output = `<p><a rel="nofollow">title</a> <img alt=""></p>\n`
      expect(withInvalidAttributes(input)).toBe(output)
    })

    const renderPlain = getRenderer({
      processImg: (s) => s,
      processLink: (s) => s,
      win: win as $TSFixMe,
    })

    it('Highlight fenced code via highlight.js', () => {
      const input = '```js\nconst x = 1\n```'
      const output = `<pre><code class="language-js"><span class="hljs-keyword">const</span> x = <span class="hljs-number">1</span>\n</code></pre>\n`
      expect(renderPlain(input)).toBe(output)
    })

    it('Autolink bare URLs', () => {
      const input = 'see https://example.com'
      const output = `<p>see <a rel="nofollow" href="https://example.com">https://example.com</a></p>\n`
      expect(renderPlain(input)).toBe(output)
    })

    it('Add nofollow rel to links', () => {
      const input = '[x](https://example.com)'
      const output = `<p><a rel="nofollow" href="https://example.com">x</a></p>\n`
      expect(renderPlain(input)).toBe(output)
    })

    it('Render tasklist glyphs', () => {
      const input = '- [x] done\n- [ ] todo\n- [] none'
      const output = `<ul>\n<li>☑ done</li>\n<li>☐ todo</li>\n<li>☐ none</li>\n</ul>\n`
      expect(renderPlain(input)).toBe(output)
    })

    it('Skip tasklist glyph for escaped brackets', () => {
      const input = '\\[x] not a checkbox'
      const output = `<p>[x] not a checkbox</p>\n`
      expect(renderPlain(input)).toBe(output)
    })

    it('Skip tasklist glyph mid-word', () => {
      const input = 'foo[x]bar'
      const output = `<p>foo[x]bar</p>\n`
      expect(renderPlain(input)).toBe(output)
    })

    it('Apply typographer replacements', () => {
      const input = '(c) -- test'
      const output = `<p>© – test</p>\n`
      expect(renderPlain(input)).toBe(output)
    })

    it('Strip <script> via DOMPurify', () => {
      const input = '<script>alert(1)</script>'
      const output = ``
      expect(renderPlain(input)).toBe(output)
    })
  })
})
