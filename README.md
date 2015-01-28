[![Build Status](https://travis-ci.org/storehouse/engen.svg?branch=master)](http://travis-ci.org/storehouse/engen)

engen
=====

Async control flow using pure ES6 generators.

Requires ES6 generator support. Tested on Node 0.11 with the `--harmony` flag.

API
---

### engen.run()

Run generator based code from callback-land.

```javascript
var g = require('engen');

function *f() {
  yield g.wait(2000);
  return 'done';
}

g.run(f(), function(err, result) {
  console.log(err); // null
  console.log(result); // 'done'
});

```

### engen.wrap()

Wrap callback-style code and call it from generator-land.

```javascript
var g = require('engen');
var readFile = g.wrap(require('fs').readFile);

function *f() {
  yield g.wait(1000);
  return yield readFile('test.js');
}

g.run(f(), function(err, res) {
  console.log(err); // null
  console.log(res); // <Buffer ...>
});
```

### engen.wait()

Generator-based version of `setTimeout`, provided for convenience.

License
-------

MIT
