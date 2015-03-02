function ResumeHandler() {}

function MultipleErrors(errors) {
  this.name = 'MultipleErrors';
  this.message = 'engen: parallel yield got multiple errors:\n' + errors.map(function(err) {
    var message = err instanceof Error ? err.message : JSON.stringify(err);
    return message + '\n\n' + err.stack;
  }).join('\n');
}

MultipleErrors.prototype = Object.create(Error.prototype);
MultipleErrors.prototype.constructor = MultipleErrors;

function isGeneratorProto(v) {
  return v && v.constructor && v.constructor.name == 'GeneratorFunctionPrototype';
}

function parallel(object, loop, callback) {
  var keys = Object.keys(object);
  var outstanding = keys.length;
  for (var i = 0, l = keys.length; i < l; i++) {
    loop(keys[i], object[keys[i]], done);
  }
  function done() {
    outstanding--;
    if (outstanding === 0) callback();
  }
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
  } else if (value !== null && typeof value == 'object') {
    var results = Array.isArray(value) ? [] : {};
    if (!Object.keys(value).length) {
      step(iterator, null, [results], next);
      return;
    }
    var errors = [];
    parallel(value, function(key, val, done) {
      if (!isGeneratorProto(val)) {
        results[key] = val;
        done();
      } else {
        step(val, null, [], function(error, result) {
          if (error) {
            errors.push(error);
          } else {
            results[key] = result;
          }
          done();
        });
      }
    }, function() {
      if (errors.length === 1) {
        step(iterator, errors[0], [], next);
      } else if (errors.length > 1) {
        step(iterator, new MultipleErrors(errors), [], next);
      } else {
        step(iterator, null, [results], next);
      }
    });
  } else {
    throw new Error('engen: yielded something other than a generator, an array of generators, or a ResumeHandler: ' + value);
  }
}

var engen = {};

engen.run = function(generator, callback) {
  if (typeof generator === 'function') {
    generator = generator();
  }
  if (!isGeneratorProto(generator)) {
    throw new Error('engen: first argument to run() must be a generator or a generator function, got: ' + generator);
  }
  step(generator, null, [], callback);
};

engen.wrap = function(f, callbackWrapper) {
  return function* wrapper() {
    var args = Array.prototype.slice.call(arguments);
    var resumeHandler = new ResumeHandler();
    args.push(function() {
      if (!resumeHandler.resume) {
        throw new Error('engen: wrapped function returned before its resumeHandler was ready: ' + f);
      }
      try {
        resumeHandler.resume.apply(null, callbackWrapper ? [null, callbackWrapper.apply(this, arguments)] : arguments);
      } catch(err) {
        resumeHandler.resume.call(null, err);
      }
    });
    yield resumeHandler;
    f.apply(this, args);
    return yield null;
  };
};

engen.multipleReturnCallback = function(err) {
  if (err) throw err;
  return Array.prototype.slice.call(arguments, 1);
};

engen.noErrorCallback = function(value) {
  return value;
};

engen.multipleReturnNoErrorCallback = function() {
  return Array.prototype.slice.call(arguments);
};

engen.wait = engen.wrap(function(interval, cb) {
  setTimeout(function() {
    cb();
  }, interval);
});

module.exports = engen;
