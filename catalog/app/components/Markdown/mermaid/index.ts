import type MarkdownIt from 'markdown-it'
import * as React from 'react'

import log from 'utils/Logging'
import useId from 'utils/useId'

import { attach } from './panZoom'

export { CONTROLS_CLASS, VIEWPORT_CLASS, ZOOMED_CLASS } from './panZoom'

export const FENCE_LANG = 'mermaid'
export const FENCE_CLASS = 'mermaid-fence'
export const FENCE_RENDERED_CLASS = 'mermaid-fence-rendered'

/**
 * Render a ```mermaid fence as a <pre> holding the diagram source.
 *
 * SANITIZE_OPTS allows no svg tags, so a diagram emitted into the HTML string
 * would be stripped; `useMermaidFences` draws into these nodes after the
 * sanitizer has run instead. Until then the source stays visible as text, which
 * is also what a reader is left with if the diagram fails to parse.
 */
export const fenceHandler = (md: MarkdownIt) => {
  const inherited = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.info.trim().split(/\s+/)[0].toLowerCase() !== FENCE_LANG) {
      return inherited
        ? inherited(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options)
    }
    return `<pre class="${FENCE_CLASS}">${md.utils.escapeHtml(token.content)}</pre>`
  }
}

/**
 * Draw every mermaid fence inside `ref` once the sanitized HTML is in the DOM.
 *
 * Returns a ref to attach to the element holding the rendered markdown.
 */
export function useMermaidFences<T extends HTMLElement>(html?: string) {
  const ref = React.useRef<T | null>(null)
  const idPrefix = useId()

  React.useEffect(() => {
    const root = ref.current
    if (!root) return
    const nodes = Array.from(
      root.querySelectorAll<HTMLPreElement>(`pre.${FENCE_CLASS}`),
    ).filter((node) => !node.classList.contains(FENCE_RENDERED_CLASS))
    if (!nodes.length) return

    let stale = false
    // mermaid measures text by drawing into a temp node it appends to
    // `document.body` and removes after -- but both its error paths throw first,
    // stranding that node and its error graph outside the container.
    const tempIds: string[] = []
    const dropTempNodes = () => {
      tempIds.forEach((id) => document.getElementById(id)?.remove())
    }
    const detachers: Array<() => void> = []

    async function render() {
      const { default: mermaid } = await import('mermaid')
      if (stale) return
      mermaid.initialize({
        startOnLoad: false,
        // Fence content is customer data: keep mermaid's sanitizer on and refuse
        // click-handler/script directives in the graph definition.
        securityLevel: 'strict',
        theme: 'neutral',
      })
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        // textContent, not innerHTML: the source was html-escaped for the
        // sanitizer and this reads it back as the author wrote it.
        const source = node.textContent ?? ''
        const id = `mermaid-${idPrefix}-${i}`
        tempIds.push(`d${id}`)
        try {
          // eslint-disable-next-line no-await-in-loop
          const { svg } = await mermaid.render(id, source)
          if (stale) break
          // The page sanitizer cannot carry svg, so this bypasses it: the markup
          // is sanitized by mermaid's own DOMPurify instead, under
          // securityLevel 'strict'. That pass is NOT the same policy -- it admits
          // the <style> element mermaid compiles per diagram, which SANITIZE_OPTS
          // forbids by name -- and it runs against mermaid's transitive dompurify,
          // not the catalog's pin. A dompurify advisory has to be answered in both.
          node.innerHTML = svg
          node.classList.add(FENCE_RENDERED_CLASS)
          const el = node.querySelector('svg')
          if (el) detachers.push(attach(el, node))
        } catch (e) {
          // Leave the fence showing its source rather than blanking the diagram.
          log.error(e)
        }
      }
      dropTempNodes()
    }

    // The import and initialize sit outside render()'s own try, and a floating
    // rejection would reach Sentry as a bare error: a stale chunk after a redeploy
    // must degrade to the visible source, as utils/hljs does for its grammars.
    render().catch((e) => log.error(e))
    return () => {
      stale = true
      dropTempNodes()
      detachers.forEach((detach) => detach())
    }
  }, [html, idPrefix])

  return ref
}
