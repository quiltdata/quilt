/* Time utilities */
/* unix time in seconds; not necessarily an integer */
export function timestamp(): number {
  return Date.now() / 1000
}
