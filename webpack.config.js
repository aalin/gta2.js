const path = require('path');
const webpack = require('webpack');

const MinifyPlugin = require("babel-minify-webpack-plugin");

let config = {
  entry: './src/index',
  devtool: 'source-map',
  target: 'web',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: './dist/'
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.DEBUG': JSON.stringify(process.env.DEBUG)
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
  }
};

if (process.env.NODE_ENV === 'production') {
  config.plugins.push(new MinifyPlugin());
}

module.exports = config;
