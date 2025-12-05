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
  })
})
