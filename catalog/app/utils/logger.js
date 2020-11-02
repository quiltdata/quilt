/* eslint-disable no-console */

// NOTE: you can get name from get `exception.name`
function error(exception) {
  console.error(exception)
}

function warn(name, optData) {
  console.log(name, optData)
}

function log(name, optData) {
  console.log(name, optData)
}

function debug(name, optData) {
  console.debug(name, optData)
  if (optData) {
    console.dir(optData)
  }
}

const logger = {
  debug,
  error,
  log,
  warn,
}

export function useLogger() {
  return logger
}

export default logger
