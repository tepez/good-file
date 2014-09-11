var Lab = require('lab');
var lab = exports.lab = Lab.script();
var GoodFile = require('..');

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var expect = Lab.expect;

describe('good-file', function () {

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

    describe('#start', function () {

        it('properly sets up the path and file information if the file name is specified', function (done) {

            var reporter = new GoodFile({
                path:'./test/fixtures/good_log'
            });

            reporter.start(function (error) {

                expect(error).to.not.exist;

                expect(reporter._nextFile).to.contain('/test/fixtures/good_log.002');
                done();
            });
        });

        it('properly sets up the path and file information if only a path is specified', function (done) {

            var reporter = new GoodFile({
                path:'./test/fixtures/'
            });

            reporter.start(function (error) {

                expect(error).to.not.exist;

                var next = reporter._nextFile;

                expect(/\d+\.002/g.test(next)).to.equal(true);
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
});
