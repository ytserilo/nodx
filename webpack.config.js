const path = require('path')

module.exports = {
  entry: './src/static/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  mode: 'production'
}
