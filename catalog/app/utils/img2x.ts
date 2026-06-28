export default <T>(x1: T, x2: T): T =>
  typeof window !== 'undefined' &&
  window.devicePixelRatio != null &&
  window.devicePixelRatio >= 1.5
    ? x2
    : x1
