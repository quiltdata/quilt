const chalk = require('chalk')

/**
 * Adds mark check symbol
 */
module.exports = (callback) => {
  process.stdout.write(chalk.green(' ✓'))
  if (callback) callback()
}
