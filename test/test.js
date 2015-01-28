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
        var res = yield [b(), 456];
        assert.equal(res[0], 12);
        assert.equal(res[1], 456);
      }

      engen.run(a(), done);
    });

   xit('should not allow nested arrays of generators', function(done) {
      function *c() {
        return 23;
      }

      function *b() {
        return 12;
      }

      function *a() {
        var res = yield [b(), [c()]];
      }

      assert.throws(function() {
        engen.run(a(), done);
      }, Error);
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
        assert(/multiple errors/.test(err.message));
        assert(/Error: b/.test(err.message));
        assert(/Error: c/.test(err.message));
      });
    });
  });

});

