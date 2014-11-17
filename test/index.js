// Load modules

var EventEmitter = require('events').EventEmitter;
var Fs = require('fs');
var Os = require('os');

var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var Hoek = require('hoek');
var GoodFile = require('..');


// Declare internals

var internals = {
    timeout: process.env.TIMEOUT || 1000,
    tempDir: Os.tmpDir()
};

internals.removeLog = function (path) {

    if (Fs.existsSync(path)) {
        Fs.unlinkSync(path);
    }
};


internals.getLog = function (path, callback) {

    Fs.readFile(path, { encoding: 'utf8' }, function (error, data) {

        if (error) {
            return callback(error);
        }

        var results = JSON.parse('[' + data.replace(/\n/g,',').slice(0,-1) + ']');
        callback(null, results);
    });
};

// Lab shortcuts

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

describe('GoodFile', function () {

    it('throws an error without using new', function (done) {

        expect(function () {

            var reporter = GoodFile('./fixtures', {});
        }).to.throw('GoodFile must be created with new');

        done();
    });

    it('throws an error if missing file', function (done) {

        expect(function () {

            var reporter = new GoodFile({});
        }).to.throw('file or directory must be specified as strings');

        done();
    });

    it('stop() ends the stream', function (done) {

        var file = Hoek.uniqueFilename(internals.tempDir);
        var reporter = new GoodFile({ request:  '*' }, { file: file });
        var ee = new EventEmitter();

        reporter.start(ee, function (error) {

            expect(error).to.not.exist();

            ee.emit('report', 'request', { id: 1, timestamp: Date.now() });

            reporter.stop();
            expect(reporter._writeStream.bytesWritten).to.equal(0);
            expect(reporter._writeStream.path).to.equal(file);
            expect(reporter._writeStream._writableState.ended).to.equal(true);

            internals.removeLog(reporter._writeStream.path);

            done();

        });

    });

    it('logs a stream error if it occurs', function (done) {

        var file = Hoek.uniqueFilename(internals.tempDir);
        var reporter = new GoodFile({ request:  '*' }, { file: file });
        var ee = new EventEmitter();
        var logError = console.error;

        console.error = function (value) {

            console.error = logError;
            expect(value.message).to.equal('mock error');
            internals.removeLog(reporter._writeStream.path);
            done();
        };

        reporter.start(ee, function (error) {

            expect(error).to.not.exist();
            reporter._writeStream.emit('error', new Error('mock error'));
        });
    });

    describe('start()', function () {

        it('properly sets up the path and file information if the file name is specified', function (done) {

            var file = Hoek.uniqueFilename(internals.tempDir);
            var reporter = new GoodFile({}, { file: file });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist();

                expect(reporter._writeStream.path).to.equal(file);

                internals.removeLog(reporter._writeStream.path);
                done();
            });
        });

        it('properly creates a random file if the directory option is specified', function (done) {

            var reporter = new GoodFile({}, { directory: internals.tempDir });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist();
                expect(/good-file-\d+-.+.log/g.test(reporter._writeStream.path)).to.be.true();

                internals.removeLog(reporter._writeStream.path);
                done();
            });
        });
    });

    describe('_report()', function () {

        it('writes to the current file and does not create a new one', function (done) {

            var file = Hoek.uniqueFilename(internals.tempDir);
            var reporter = new GoodFile({ request:  '*' }, { file: file });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist();
                expect(reporter._writeStream.path).to.equal(file);

                for (var i = 0; i < 20; ++i) {

                    ee.emit('report', 'request', { statusCode:200, id: i, tag: 'my test ' + i });
                }

                setTimeout(function () {

                    expect(error).to.not.exist();

                    expect(reporter._writeStream.bytesWritten).to.equal(900);
                    internals.removeLog(reporter._writeStream.path);

                    done();
                }, internals.timeout);
            });
        });

        it('handles circular references in objects', function (done) {

            var file = Hoek.uniqueFilename(internals.tempDir);
            var reporter = new GoodFile({ request: '*' }, { file: file });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exit;

                var data = {
                    id: 1,
                    timestamp: Date.now()
                };

                data._data = data;

                ee.emit('report', 'request', data);

                setTimeout(function() {

                    internals.getLog(reporter._writeStream.path, function (error, results) {

                        expect(error).to.not.exist();
                        expect(results.length).to.equal(1);
                        expect(results[0]._data).to.equal('[Circular ~]');

                        internals.removeLog(reporter._writeStream.path);

                        done();
                    });
                }, internals.timeout);
            });
        });

        it('can handle a large number of events', function (done) {

            var file = Hoek.uniqueFilename(internals.tempDir);
            var reporter = new GoodFile({ request: '*' }, { file: file });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist();
                expect(reporter._writeStream.path).to.equal(file);

                for (var i = 0; i <= 10000; i++) {
                    ee.emit('report', 'request', { id: i, timestamp: Date.now(), value: 'value for iteration ' + i });
                }
                setTimeout(function() {

                    reporter.stop();
                    expect(reporter._writeStream.bytesWritten).to.equal(727855);
                    internals.removeLog(reporter._writeStream.path);

                    done();
                }, internals.timeout);
            });
        });

        it('will log events even after a delay', function (done) {

            var file = Hoek.uniqueFilename(internals.tempDir);
            var reporter = new GoodFile({ request: '*' }, { file: file });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist();
                expect(reporter._writeStream.path).to.equal(file);

                for (var i = 0; i <= 100; i++) {
                    ee.emit('report', 'request', { id: i, timestamp: Date.now(), value: 'value for iteration ' + i });
                }

                setTimeout(function() {

                    for (var i = 0; i <= 100; i++) {
                        ee.emit('report', 'request', { id: i, timestamp: Date.now(), value: 'inner iteration ' + i });
                    }

                    setTimeout(function() {

                        reporter.stop();
                        expect(reporter._writeStream.bytesWritten).to.equal(13498);
                        internals.removeLog(reporter._writeStream.path);
                        done();
                    }, internals.timeout);

                }, 100);
            });
        });
    });
});
