import log from 'loglevel'

const defaultLevel = process.env.NODE_ENV === 'development' ? 'trace' : 'info'
// Use setDefaultLevel() instead of setLevel() here to allow developers or users
// overriding log level by running Log.setLevel(lvl) in the console for
// debug / development purposes (reset it back to default with Log.resetLevel()).
// For details see loglevel docs at https://github.com/pimterry/loglevel
log.setDefaultLevel(defaultLevel)

// expose logger instance to allow changing log levels via console
;(window as any).Log = log

export default log
