// Load modules

var Crypto = require('crypto');
var Fs = require('fs');
var Path = require('path');
var Stream = require('stream');

var GoodReporter = require('good-reporter');
var Hoek = require('hoek');
var Joi = require('joi');
var Moment = require('moment');
var Stringify = require('json-stringify-safe');

var Schema = require('./schema');

// Declare internals

var internals = {
    defaults: {
        directory: {
            format: 'YYYY-MM-DD',
            extension: '.log',
            prefix: 'good-file'
        }
    }
};

internals.sanitize = new RegExp(Path.sep, 'g');


internals.buildWriteStream = function (emitter, handler, path) {


    var result = Fs.createWriteStream(path, { flags: 'a', end: false });

    result.once('error', function (err) {

        // Remove the listener for the report event
        emitter.removeListener('report', handler);

        console.error(err);
    });

    return result;
};


module.exports = internals.GoodFile = function (configuration, events) {

    var settings;

    configuration = configuration || false;

    Hoek.assert(this.constructor === internals.GoodFile, 'GoodFile must be created with new');

    Joi.assert(configuration, Schema.options);

    if (typeof configuration === 'string') {
        settings = {
            file: configuration
        };
    }
    else {
        settings = Hoek.applyToDefaults(internals.defaults.directory, configuration);
    }

    if (settings.file) {

        this.getFile = function () {

            return settings.file;
        };
    }
    else {

        settings.extension = settings.extension[0] === '.' ? settings.extension : '.' + settings.extension;

        // Replace any path separators with a "-"
        settings.format = settings.format.replace(internals.sanitize, '-');
        settings.prefix = settings.prefix.replace(internals.sanitize, '-');
        settings.extension = settings.extension.replace(internals.sanitize, '-');

        this.getFile = function () {

            var dateString = Moment.utc().format(settings.format);
            var name = [settings.prefix, dateString, Crypto.randomBytes(5).toString('hex')].join('-') + settings.extension;

            return Path.join(settings.path, name);
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

    this._stopped = false;

    callback();
};


internals.GoodFile.prototype.stop = function () {

    // Prevent in-flight events from being written
    this._stopped = true;
    this._readableStream.push(null);
};


internals.GoodFile.prototype._report = function (event, eventData) {

    if (this._stopped) { return; }

    var eventString = Stringify(eventData) + '\n';
    this._readableStream.push(eventString);
};
