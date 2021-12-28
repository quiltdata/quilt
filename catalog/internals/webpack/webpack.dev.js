const path = require('path')

const CircularDependencyPlugin = require('circular-dependency-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = require('./webpack.base')({
  mode: 'development',

  devServer: {
    compress: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    // hot: true, // https://github.com/webpack-contrib/webpack-hot-middleware/issues/390
    historyApiFallback: true,
    port: process.env.PORT || 3000,
    static: {
      directory: 'static-dev/',
    },
    watchFiles: ['app/**/*', 'static-dev/*'],
  },

  entry: {
    app: path.join(process.cwd(), 'app/app'), // Start with app/app.js
    embed: path.join(process.cwd(), 'app/embed'),
    'embed-debug-harness': path.join(process.cwd(), 'app/embed/debug-harness'),
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
