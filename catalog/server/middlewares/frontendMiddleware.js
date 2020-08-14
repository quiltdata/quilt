/* eslint-disable global-require */
const express = require('express')
const path = require('path')
const compression = require('compression')

// Dev middleware
const addDevMiddlewares = (app, webpackConfig) => {
  const webpack = require('webpack')
  const webpackDevMiddleware = require('webpack-dev-middleware')
  const webpackHotMiddleware = require('webpack-hot-middleware')
  const compiler = webpack(webpackConfig)
  const middleware = webpackDevMiddleware(compiler, {
    logLevel: 'warn',
    publicPath: webpackConfig.output.publicPath,
    stats: 'errors-only',
  })

  app.use(middleware)
  app.use(webpackHotMiddleware(compiler))

  // Since webpackDevMiddleware uses memory-fs internally to store build
  // artifacts, we use it instead
  const fs = middleware.fileSystem

  const sendFile = (name) => (req, res) => {
    fs.readFile(path.join(compiler.outputPath, name), (err, file) => {
      if (err) {
        res.sendStatus(404)
      } else {
        res.send(file.toString())
      }
    })
  }

  app.get('/__embed-debug', sendFile('embed-debug-harness.html'))
  app.get('/__embed', sendFile('embed.html'))
  app.get('*', sendFile('index.html'))
}

// Production middlewares
const addProdMiddlewares = (app, { publicPath, outputPath }) => {
  // compression middleware compresses your server responses which makes them
  // smaller (applies also to assets). You can read more about that technique
  // and other good practices on official Express.js docs http://mxs.is/googmy
  app.use(compression())
  app.use(publicPath, express.static(outputPath))

  const sendFile = (name) => (req, res) => res.sendFile(path.resolve(outputPath, name))
  app.get('/__embed-debug', sendFile('embed-debug-harness.html'))
  app.get('/__embed', sendFile('embed.html'))
  app.get('*', sendFile('index.html'))
}

/**
 * Front-end middleware
 */
module.exports = (app, options) => {
  const isProd = process.env.NODE_ENV === 'production'

  if (isProd) {
    addProdMiddlewares(app, options)
  } else {
    const webpackConfig = require('../../internals/webpack/webpack.dev.babel')
    addDevMiddlewares(app, webpackConfig)
  }

  return app
}
