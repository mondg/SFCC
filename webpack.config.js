'use strict';

var path = require('path');
var ExtractTextPlugin = require('sgmf-scripts')['extract-text-webpack-plugin'];
var jsFiles = require('sgmf-scripts').createJsPath();
var scssFiles = require('sgmf-scripts').createScssPath();

module.exports = [{
    mode: 'none',
    name: 'js',
    entry: jsFiles,
    devtool: 'source-map',
    output: {
        path: path.resolve('./cartridges/int_moneris/cartridge/static'),
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                options: {
                    plugins: ['@babel/plugin-proposal-optional-chaining']
                }
            }
        ]
    },
    plugins: []
}, {
    mode: 'none',
    name: 'scss',
    entry: scssFiles,
    output: {
        path: path.resolve('./cartridges/int_moneris/cartridge/static'),
        filename: '[name].css'
    },
    module: {
        rules: [
            {
                test: /\.scss$/,
                use: ExtractTextPlugin.extract({
                    use: [{
                        loader: 'css-loader',
                        options: {
                            url: false,
                            minimize: true
                        }
                    }, {
                        loader: 'postcss-loader',
                        options: {
                            plugins: [
                                require('autoprefixer')()
                            ]
                        }
                    }, {
                        loader: 'sass-loader',
                        options: {
                            includePaths: [
                                path.resolve('node_modules')
                            ]
                        }
                    }]
                })
            }
        ]
    },
    plugins: [
        new ExtractTextPlugin({ filename: '[name].css' })
    ]
}];
