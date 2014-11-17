// Load modules

var Crypto = require('crypto');
var Fs = require('fs');
var Path = require('path');
var Stream = require('stream');

var GoodReporter = require('good-reporter');
var Hoek = require('hoek');
var Stringify = require('json-stringify-safe');

// Declare internals

var internals = {
    defaults: {}
};


internals.buildWriteStream = function (emitter, handler, path) {


    var result = Fs.createWriteStream(path, { flags: 'a', end: false });

    result.once('error', function (err) {

        // Remove the listener for the report event
        emitter.removeListener('report', handler);

        console.error(err);
    });

    return result;
};


module.exports = internals.GoodFile = function (events, options) {

    options = options || {};

    Hoek.assert(this.constructor === internals.GoodFile, 'GoodFile must be created with new');
    Hoek.assert(typeof options.file === 'string' || typeof options.directory ==='string', 'file or directory must be specified as strings');

    var settings = Hoek.applyToDefaults(internals.defaults, options);


    if (settings.file) {

        delete settings.directory;
        this.getFile = function () {

            return settings.file;
        };
    }
    else {

        this.getFile = function () {

            var name = ['good-file', Date.now(), Crypto.randomBytes(8).toString('hex')].join('-') + '.log';

            return Path.join(settings.directory, name);
        };
    }

    GoodReporter.call(this, events, settings);

    this._state = {};
};


Hoek.inherits(internals.GoodFile, GoodReporter);


internals.GoodFile.prototype.start = function (emitter, callback) {

    this._state.eventHandler = this._handleEvent.bind(this);
    emitter.on('report', this._state.eventHandler);

    this._readableStream = new Stream.Readable();

    this._readableStream._read = Hoek.ignore;

    this._writeStream = internals.buildWriteStream(emitter, this._state.eventHandler, this.getFile());
    this._readableStream.pipe(this._writeStream);

    callback();
};


internals.GoodFile.prototype.stop = function () {

    this._readableStream.push(null);
    this._writeStream.end();
};


internals.GoodFile.prototype._report = function (event, eventData) {

    var eventString = Stringify(eventData) + '\n';
    this._readableStream.push(eventString);
};