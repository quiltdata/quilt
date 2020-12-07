/**
 * Copy a string to the clipboard.
 * Must be called from within an event handler such as click.
 * May return false if it failed, but this is not always possible.
 * Browser support for Chrome 43+, Firefox 42+, Safari 10+, Edge and IE 10+.
 * IE: The clipboard feature may be disabled by an administrator.
 * By default a prompt is shown the first time the clipboard is used (per session).
 *
 * Taken from this SO answer: https://stackoverflow.com/a/33928558/2129080
 *
 * @name copyToClipboard
 *
 * @param {string} text
 *
 * @returns {boolean}
 */
export default function copyToClipboard(text, { container = document.body } = {}) {
  if (window.clipboardData && window.clipboardData.setData) {
    // IE specific code path to prevent textarea being shown while dialog is visible.
    return window.clipboardData.setData('Text', text)
  }

  if (!(document.queryCommandSupported && document.queryCommandSupported('copy'))) {
    return false
  }

  const textarea = document.createElement('textarea')
  textarea.textContent = text
  // Prevent scrolling to bottom of page in MS Edge.
  textarea.style.position = 'fixed'
  container.appendChild(textarea)
  textarea.select()
  try {
    // Security exception may be thrown by some browsers.
    return document.execCommand('copy')
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('copy to clipboard failed', e)
    return false
  } finally {
    container.removeChild(textarea)
  }
}
