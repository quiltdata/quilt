import { describe, expect, it } from 'vitest'

import { getRenderer } from './Markdown'
import { FENCE_CLASS } from './mermaid'

// getRenderer throws a Promise (Suspense protocol) when a fence needs an unloaded
// grammar; await it and retry until rendering completes.
async function render(md: string): Promise<string> {
  const renderer = getRenderer({})
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return renderer(md)
    } catch (e) {
      if (e instanceof Promise) await e
      else throw e
    }
  }
}

const DIAGRAM = '```mermaid\nflowchart TB\n  A --> B\n```'

describe('components/Markdown/mermaid', () => {
  it('marks a mermaid fence for the diagram pass', async () => {
    expect(await render(DIAGRAM)).toContain(`class="${FENCE_CLASS}"`)
  })

  it('survives the sanitizer, which carries no svg tags', async () => {
    // The whole approach rests on `class` outliving DOMPurify: the diagram is
    // drawn into these nodes after sanitization, so losing the hook loses the
    // diagram silently.
    expect(await render(DIAGRAM)).toMatch(new RegExp(`<pre[^>]*class="${FENCE_CLASS}"`))
  })

  it('keeps the source readable as text until the diagram is drawn', async () => {
    const html = await render(DIAGRAM)
    expect(html).toContain('flowchart TB')
    // `-->` must arrive as written, not as a broken entity, or mermaid cannot parse it
    expect(html).toContain('A --&gt; B')
  })

  it('does not escape the fence content twice', async () => {
    expect(await render(DIAGRAM)).not.toContain('&amp;gt;')
  })

  it('leaves other fences to the normal highlighter', async () => {
    const html = await render('```python\nx = 1\n```')
    expect(html).not.toContain(FENCE_CLASS)
    expect(html).toContain('language-python')
  })

  it('leaves an unlabelled fence alone', async () => {
    expect(await render('```\nplain\n```')).not.toContain(FENCE_CLASS)
  })

  it('does not claim a fence whose label merely starts with mermaid', async () => {
    expect(await render('```mermaidish\nnope\n```')).not.toContain(FENCE_CLASS)
  })

  it('handles several diagrams in one document', async () => {
    const html = await render(`${DIAGRAM}\n\n\`\`\`mermaid\ngraph LR\n  C --> D\n\`\`\``)
    expect(html.match(new RegExp(FENCE_CLASS, 'g'))).toHaveLength(2)
  })
})
