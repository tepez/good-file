// Load modules

var Fs = require('fs');
var Path = require('path');
var Async = require('async');
var GoodReporter = require('good-reporter');
var Hoek = require('hoek');
var Moment = require('moment');
var Stringify = require('json-stringify-safe');

// Declare internals

var internals = {
    defaults: {
        maxLogSize: Infinity,
        rotationTime: 0,
        extension: 'good',
        format: null
    },
    ONE_DAY: 86400000 // number of milliseconds in one day
};


internals.nextFileNumber = function (startIndex) {

    return function () {

        startIndex++;
        var s = "0000" + startIndex;
        return s.substr(s.length-3);
    };
};


internals.timeSequenceFile = function (path, extension, format) {

    var date;

    if (format) {
        date = Moment.utc().format(format);
    }
    else {
        date = Date.now();
    }

    return Path.join(path, date + '.' + extension);
};


internals.namedFile = function (path, name, number) {

    return Path.join(path, name + '.' + number);
};


internals.buildWriteStream = function (emitter, handler, path, queue) {

    var result = Fs.createWriteStream(path, { flags: 'a'});

    result.on('drain', function () {

        queue.resume();
    });

    result.once('error', function (err) {

        console.error(err);
        queue.kill();
        // Remove any listeners on this file stream
        result.removeAllListeners();
        // Remove the listener for the report event
        emitter.removeListener('report', handler);
    });

    result._good = {
        length: 0
    };

    return result;
};


module.exports = internals.GoodFile = function (path, events, options) {

    Hoek.assert(this.constructor === internals.GoodFile, 'GoodFile must be created with new');
    Hoek.assert(typeof path === 'string', 'path must be a string');

    var settings = options || {};
    settings = Hoek.applyToDefaults(internals.defaults, settings);

    GoodReporter.call(this, events, settings);

    this._directory = path[path.length -1] === '/' ? path.slice(0, -1) : Path.dirname(path);
    this._directory = Path.resolve(this._directory);
    this._state = {};

    if (settings.rotationTime) {
        settings.maxLogSize = Infinity;
        this._getFileName = internals.timeSequenceFile.bind(null, this._directory, settings.extension, settings.format);
    }
    else if (path[path.length -1] === '/') {
        this._getFileName = internals.timeSequenceFile.bind(null, this._directory, settings.extension, settings.format);
    }
    else {
        this._fileName = Path.basename(path);
        this._getFileName = internals.namedFile.bind(this, this._directory, this._fileName);
    }
};


Hoek.inherits(internals.GoodFile, GoodReporter);


internals.GoodFile.prototype.start = function (emitter, callback) {

    var self = this;

    self._state.eventHandler = self._handleEvent.bind(self);
    emitter.on('report', self._state.eventHandler);

    var buildWriteStream = internals.buildWriteStream.bind(null, emitter, self._state.eventHandler);

    self._queue = Async.queue(function (data, next) {

        if (self._currentStream._good.length + data.bytes >= self._settings.maxLogSize) {
            self._currentStream.removeAllListeners('drain');
            self._currentStream.end();

            var fileName = self._getFileName(self._nextNumber());
            self._currentStream = buildWriteStream(fileName, self._queue);
        }

        if (!self._currentStream.write(data.event)) {
            self._queue.pause();
        }

        self._currentStream._good.length += data.bytes;

        next();
    }, 10);

    if (!self._fileName) {

        var fileName = self._getFileName();
        self._currentStream = buildWriteStream(fileName, self._queue);

        // If it's a log that rotates on a timer, we don't need to do anything other than
        // set up that timer.
        if (self._settings.rotationTime) {
            self._state.interval = setInterval(function () {

                var fileName = self._getFileName();
                self._currentStream = buildWriteStream(fileName, self._queue);
            }, Math.floor(self._settings.rotationTime * internals.ONE_DAY));
        }
        return process.nextTick(callback);
    }


    Fs.readdir(this._directory, function (err, filenames) {

        if (err) {
            return callback(err);
        }

        var extNum = 0;
        filenames.forEach(function (filename) {

            if (filename.indexOf(self._fileName) > -1) {
                var fileExtNum = parseInt(Path.extname(filename).substr(1), 10) || -1;
                extNum = Math.max(fileExtNum, extNum);
            }
        });

        self._nextNumber = internals.nextFileNumber(extNum);

        var nextSequence = self._nextNumber();
        var fileName = self._getFileName(nextSequence);
        self._currentStream = buildWriteStream(fileName, self._queue);

        callback(null);
    });
};


internals.GoodFile.prototype.stop = function () {

    clearInterval(this._state.interval);
    this._currentStream.end();
    this._queue.kill();
};


internals.GoodFile.prototype._report = function (event, eventData) {


    var eventString = Stringify(eventData);
    var data = new Buffer(eventString + '\n');

    this._queue.push({
        event: data,
        bytes: data.length
    });
};