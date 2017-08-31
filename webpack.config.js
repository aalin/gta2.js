const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index',
  devtool: 'source-map',
  target: 'web',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: './dist/'
  },

  plugins: [
    new webpack.ProvidePlugin({
      'window.decomp': 'poly-decomp' // matterjs
    })
  ],
  module: {
    rules: [
      {
        test: /\.(js)$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      }, {
        test: /\.(vert|frag)$/,
        loader: 'webpack-glsl-loader'
      }, {
        test: /\.png$/,
        loader: 'url-loader'
      },
    ]
  },

  resolve: {
    modules: [
      'node_modules'
    ],

    extensions: ['.js']
  },

//   plugins: [ new BabiliPlugin({}, {}) ]
};
