var engen = require('../index');
var assert = require('assert');

describe('engen.run()', function() {

  describe('basics', function() {

    it('should pass down arguments correctly', function(done) {
      function *b() {
        assert.deepEqual([].slice.apply(arguments), [12, 34, 56]);
      }

      function *a() {
        yield b(12, 34, 56);
      }

      engen.run(a(), done);
    });

    it('should pass return values back correctly', function(done) {
      function *b() {
        return 12;
      }

      function *a() {
        var x = yield b();
        assert.equal(x, 12);
      }

      engen.run(a(), done);
    });

    it('should pass return values all the way to the top', function() {
      function *b() {
        return 12;
      }

      function *a() {
        return yield b();
      }

      engen.run(a(), function(err, val) {
        assert.equal(val, 12);
      });
    });

    it('should allow calling without a callback', function() {
      function *b() {
        return 12;
      }

      function *a() {
        return yield b();
      }

      engen.run(a());
    });

    it('should allow calling with a function as first parameter', function() {
      function *b() {
        return 12;
      }

      function *a() {
        return yield b();
      }

      engen.run(a, function(err, value) {
        assert.equal(value, 12);
      });
    });
  });

  describe('parallel execution', function() {

    it('should execute arrays of generators in parallel', function(done) {
      this.timeout(40);

      function *c() {
        yield engen.wait(30);
        return 24;
      }

      function *b() {
        yield engen.wait(20);
        return 12;
      }

      function *a() {
        var res = yield [b(), c()];
        assert.equal(res[0], 12);
        assert.equal(res[1], 24);
      }

      engen.run(a(), done);
    });

    it('should execute objects of generators in parallel', function(done) {
      this.timeout(40);

      function *c() {
        yield engen.wait(30);
        return 24;
      }

      function *b() {
        yield engen.wait(20);
        return 12;
      }

      function *a() {
        var res = yield {b: b(), c: c()};
        assert.equal(res.b, 12);
        assert.equal(res.c, 24);
      }

      engen.run(a(), done);
    });


    it('should allow literal values in arrays', function(done) {
      function *b() {
        return 12;
      }

      function *a() {
        var res = yield [b(), 456, null];
        assert.deepEqual(res, [12, 456, null]);
      }

      engen.run(a(), done);
    });
  });

  describe('exception handling', function() {

    it('should bubble up exceptions to the callback', function() {
      function *b() {
        throw new Error('crap');
      }

      function *a() {
        yield b();
      }

      engen.run(a(), function(err) {
        assert(err);
      });
    });

    it('should allow catching exceptions', function() {
      function *b() {
        throw new Error('crap');
      }

      function *a() {
        try {
          yield b();
        } catch (err) {
          assert(err);
        }
      }

      engen.run(a(), function(err) {
        assert.ifError(err);
      });
    });

    it('should propagate single exceptions through parallel execution', function() {
      function *c() {
        return 12;
      }

      function *b() {
        throw new Error('crap');
      }

      function *a() {
        yield [b(), c()];
      }

      engen.run(a(), function(err) {
        assert(err);
        assert.equal(err.message, 'crap');
      });
    });

    it('should wrap multiple parallel exceptions', function() {
      function *c() {
        throw new Error('c');
      }

      function *b() {
        throw new Error('b');
      }

      function *a() {
        yield [b(), c()];
      }

      engen.run(a(), function(err) {
        assert(err);
        assert(/multiple errors/.test(err.message), err.message);
        assert(/Error: b/.test(err.message));
        assert(/Error: c/.test(err.message));
      });
    });

  });

  describe('helpful usage error messages', function() {

    it('should throw when calling run() with unexpected first argument', function() {
      assert.throws(
        function() {
          engen.run(123);
        },
        /argument to run\(\) must be/
      );
    });

    it('should throw when yielding non-generators', function() {

      function *a() {
        yield 123;
      }

      assert.throws(
        function() {
          engen.run(a());
        },
        /yielded something other than/
      );

      function *a() {
        yield null;
      }

      assert.throws(
        function() {
          engen.run(a());
        },
        /yielded something other than/
      );

    });

    xit('should throw when yielding a nested array of generators', function(done) {
      function *c() {
        return 23;
      }

      function *b() {
        return 12;
      }

      function *a() {
        yield [b(), [c()]];
      }

      assert.throws(
        function() {
          engen.run(a(), done);
        },
        /do not nest/
      );
    });

  });

});


