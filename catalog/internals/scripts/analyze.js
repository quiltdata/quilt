#!/usr/bin/env node

const shelljs = require('shelljs')
const chalk = require('chalk')
const animateProgress = require('./helpers/progress')
const addCheckMark = require('./helpers/checkmark')

const progress = animateProgress('Generating stats')

// Generate stats.json file with webpack
shelljs.exec(
  'webpack --config internals/webpack/webpack.prod.js --profile --json > stats.json',
  () => {
    // Called after webpack has finished generating the stats.json file
    addCheckMark()
    clearInterval(progress)
    process.stdout.write(
      `\n\nOpen ${chalk.magenta(
        'http://webpack.github.io/analyse/',
      )} in your browser and upload the stats.json file!${chalk.blue(
        `\n(Tip: ${chalk.italic('CMD + double-click')} the link!)\n\n`,
      )}`,
    )
  },
)
