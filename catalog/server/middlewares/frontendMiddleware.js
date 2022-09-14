/* eslint-disable global-require */
const express = require('express')
const path = require('path')
const compression = require('compression')

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
  app.get('/oauth-callback', sendFile('oauth-callback.html'))
  app.get('*', sendFile('index.html'))
}

/**
 * Front-end middleware
 */
module.exports = (app, options) => {
  addProdMiddlewares(app, options)

  return app
}
