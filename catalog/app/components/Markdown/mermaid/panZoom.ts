import * as VB from './viewBox'

export const CONTROLS_CLASS = 'mermaid-fence-controls'
export const VIEWPORT_CLASS = 'mermaid-fence-viewport'
export const ZOOMED_CLASS = 'mermaid-fence-zoomed'

interface Control {
  label: string
  action: 'in' | 'out' | 'reset'
  glyph: string
}

const CONTROLS: Control[] = [
  { label: 'Zoom in', action: 'in', glyph: '+' },
  { label: 'Zoom out', action: 'out', glyph: '−' },
  { label: 'Reset zoom', action: 'reset', glyph: '↻' },
]

/**
 * Map a client point into the diagram's own coordinates.
 *
 * Goes through the SVG's CTM rather than measuring the element, so it stays exact
 * however the diagram is letterboxed inside its box by preserveAspectRatio.
 */
function toDiagram(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): VB.Point | null {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const mapped = pt.matrixTransform(ctm.inverse())
  return { x: mapped.x, y: mapped.y }
}

/**
 * Give a rendered mermaid SVG cursor-anchored zoom and drag-to-pan.
 *
 * Drives the SVG's `viewBox` rather than a CSS transform, so the diagram stays
 * crisp at every zoom level and text keeps its own layout. Returns a teardown.
 */
export function attach(svg: SVGSVGElement, host: HTMLElement): () => void {
  const base = VB.parse(svg.getAttribute('viewBox'))
  // No viewBox means no coordinate system to zoom within: leave the diagram be.
  if (!base) return () => {}

  let view: VB.ViewBox = { ...base }

  // mermaid caps the SVG's width to the diagram's natural size, which makes a
  // zoomed-in view scale the box instead of showing more detail inside it.
  svg.style.maxWidth = '100%'
  svg.style.width = '100%'

  const apply = (next: VB.ViewBox) => {
    view = next
    svg.setAttribute('viewBox', VB.format(view))
    const zoomed = !VB.isFit(base, view)
    host.classList.toggle(ZOOMED_CLASS, zoomed)
    // A fit diagram is not draggable, so it should not advertise a grab cursor.
    svg.style.cursor = zoomed ? 'grab' : ''
  }

  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    const rect = svg.getBoundingClientRect()
    const at =
      clientX != null && clientY != null
        ? toDiagram(svg, clientX, clientY)
        : toDiagram(svg, rect.left + rect.width / 2, rect.top + rect.height / 2)
    apply(VB.zoomAbout(base, view, at ?? VB.center(view), factor))
  }

  const onWheel = (e: WheelEvent) => {
    // Plain wheel keeps scrolling the document: a diagram mid-page must not trap
    // the reader's scroll. Ctrl/⌘ is the platform gesture for zooming content,
    // and is also what a pinch on a trackpad sends.
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    zoomAt(e.deltaY < 0 ? VB.STEP : 1 / VB.STEP, e.clientX, e.clientY)
  }

  let drag: { x: number; y: number; from: VB.ViewBox } | null = null

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || VB.isFit(base, view)) return
    drag = { x: e.clientX, y: e.clientY, from: { ...view } }
    svg.setPointerCapture(e.pointerId)
    svg.style.cursor = 'grabbing'
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return
    e.preventDefault()
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    // Measure the drag against the viewBox at pointerdown: applying deltas to a
    // view that is itself moving would compound them.
    const perPxX = drag.from.w / rect.width
    const perPxY = drag.from.h / rect.height
    apply(
      VB.panBy(
        base,
        drag.from,
        (e.clientX - drag.x) * perPxX,
        (e.clientY - drag.y) * perPxY,
      ),
    )
  }

  const endDrag = (e: PointerEvent) => {
    if (!drag) return
    drag = null
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId)
    svg.style.cursor = VB.isFit(base, view) ? '' : 'grab'
  }

  const onDblClick = (e: MouseEvent) => {
    e.preventDefault()
    zoomAt(VB.STEP, e.clientX, e.clientY)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const pan = (dx: number, dy: number) => {
      apply(VB.panBy(base, view, dx * view.w * 0.1, dy * view.h * 0.1))
    }
    switch (e.key) {
      case '+':
      case '=':
        zoomAt(VB.STEP)
        break
      case '-':
      case '_':
        zoomAt(1 / VB.STEP)
        break
      case '0':
        apply({ ...base })
        break
      case 'ArrowLeft':
        pan(1, 0)
        break
      case 'ArrowRight':
        pan(-1, 0)
        break
      case 'ArrowUp':
        pan(0, 1)
        break
      case 'ArrowDown':
        pan(0, -1)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const controls = document.createElement('div')
  controls.className = CONTROLS_CLASS
  const onControlClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest('button')
    if (!target) return
    e.preventDefault()
    const action = target.dataset.action
    if (action === 'in') zoomAt(VB.STEP)
    else if (action === 'out') zoomAt(1 / VB.STEP)
    else if (action === 'reset') apply({ ...base })
  }
  CONTROLS.forEach(({ label, action, glyph }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.action = action
    // Icon-only control: the glyph is decorative, the label is what AT reads.
    button.setAttribute('aria-label', label)
    button.title = label
    button.textContent = glyph
    controls.appendChild(button)
  })
  controls.addEventListener('click', onControlClick)

  host.classList.add(VIEWPORT_CLASS)
  host.appendChild(controls)

  // Focusable so the keyboard shortcuts are reachable without a pointer.
  host.tabIndex = 0
  host.setAttribute('role', 'group')
  host.setAttribute('aria-label', 'Diagram, zoomable')

  svg.addEventListener('wheel', onWheel, { passive: false })
  svg.addEventListener('pointerdown', onPointerDown)
  svg.addEventListener('pointermove', onPointerMove)
  svg.addEventListener('pointerup', endDrag)
  svg.addEventListener('pointercancel', endDrag)
  svg.addEventListener('dblclick', onDblClick)
  host.addEventListener('keydown', onKeyDown)

  return () => {
    svg.removeEventListener('wheel', onWheel)
    svg.removeEventListener('pointerdown', onPointerDown)
    svg.removeEventListener('pointermove', onPointerMove)
    svg.removeEventListener('pointerup', endDrag)
    svg.removeEventListener('pointercancel', endDrag)
    svg.removeEventListener('dblclick', onDblClick)
    host.removeEventListener('keydown', onKeyDown)
    controls.removeEventListener('click', onControlClick)
    controls.remove()
    host.classList.remove(VIEWPORT_CLASS, ZOOMED_CLASS)
    host.removeAttribute('tabindex')
    host.removeAttribute('role')
    host.removeAttribute('aria-label')
  }
}
