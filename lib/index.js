// Load modules

var Hoek = require('hoek');
var GoodReporter = require('good-reporter');
var Fs = require('fs');
var Async = require('async');
var Path = require('path');
var Stringify = require('json-stringify-safe');

// Declare internals

var internals = {
	defaults: {
		maxLogSize: Infinity,
		events: {
			request: [],
			log: []
		}
	}
};

internals.nextFileNumber = function (startIndex) {

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

internals.getFileObject = function (path) {

	return Fs.createWriteStream(path, { flags: 'a'});
};

module.exports = internals.GoodFile = function (options) {

	Hoek.assert(this.constructor === internals.GoodFile, 'GoodReporter must be created with new');
	Hoek.assert(options.path, 'path must be specified');

	var settings = Hoek.clone(options);
	settings = Hoek.applyToDefaults(internals.defaults, settings);

	GoodReporter.call(this, settings);

	if (settings.path[settings.path.length -1] === '/') {
		this._directory = settings.path.slice(0, -1);
		this._getFileName = internals.dateTimefile.bind(this, Path.resolve(this._directory));
	}
	else {
		this._directory = Path.dirname(settings.path);
		this._getFileName = internals.namedFile.bind(this, Path.resolve(this._directory), Path.basename(settings.path));
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

		self._nextNumber = internals.nextFileNumber(extNum);
		self._currentStream = internals.getFileObject(self._getFileName(self._nextNumber()));

		callback(null);
	});
};


internals.GoodFile.prototype.stop = function (callback) {

	this._currentStream.end();
	callback(null);
}


internals.GoodFile.prototype.report = function (callback) {

	var self = this;

	Async.eachSeries(this._eventQueue, function (item, callback) {
		var eventString = Stringify(item);
		var data = new Buffer(eventString + '\n');
		var bytes = data.length;

		// If it does not fit, create a new file/stream
		if (self._currentStream.bytesWritten >= self._settings.maxLogSize) {

			// End the previous stream
			self._currentStream.end();

			var nextLog = self._getFileName(self._nextNumber());
			self._currentStream = internals.getFileObject(nextLog);
		}

		return self._currentStream.write(data, callback);

	}, function (error) {
		if (error) {
			return callback(error);
		}

		self._eventQueue.length = 0;
		callback(null);
	});
}
