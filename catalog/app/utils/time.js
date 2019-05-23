/* Time utilities */
/* unix time in seconds; not necessarily an integer */
export function timestamp() {
  return Date.now() / 1000
}

export default timestamp
