const { resolve } = require('path')
const express = require('express')
const argv = require('minimist')(process.argv.slice(2))
const ngrok =
  (process.env.NODE_ENV !== 'production' && process.env.ENABLE_TUNNEL) || argv.tunnel
    ? require('ngrok')
    : false

const logger = require('./logger')
const setup = require('./middlewares/frontendMiddleware')

const app = express()

// In production we need to pass these values in instead of relying on webpack
setup(app, {
  outputPath: resolve(process.cwd(), 'build'),
  publicPath: '/',
})

// get the intended host and port number, use localhost and port 3000 if not provided
const customHost = argv.host || process.env.HOST
const host = customHost || null // Let http.Server use its default IPv6/4 host
const prettyHost = customHost || 'localhost'

const port = argv.port || process.env.PORT || 3000

// use the gzipped bundle
app.get('*.js', (req, res, next) => {
  req.url = req.url + '.gz' // eslint-disable-line
  res.set('Content-Encoding', 'gzip')
  next()
})

// Start your app.
app.listen(port, host, async (err) => {
  if (err) {
    logger.error(err.message)
    return
  }

  // Connect to ngrok in dev mode
  if (ngrok) {
    try {
      const url = await ngrok.connect(port)
      logger.appStarted(port, prettyHost, url)
    } catch (e) {
      logger.error(e)
    }
  } else {
    logger.appStarted(port, prettyHost)
  }
})
