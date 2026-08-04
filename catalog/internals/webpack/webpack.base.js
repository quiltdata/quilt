/**
 * COMMON WEBPACK CONFIGURATION
 */

const path = require('path')

const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

// TODO: use webpack-merge, it's already in node_modules
module.exports = (options) => ({
  mode: options.mode,
  entry: options.entry || {
    app: path.join(process.cwd(), 'app/app'), // Start with app/app.js
  },
  output: {
    // Compile into js/build.js
    path: path.resolve(process.cwd(), 'build'),
    publicPath: '/',
    // Merge with env dependent settings
    ...options.output,
  },
  devServer: options.devServer,
  optimization: options.optimization,
  module: {
    rules: [
      {
        test: /\.(txt|md)$/,
        type: 'asset/source',
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // disable type checking - the standalone `npm run typecheck` (tsc) is the type gate
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
        exclude: [/monaco-editor/], // Perspective library needs this exception
        use: ['style-loader', 'css-loader'],
      },
      {
        // Perspective 3.x ships its data engine + viewer as .wasm assets and
        // fetches them at runtime; emit them as files. (Replaces the legacy
        // @finos/perspective-webpack-plugin, retired in the 1.9.4 -> 3.x upgrade.)
        test: /\.wasm$/,
        type: 'asset/resource',
      },
      {
        test: /\.(eot|otf|ttf|woff|woff2)$/,
        type: 'asset/resource',
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
        test: /\.(jpg|jpeg|png|gif|webp)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            // Inline files smaller than 10 kB
            maxSize: 10 * 1024,
          },
        },
      },
      {
        test: /\.html$/,
        use: 'html-loader',
      },
      {
        test: /\.(mp4|webm)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
      },
    ],
  },
  // Perspective 3.x's .wasm is emitted as a fetched asset (asset/resource rule
  // above), so disable webpack's WASM module experiments — otherwise webpack
  // tries to treat .wasm as a first-class WebAssembly module.
  experiments: {
    asyncWebAssembly: false,
    syncWebAssembly: false,
  },
  plugins: options.plugins.concat([
    new CopyWebpackPlugin({
      patterns: [{ from: 'static', globOptions: { ignore: ['**/.prettierrc.json'] } }],
    }),

    new HtmlWebpackPlugin({
      chunks: ['app'],
      template: 'app/index.html',
      inject: true,
    }),

    // NODE_ENV is exposed automatically based on the "mode" option
    new webpack.EnvironmentPlugin({
      LOGGER_REDUX: process.env.LOGGER_REDUX || 'enabled',
    }),

    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    }),
  ]),
  resolve: {
    modules: ['app', 'node_modules', path.resolve(__dirname, '../../../shared')],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.react.js'],
    mainFields: ['module', 'browser', 'jsnext:main', 'main'],
    fallback: {
      // Previously set by RevertPathOverwriteByPerspective (the old Perspective
      // plugin nulled resolve.fallback.path); set it directly now the plugin is gone.
      path: require.resolve('path-browserify'),
    },
  },
  devtool: options.devtool,
  target: 'web', // Make web variables accessible to webpack, e.g. window
  performance: options.performance || {},
})
