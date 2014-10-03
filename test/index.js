// Load modules

var EventEmitter = require('events').EventEmitter;
var Fs = require('fs');
var Crypto = require('crypto');
var Writable = require('stream').Writable;
var Hoek = require('hoek');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var GoodFile = require('..');

// Declare internals

var internals = {};

internals.removeLog = function (path) {

    Fs.unlinkSync(path);
};


internals.uniqueFile = function () {

    var name = [Date.now(), process.pid, Crypto.randomBytes(8).toString('hex')].join('-');
    return name;
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
var expect = Lab.expect;

describe('good-file', function () {

    it('throws an error without using new', function (done) {

        expect(function () {

            var reporter = GoodFile('./fixtures', {});
        }).to.throw('GoodFile must be created with new');

        done();
    });

    it('throws an error if missing path', function (done) {

        expect(function () {

            var reporter = new GoodFile({});
        }).to.throw('path must be a string');

        done();
    });

    it('stop() ends the stream', function (done) {

        var file = Hoek.uniqueFilename('./test/fixtures');
        var reporter = new GoodFile(file, {
            events: {
                request:  '*'
            }
        });
        var ee = new EventEmitter();

        reporter.start(ee, function (error) {

            expect(error).to.not.exist;
            expect(reporter._currentStream.path).to.contain(file +  '.001');

            reporter.stop();
            expect(reporter._currentStream.bytesWritten).to.equal(0);
            expect(reporter._currentStream.path).to.contain(file +  '.001');
            expect(reporter._currentStream._writableState.ended).to.equal(true);

            internals.removeLog(reporter._currentStream.path);

            done();

        });

    });

    describe('start()', function () {

        it('properly sets up the path and file information if the file name is specified', function (done) {

            var file = internals.uniqueFile();
            var reporter = new GoodFile('./test/fixtures/' + file);
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;

                internals.removeLog(reporter._currentStream.path);
                done();
            });
        });

        it('properly sets up the path and file information if only a path is specified', function (done) {

            var reporter = new GoodFile('./test/fixtures/');
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;

                var path = reporter._currentStream.path;
                expect(/\d+\.001/g.test(path)).to.equal(true);

                internals.removeLog(path);

                done();
            });
        });

        it('will callback with an error if it occurs', function (done) {

            var reporter = new GoodFile('./test/foobar/');
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.exist;
                done();
            });
        });
    });

    describe('report()', function () {

        it('writes to the current file and does not create a new one', function (done) {

            var file = internals.uniqueFile();
            var reporter = new GoodFile('./test/fixtures/' + file, {
                events: {
                  request:  '*'
                }
            });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._currentStream.path).to.contain('/test/fixtures/' + file + '.001');

                for (var i = 0; i < 20; ++i) {

                    ee.emit('report', 'request', { statusCode:200, id: i, tag: 'my test ' + i });
                }

                setTimeout(function () {

                    expect(error).to.not.exist;

                    expect(reporter._currentStream.bytesWritten).to.equal(900);
                    expect(reporter._currentStream.path).to.contain('/test/fixtures/' + file + '.001');
                    internals.removeLog(reporter._currentStream.path);

                    done();
                }, 1000);
            });
        });

        it('creates new log files if the maxsize is exceeded', function (done) {

            var file = internals.uniqueFile();
            var reporter = new GoodFile('./test/fixtures/' + file, {
                events: {
                    request:  '*'
                },
                maxLogSize: 300
            });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._currentStream.path).to.contain('/test/fixtures/' + file + '.001');

                for (var i = 0; i < 20; ++i) {
                    ee.emit('report', 'request', { statusCode:200, id: i, tag: 'my test ' + i });
                }

                setTimeout(function () {

                    expect(reporter._currentStream.bytesWritten).to.equal(92);
                    expect(reporter._currentStream.path).to.contain('/test/fixtures/' + file + '.004');

                    expect(reporter._eventQueue).to.be.empty;

                    internals.removeLog('./test/fixtures/' + file + '.001');
                    internals.removeLog('./test/fixtures/' + file + '.002');
                    internals.removeLog('./test/fixtures/' + file + '.003');
                    internals.removeLog('./test/fixtures/' + file + '.004');

                    done();

                }, 1000);
            });
        });

        it('create a new log file next in the sequence if existing log files are present', function (done) {

            var file = internals.uniqueFile();
            Fs.writeFileSync('./test/fixtures/' + file + '.001', 'dummy log data for testing');
            var reporter = new GoodFile('./test/fixtures/' + file, {
                events: {
                    request: '*'
                }
            });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._currentStream.path).to.contain('/test/fixtures/' + file + '.002');

                for (var i = 0; i < 20; ++i) {
                    ee.emit('report', 'request', { statusCode:200, id: i });
                }

                setTimeout(function() {

                    expect(reporter._currentStream.bytesWritten).to.equal(530);
                    expect(reporter._currentStream.path).to.contain('/test/fixtures/' + file + '.002');

                    internals.removeLog('./test/fixtures/' + file + '.001');
                    internals.removeLog('./test/fixtures/' + file + '.002');

                    done();

                }, 1000);
            });
        });

        it('handles circular references in objects', function (done) {

            var file = internals.uniqueFile();
            var reporter = new GoodFile('./test/fixtures/' + file, {
                events: {
                    request: '*'
                }
            });
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

                    internals.getLog(reporter._currentStream.path, function (error, results) {

                        expect(error).to.not.exist;
                        expect(results.length).to.equal(1);
                        expect(results[0]._data).to.equal('[Circular ~]');

                        internals.removeLog(reporter._currentStream.path);

                        done();
                    });
                }, 1000);
            });
        });

        it('uses the file name and extension in calculating the next file', function (done) {

            var file1 = internals.uniqueFile();
            var file2 = internals.uniqueFile();
            var ee1 = new EventEmitter();
            var ee2 = new EventEmitter();

            Fs.writeFileSync('./test/fixtures/' + file1 + '.010', 'dummy log data for testing');
            var reporter = new GoodFile('./test/fixtures/' + file1);
            var reporterTwo = new GoodFile('./test/fixtures/' + file2);

            reporter.start(ee1, function() {

                reporterTwo.start(ee2, function () {

                    ee1.emit('report', 'request', { id: 1, data: 'reporter 1' });
                    ee2.emit('report', 'request', { id: 2, data: 'reporter 2' });
                    ee2.emit('report', 'request', { id: 3, data: 'reporter 2' });

                    setTimeout(function() {

                        expect(reporter._currentStream.path).to.contain('/test/fixtures/' + file1 + '.011');
                        expect(reporter._currentStream.bytesWritten).to.equal(29);

                        expect(reporterTwo._currentStream.path).to.contain('/test/fixtures/' + file2 + '.001');
                        expect(reporterTwo._currentStream.bytesWritten).to.equal(58);

                        internals.removeLog(reporterTwo._currentStream.path);
                        internals.removeLog(reporter._currentStream.path);
                        internals.removeLog('./test/fixtures/' + file1 + '.010');

                        done();

                    }, 1000);
                });
            });
        });
    });
});
