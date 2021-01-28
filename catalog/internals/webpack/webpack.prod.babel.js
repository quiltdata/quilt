const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')
const CompressionPlugin = require('compression-webpack-plugin')

module.exports = require('./webpack.base.babel')({
  mode: 'production',

  // In production, we skip all hot-reloading stuff
  entry: {
    app: [
      require.resolve('react-app-polyfill/ie11'),
      path.join(process.cwd(), 'app/app.js'),
    ],
    embed: [
      require.resolve('react-app-polyfill/ie11'),
      path.join(process.cwd(), 'app/embed/index.js'),
    ],
    'embed-debug-harness': [path.join(process.cwd(), 'app/embed/debug-harness.js')],
  },

  // Utilize long-term caching by adding content hashes (not compilation hashes) to compiled assets
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js',
  },

  optimization: {
    minimizer: [new TerserPlugin({ parallel: 3 })],
    runtimeChunk: 'single',
    splitChunks: { chunks: 'all' },
  },

  plugins: [
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.js$|\.css$|\.html$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
  ],

  devtool: 'source-map',

  performance: {
    assetFilter: (assetFilename) => !/(\.map$)|(^(main\.|favicon\.))/.test(assetFilename),
  },

  // options passed to all instances of HtmlWebpackPlugin
  html: {
    minify: {
      removeComments: true,
      collapseWhitespace: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeStyleLinkTypeAttributes: true,
      keepClosingSlash: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
    },
  },
})
