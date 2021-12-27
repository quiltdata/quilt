const path = require('path')

const CompressionPlugin = require('compression-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = require('./webpack.base')({
  mode: 'production',

  entry: {
    app: path.join(process.cwd(), 'app/app'),
    embed: path.join(process.cwd(), 'app/embed/index'),
    'embed-debug-harness': path.join(process.cwd(), 'app/embed/debug-harness'),
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
})
