/*
 * Scroll element into view when rendered if its id equals current location hash.
 * Returns a function to use as a `ref` prop.
 * Accepts a timeout in ms (the default one is manually tested magic number).
 * Example: <h1 id="about" ref={scrollIntoView()}>About</h1>
 */

export default (timeout = 100) => (el) => {
  const { hash } = window.location
  if (el && el.id && hash) {
    const id = hash.replace('#', '')
    if (el.id === id) setTimeout(() => el.scrollIntoView(), timeout)
  }
}
