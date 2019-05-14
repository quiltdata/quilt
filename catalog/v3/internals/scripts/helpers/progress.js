const readline = require('readline')

/**
 * Adds an animated progress indicator
 *
 * @param  {string} message      The message to write next to the indicator
 * @param  {number} amountOfDots The amount of dots you want to animate
 */
module.exports = (message, amountOfDots) => {
  if (typeof amountOfDots !== 'number') {
    // eslint-disable-next-line no-param-reassign
    amountOfDots = 3
  }

  let i = 0
  return setInterval(() => {
    readline.cursorTo(process.stdout, 0)
    i = (i + 1) % (amountOfDots + 1)
    const dots = new Array(i + 1).join('.')
    process.stdout.write(message + dots)
  }, 500)
}
