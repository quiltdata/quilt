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

    it('should strip invalid attributes', () => {
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

    it('renders fenced code with language via highlight.js', () => {
      const html = renderPlain('```js\nconst x = 1\n```')
      expect(html).toContain('hljs')
      expect(html).toMatch(/language-js/)
    })
    it('autolinks bare URLs (linkify)', () => {
      expect(renderPlain('see https://example.com')).toContain(
        'href="https://example.com"',
      )
    })
    it('adds nofollow rel to links', () => {
      expect(renderPlain('[x](https://example.com)')).toMatch(/rel="[^"]*nofollow/)
    })
    it('renders tasklist glyphs', () => {
      const html = renderPlain('- [x] done\n- [ ] todo\n- [] none')
      expect(html).toContain('☑')
      expect(html).toContain('☐')
    })
    it('typographer: (c) → ©, -- → en-dash', () => {
      const html = renderPlain('(c) -- test')
      expect(html).toContain('©')
      expect(html).toContain('–')
    })
    it('strips <script> via DOMPurify', () => {
      expect(renderPlain('<script>alert(1)</script>')).not.toContain('<script')
    })
    it('preserves escape sequences in alt text', () => {
      expect(renderPlain('![a\\!b](x.png)')).toMatch(/alt="a!b"/)
    })
    it('preserves line breaks in multi-line alt text', () => {
      expect(renderPlain('![line one\nline two](x.png)')).toMatch(
        /alt="line one\nline two"/,
      )
    })
  })
})
