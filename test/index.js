// Load modules

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var GoodFile = require('..');
var Fs = require('fs');
var Writable = require('stream').Writable

// Declare internals

var internals = {};

internals.removeLog = function (path) {
	Fs.unlinkSync(path);
};

// Lab shortcuts

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var expect = Lab.expect;

describe('good-file', function () {

// beforeEach(function (done) {
//
// 	Fs.truncate('./test/fixtures/good_log.001', 0, done);
// });

	it('throws an error without using new', function(done) {

		expect(function () {

			var reporter = GoodFile({
				path: './fixtures'
			});
		}).to.throw('GoodReporter must be created with new');

		done();
	});

	it('throws an error if missing path', function (done) {

		expect(function () {
			var reporter = new GoodFile({});
		}).to.throw('path must be specified');

		done();
	});

	it('#stop ends the stream', function(done) {

		var reporter = new GoodFile({
			path:'./test/fixtures/good_log',
			events: {
				request:[]
			}
		});

		reporter.start(function (error) {

			expect(error).to.not.exist;
			expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.001');

			reporter.stop(function (error) {

				expect(error).to.not.exist;
				expect(reporter._currentStream.bytesWritten).to.equal(0);
				expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.001');
				expect(reporter._currentStream._writableState.ended).to.equal(true);

				internals.removeLog(reporter._currentStream.path);

				done();
			});
		});

	});

	describe('#start', function () {

		it('properly sets up the path and file information if the file name is specified', function (done) {

			var reporter = new GoodFile({
				path:'./test/fixtures/good_log'
			});

			reporter.start(function (error) {

				expect(error).to.not.exist;

				expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.001');
				internals.removeLog(reporter._currentStream.path);
				done();
			});
		});

		it('properly sets up the path and file information if only a path is specified', function (done) {

			var reporter = new GoodFile({
				path:'./test/fixtures/'
			});

			reporter.start(function (error) {

				expect(error).to.not.exist;

				var path = reporter._currentStream.path;
				expect(/\d+\.001/g.test(path)).to.equal(true);

				internals.removeLog(path);

				done();
			});
		});

		it('will callback with an error if it occurs', function (done) {

			var reporter = new GoodFile({
				path: './test/foobar/'
			});

			reporter.start(function (error) {

				expect(error).to.exist;
				done();
			});
		});
	});

	describe('#report', function () {

		it('writes to the current file and does not create a new one', function (done) {

			var reporter = new GoodFile({
				path:'./test/fixtures/good_log',
				events: {
				  request:[]
				}
			});

			reporter.start(function (error) {

				expect(error).to.not.exist;
				expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.001');

				for (var i = 0; i < 20; ++i) {
					reporter.queue('request',{ statusCode:200, id: i })
				}

				reporter.report(function (error) {

					expect(error).to.not.exist;

					expect(reporter._currentStream.bytesWritten).to.equal(530);
					expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.001');

					expect(reporter._eventQueue).to.be.empty;

					internals.removeLog(reporter._currentStream.path);

					done();
				});
			});
		});

		it('creates new log files if the maxsize is exceeded', function (done) {

			var reporter = new GoodFile({
				path:'./test/fixtures/good_log',
				events: {
					request:[]
				},
				maxLogSize: 200
			});

			reporter.start(function (error) {

				expect(error).to.not.exist;
				expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.001');

				for (var i = 0; i < 20; ++i) {
					reporter.queue('request', { statusCode:200, id: i })
				}

				reporter.report(function (error) {

					expect(error).to.not.exist;

					expect(reporter._currentStream.bytesWritten).to.equal(108);
					expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.003');

					expect(reporter._eventQueue).to.be.empty;

					internals.removeLog('./test/fixtures/good_log.002');
					internals.removeLog('./test/fixtures/good_log.003');
					internals.removeLog('./test/fixtures/good_log.001');

					done();
				});
			});
		});

		it('create a new log file next in the sequence if existing log files are present', function (done) {

			Fs.writeFileSync('./test/fixtures/good_log.001', 'dummy log data for testing')
			var reporter = new GoodFile({
				path:'./test/fixtures/good_log',
				events: {
					request:[]
				}
			});

			reporter.start(function (error) {

				expect(error).to.not.exist;
				expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.002');

				for (var i = 0; i < 20; ++i) {
					reporter.queue('request', { statusCode:200, id: i });
				}

				reporter.report(function (error) {

					expect(error).to.not.exist;

					expect(reporter._currentStream.bytesWritten).to.equal(530);
					expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.002');

					expect(reporter._eventQueue).to.be.empty;

					internals.removeLog('./test/fixtures/good_log.001');
					internals.removeLog('./test/fixtures/good_log.002');

					done();
				});
			});
		});
	});

	it('reports an error if it occurs', function (done) {

		var reporter = new GoodFile({
			path:'./test/fixtures/good_log',
			events: {
				request:[]
			}
		});

		reporter.start(function (error) {

			expect(error).to.not.exist;
			expect(reporter._currentStream.path).to.contain('/test/fixtures/good_log.001');

			reporter.queue('request', { statusCode:200, id: 10 });

			var write = Writable.prototype.write;

			Writable.prototype.write = function (data, callback) {

				callback(new Error('stream error'));
			};

			reporter.report(function (error) {

				expect(error).to.exist;
				expect(reporter._eventQueue.length).to.equal(1);

				Writable.prototype.write = write;

				internals.removeLog('./test/fixtures/good_log.001');

				done();
			});
		});
	});
});
