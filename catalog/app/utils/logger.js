/* eslint-disable no-console */
function log(name, optData) {
  console.log(name, optData)
}

// NOTE: you can get name from get `exception.name`
function error(exception) {
  console.error(exception)
}

// NOTE: you can get name from get `exception.name`
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
}

export function useLogger() {
  return logger
}
