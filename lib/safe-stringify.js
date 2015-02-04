var Stringify = require('json-stringify-safe');
var Through = require('through2');

module.exports = Through.ctor({ objectMode: true }, function (chunk, enc, next) {

    this.push(Stringify(chunk) + '\n');
    return next();
});
