const path = require('path')

const CircularDependencyPlugin = require('circular-dependency-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack')

module.exports = require('./webpack.base')({
  mode: 'development',

  // Add hot reloading in development
  entry: {
    app: [
      'webpack-hot-middleware/client?reload=true',
      path.join(process.cwd(), 'app/app'), // Start with app/app.js
    ],
    embed: [
      'webpack-hot-middleware/client?reload=true',
      path.join(process.cwd(), 'app/embed'),
    ],
    'embed-debug-harness': [
      'webpack-hot-middleware/client?reload=true',
      path.join(process.cwd(), 'app/embed/debug-harness'),
    ],
  },

  optimization: {
    emitOnErrors: false,
    splitChunks: { chunks: 'all' },
  },

  // Add development plugins
  plugins: [
    new CopyWebpackPlugin({ patterns: [{ from: 'static-dev' }] }),

    new webpack.HotModuleReplacementPlugin(), // Tell webpack we want hot reloading

    new CircularDependencyPlugin({
      exclude: /a\.js|node_modules/, // exclude node_modules
      failOnError: false, // show a warning when there is a circular dependency
    }),
  ],

  // Emit a source map for easier debugging
  // See https://webpack.js.org/configuration/devtool/#devtool
  devtool: 'eval-source-map',

  performance: {
    hints: false,
  },
})
