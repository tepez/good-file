// Load modules

var EventEmitter = require('events').EventEmitter;
var Fs = require('fs');
var Async = require('async');
var Hoek = require('hoek');
var Writable = require('stream').Writable;
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var GoodFile = require('..');

// Declare internals

var internals = {};

internals.removeLog = function (path) {

    Fs.unlinkSync(path);
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

describe('GoodFile', function () {

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

    it('stop() ends the stream and kills the queue', function (done) {

        var file = Hoek.uniqueFilename('./test/fixtures');
        var reporter = new GoodFile(file, {
            events: {
                request:  '*'
            }
        });
        var ee = new EventEmitter();

        reporter.start(ee, function (error) {

            expect(error).to.not.exist;

            ee.emit('report', 'request', { id: 1, timestamp: Date.now() });

            reporter.stop();
            expect(reporter._currentStream.bytesWritten).to.equal(0);
            expect(reporter._currentStream.path).to.contain(file +  '.001');
            expect(reporter._currentStream._writableState.ended).to.equal(true);
            expect(reporter._queue.running()).to.equal(0);

            internals.removeLog(reporter._currentStream.path);

            done();

        });

    });

    describe('start()', function () {

        it('properly sets up the path and file information if the file name is specified', function (done) {

            var file = Hoek.uniqueFilename('./test/fixtures');
            var reporter = new GoodFile(file);
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;

                expect(reporter._currentStream.path).to.contain(file);

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
                expect(/\d+\.good/g.test(path)).to.equal(true);

                internals.removeLog(path);

                done();
            });
        });

        it('will callback with an error if it occurs', function (done) {

            var reporter = new GoodFile('./this/is/fake');
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.exist;
                done();
            });
        });

        it('ignores files with non-numerical extensions that match the file name', function (done) {

            var file = Hoek.uniqueFilename('./test/fixtures');
            Fs.writeFileSync(file + '.fake', 'dummy log data for testing');
            var ee = new EventEmitter();

            var reporter = new GoodFile(file, {
                events: {
                    request: '*'
                }
            });

            reporter.start(ee, function (err) {

                expect(err).to.not.exist;

                expect(reporter._currentStream.path).to.equal(file + '.001');
                internals.removeLog(reporter._currentStream.path);
                internals.removeLog(file + '.fake');
                done();
            });
        });
    });

    describe('_report()', function () {

        it('writes to the current file and does not create a new one', function (done) {

            var file = Hoek.uniqueFilename('./test/fixtures');
            var reporter = new GoodFile(file, {
                events: {
                  request:  '*'
                }
            });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._currentStream.path).to.equal(file + '.001');

                for (var i = 0; i < 20; ++i) {

                    ee.emit('report', 'request', { statusCode:200, id: i, tag: 'my test ' + i });
                }

                setTimeout(function () {

                    expect(error).to.not.exist;

                    expect(reporter._currentStream.bytesWritten).to.equal(900);
                    expect(reporter._currentStream._good.length).to.equal(900);
                    expect(reporter._currentStream.path).to.equal(file + '.001');
                    internals.removeLog(reporter._currentStream.path);

                    done();
                }, 2000);
            });
        });

        it('creates new log files if the maxsize is exceeded', function (done) {

            var file = Hoek.uniqueFilename('./test/fixtures');
            var reporter = new GoodFile(file, {
                events: {
                    request:  '*'
                },
                maxLogSize: 300
            });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._currentStream.path).to.equal(file + '.001');

                for (var i = 0; i < 20; ++i) {
                    ee.emit('report', 'request', { statusCode:200, id: i, tag: 'my test ' + i });
                }

                setTimeout(function () {

                    expect(reporter._currentStream.bytesWritten).to.equal(92);
                    expect(reporter._currentStream._good.length).to.equal(92);
                    expect(reporter._currentStream.path).to.equal(file + '.004');

                    internals.removeLog(file + '.001');
                    internals.removeLog(file + '.002');
                    internals.removeLog(file + '.003');
                    internals.removeLog(file + '.004');

                    done();

                }, 2000);
            });
        });

        it('create a new log file next in the sequence if existing log files are present', function (done) {

            var file = Hoek.uniqueFilename('./test/fixtures');
            Fs.writeFileSync(file + '.001', 'dummy log data for testing');
            var reporter = new GoodFile(file, {
                events: {
                    request: '*'
                }
            });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._currentStream.path).to.equal(file + '.002');

                for (var i = 0; i < 20; ++i) {
                    ee.emit('report', 'request', { statusCode:200, id: i });
                }

                setTimeout(function() {

                    expect(reporter._currentStream.bytesWritten).to.equal(530);
                    expect(reporter._currentStream._good.length).to.equal(530);
                    expect(reporter._currentStream.path).to.equal(file + '.002');

                    internals.removeLog(file + '.001');
                    internals.removeLog(file + '.002');

                    done();

                }, 2000);
            });
        });

        it('handles circular references in objects', function (done) {

            var file = Hoek.uniqueFilename('./test/fixtures')
            var reporter = new GoodFile(file, {
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
                }, 2000);
            });
        });

        it('uses the file name and extension in calculating the next file', function (done) {

            var file1 = Hoek.uniqueFilename('./test/fixtures');
            var file2 = Hoek.uniqueFilename('./test/fixtures');
            var ee1 = new EventEmitter();
            var ee2 = new EventEmitter();

            Fs.writeFileSync(file1 + '.010', 'dummy log data for testing');
            var reporter = new GoodFile(file1);
            var reporterTwo = new GoodFile(file2);

            reporter.start(ee1, function() {

                reporterTwo.start(ee2, function () {

                    ee1.emit('report', 'request', { id: 1, data: 'reporter 1' });
                    ee2.emit('report', 'request', { id: 2, data: 'reporter 2' });
                    ee2.emit('report', 'request', { id: 3, data: 'reporter 2' });

                    setTimeout(function() {

                        expect(reporter._currentStream.path).to.equal(file1 + '.011');
                        expect(reporter._currentStream.bytesWritten).to.equal(29);
                        expect(reporter._currentStream._good.length).to.equal(29);

                        expect(reporterTwo._currentStream.path).to.contain(file2 + '.001');
                        expect(reporterTwo._currentStream.bytesWritten).to.equal(58);
                        expect(reporterTwo._currentStream._good.length).to.equal(58);

                        internals.removeLog(reporterTwo._currentStream.path);
                        internals.removeLog(reporter._currentStream.path);
                        internals.removeLog(file1 + '.010');

                        done();

                    }, 2000);
                });
            });
        });

        it('can handle a large number of events without building back-pressure on the WriteStream', function (done) {

            var file = Hoek.uniqueFilename('./test/fixtures')
            var reporter = new GoodFile(file, {
                events: {
                    request: '*'
                }
            });
            var ee = new EventEmitter();
            var drain = false;
            var writeCount = 0;
            var write = Writable.prototype.write;

            Writable.prototype.write = function (chunk, encoding) {

                writeCount++;
                if (writeCount == 10000) {
                    reporter._currentStream.end();
                    internals.removeLog(reporter._currentStream.path);
                    expect(reporter._currentStream._good.length).to.equal(727707);
                    Writable.prototype.write = write;

                    return done();
                }
                return write.call(this, chunk, encoding);
            };


            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._currentStream.path).to.equal(file + '.001');

                reporter._currentStream.on('drain', function () {

                    drain = true;
                    expect(reporter._queue.paused).to.be.true;
                });

                for (var i = 0; i <= 10000; i++) {
                    ee.emit('report', 'request', { id: i, timestamp: Date.now(), value: 'value for iteration ' + i });
                }
            });
        });

        it('rotates log files based on the rotationTime option', function (done) {

            var reporter = new GoodFile('./test/fixtures/', {
                events: {
                    request:  '*'
                },
                rotationTime:.00001

            });
            var ee = new EventEmitter();

            reporter.start(ee, function (error) {

                expect(error).to.not.exist;
                expect(reporter._settings.rotationTime).to.exist;

                for (var i = 0; i < 10; ++i) {

                    ee.emit('report', 'request', { statusCode:200, id: i, tag: 'my test ' + i });
                }

                setTimeout(function () {

                    for (var j = 0; j < 10; ++j) {

                        ee.emit('report', 'request', { statusCode:200, id: j, tag: 'my test after 1000' + j });
                    }
                }, 900);

                setTimeout(function () {

                    expect(error).to.not.exist;

                    reporter.stop();

                    Fs.readdir('./test/fixtures', function (err, filenames) {

                        var i = 0;
                        filenames = filenames.filter(function (item) {

                            return item.indexOf('not_a_log') === -1;
                        });

                        expect(filenames.length).to.equal(3);

                        // Since they are time based, order them, oldest to newest
                        filenames.sort(function (a, b) {

                            return parseInt(a, 10) - parseInt(b, 10);
                        });

                        Async.eachSeries(filenames, function (item, next) {

                            var path = './test/fixtures/' + item;

                            internals.getLog(path, function (err, log) {

                                expect(err).to.not.exist;

                                if (i === 0) {
                                    expect(log).to.deep.equal([
                                        {statusCode:200,id:0,tag:"my test 0"},
                                        {statusCode:200,id:1,tag:"my test 1"},
                                        {statusCode:200,id:2,tag:"my test 2"},
                                        {statusCode:200,id:3,tag:"my test 3"},
                                        {statusCode:200,id:4,tag:"my test 4"},
                                        {statusCode:200,id:5,tag:"my test 5"},
                                        {statusCode:200,id:6,tag:"my test 6"},
                                        {statusCode:200,id:7,tag:"my test 7"},
                                        {statusCode:200,id:8,tag:"my test 8"},
                                        {statusCode:200,id:9,tag:"my test 9"}
                                    ]);
                                } else if (i === 1) {
                                    expect(log).to.deep.equal([
                                        {statusCode:200,id:0,tag:"my test after 10000"},
                                        {statusCode:200,id:1,tag:"my test after 10001"},
                                        {statusCode:200,id:2,tag:"my test after 10002"},
                                        {statusCode:200,id:3,tag:"my test after 10003"},
                                        {statusCode:200,id:4,tag:"my test after 10004"},
                                        {statusCode:200,id:5,tag:"my test after 10005"},
                                        {statusCode:200,id:6,tag:"my test after 10006"},
                                        {statusCode:200,id:7,tag:"my test after 10007"},
                                        {statusCode:200,id:8,tag:"my test after 10008"},
                                        {statusCode:200,id:9,tag:"my test after 10009"}
                                    ]);
                                } else {
                                    expect(log).to.be.empty;
                                }

                                i++;

                                Fs.unlink(path, next);
                            });
                        }, done);
                    });
                }, 2000);
            });
        });
    });
});
