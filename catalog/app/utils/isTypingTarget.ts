// Whether a keyboard event is headed for a text field, so a global shortcut
// should stay out of its way. Prefers the composed path over `target`: at a
// window listener, an input inside a shadow root (perspective-viewer's filter
// fields) is retargeted to its host, which would pass as "not typing". A
// synthetic event dispatched straight at the window has no element at the
// head of its path, so `target` still gets the final say. `role="textbox"`
// counts as typing too: a JsonEditor cell is a focusable div that turns the
// first printable key into a value (`[` starts an array), so a shortcut that
// preventDefaults the keydown would swallow it.
export default function isTypingTarget(evt: KeyboardEvent): boolean {
  const head = evt.composedPath?.()[0]
  const target = (head instanceof Element ? head : evt.target) as HTMLElement | null
  return (
    !!target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.getAttribute?.('role') === 'textbox')
  )
}
