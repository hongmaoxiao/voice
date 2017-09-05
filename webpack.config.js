const path = require("path");

// var devtool = 'cheap-module-eval-source-map';
// process.argv.forEach(function(argv) {
//   if (argv === '-p') {
//     devtool = 'cheap-module-source-map';
//     //process.env.NODE_ENV = 'production';
//   }
// });
const devtool = process.env.NODE_ENV = 'production' ? 'cheap-module-source-map' : 'cheap-module-eval-source-map';

module.exports = {
  cache: true,
  context: path.resolve(__dirname, "src"),
  entry: {
    voice: './index.js',
    voiceworker: './worker.js',
    cmd: './cmd.js',
    cmdworker: './cmdworker.js',
    rtc: './rtc.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    chunkFilename: "[chunkhash].js",
  },
  devtool: devtool,
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: [{
          loader: 'eslint-loader',
          options: {
            fix: true,
            formatter: require('eslint-friendly-formatter'),
          }
        }],
        exclude: /(node_modules|lib)/
      },
      {
        test: /\.js$/,
        use: [
          'babel-loader',
        ],
        exclude: /(node_modules|lib)/
      },
      {
        test: /resampler\.js$/,
        use: [
          'exports?Resampler'
        ]
      },
    ],
    noParse: /lib/
  },
  devServer: {
    quiet: false,
    stats: {
      colors: true
    },
  }
};
