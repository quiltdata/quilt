const path = require('path')

const CircularDependencyPlugin = require('circular-dependency-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = require('./webpack.base')({
  mode: 'development',

  devServer: {
    compress: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    // hot: true, // https://github.com/webpack-contrib/webpack-hot-middleware/issues/390
    port: process.env.PORT || 3000,
    static: {
      directory: 'static-dev/',
    },
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
        { from: /^\/__embed$/, to: '/embed.html' },
        { from: /^\/__embed-debug$/, to: '/embed-debug-harness.html' },
        { from: /^\/oauth-callback$/, to: '/oauth-callback.html' },
      ],
    },
    watchFiles: ['app/**/*', 'static-dev/*'],
  },

  optimization: {
    emitOnErrors: false,
    splitChunks: { chunks: 'all' },
  },

  // Add development plugins
  plugins: [
    new CopyWebpackPlugin({ patterns: [{ from: 'static-dev' }] }),

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
