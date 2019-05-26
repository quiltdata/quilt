export default (x1, x2) =>
  typeof window !== 'undefined' &&
  window.devicePixelRatio != null &&
  window.devicePixelRatio >= 1.5
    ? x2
    : x1
