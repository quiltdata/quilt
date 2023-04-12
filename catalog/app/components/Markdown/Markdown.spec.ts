import { JSDOM } from 'jsdom'

import { getRenderer } from './Markdown'

const win = new JSDOM('').window
const processLink = () => 'LINK'
const processImg = () => 'IMAGE'

describe('components/Markdown', () => {
  describe('getRenderer', () => {
    // @ts-expect-error
    const render = getRenderer({ processImg, processLink, win })
    it('Process only images and links', () => {
      const input = `Something

[link](anything)
![](anything)

<span href="anything" src="anything">don't touch</span>
<a href="anything">link</a>
<img src="anything"/>`
      const output = `<p>Something</p>
<p><a rel="nofollow" href="LINK">link</a>
<img alt="" src="IMAGE"></p>
<p><span src="anything" href="anything">don’t touch</span>
<a rel="nofollow" href="LINK">link</a>
<img src="IMAGE"></p>
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
<p><a rel="nofollow" href="LINK">link</a>
<img alt="Alternative text" src="IMAGE"></p>
<p><span data-dont-touch="" src="anything" href="anything">don’t touch</span>
<a href="LINK" title="Link title" rel="nofollow base nofollow">link</a>
<img src="IMAGE" alt="Alternative text"></p>
`
      expect(render(input)).toBe(output)
    })
    it('Avoid XSS', () => {
      const hack = getRenderer({
        processImg,
        processLink: () => 'javascript:alert(0)',
        // @ts-expect-error
        win,
      })
      expect(hack('<a href="anything">l</a>')).toBe('<p><a rel="nofollow">l</a></p>\n')
    })
  })
})
