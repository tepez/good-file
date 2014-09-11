// Load modules

var Hoek = require('hoek');
var GoodReporter = require('good-reporter');
var Fs = require('fs');
var Async = require('async');
var Path = require('path');

// Declare internals

var internals = {
    defaults: {
        maxLogSize: 0,
        events: {
            request: [],
            log: []
        }
    }
};


internals.nextNumber = function (startIndex) {

    return function () {
        startIndex++;
        var s = "0000" + startIndex;
        return s.substr(s.length-3);
    };
};


internals.dateTimefile = function (path, number) {

    return Path.join(path, Date.now() + '.' + number);
};

internals.namedFile = function (path, name, number) {

    return Path.join(path, name + '.' + number);
};

module.exports = internals.GoodFile = function (options) {

    Hoek.assert(this.constructor === internals.GoodFile, 'GoodReporter must be created with new');
    Hoek.assert(options.path, 'path must be specified');

    var settings = Hoek.clone(options);
    settings = Hoek.applyToDefaults(internals.defaults, settings);

    var events = settings.events;
    this._events = GoodReporter.buildSubscription(events);
    delete settings.events;

    this._eventQueue = [];
    this._settings = settings;

    if (settings.path[settings.path.length -1] === '/') {
        this._directory = settings.path.slice(0, -1);
        this._getNextFile = internals.dateTimefile.bind(this, Path.resolve(this._directory));
    }
    else {
        this._directory = Path.dirname(settings.path);
        this._getNextFile = internals.namedFile.bind(this, Path.resolve(this._directory), Path.basename(settings.path));
    }

    this._resolvedPath = Path.resolve(this._directory);

};

Hoek.inherits(internals.GoodFile, GoodReporter);

internals.GoodFile.prototype.start = function (callback) {

    var self = this;
    var path = this._settings.path;

    Fs.readdir(this._directory, function (err, filenames) {

        if (err) {
            return callback(err);
        }

        var extNum = 0;
        filenames.forEach(function (filename) {
            var fileExtNum = parseInt(Path.extname(filename).substr(1), 10) || -1;
            extNum = Math.max(fileExtNum, extNum);
        });

        self._nextNumber = internals.nextNumber(extNum);
        self._nextFile = self._getNextFile(self._nextNumber());

        callback(null);
    });
};