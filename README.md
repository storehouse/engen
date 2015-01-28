[![Build Status](https://travis-ci.org/storehouse/engen.svg?branch=master)](http://travis-ci.org/storehouse/engen)

engen
=====

Async control flow using pure ES6 generators.

API
---

### engen.run()

Run generator based code from callback-land.

```javascript
var engen = require('engen');

function *f() {
  yield engen.wait(2000);
  return 'done';
}

engen.run(f(), function(err, result) {
  if (err) return callback(err);
  console.log(result); // 'done'
});

```

### engen.wrap()

Wrap callback-style code and call it from generator-land.

```javascript
var engen = require('engen');

var wait = engen.wrap(function(time, cb) {
  return setTimeout(cb, time);
});

function *f() {
  yield wait(2000);
  return 'done';
}
```

### engen.wait()

Generator-based version of `setTimeout`, provided for convenience.

License
-------

MIT
