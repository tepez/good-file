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

internals.ThrottleRead = function (options) {

    Stream.Readable.call(this, options);
    this._eventQueue = [];
    this._reading = 0;
};

Hoek.inherits(internals.ThrottleRead, Stream.Readable);


internals.ThrottleRead.prototype._read = function (n) {

    this._reading += n;
    setImmediate(function(self) {

        self._doRead();
    }, this);
};


internals.ThrottleRead.prototype._doRead = function () {

    var n = this._reading;

    while (n >= 0) {
        var next = this._eventQueue.shift();
        if (!next) {
            this._reading = n;
            return;
        }

        n -= Buffer.byteLength(next);

        this.push(next);
    }

    this._reading = Math.max(n, 0);
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

    this._readableStream = new internals.ThrottleRead();
    this._writeStream = internals.buildWriteStream(emitter, this._state.eventHandler, this.getFile());
    this._readableStream.pipe(this._writeStream);

    callback();
};


internals.GoodFile.prototype.stop = function () {

    this._readableStream.unpipe();
    this._readableStream._doRead();
    this._writeStream.end();
};


internals.GoodFile.prototype._report = function (event, eventData) {

    var eventString = Stringify(eventData) + '\n';
    this._readableStream._eventQueue.push(eventString);

    // If we're receiving data and we haven't fulfilled the downstream
    // fs.writeStream quota, automatically push this data out
    if (this._readableStream._reading) {
        setImmediate(function (self) {

            self._doRead();
        }, this._readableStream);
    }
};