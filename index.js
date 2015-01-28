function ResumeHandler() {}

function isGenerator(v) {
  return v && v.constructor && v.constructor.name == 'GeneratorFunction';
}

function isGeneratorProto(v) {
  return v && v.constructor && v.constructor.name == 'GeneratorFunctionPrototype';
}

function step(iterator, error, returnValues, next) {
  var iteration;

  try {
    if (error) {
      iteration = iterator.throw.call(iterator, error);
    } else {
      iteration = iterator.next.apply(iterator, returnValues);
    }
  } catch (err) {
    return next(err);
  }

  var value = iteration.value;

  if (iteration.done) return next && next(null, value);

  if (value instanceof ResumeHandler) {
    value.resume = function(error) {
      setTimeout(step.bind(null, iterator, error, Array.prototype.slice.call(arguments, 1), next), 0);
    };
    iterator.next();
  } else if (isGeneratorProto(value)) {
    step(value, null, [], function(error) {
      step(iterator, error, Array.prototype.slice.call(arguments, 1), next);
    });
  } else if (typeof value == 'object') {
    var results = Array.isArray(value) ? [] : {};
    if (!Object.keys(value).length) {
      step(iterator, null, [results], next);
      return;
    }
    // jshint ignore:start
    var keys = Object.keys(value);
    var errors = [];
    var outstanding = keys.length;
    for (var i = 0, l = keys.length; i < l; i++) {
      if (!isGeneratorProto(value[keys[i]])) {
        results[keys[i]] = value[keys[i]];
        finish();
        continue;
      }
      step(value[keys[i]], null, [], function(n, error, result) {
        if (error) {
          errors.push(error);
        } else {
          results[keys[n]] = result;
        }
        finish();
      }.bind(null, i));
      function finish() {
        outstanding--;
        if (outstanding === 0) {
          if (errors.length === 1) {
            step(iterator, errors[0], [], next);
          } else if (errors.length > 1) {
            step(iterator, new Error('Parallel yield got multiple errors:\n' + errors.map(function(err) { return err.stack; }).join('\n')), [], next);
          } else {
            step(iterator, null, [results], next);
          }
        }
      }
    }
    // jshint ignore:end
  } else {
    throw new Error('Yielded something other than a generator, an array of generators, or a ResumeHandler: ' + value);
  }
}

var go = {};

go.run = function(generator, callback) {
  if (typeof generator === 'function') generator = generator();
  if (!isGeneratorProto(generator)) throw new Error('First argument to run() must be a generator or a generator function, got: ' + generator);
  step(generator, null, [], callback);
};

go.wrap = function(f) {
  return function* wrapper() {
    var args = Array.prototype.slice.call(arguments);
    var resumeHandler = new ResumeHandler();
    args.push(function() {
      if (!resumeHandler.resume) {
        throw new Error('Wrapped function returned before its resumeHandler was ready: ' + f);
      }
      resumeHandler.resume.apply(null, arguments);
    });
    yield resumeHandler;
    f.apply(this, args);
    return yield null;
  };
};

go.wait = go.wrap(function(interval, cb) {
  setTimeout(function() {
    cb();
  }, interval);
});

module.exports = go;
