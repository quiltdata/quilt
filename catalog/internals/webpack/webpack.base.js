/**
 * COMMON WEBPACK CONFIGURATION
 */

const path = require('path')

const CopyWebpackPlugin = require('copy-webpack-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

module.exports = (options) => ({
  mode: options.mode,
  entry: options.entry,
  output: {
    // Compile into js/build.js
    path: path.resolve(process.cwd(), 'build'),
    publicPath: '/',
    // Merge with env dependent settings
    ...options.output,
  },
  optimization: options.optimization,
  module: {
    rules: [
      {
        test: /\.(txt|md)$/,
        use: 'raw-loader',
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // disable type checking - we use ForkTsCheckerWebpackPlugin for that
            transpileOnly: true,
          },
        },
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: 'source-map-loader',
      },
      {
        // Preprocess our own .css files
        // This is the place to add your own loaders (e.g. sass/less etc.)
        // for a list of loaders, see https://webpack.js.org/loaders/#styling
        test: /\.css$/,
        exclude: /node_modules/,
        use: ['style-loader', 'css-loader'],
      },
      {
        // Preprocess 3rd party .css files located in node_modules
        test: /\.css$/,
        include: /node_modules/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(eot|otf|ttf|woff|woff2)$/,
        use: 'file-loader',
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'svg-url-loader',
            options: {
              // Inline files smaller than 10 kB
              limit: 10 * 1024,
              noquotes: true,
            },
          },
        ],
      },
      {
        test: /\.(jpg|jpeg|png|gif)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              // Inline files smaller than 10 kB
              limit: 10 * 1024,
            },
          },
        ],
      },
      {
        test: /\.html$/,
        use: 'html-loader',
      },
      {
        test: /\.(mp4|webm)$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
          },
        },
      },
    ],
  },
  plugins: options.plugins.concat([
    new CopyWebpackPlugin({ patterns: [{ from: 'static' }] }),

    new HtmlWebpackPlugin({
      chunks: ['app'],
      template: 'app/index.html',
      inject: true,
    }),
    new HtmlWebpackPlugin({
      chunks: ['embed'],
      template: 'app/embed/index.html',
      filename: 'embed.html',
      inject: true,
    }),
    new HtmlWebpackPlugin({
      chunks: ['embed-debug-harness'],
      template: 'app/embed/debug-harness.html',
      filename: 'embed-debug-harness.html',
      inject: true,
    }),

    new ForkTsCheckerWebpackPlugin(),

    // NODE_ENV is exposed automatically based on the "mode" option
    new webpack.EnvironmentPlugin({
      LOGGER_REDUX: process.env.LOGGER_REDUX || 'enabled',
    }),
  ]),
  resolve: {
    modules: ['app', 'node_modules', path.resolve(__dirname, '../../../shared')],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.react.js'],
    mainFields: ['module', 'browser', 'jsnext:main', 'main'],
    fallback: {
      path: require.resolve('path-browserify'),
    },
  },
  devtool: options.devtool,
  target: 'web', // Make web variables accessible to webpack, e.g. window
  performance: options.performance || {},
})