describe('engen.wrap()', function() {

  describe('basics', function() {

    it('should allow wrapping a simple callback-based function', function(done) {

      var wait = engen.wrap(function(time, cb) {
        return setTimeout(cb, time);
      });

      var finished = false;

      function *a() {
        yield wait(20);
        finished = true;
      }

      engen.run(a(), function() {
        assert.equal(finished, true);
        done();
      });

      assert.equal(finished, false);

    });

    it('should support functions that finish synchronously', function(done) {

      var instant = engen.wrap(function(x, cb) {
        cb(null, x);
      });

      function *a() {
        var x = yield instant(20);
        return x;
      }

      engen.run(a(), function(err, x) {
        assert.equal(x, 20);
        done();
      });

    });

    it('should return first value from callbacks with multiple return values', function(done) {
      var b = engen.wrap(function(cb) {
        cb(null, 12, 34, 56);
      });

      function *a() {
        var res = yield b();
        assert.equal(res, 12);
        return res;
      }

      engen.run(a(), function(err, res) {
        assert.ifError(err);
        assert.equal(res, 12);
        done();
      });
    });

    it('should convert errors into exceptions', function() {

      var b = engen.wrap(function(cb) {
        cb(new Error('oops'));
      });

      function *a() {
        yield b();
      }

      engen.run(a(), function(err) {
        assert(err);
        assert(/oops/.test(err.message));
      });

    });

  });

  describe('callback wrapper', function() {

    it('should allow wrapping callbacks with multiple return values', function(done) {

      var b = engen.wrap(function(cb) {
        cb(null, 12, 34, 56);
      }, function(err, a, b, c) {
        if (err) throw err;
        return [a, b, c];
      });

      function *a() {
        var res = yield b();
        assert.deepEqual(res, [12, 34, 56]);
        return res;
      }

      engen.run(a(), function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res, [12, 34, 56]);
        done();
      });

    });

    it('should allow wrapping callbacks without an error parameter', function(done) {

      var b = engen.wrap(function(cb) {
        cb(12, 34, 56);
      }, function(a, b, c) {
        return [a, b, c];
      });

      function *a() {
        var res = yield b();
        assert.deepEqual(res, [12, 34, 56]);
        return res;
      }

      engen.run(a(), function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res, [12, 34, 56]);
        done();
      });

    });

    it('should allow wrapping callbacks with multiple return values using multipleReturnCallback', function(done) {

      var b = engen.wrap(function(cb) {
        cb(null, 12, 34, 56);
      }, engen.multipleReturnCallback);

      function *a() {
        var res = yield b();
        assert.deepEqual(res, [12, 34, 56]);
        return res;
      }

      engen.run(a(), function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res, [12, 34, 56]);
        done();
      });

    });

    it('should allow wrapping callbacks without an error parameter using noErrorCallback', function(done) {

      var b = engen.wrap(function(cb) {
        cb(12);
      }, engen.noErrorCallback);

      function *a() {
        var res = yield b();
        assert.deepEqual(res, 12);
        return res;
      }

      engen.run(a(), function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res, 12);
        done();
      });

    });

    it('should allow wrapping callbacks with multiple return values an error parameter using multipleReturnNoErrorCallback', function(done) {

      var b = engen.wrap(function(cb) {
        cb(12, 34, 56);
      }, engen.multipleReturnNoErrorCallback);

      function *a() {
        var res = yield b();
        assert.deepEqual(res, [12, 34, 56]);
        return res;
      }

      engen.run(a(), function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res, [12, 34, 56]);
        done();
      });

    });

    it('should handle exceptions from wrapped callbacks', function(done) {

      var b = engen.wrap(function(cb) {
        cb(new Error('oops'), 12, 34, 56);
      }, function(err, a, b, c) {
        if (err) throw err;
        return [a, b, c];
      });

      function *a() {
        var res;
        try {
          res = yield b();
        } catch(err) {
          assert(err);
          assert(/oops/.test(err.message));
          throw err;
        }
        return res;
      }

      engen.run(a(), function(err/*, res*/) {
        assert(err);
        assert(/oops/.test(err.message));
        done();
      });

    });
  });

});
