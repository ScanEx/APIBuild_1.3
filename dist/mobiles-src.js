(function () {
var define = null;
var buildDate = '2018-2-6 10:00:00';
var buildUUID = '521e7e92ce9c429c88f3ee557eedd891';
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   4.1.0+f046478d
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === GET_THEN_ERROR) {
      reject(promise, GET_THEN_ERROR.error);
      GET_THEN_ERROR.error = null;
    } else if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value.error = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      resolve(promise, value);
    } else if (failed) {
      reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator$1(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate(input);
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

Enumerator$1.prototype._enumerate = function (input) {
  for (var i = 0; this._state === PENDING && i < input.length; i++) {
    this._eachEntry(input[i], i);
  }
};

Enumerator$1.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$1 = c.resolve;

  if (resolve$$1 === resolve$1) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise$3) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$1) {
        return resolve$$1(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$1(entry), i);
  }
};

Enumerator$1.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator$1.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all$1(entries) {
  return new Enumerator$1(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race$1(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise$3(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise$3 ? initializePromise(this, resolver) : needsNew();
  }
}

Promise$3.all = all$1;
Promise$3.race = race$1;
Promise$3.resolve = resolve$1;
Promise$3.reject = reject$1;
Promise$3._setScheduler = setScheduler;
Promise$3._setAsap = setAsap;
Promise$3._asap = asap;

Promise$3.prototype = {
  constructor: Promise$3,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

/*global self*/
function polyfill$1() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise$3;
}

// Strange compat..
Promise$3.polyfill = polyfill$1;
Promise$3.Promise = Promise$3;

Promise$3.polyfill();

return Promise$3;

})));



(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ')
    preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status === undefined ? 200 : options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);


/* @preserve
 * Leaflet 1.3.1+Detached: ba6f97fff8647e724e4dfe66d2ed7da11f908989.ba6f97f, a JS library for interactive maps. http://leafletjs.com
 * (c) 2010-2017 Vladimir Agafonkin, (c) 2010-2011 CloudMade
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.L = {})));
}(this, (function (exports) { 'use strict';

var version = "1.3.1+HEAD.ba6f97f";

/*
 * @namespace Util
 *
 * Various utility functions, used by Leaflet internally.
 */

var freeze = Object.freeze;
Object.freeze = function (obj) { return obj; };

// @function extend(dest: Object, src?: Object): Object
// Merges the properties of the `src` object (or multiple objects) into `dest` object and returns the latter. Has an `L.extend` shortcut.
function extend(dest) {
	var i, j, len, src;

	for (j = 1, len = arguments.length; j < len; j++) {
		src = arguments[j];
		for (i in src) {
			dest[i] = src[i];
		}
	}
	return dest;
}

// @function create(proto: Object, properties?: Object): Object
// Compatibility polyfill for [Object.create](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/create)
var create = Object.create || (function () {
	function F() {}
	return function (proto) {
		F.prototype = proto;
		return new F();
	};
})();

// @function bind(fn: Function, …): Function
// Returns a new function bound to the arguments passed, like [Function.prototype.bind](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
// Has a `L.bind()` shortcut.
function bind(fn, obj) {
	var slice = Array.prototype.slice;

	if (fn.bind) {
		return fn.bind.apply(fn, slice.call(arguments, 1));
	}

	var args = slice.call(arguments, 2);

	return function () {
		return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
	};
}

// @property lastId: Number
// Last unique ID used by [`stamp()`](#util-stamp)
var lastId = 0;

// @function stamp(obj: Object): Number
// Returns the unique ID of an object, assigning it one if it doesn't have it.
function stamp(obj) {
	/*eslint-disable */
	obj._leaflet_id = obj._leaflet_id || ++lastId;
	return obj._leaflet_id;
	/* eslint-enable */
}

// @function throttle(fn: Function, time: Number, context: Object): Function
// Returns a function which executes function `fn` with the given scope `context`
// (so that the `this` keyword refers to `context` inside `fn`'s code). The function
// `fn` will be called no more than one time per given amount of `time`. The arguments
// received by the bound function will be any arguments passed when binding the
// function, followed by any arguments passed when invoking the bound function.
// Has an `L.throttle` shortcut.
function throttle(fn, time, context) {
	var lock, args, wrapperFn, later;

	later = function () {
		// reset lock and call if queued
		lock = false;
		if (args) {
			wrapperFn.apply(context, args);
			args = false;
		}
	};

	wrapperFn = function () {
		if (lock) {
			// called too soon, queue to call later
			args = arguments;

		} else {
			// call and lock until later
			fn.apply(context, arguments);
			setTimeout(later, time);
			lock = true;
		}
	};

	return wrapperFn;
}

// @function wrapNum(num: Number, range: Number[], includeMax?: Boolean): Number
// Returns the number `num` modulo `range` in such a way so it lies within
// `range[0]` and `range[1]`. The returned value will be always smaller than
// `range[1]` unless `includeMax` is set to `true`.
function wrapNum(x, range, includeMax) {
	var max = range[1],
	    min = range[0],
	    d = max - min;
	return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
}

// @function falseFn(): Function
// Returns a function which always returns `false`.
function falseFn() { return false; }

// @function formatNum(num: Number, digits?: Number): Number
// Returns the number `num` rounded to `digits` decimals, or to 6 decimals by default.
function formatNum(num, digits) {
	var pow = Math.pow(10, (digits === undefined ? 6 : digits));
	return Math.round(num * pow) / pow;
}

// @function trim(str: String): String
// Compatibility polyfill for [String.prototype.trim](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/Trim)
function trim(str) {
	return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

// @function splitWords(str: String): String[]
// Trims and splits the string on whitespace and returns the array of parts.
function splitWords(str) {
	return trim(str).split(/\s+/);
}

// @function setOptions(obj: Object, options: Object): Object
// Merges the given properties to the `options` of the `obj` object, returning the resulting options. See `Class options`. Has an `L.setOptions` shortcut.
function setOptions(obj, options) {
	if (!obj.hasOwnProperty('options')) {
		obj.options = obj.options ? create(obj.options) : {};
	}
	for (var i in options) {
		obj.options[i] = options[i];
	}
	return obj.options;
}

// @function getParamString(obj: Object, existingUrl?: String, uppercase?: Boolean): String
// Converts an object into a parameter URL string, e.g. `{a: "foo", b: "bar"}`
// translates to `'?a=foo&b=bar'`. If `existingUrl` is set, the parameters will
// be appended at the end. If `uppercase` is `true`, the parameter names will
// be uppercased (e.g. `'?A=foo&B=bar'`)
function getParamString(obj, existingUrl, uppercase) {
	var params = [];
	for (var i in obj) {
		params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
	}
	return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
}

var templateRe = /\{ *([\w_-]+) *\}/g;

// @function template(str: String, data: Object): String
// Simple templating facility, accepts a template string of the form `'Hello {a}, {b}'`
// and a data object like `{a: 'foo', b: 'bar'}`, returns evaluated string
// `('Hello foo, bar')`. You can also specify functions instead of strings for
// data values — they will be evaluated passing `data` as an argument.
function template(str, data) {
	return str.replace(templateRe, function (str, key) {
		var value = data[key];

		if (value === undefined) {
			throw new Error('No value provided for variable ' + str);

		} else if (typeof value === 'function') {
			value = value(data);
		}
		return value;
	});
}

// @function isArray(obj): Boolean
// Compatibility polyfill for [Array.isArray](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray)
var isArray = Array.isArray || function (obj) {
	return (Object.prototype.toString.call(obj) === '[object Array]');
};

// @function indexOf(array: Array, el: Object): Number
// Compatibility polyfill for [Array.prototype.indexOf](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf)
function indexOf(array, el) {
	for (var i = 0; i < array.length; i++) {
		if (array[i] === el) { return i; }
	}
	return -1;
}

// @property emptyImageUrl: String
// Data URI string containing a base64-encoded empty GIF image.
// Used as a hack to free memory from unused images on WebKit-powered
// mobile devices (by setting image `src` to this string).
var emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

// inspired by http://paulirish.com/2011/requestanimationframe-for-smart-animating/

function getPrefixed(name) {
	return window['webkit' + name] || window['moz' + name] || window['ms' + name];
}

var lastTime = 0;

// fallback for IE 7-8
function timeoutDefer(fn) {
	var time = +new Date(),
	    timeToCall = Math.max(0, 16 - (time - lastTime));

	lastTime = time + timeToCall;
	return window.setTimeout(fn, timeToCall);
}

var requestFn = window.requestAnimationFrame || getPrefixed('RequestAnimationFrame') || timeoutDefer;
var cancelFn = window.cancelAnimationFrame || getPrefixed('CancelAnimationFrame') ||
		getPrefixed('CancelRequestAnimationFrame') || function (id) { window.clearTimeout(id); };

// @function requestAnimFrame(fn: Function, context?: Object, immediate?: Boolean): Number
// Schedules `fn` to be executed when the browser repaints. `fn` is bound to
// `context` if given. When `immediate` is set, `fn` is called immediately if
// the browser doesn't have native support for
// [`window.requestAnimationFrame`](https://developer.mozilla.org/docs/Web/API/window/requestAnimationFrame),
// otherwise it's delayed. Returns a request ID that can be used to cancel the request.
function requestAnimFrame(fn, context, immediate) {
	if (immediate && requestFn === timeoutDefer) {
		fn.call(context);
	} else {
		return requestFn.call(window, bind(fn, context));
	}
}

// @function cancelAnimFrame(id: Number): undefined
// Cancels a previous `requestAnimFrame`. See also [window.cancelAnimationFrame](https://developer.mozilla.org/docs/Web/API/window/cancelAnimationFrame).
function cancelAnimFrame(id) {
	if (id) {
		cancelFn.call(window, id);
	}
}


var Util = (Object.freeze || Object)({
	freeze: freeze,
	extend: extend,
	create: create,
	bind: bind,
	lastId: lastId,
	stamp: stamp,
	throttle: throttle,
	wrapNum: wrapNum,
	falseFn: falseFn,
	formatNum: formatNum,
	trim: trim,
	splitWords: splitWords,
	setOptions: setOptions,
	getParamString: getParamString,
	template: template,
	isArray: isArray,
	indexOf: indexOf,
	emptyImageUrl: emptyImageUrl,
	requestFn: requestFn,
	cancelFn: cancelFn,
	requestAnimFrame: requestAnimFrame,
	cancelAnimFrame: cancelAnimFrame
});

// @class Class
// @aka L.Class

// @section
// @uninheritable

// Thanks to John Resig and Dean Edwards for inspiration!

function Class() {}

Class.extend = function (props) {

	// @function extend(props: Object): Function
	// [Extends the current class](#class-inheritance) given the properties to be included.
	// Returns a Javascript function that is a class constructor (to be called with `new`).
	var NewClass = function () {

		// call the constructor
		if (this.initialize) {
			this.initialize.apply(this, arguments);
		}

		// call all constructor hooks
		this.callInitHooks();
	};

	var parentProto = NewClass.__super__ = this.prototype;

	var proto = create(parentProto);
	proto.constructor = NewClass;

	NewClass.prototype = proto;

	// inherit parent's statics
	for (var i in this) {
		if (this.hasOwnProperty(i) && i !== 'prototype' && i !== '__super__') {
			NewClass[i] = this[i];
		}
	}

	// mix static properties into the class
	if (props.statics) {
		extend(NewClass, props.statics);
		delete props.statics;
	}

	// mix includes into the prototype
	if (props.includes) {
		checkDeprecatedMixinEvents(props.includes);
		extend.apply(null, [proto].concat(props.includes));
		delete props.includes;
	}

	// merge options
	if (proto.options) {
		props.options = extend(create(proto.options), props.options);
	}

	// mix given properties into the prototype
	extend(proto, props);

	proto._initHooks = [];

	// add method for calling all hooks
	proto.callInitHooks = function () {

		if (this._initHooksCalled) { return; }

		if (parentProto.callInitHooks) {
			parentProto.callInitHooks.call(this);
		}

		this._initHooksCalled = true;

		for (var i = 0, len = proto._initHooks.length; i < len; i++) {
			proto._initHooks[i].call(this);
		}
	};

	return NewClass;
};


// @function include(properties: Object): this
// [Includes a mixin](#class-includes) into the current class.
Class.include = function (props) {
	extend(this.prototype, props);
	return this;
};

// @function mergeOptions(options: Object): this
// [Merges `options`](#class-options) into the defaults of the class.
Class.mergeOptions = function (options) {
	extend(this.prototype.options, options);
	return this;
};

// @function addInitHook(fn: Function): this
// Adds a [constructor hook](#class-constructor-hooks) to the class.
Class.addInitHook = function (fn) { // (Function) || (String, args...)
	var args = Array.prototype.slice.call(arguments, 1);

	var init = typeof fn === 'function' ? fn : function () {
		this[fn].apply(this, args);
	};

	this.prototype._initHooks = this.prototype._initHooks || [];
	this.prototype._initHooks.push(init);
	return this;
};

function checkDeprecatedMixinEvents(includes) {
	if (typeof L === 'undefined' || !L || !L.Mixin) { return; }

	includes = isArray(includes) ? includes : [includes];

	for (var i = 0; i < includes.length; i++) {
		if (includes[i] === L.Mixin.Events) {
			console.warn('Deprecated include of L.Mixin.Events: ' +
				'this property will be removed in future releases, ' +
				'please inherit from L.Evented instead.', new Error().stack);
		}
	}
}

/*
 * @class Evented
 * @aka L.Evented
 * @inherits Class
 *
 * A set of methods shared between event-powered classes (like `Map` and `Marker`). Generally, events allow you to execute some function when something happens with an object (e.g. the user clicks on the map, causing the map to fire `'click'` event).
 *
 * @example
 *
 * ```js
 * map.on('click', function(e) {
 * 	alert(e.latlng);
 * } );
 * ```
 *
 * Leaflet deals with event listeners by reference, so if you want to add a listener and then remove it, define it as a function:
 *
 * ```js
 * function onClick(e) { ... }
 *
 * map.on('click', onClick);
 * map.off('click', onClick);
 * ```
 */

var Events = {
	/* @method on(type: String, fn: Function, context?: Object): this
	 * Adds a listener function (`fn`) to a particular event type of the object. You can optionally specify the context of the listener (object the this keyword will point to). You can also pass several space-separated types (e.g. `'click dblclick'`).
	 *
	 * @alternative
	 * @method on(eventMap: Object): this
	 * Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
	 */
	on: function (types, fn, context) {

		// types can be a map of types/handlers
		if (typeof types === 'object') {
			for (var type in types) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on(type, types[type], fn);
			}

		} else {
			// types can be a string of space-separated words
			types = splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._on(types[i], fn, context);
			}
		}

		return this;
	},

	/* @method off(type: String, fn?: Function, context?: Object): this
	 * Removes a previously added listener function. If no function is specified, it will remove all the listeners of that particular event from the object. Note that if you passed a custom context to `on`, you must pass the same context to `off` in order to remove the listener.
	 *
	 * @alternative
	 * @method off(eventMap: Object): this
	 * Removes a set of type/listener pairs.
	 *
	 * @alternative
	 * @method off: this
	 * Removes all listeners to all events on the object.
	 */
	off: function (types, fn, context) {

		if (!types) {
			// clear all listeners if called without arguments
			delete this._events;

		} else if (typeof types === 'object') {
			for (var type in types) {
				this._off(type, types[type], fn);
			}

		} else {
			types = splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._off(types[i], fn, context);
			}
		}

		return this;
	},

	// attach listener (without syntactic sugar now)
	_on: function (type, fn, context) {
		this._events = this._events || {};

		/* get/init listeners for type */
		var typeListeners = this._events[type];
		if (!typeListeners) {
			typeListeners = [];
			this._events[type] = typeListeners;
		}

		if (context === this) {
			// Less memory footprint.
			context = undefined;
		}
		var newListener = {fn: fn, ctx: context},
		    listeners = typeListeners;

		// check if fn already there
		for (var i = 0, len = listeners.length; i < len; i++) {
			if (listeners[i].fn === fn && listeners[i].ctx === context) {
				return;
			}
		}

		listeners.push(newListener);
	},

	_off: function (type, fn, context) {
		var listeners,
		    i,
		    len;

		if (!this._events) { return; }

		listeners = this._events[type];

		if (!listeners) {
			return;
		}

		if (!fn) {
			// Set all removed listeners to noop so they are not called if remove happens in fire
			for (i = 0, len = listeners.length; i < len; i++) {
				listeners[i].fn = falseFn;
			}
			// clear all listeners for a type if function isn't specified
			delete this._events[type];
			return;
		}

		if (context === this) {
			context = undefined;
		}

		if (listeners) {

			// find fn and remove it
			for (i = 0, len = listeners.length; i < len; i++) {
				var l = listeners[i];
				if (l.ctx !== context) { continue; }
				if (l.fn === fn) {

					// set the removed listener to noop so that's not called if remove happens in fire
					l.fn = falseFn;

					if (this._firingCount) {
						/* copy array in case events are being fired */
						this._events[type] = listeners = listeners.slice();
					}
					listeners.splice(i, 1);

					return;
				}
			}
		}
	},

	// @method fire(type: String, data?: Object, propagate?: Boolean): this
	// Fires an event of the specified type. You can optionally provide an data
	// object — the first argument of the listener function will contain its
	// properties. The event can optionally be propagated to event parents.
	fire: function (type, data, propagate) {
		if (!this.listens(type, propagate)) { return this; }

		var event = extend({}, data, {
			type: type,
			target: this,
			sourceTarget: data && data.sourceTarget || this
		});

		if (this._events) {
			var listeners = this._events[type];

			if (listeners) {
				this._firingCount = (this._firingCount + 1) || 1;
				for (var i = 0, len = listeners.length; i < len; i++) {
					var l = listeners[i];
					l.fn.call(l.ctx || this, event);
				}

				this._firingCount--;
			}
		}

		if (propagate) {
			// propagate the event to parents (set with addEventParent)
			this._propagateEvent(event);
		}

		return this;
	},

	// @method listens(type: String): Boolean
	// Returns `true` if a particular event type has any listeners attached to it.
	listens: function (type, propagate) {
		var listeners = this._events && this._events[type];
		if (listeners && listeners.length) { return true; }

		if (propagate) {
			// also check parents for listeners if event propagates
			for (var id in this._eventParents) {
				if (this._eventParents[id].listens(type, propagate)) { return true; }
			}
		}
		return false;
	},

	// @method once(…): this
	// Behaves as [`on(…)`](#evented-on), except the listener will only get fired once and then removed.
	once: function (types, fn, context) {

		if (typeof types === 'object') {
			for (var type in types) {
				this.once(type, types[type], fn);
			}
			return this;
		}

		var handler = bind(function () {
			this
			    .off(types, fn, context)
			    .off(types, handler, context);
		}, this);

		// add a listener that's executed once and removed after that
		return this
		    .on(types, fn, context)
		    .on(types, handler, context);
	},

	// @method addEventParent(obj: Evented): this
	// Adds an event parent - an `Evented` that will receive propagated events
	addEventParent: function (obj) {
		this._eventParents = this._eventParents || {};
		this._eventParents[stamp(obj)] = obj;
		return this;
	},

	// @method removeEventParent(obj: Evented): this
	// Removes an event parent, so it will stop receiving propagated events
	removeEventParent: function (obj) {
		if (this._eventParents) {
			delete this._eventParents[stamp(obj)];
		}
		return this;
	},

	_propagateEvent: function (e) {
		for (var id in this._eventParents) {
			this._eventParents[id].fire(e.type, extend({
				layer: e.target,
				propagatedFrom: e.target
			}, e), true);
		}
	}
};

// aliases; we should ditch those eventually

// @method addEventListener(…): this
// Alias to [`on(…)`](#evented-on)
Events.addEventListener = Events.on;

// @method removeEventListener(…): this
// Alias to [`off(…)`](#evented-off)

// @method clearAllEventListeners(…): this
// Alias to [`off()`](#evented-off)
Events.removeEventListener = Events.clearAllEventListeners = Events.off;

// @method addOneTimeEventListener(…): this
// Alias to [`once(…)`](#evented-once)
Events.addOneTimeEventListener = Events.once;

// @method fireEvent(…): this
// Alias to [`fire(…)`](#evented-fire)
Events.fireEvent = Events.fire;

// @method hasEventListeners(…): Boolean
// Alias to [`listens(…)`](#evented-listens)
Events.hasEventListeners = Events.listens;

var Evented = Class.extend(Events);

/*
 * @class Point
 * @aka L.Point
 *
 * Represents a point with `x` and `y` coordinates in pixels.
 *
 * @example
 *
 * ```js
 * var point = L.point(200, 300);
 * ```
 *
 * All Leaflet methods and options that accept `Point` objects also accept them in a simple Array form (unless noted otherwise), so these lines are equivalent:
 *
 * ```js
 * map.panBy([200, 300]);
 * map.panBy(L.point(200, 300));
 * ```
 *
 * Note that `Point` does not inherit from Leafet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function Point(x, y, round) {
	// @property x: Number; The `x` coordinate of the point
	this.x = (round ? Math.round(x) : x);
	// @property y: Number; The `y` coordinate of the point
	this.y = (round ? Math.round(y) : y);
}

var trunc = Math.trunc || function (v) {
	return v > 0 ? Math.floor(v) : Math.ceil(v);
};

Point.prototype = {

	// @method clone(): Point
	// Returns a copy of the current point.
	clone: function () {
		return new Point(this.x, this.y);
	},

	// @method add(otherPoint: Point): Point
	// Returns the result of addition of the current and the given points.
	add: function (point) {
		// non-destructive, returns a new point
		return this.clone()._add(toPoint(point));
	},

	_add: function (point) {
		// destructive, used directly for performance in situations where it's safe to modify existing point
		this.x += point.x;
		this.y += point.y;
		return this;
	},

	// @method subtract(otherPoint: Point): Point
	// Returns the result of subtraction of the given point from the current.
	subtract: function (point) {
		return this.clone()._subtract(toPoint(point));
	},

	_subtract: function (point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	},

	// @method divideBy(num: Number): Point
	// Returns the result of division of the current point by the given number.
	divideBy: function (num) {
		return this.clone()._divideBy(num);
	},

	_divideBy: function (num) {
		this.x /= num;
		this.y /= num;
		return this;
	},

	// @method multiplyBy(num: Number): Point
	// Returns the result of multiplication of the current point by the given number.
	multiplyBy: function (num) {
		return this.clone()._multiplyBy(num);
	},

	_multiplyBy: function (num) {
		this.x *= num;
		this.y *= num;
		return this;
	},

	// @method scaleBy(scale: Point): Point
	// Multiply each coordinate of the current point by each coordinate of
	// `scale`. In linear algebra terms, multiply the point by the
	// [scaling matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation)
	// defined by `scale`.
	scaleBy: function (point) {
		return new Point(this.x * point.x, this.y * point.y);
	},

	// @method unscaleBy(scale: Point): Point
	// Inverse of `scaleBy`. Divide each coordinate of the current point by
	// each coordinate of `scale`.
	unscaleBy: function (point) {
		return new Point(this.x / point.x, this.y / point.y);
	},

	// @method round(): Point
	// Returns a copy of the current point with rounded coordinates.
	round: function () {
		return this.clone()._round();
	},

	_round: function () {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	},

	// @method floor(): Point
	// Returns a copy of the current point with floored coordinates (rounded down).
	floor: function () {
		return this.clone()._floor();
	},

	_floor: function () {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	},

	// @method ceil(): Point
	// Returns a copy of the current point with ceiled coordinates (rounded up).
	ceil: function () {
		return this.clone()._ceil();
	},

	_ceil: function () {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	},

	// @method trunc(): Point
	// Returns a copy of the current point with truncated coordinates (rounded towards zero).
	trunc: function () {
		return this.clone()._trunc();
	},

	_trunc: function () {
		this.x = trunc(this.x);
		this.y = trunc(this.y);
		return this;
	},

	// @method distanceTo(otherPoint: Point): Number
	// Returns the cartesian distance between the current and the given points.
	distanceTo: function (point) {
		point = toPoint(point);

		var x = point.x - this.x,
		    y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	},

	// @method equals(otherPoint: Point): Boolean
	// Returns `true` if the given point has the same coordinates.
	equals: function (point) {
		point = toPoint(point);

		return point.x === this.x &&
		       point.y === this.y;
	},

	// @method contains(otherPoint: Point): Boolean
	// Returns `true` if both coordinates of the given point are less than the corresponding current point coordinates (in absolute values).
	contains: function (point) {
		point = toPoint(point);

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	},

	// @method toString(): String
	// Returns a string representation of the point for debugging purposes.
	toString: function () {
		return 'Point(' +
		        formatNum(this.x) + ', ' +
		        formatNum(this.y) + ')';
	}
};

// @factory L.point(x: Number, y: Number, round?: Boolean)
// Creates a Point object with the given `x` and `y` coordinates. If optional `round` is set to true, rounds the `x` and `y` values.

// @alternative
// @factory L.point(coords: Number[])
// Expects an array of the form `[x, y]` instead.

// @alternative
// @factory L.point(coords: Object)
// Expects a plain object of the form `{x: Number, y: Number}` instead.
function toPoint(x, y, round) {
	if (x instanceof Point) {
		return x;
	}
	if (isArray(x)) {
		return new Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	if (typeof x === 'object' && 'x' in x && 'y' in x) {
		return new Point(x.x, x.y);
	}
	return new Point(x, y, round);
}

/*
 * @class Bounds
 * @aka L.Bounds
 *
 * Represents a rectangular area in pixel coordinates.
 *
 * @example
 *
 * ```js
 * var p1 = L.point(10, 10),
 * p2 = L.point(40, 60),
 * bounds = L.bounds(p1, p2);
 * ```
 *
 * All Leaflet methods that accept `Bounds` objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * otherBounds.intersects([[10, 10], [40, 60]]);
 * ```
 *
 * Note that `Bounds` does not inherit from Leafet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function Bounds(a, b) {
	if (!a) { return; }

	var points = b ? [a, b] : a;

	for (var i = 0, len = points.length; i < len; i++) {
		this.extend(points[i]);
	}
}

Bounds.prototype = {
	// @method extend(point: Point): this
	// Extends the bounds to contain the given point.
	extend: function (point) { // (Point)
		point = toPoint(point);

		// @property min: Point
		// The top left corner of the rectangle.
		// @property max: Point
		// The bottom right corner of the rectangle.
		if (!this.min && !this.max) {
			this.min = point.clone();
			this.max = point.clone();
		} else {
			this.min.x = Math.min(point.x, this.min.x);
			this.max.x = Math.max(point.x, this.max.x);
			this.min.y = Math.min(point.y, this.min.y);
			this.max.y = Math.max(point.y, this.max.y);
		}
		return this;
	},

	// @method getCenter(round?: Boolean): Point
	// Returns the center point of the bounds.
	getCenter: function (round) {
		return new Point(
		        (this.min.x + this.max.x) / 2,
		        (this.min.y + this.max.y) / 2, round);
	},

	// @method getBottomLeft(): Point
	// Returns the bottom-left point of the bounds.
	getBottomLeft: function () {
		return new Point(this.min.x, this.max.y);
	},

	// @method getTopRight(): Point
	// Returns the top-right point of the bounds.
	getTopRight: function () { // -> Point
		return new Point(this.max.x, this.min.y);
	},

	// @method getTopLeft(): Point
	// Returns the top-left point of the bounds (i.e. [`this.min`](#bounds-min)).
	getTopLeft: function () {
		return this.min; // left, top
	},

	// @method getBottomRight(): Point
	// Returns the bottom-right point of the bounds (i.e. [`this.max`](#bounds-max)).
	getBottomRight: function () {
		return this.max; // right, bottom
	},

	// @method getSize(): Point
	// Returns the size of the given bounds
	getSize: function () {
		return this.max.subtract(this.min);
	},

	// @method contains(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle contains the given one.
	// @alternative
	// @method contains(point: Point): Boolean
	// Returns `true` if the rectangle contains the given point.
	contains: function (obj) {
		var min, max;

		if (typeof obj[0] === 'number' || obj instanceof Point) {
			obj = toPoint(obj);
		} else {
			obj = toBounds(obj);
		}

		if (obj instanceof Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	},

	// @method intersects(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle intersects the given bounds. Two bounds
	// intersect if they have at least one point in common.
	intersects: function (bounds) { // (Bounds) -> Boolean
		bounds = toBounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	},

	// @method overlaps(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle overlaps the given bounds. Two bounds
	// overlap if their intersection is an area.
	overlaps: function (bounds) { // (Bounds) -> Boolean
		bounds = toBounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xOverlaps = (max2.x > min.x) && (min2.x < max.x),
		    yOverlaps = (max2.y > min.y) && (min2.y < max.y);

		return xOverlaps && yOverlaps;
	},

	isValid: function () {
		return !!(this.min && this.max);
	}
};


// @factory L.bounds(corner1: Point, corner2: Point)
// Creates a Bounds object from two corners coordinate pairs.
// @alternative
// @factory L.bounds(points: Point[])
// Creates a Bounds object from the given array of points.
function toBounds(a, b) {
	if (!a || a instanceof Bounds) {
		return a;
	}
	return new Bounds(a, b);
}

/*
 * @class LatLngBounds
 * @aka L.LatLngBounds
 *
 * Represents a rectangular geographical area on a map.
 *
 * @example
 *
 * ```js
 * var corner1 = L.latLng(40.712, -74.227),
 * corner2 = L.latLng(40.774, -74.125),
 * bounds = L.latLngBounds(corner1, corner2);
 * ```
 *
 * All Leaflet methods that accept LatLngBounds objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * map.fitBounds([
 * 	[40.712, -74.227],
 * 	[40.774, -74.125]
 * ]);
 * ```
 *
 * Caution: if the area crosses the antimeridian (often confused with the International Date Line), you must specify corners _outside_ the [-180, 180] degrees longitude range.
 *
 * Note that `LatLngBounds` does not inherit from Leafet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function LatLngBounds(corner1, corner2) { // (LatLng, LatLng) or (LatLng[])
	if (!corner1) { return; }

	var latlngs = corner2 ? [corner1, corner2] : corner1;

	for (var i = 0, len = latlngs.length; i < len; i++) {
		this.extend(latlngs[i]);
	}
}

LatLngBounds.prototype = {

	// @method extend(latlng: LatLng): this
	// Extend the bounds to contain the given point

	// @alternative
	// @method extend(otherBounds: LatLngBounds): this
	// Extend the bounds to contain the given bounds
	extend: function (obj) {
		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof LatLng) {
			sw2 = obj;
			ne2 = obj;

		} else if (obj instanceof LatLngBounds) {
			sw2 = obj._southWest;
			ne2 = obj._northEast;

			if (!sw2 || !ne2) { return this; }

		} else {
			return obj ? this.extend(toLatLng(obj) || toLatLngBounds(obj)) : this;
		}

		if (!sw && !ne) {
			this._southWest = new LatLng(sw2.lat, sw2.lng);
			this._northEast = new LatLng(ne2.lat, ne2.lng);
		} else {
			sw.lat = Math.min(sw2.lat, sw.lat);
			sw.lng = Math.min(sw2.lng, sw.lng);
			ne.lat = Math.max(ne2.lat, ne.lat);
			ne.lng = Math.max(ne2.lng, ne.lng);
		}

		return this;
	},

	// @method pad(bufferRatio: Number): LatLngBounds
	// Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
	// For example, a ratio of 0.5 extends the bounds by 50% in each direction.
	// Negative values will retract the bounds.
	pad: function (bufferRatio) {
		var sw = this._southWest,
		    ne = this._northEast,
		    heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
		    widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new LatLngBounds(
		        new LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
		        new LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
	},

	// @method getCenter(): LatLng
	// Returns the center point of the bounds.
	getCenter: function () {
		return new LatLng(
		        (this._southWest.lat + this._northEast.lat) / 2,
		        (this._southWest.lng + this._northEast.lng) / 2);
	},

	// @method getSouthWest(): LatLng
	// Returns the south-west point of the bounds.
	getSouthWest: function () {
		return this._southWest;
	},

	// @method getNorthEast(): LatLng
	// Returns the north-east point of the bounds.
	getNorthEast: function () {
		return this._northEast;
	},

	// @method getNorthWest(): LatLng
	// Returns the north-west point of the bounds.
	getNorthWest: function () {
		return new LatLng(this.getNorth(), this.getWest());
	},

	// @method getSouthEast(): LatLng
	// Returns the south-east point of the bounds.
	getSouthEast: function () {
		return new LatLng(this.getSouth(), this.getEast());
	},

	// @method getWest(): Number
	// Returns the west longitude of the bounds
	getWest: function () {
		return this._southWest.lng;
	},

	// @method getSouth(): Number
	// Returns the south latitude of the bounds
	getSouth: function () {
		return this._southWest.lat;
	},

	// @method getEast(): Number
	// Returns the east longitude of the bounds
	getEast: function () {
		return this._northEast.lng;
	},

	// @method getNorth(): Number
	// Returns the north latitude of the bounds
	getNorth: function () {
		return this._northEast.lat;
	},

	// @method contains(otherBounds: LatLngBounds): Boolean
	// Returns `true` if the rectangle contains the given one.

	// @alternative
	// @method contains (latlng: LatLng): Boolean
	// Returns `true` if the rectangle contains the given point.
	contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
		if (typeof obj[0] === 'number' || obj instanceof LatLng || 'lat' in obj) {
			obj = toLatLng(obj);
		} else {
			obj = toLatLngBounds(obj);
		}

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof LatLngBounds) {
			sw2 = obj.getSouthWest();
			ne2 = obj.getNorthEast();
		} else {
			sw2 = ne2 = obj;
		}

		return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
		       (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
	},

	// @method intersects(otherBounds: LatLngBounds): Boolean
	// Returns `true` if the rectangle intersects the given bounds. Two bounds intersect if they have at least one point in common.
	intersects: function (bounds) {
		bounds = toLatLngBounds(bounds);

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),

		    latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
		    lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	},

	// @method overlaps(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle overlaps the given bounds. Two bounds overlap if their intersection is an area.
	overlaps: function (bounds) {
		bounds = toLatLngBounds(bounds);

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),

		    latOverlaps = (ne2.lat > sw.lat) && (sw2.lat < ne.lat),
		    lngOverlaps = (ne2.lng > sw.lng) && (sw2.lng < ne.lng);

		return latOverlaps && lngOverlaps;
	},

	// @method toBBoxString(): String
	// Returns a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format. Useful for sending requests to web services that return geo data.
	toBBoxString: function () {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	},

	// @method equals(otherBounds: LatLngBounds, maxMargin?: Number): Boolean
	// Returns `true` if the rectangle is equivalent (within a small margin of error) to the given bounds. The margin of error can be overridden by setting `maxMargin` to a small number.
	equals: function (bounds, maxMargin) {
		if (!bounds) { return false; }

		bounds = toLatLngBounds(bounds);

		return this._southWest.equals(bounds.getSouthWest(), maxMargin) &&
		       this._northEast.equals(bounds.getNorthEast(), maxMargin);
	},

	// @method isValid(): Boolean
	// Returns `true` if the bounds are properly initialized.
	isValid: function () {
		return !!(this._southWest && this._northEast);
	}
};

// TODO International date line?

// @factory L.latLngBounds(corner1: LatLng, corner2: LatLng)
// Creates a `LatLngBounds` object by defining two diagonally opposite corners of the rectangle.

// @alternative
// @factory L.latLngBounds(latlngs: LatLng[])
// Creates a `LatLngBounds` object defined by the geographical points it contains. Very useful for zooming the map to fit a particular set of locations with [`fitBounds`](#map-fitbounds).
function toLatLngBounds(a, b) {
	if (a instanceof LatLngBounds) {
		return a;
	}
	return new LatLngBounds(a, b);
}

/* @class LatLng
 * @aka L.LatLng
 *
 * Represents a geographical point with a certain latitude and longitude.
 *
 * @example
 *
 * ```
 * var latlng = L.latLng(50.5, 30.5);
 * ```
 *
 * All Leaflet methods that accept LatLng objects also accept them in a simple Array form and simple object form (unless noted otherwise), so these lines are equivalent:
 *
 * ```
 * map.panTo([50, 30]);
 * map.panTo({lon: 30, lat: 50});
 * map.panTo({lat: 50, lng: 30});
 * map.panTo(L.latLng(50, 30));
 * ```
 *
 * Note that `LatLng` does not inherit from Leafet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function LatLng(lat, lng, alt) {
	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
	}

	// @property lat: Number
	// Latitude in degrees
	this.lat = +lat;

	// @property lng: Number
	// Longitude in degrees
	this.lng = +lng;

	// @property alt: Number
	// Altitude in meters (optional)
	if (alt !== undefined) {
		this.alt = +alt;
	}
}

LatLng.prototype = {
	// @method equals(otherLatLng: LatLng, maxMargin?: Number): Boolean
	// Returns `true` if the given `LatLng` point is at the same position (within a small margin of error). The margin of error can be overridden by setting `maxMargin` to a small number.
	equals: function (obj, maxMargin) {
		if (!obj) { return false; }

		obj = toLatLng(obj);

		var margin = Math.max(
		        Math.abs(this.lat - obj.lat),
		        Math.abs(this.lng - obj.lng));

		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	},

	// @method toString(): String
	// Returns a string representation of the point (for debugging purposes).
	toString: function (precision) {
		return 'LatLng(' +
		        formatNum(this.lat, precision) + ', ' +
		        formatNum(this.lng, precision) + ')';
	},

	// @method distanceTo(otherLatLng: LatLng): Number
	// Returns the distance (in meters) to the given `LatLng` calculated using the [Spherical Law of Cosines](https://en.wikipedia.org/wiki/Spherical_law_of_cosines).
	distanceTo: function (other) {
		return Earth.distance(this, toLatLng(other));
	},

	// @method wrap(): LatLng
	// Returns a new `LatLng` object with the longitude wrapped so it's always between -180 and +180 degrees.
	wrap: function () {
		return Earth.wrapLatLng(this);
	},

	// @method toBounds(sizeInMeters: Number): LatLngBounds
	// Returns a new `LatLngBounds` object in which each boundary is `sizeInMeters/2` meters apart from the `LatLng`.
	toBounds: function (sizeInMeters) {
		var latAccuracy = 180 * sizeInMeters / 40075017,
		    lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

		return toLatLngBounds(
		        [this.lat - latAccuracy, this.lng - lngAccuracy],
		        [this.lat + latAccuracy, this.lng + lngAccuracy]);
	},

	clone: function () {
		return new LatLng(this.lat, this.lng, this.alt);
	}
};



// @factory L.latLng(latitude: Number, longitude: Number, altitude?: Number): LatLng
// Creates an object representing a geographical point with the given latitude and longitude (and optionally altitude).

// @alternative
// @factory L.latLng(coords: Array): LatLng
// Expects an array of the form `[Number, Number]` or `[Number, Number, Number]` instead.

// @alternative
// @factory L.latLng(coords: Object): LatLng
// Expects an plain object of the form `{lat: Number, lng: Number}` or `{lat: Number, lng: Number, alt: Number}` instead.

function toLatLng(a, b, c) {
	if (a instanceof LatLng) {
		return a;
	}
	if (isArray(a) && typeof a[0] !== 'object') {
		if (a.length === 3) {
			return new LatLng(a[0], a[1], a[2]);
		}
		if (a.length === 2) {
			return new LatLng(a[0], a[1]);
		}
		return null;
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
	}
	if (b === undefined) {
		return null;
	}
	return new LatLng(a, b, c);
}

/*
 * @namespace CRS
 * @crs L.CRS.Base
 * Object that defines coordinate reference systems for projecting
 * geographical points into pixel (screen) coordinates and back (and to
 * coordinates in other units for [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services). See
 * [spatial reference system](http://en.wikipedia.org/wiki/Coordinate_reference_system).
 *
 * Leaflet defines the most usual CRSs by default. If you want to use a
 * CRS not defined by default, take a look at the
 * [Proj4Leaflet](https://github.com/kartena/Proj4Leaflet) plugin.
 *
 * Note that the CRS instances do not inherit from Leafet's `Class` object,
 * and can't be instantiated. Also, new classes can't inherit from them,
 * and methods can't be added to them with the `include` function.
 */

var CRS = {
	// @method latLngToPoint(latlng: LatLng, zoom: Number): Point
	// Projects geographical coordinates into pixel coordinates for a given zoom.
	latLngToPoint: function (latlng, zoom) {
		var projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	// @method pointToLatLng(point: Point, zoom: Number): LatLng
	// The inverse of `latLngToPoint`. Projects pixel coordinates on a given
	// zoom into geographical coordinates.
	pointToLatLng: function (point, zoom) {
		var scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	// @method project(latlng: LatLng): Point
	// Projects geographical coordinates into coordinates in units accepted for
	// this CRS (e.g. meters for EPSG:3857, for passing it to WMS services).
	project: function (latlng) {
		return this.projection.project(latlng);
	},

	// @method unproject(point: Point): LatLng
	// Given a projected coordinate returns the corresponding LatLng.
	// The inverse of `project`.
	unproject: function (point) {
		return this.projection.unproject(point);
	},

	// @method scale(zoom: Number): Number
	// Returns the scale used when transforming projected coordinates into
	// pixel coordinates for a particular zoom. For example, it returns
	// `256 * 2^zoom` for Mercator-based CRS.
	scale: function (zoom) {
		return 256 * Math.pow(2, zoom);
	},

	// @method zoom(scale: Number): Number
	// Inverse of `scale()`, returns the zoom level corresponding to a scale
	// factor of `scale`.
	zoom: function (scale) {
		return Math.log(scale / 256) / Math.LN2;
	},

	// @method getProjectedBounds(zoom: Number): Bounds
	// Returns the projection's bounds scaled and transformed for the provided `zoom`.
	getProjectedBounds: function (zoom) {
		if (this.infinite) { return null; }

		var b = this.projection.bounds,
		    s = this.scale(zoom),
		    min = this.transformation.transform(b.min, s),
		    max = this.transformation.transform(b.max, s);

		return new Bounds(min, max);
	},

	// @method distance(latlng1: LatLng, latlng2: LatLng): Number
	// Returns the distance between two geographical coordinates.

	// @property code: String
	// Standard code name of the CRS passed into WMS services (e.g. `'EPSG:3857'`)
	//
	// @property wrapLng: Number[]
	// An array of two numbers defining whether the longitude (horizontal) coordinate
	// axis wraps around a given range and how. Defaults to `[-180, 180]` in most
	// geographical CRSs. If `undefined`, the longitude axis does not wrap around.
	//
	// @property wrapLat: Number[]
	// Like `wrapLng`, but for the latitude (vertical) axis.

	// wrapLng: [min, max],
	// wrapLat: [min, max],

	// @property infinite: Boolean
	// If true, the coordinate space will be unbounded (infinite in both axes)
	infinite: false,

	// @method wrapLatLng(latlng: LatLng): LatLng
	// Returns a `LatLng` where lat and lng has been wrapped according to the
	// CRS's `wrapLat` and `wrapLng` properties, if they are outside the CRS's bounds.
	wrapLatLng: function (latlng) {
		var lng = this.wrapLng ? wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng,
		    lat = this.wrapLat ? wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat,
		    alt = latlng.alt;

		return new LatLng(lat, lng, alt);
	},

	// @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
	// Returns a `LatLngBounds` with the same size as the given one, ensuring
	// that its center is within the CRS's bounds.
	// Only accepts actual `L.LatLngBounds` instances, not arrays.
	wrapLatLngBounds: function (bounds) {
		var center = bounds.getCenter(),
		    newCenter = this.wrapLatLng(center),
		    latShift = center.lat - newCenter.lat,
		    lngShift = center.lng - newCenter.lng;

		if (latShift === 0 && lngShift === 0) {
			return bounds;
		}

		var sw = bounds.getSouthWest(),
		    ne = bounds.getNorthEast(),
		    newSw = new LatLng(sw.lat - latShift, sw.lng - lngShift),
		    newNe = new LatLng(ne.lat - latShift, ne.lng - lngShift);

		return new LatLngBounds(newSw, newNe);
	}
};

/*
 * @namespace CRS
 * @crs L.CRS.Earth
 *
 * Serves as the base for CRS that are global such that they cover the earth.
 * Can only be used as the base for other CRS and cannot be used directly,
 * since it does not have a `code`, `projection` or `transformation`. `distance()` returns
 * meters.
 */

var Earth = extend({}, CRS, {
	wrapLng: [-180, 180],

	// Mean Earth Radius, as recommended for use by
	// the International Union of Geodesy and Geophysics,
	// see http://rosettacode.org/wiki/Haversine_formula
	R: 6371000,

	// distance between two geographical points using spherical law of cosines approximation
	distance: function (latlng1, latlng2) {
		var rad = Math.PI / 180,
		    lat1 = latlng1.lat * rad,
		    lat2 = latlng2.lat * rad,
		    sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2),
		    sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2),
		    a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
		    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return this.R * c;
	}
});

/*
 * @namespace Projection
 * @projection L.Projection.SphericalMercator
 *
 * Spherical Mercator projection — the most common projection for online maps,
 * used by almost all free and commercial tile providers. Assumes that Earth is
 * a sphere. Used by the `EPSG:3857` CRS.
 */

var SphericalMercator = {

	R: 6378137,
	MAX_LATITUDE: 85.0511287798,

	project: function (latlng) {
		var d = Math.PI / 180,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    sin = Math.sin(lat * d);

		return new Point(
			this.R * latlng.lng * d,
			this.R * Math.log((1 + sin) / (1 - sin)) / 2);
	},

	unproject: function (point) {
		var d = 180 / Math.PI;

		return new LatLng(
			(2 * Math.atan(Math.exp(point.y / this.R)) - (Math.PI / 2)) * d,
			point.x * d / this.R);
	},

	bounds: (function () {
		var d = 6378137 * Math.PI;
		return new Bounds([-d, -d], [d, d]);
	})()
};

/*
 * @class Transformation
 * @aka L.Transformation
 *
 * Represents an affine transformation: a set of coefficients `a`, `b`, `c`, `d`
 * for transforming a point of a form `(x, y)` into `(a*x + b, c*y + d)` and doing
 * the reverse. Used by Leaflet in its projections code.
 *
 * @example
 *
 * ```js
 * var transformation = L.transformation(2, 5, -1, 10),
 * 	p = L.point(1, 2),
 * 	p2 = transformation.transform(p), //  L.point(7, 8)
 * 	p3 = transformation.untransform(p2); //  L.point(1, 2)
 * ```
 */


// factory new L.Transformation(a: Number, b: Number, c: Number, d: Number)
// Creates a `Transformation` object with the given coefficients.
function Transformation(a, b, c, d) {
	if (isArray(a)) {
		// use array properties
		this._a = a[0];
		this._b = a[1];
		this._c = a[2];
		this._d = a[3];
		return;
	}
	this._a = a;
	this._b = b;
	this._c = c;
	this._d = d;
}

Transformation.prototype = {
	// @method transform(point: Point, scale?: Number): Point
	// Returns a transformed point, optionally multiplied by the given scale.
	// Only accepts actual `L.Point` instances, not arrays.
	transform: function (point, scale) { // (Point, Number) -> Point
		return this._transform(point.clone(), scale);
	},

	// destructive transform (faster)
	_transform: function (point, scale) {
		scale = scale || 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	},

	// @method untransform(point: Point, scale?: Number): Point
	// Returns the reverse transformation of the given point, optionally divided
	// by the given scale. Only accepts actual `L.Point` instances, not arrays.
	untransform: function (point, scale) {
		scale = scale || 1;
		return new Point(
		        (point.x / scale - this._b) / this._a,
		        (point.y / scale - this._d) / this._c);
	}
};

// factory L.transformation(a: Number, b: Number, c: Number, d: Number)

// @factory L.transformation(a: Number, b: Number, c: Number, d: Number)
// Instantiates a Transformation object with the given coefficients.

// @alternative
// @factory L.transformation(coefficients: Array): Transformation
// Expects an coefficients array of the form
// `[a: Number, b: Number, c: Number, d: Number]`.

function toTransformation(a, b, c, d) {
	return new Transformation(a, b, c, d);
}

/*
 * @namespace CRS
 * @crs L.CRS.EPSG3857
 *
 * The most common CRS for online maps, used by almost all free and commercial
 * tile providers. Uses Spherical Mercator projection. Set in by default in
 * Map's `crs` option.
 */

var EPSG3857 = extend({}, Earth, {
	code: 'EPSG:3857',
	projection: SphericalMercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * SphericalMercator.R);
		return toTransformation(scale, 0.5, -scale, 0.5);
	}())
});

var EPSG900913 = extend({}, EPSG3857, {
	code: 'EPSG:900913'
});

// @namespace SVG; @section
// There are several static functions which can be called without instantiating L.SVG:

// @function create(name: String): SVGElement
// Returns a instance of [SVGElement](https://developer.mozilla.org/docs/Web/API/SVGElement),
// corresponding to the class name passed. For example, using 'line' will return
// an instance of [SVGLineElement](https://developer.mozilla.org/docs/Web/API/SVGLineElement).
function svgCreate(name) {
	return document.createElementNS('http://www.w3.org/2000/svg', name);
}

// @function pointsToPath(rings: Point[], closed: Boolean): String
// Generates a SVG path string for multiple rings, with each ring turning
// into "M..L..L.." instructions
function pointsToPath(rings, closed) {
	var str = '',
	i, j, len, len2, points, p;

	for (i = 0, len = rings.length; i < len; i++) {
		points = rings[i];

		for (j = 0, len2 = points.length; j < len2; j++) {
			p = points[j];
			str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
		}

		// closes the ring for polygons; "x" is VML syntax
		str += closed ? (svg ? 'z' : 'x') : '';
	}

	// SVG complains about empty path strings
	return str || 'M0 0';
}

/*
 * @namespace Browser
 * @aka L.Browser
 *
 * A namespace with static properties for browser/feature detection used by Leaflet internally.
 *
 * @example
 *
 * ```js
 * if (L.Browser.ielt9) {
 *   alert('Upgrade your browser, dude!');
 * }
 * ```
 */

var style$1 = document.documentElement.style;

// @property ie: Boolean; `true` for all Internet Explorer versions (not Edge).
var ie = 'ActiveXObject' in window;

// @property ielt9: Boolean; `true` for Internet Explorer versions less than 9.
var ielt9 = ie && !document.addEventListener;

// @property edge: Boolean; `true` for the Edge web browser.
var edge = 'msLaunchUri' in navigator && !('documentMode' in document);

// @property webkit: Boolean;
// `true` for webkit-based browsers like Chrome and Safari (including mobile versions).
var webkit = userAgentContains('webkit');

// @property android: Boolean
// `true` for any browser running on an Android platform.
var android = userAgentContains('android');

// @property android23: Boolean; `true` for browsers running on Android 2 or Android 3.
var android23 = userAgentContains('android 2') || userAgentContains('android 3');

/* See https://stackoverflow.com/a/17961266 for details on detecting stock Android */
var webkitVer = parseInt(/WebKit\/([0-9]+)|$/.exec(navigator.userAgent)[1], 10); // also matches AppleWebKit
// @property androidStock: Boolean; `true` for the Android stock browser (i.e. not Chrome)
var androidStock = android && userAgentContains('Google') && webkitVer < 537 && !('AudioNode' in window);

// @property opera: Boolean; `true` for the Opera browser
var opera = !!window.opera;

// @property chrome: Boolean; `true` for the Chrome browser.
var chrome = userAgentContains('chrome');

// @property gecko: Boolean; `true` for gecko-based browsers like Firefox.
var gecko = userAgentContains('gecko') && !webkit && !opera && !ie;

// @property safari: Boolean; `true` for the Safari browser.
var safari = !chrome && userAgentContains('safari');

var phantom = userAgentContains('phantom');

// @property opera12: Boolean
// `true` for the Opera browser supporting CSS transforms (version 12 or later).
var opera12 = 'OTransition' in style$1;

// @property win: Boolean; `true` when the browser is running in a Windows platform
var win = navigator.platform.indexOf('Win') === 0;

// @property ie3d: Boolean; `true` for all Internet Explorer versions supporting CSS transforms.
var ie3d = ie && ('transition' in style$1);

// @property webkit3d: Boolean; `true` for webkit-based browsers supporting CSS transforms.
var webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23;

// @property gecko3d: Boolean; `true` for gecko-based browsers supporting CSS transforms.
var gecko3d = 'MozPerspective' in style$1;

// @property any3d: Boolean
// `true` for all browsers supporting CSS transforms.
var any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d) && !opera12 && !phantom;

// @property mobile: Boolean; `true` for all browsers running in a mobile device.
var mobile = typeof orientation !== 'undefined' || userAgentContains('mobile');

// @property mobileWebkit: Boolean; `true` for all webkit-based browsers in a mobile device.
var mobileWebkit = mobile && webkit;

// @property mobileWebkit3d: Boolean
// `true` for all webkit-based browsers in a mobile device supporting CSS transforms.
var mobileWebkit3d = mobile && webkit3d;

// @property msPointer: Boolean
// `true` for browsers implementing the Microsoft touch events model (notably IE10).
var msPointer = !window.PointerEvent && window.MSPointerEvent;

// @property pointer: Boolean
// `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
var pointer = !!(window.PointerEvent || msPointer);

// @property touch: Boolean
// `true` for all browsers supporting [touch events](https://developer.mozilla.org/docs/Web/API/Touch_events).
// This does not necessarily mean that the browser is running in a computer with
// a touchscreen, it only means that the browser is capable of understanding
// touch events.
var touch = !window.L_NO_TOUCH && (pointer || 'ontouchstart' in window ||
		(window.DocumentTouch && document instanceof window.DocumentTouch));

// @property mobileOpera: Boolean; `true` for the Opera browser in a mobile device.
var mobileOpera = mobile && opera;

// @property mobileGecko: Boolean
// `true` for gecko-based browsers running in a mobile device.
var mobileGecko = mobile && gecko;

// @property retina: Boolean
// `true` for browsers on a high-resolution "retina" screen.
var retina = (window.devicePixelRatio || (window.screen.deviceXDPI / window.screen.logicalXDPI)) > 1;


// @property canvas: Boolean
// `true` when the browser supports [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
var canvas = (function () {
	return !!document.createElement('canvas').getContext;
}());

// @property svg: Boolean
// `true` when the browser supports [SVG](https://developer.mozilla.org/docs/Web/SVG).
var svg = !!(document.createElementNS && svgCreate('svg').createSVGRect);

// @property vml: Boolean
// `true` if the browser supports [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language).
var vml = !svg && (function () {
	try {
		var div = document.createElement('div');
		div.innerHTML = '<v:shape adj="1"/>';

		var shape = div.firstChild;
		shape.style.behavior = 'url(#default#VML)';

		return shape && (typeof shape.adj === 'object');

	} catch (e) {
		return false;
	}
}());


function userAgentContains(str) {
	return navigator.userAgent.toLowerCase().indexOf(str) >= 0;
}


var Browser = (Object.freeze || Object)({
	ie: ie,
	ielt9: ielt9,
	edge: edge,
	webkit: webkit,
	android: android,
	android23: android23,
	androidStock: androidStock,
	opera: opera,
	chrome: chrome,
	gecko: gecko,
	safari: safari,
	phantom: phantom,
	opera12: opera12,
	win: win,
	ie3d: ie3d,
	webkit3d: webkit3d,
	gecko3d: gecko3d,
	any3d: any3d,
	mobile: mobile,
	mobileWebkit: mobileWebkit,
	mobileWebkit3d: mobileWebkit3d,
	msPointer: msPointer,
	pointer: pointer,
	touch: touch,
	mobileOpera: mobileOpera,
	mobileGecko: mobileGecko,
	retina: retina,
	canvas: canvas,
	svg: svg,
	vml: vml
});

/*
 * Extends L.DomEvent to provide touch support for Internet Explorer and Windows-based devices.
 */


var POINTER_DOWN =   msPointer ? 'MSPointerDown'   : 'pointerdown';
var POINTER_MOVE =   msPointer ? 'MSPointerMove'   : 'pointermove';
var POINTER_UP =     msPointer ? 'MSPointerUp'     : 'pointerup';
var POINTER_CANCEL = msPointer ? 'MSPointerCancel' : 'pointercancel';
var TAG_WHITE_LIST = ['INPUT', 'SELECT', 'OPTION'];

var _pointers = {};
var _pointerDocListener = false;

// DomEvent.DoubleTap needs to know about this
var _pointersCount = 0;

// Provides a touch events wrapper for (ms)pointer events.
// ref http://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

function addPointerListener(obj, type, handler, id) {
	if (type === 'touchstart') {
		_addPointerStart(obj, handler, id);

	} else if (type === 'touchmove') {
		_addPointerMove(obj, handler, id);

	} else if (type === 'touchend') {
		_addPointerEnd(obj, handler, id);
	}

	return this;
}

function removePointerListener(obj, type, id) {
	var handler = obj['_leaflet_' + type + id];

	if (type === 'touchstart') {
		obj.removeEventListener(POINTER_DOWN, handler, false);

	} else if (type === 'touchmove') {
		obj.removeEventListener(POINTER_MOVE, handler, false);

	} else if (type === 'touchend') {
		obj.removeEventListener(POINTER_UP, handler, false);
		obj.removeEventListener(POINTER_CANCEL, handler, false);
	}

	return this;
}

function _addPointerStart(obj, handler, id) {
	var onDown = bind(function (e) {
		if (e.pointerType !== 'mouse' && e.MSPOINTER_TYPE_MOUSE && e.pointerType !== e.MSPOINTER_TYPE_MOUSE) {
			// In IE11, some touch events needs to fire for form controls, or
			// the controls will stop working. We keep a whitelist of tag names that
			// need these events. For other target tags, we prevent default on the event.
			if (TAG_WHITE_LIST.indexOf(e.target.tagName) < 0) {
				preventDefault(e);
			} else {
				return;
			}
		}

		_handlePointer(e, handler);
	});

	obj['_leaflet_touchstart' + id] = onDown;
	obj.addEventListener(POINTER_DOWN, onDown, false);

	// need to keep track of what pointers and how many are active to provide e.touches emulation
	if (!_pointerDocListener) {
		// we listen documentElement as any drags that end by moving the touch off the screen get fired there
		document.documentElement.addEventListener(POINTER_DOWN, _globalPointerDown, true);
		document.documentElement.addEventListener(POINTER_MOVE, _globalPointerMove, true);
		document.documentElement.addEventListener(POINTER_UP, _globalPointerUp, true);
		document.documentElement.addEventListener(POINTER_CANCEL, _globalPointerUp, true);

		_pointerDocListener = true;
	}
}

function _globalPointerDown(e) {
	_pointers[e.pointerId] = e;
	_pointersCount++;
}

function _globalPointerMove(e) {
	if (_pointers[e.pointerId]) {
		_pointers[e.pointerId] = e;
	}
}

function _globalPointerUp(e) {
	delete _pointers[e.pointerId];
	_pointersCount--;
}

function _handlePointer(e, handler) {
	e.touches = [];
	for (var i in _pointers) {
		e.touches.push(_pointers[i]);
	}
	e.changedTouches = [e];

	handler(e);
}

function _addPointerMove(obj, handler, id) {
	var onMove = function (e) {
		// don't fire touch moves when mouse isn't down
		if ((e.pointerType === e.MSPOINTER_TYPE_MOUSE || e.pointerType === 'mouse') && e.buttons === 0) { return; }

		_handlePointer(e, handler);
	};

	obj['_leaflet_touchmove' + id] = onMove;
	obj.addEventListener(POINTER_MOVE, onMove, false);
}

function _addPointerEnd(obj, handler, id) {
	var onUp = function (e) {
		_handlePointer(e, handler);
	};

	obj['_leaflet_touchend' + id] = onUp;
	obj.addEventListener(POINTER_UP, onUp, false);
	obj.addEventListener(POINTER_CANCEL, onUp, false);
}

/*
 * Extends the event handling code with double tap support for mobile browsers.
 */

var _touchstart = msPointer ? 'MSPointerDown' : pointer ? 'pointerdown' : 'touchstart';
var _touchend = msPointer ? 'MSPointerUp' : pointer ? 'pointerup' : 'touchend';
var _pre = '_leaflet_';

// inspired by Zepto touch code by Thomas Fuchs
function addDoubleTapListener(obj, handler, id) {
	var last, touch$$1,
	    doubleTap = false,
	    delay = 250;

	function onTouchStart(e) {
		var count;

		if (pointer) {
			if ((!edge) || e.pointerType === 'mouse') { return; }
			count = _pointersCount;
		} else {
			count = e.touches.length;
		}

		if (count > 1) { return; }

		var now = Date.now(),
		    delta = now - (last || now);

		touch$$1 = e.touches ? e.touches[0] : e;
		doubleTap = (delta > 0 && delta <= delay);
		last = now;
	}

	function onTouchEnd(e) {
		if (doubleTap && !touch$$1.cancelBubble) {
			if (pointer) {
				if ((!edge) || e.pointerType === 'mouse') { return; }
				// work around .type being readonly with MSPointer* events
				var newTouch = {},
				    prop, i;

				for (i in touch$$1) {
					prop = touch$$1[i];
					newTouch[i] = prop && prop.bind ? prop.bind(touch$$1) : prop;
				}
				touch$$1 = newTouch;
			}
			touch$$1.type = 'dblclick';
			handler(touch$$1);
			last = null;
		}
	}

	obj[_pre + _touchstart + id] = onTouchStart;
	obj[_pre + _touchend + id] = onTouchEnd;
	obj[_pre + 'dblclick' + id] = handler;

	obj.addEventListener(_touchstart, onTouchStart, false);
	obj.addEventListener(_touchend, onTouchEnd, false);

	// On some platforms (notably, chrome<55 on win10 + touchscreen + mouse),
	// the browser doesn't fire touchend/pointerup events but does fire
	// native dblclicks. See #4127.
	// Edge 14 also fires native dblclicks, but only for pointerType mouse, see #5180.
	obj.addEventListener('dblclick', handler, false);

	return this;
}

function removeDoubleTapListener(obj, id) {
	var touchstart = obj[_pre + _touchstart + id],
	    touchend = obj[_pre + _touchend + id],
	    dblclick = obj[_pre + 'dblclick' + id];

	obj.removeEventListener(_touchstart, touchstart, false);
	obj.removeEventListener(_touchend, touchend, false);
	if (!edge) {
		obj.removeEventListener('dblclick', dblclick, false);
	}

	return this;
}

/*
 * @namespace DomEvent
 * Utility functions to work with the [DOM events](https://developer.mozilla.org/docs/Web/API/Event), used by Leaflet internally.
 */

// Inspired by John Resig, Dean Edwards and YUI addEvent implementations.

// @function on(el: HTMLElement, types: String, fn: Function, context?: Object): this
// Adds a listener function (`fn`) to a particular DOM event type of the
// element `el`. You can optionally specify the context of the listener
// (object the `this` keyword will point to). You can also pass several
// space-separated types (e.g. `'click dblclick'`).

// @alternative
// @function on(el: HTMLElement, eventMap: Object, context?: Object): this
// Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
function on(obj, types, fn, context) {

	if (typeof types === 'object') {
		for (var type in types) {
			addOne(obj, type, types[type], fn);
		}
	} else {
		types = splitWords(types);

		for (var i = 0, len = types.length; i < len; i++) {
			addOne(obj, types[i], fn, context);
		}
	}

	return this;
}

var eventsKey = '_leaflet_events';

// @function off(el: HTMLElement, types: String, fn: Function, context?: Object): this
// Removes a previously added listener function.
// Note that if you passed a custom context to on, you must pass the same
// context to `off` in order to remove the listener.

// @alternative
// @function off(el: HTMLElement, eventMap: Object, context?: Object): this
// Removes a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
function off(obj, types, fn, context) {

	if (typeof types === 'object') {
		for (var type in types) {
			removeOne(obj, type, types[type], fn);
		}
	} else if (types) {
		types = splitWords(types);

		for (var i = 0, len = types.length; i < len; i++) {
			removeOne(obj, types[i], fn, context);
		}
	} else {
		for (var j in obj[eventsKey]) {
			removeOne(obj, j, obj[eventsKey][j]);
		}
		delete obj[eventsKey];
	}

	return this;
}

function addOne(obj, type, fn, context) {
	var id = type + stamp(fn) + (context ? '_' + stamp(context) : '');

	if (obj[eventsKey] && obj[eventsKey][id]) { return this; }

	var handler = function (e) {
		return fn.call(context || obj, e || window.event);
	};

	var originalHandler = handler;

	if (pointer && type.indexOf('touch') === 0) {
		// Needs DomEvent.Pointer.js
		addPointerListener(obj, type, handler, id);

	} else if (touch && (type === 'dblclick') && addDoubleTapListener &&
	           !(pointer && chrome)) {
		// Chrome >55 does not need the synthetic dblclicks from addDoubleTapListener
		// See #5180
		addDoubleTapListener(obj, handler, id);

	} else if ('addEventListener' in obj) {

		if (type === 'mousewheel') {
			obj.addEventListener('onwheel' in obj ? 'wheel' : 'mousewheel', handler, false);

		} else if ((type === 'mouseenter') || (type === 'mouseleave')) {
			handler = function (e) {
				e = e || window.event;
				if (isExternalTarget(obj, e)) {
					originalHandler(e);
				}
			};
			obj.addEventListener(type === 'mouseenter' ? 'mouseover' : 'mouseout', handler, false);

		} else {
			if (type === 'click' && android) {
				handler = function (e) {
					filterClick(e, originalHandler);
				};
			}
			obj.addEventListener(type, handler, false);
		}

	} else if ('attachEvent' in obj) {
		obj.attachEvent('on' + type, handler);
	}

	obj[eventsKey] = obj[eventsKey] || {};
	obj[eventsKey][id] = handler;
}

function removeOne(obj, type, fn, context) {

	var id = type + stamp(fn) + (context ? '_' + stamp(context) : ''),
	    handler = obj[eventsKey] && obj[eventsKey][id];

	if (!handler) { return this; }

	if (pointer && type.indexOf('touch') === 0) {
		removePointerListener(obj, type, id);

	} else if (touch && (type === 'dblclick') && removeDoubleTapListener &&
	           !(pointer && chrome)) {
		removeDoubleTapListener(obj, id);

	} else if ('removeEventListener' in obj) {

		if (type === 'mousewheel') {
			obj.removeEventListener('onwheel' in obj ? 'wheel' : 'mousewheel', handler, false);

		} else {
			obj.removeEventListener(
				type === 'mouseenter' ? 'mouseover' :
				type === 'mouseleave' ? 'mouseout' : type, handler, false);
		}

	} else if ('detachEvent' in obj) {
		obj.detachEvent('on' + type, handler);
	}

	obj[eventsKey][id] = null;
}

// @function stopPropagation(ev: DOMEvent): this
// Stop the given event from propagation to parent elements. Used inside the listener functions:
// ```js
// L.DomEvent.on(div, 'click', function (ev) {
// 	L.DomEvent.stopPropagation(ev);
// });
// ```
function stopPropagation(e) {

	if (e.stopPropagation) {
		e.stopPropagation();
	} else if (e.originalEvent) {  // In case of Leaflet event.
		e.originalEvent._stopped = true;
	} else {
		e.cancelBubble = true;
	}
	skipped(e);

	return this;
}

// @function disableScrollPropagation(el: HTMLElement): this
// Adds `stopPropagation` to the element's `'mousewheel'` events (plus browser variants).
function disableScrollPropagation(el) {
	addOne(el, 'mousewheel', stopPropagation);
	return this;
}

// @function disableClickPropagation(el: HTMLElement): this
// Adds `stopPropagation` to the element's `'click'`, `'doubleclick'`,
// `'mousedown'` and `'touchstart'` events (plus browser variants).
function disableClickPropagation(el) {
	on(el, 'mousedown touchstart dblclick', stopPropagation);
	addOne(el, 'click', fakeStop);
	return this;
}

// @function preventDefault(ev: DOMEvent): this
// Prevents the default action of the DOM Event `ev` from happening (such as
// following a link in the href of the a element, or doing a POST request
// with page reload when a `<form>` is submitted).
// Use it inside listener functions.
function preventDefault(e) {
	if (e.preventDefault) {
		e.preventDefault();
	} else {
		e.returnValue = false;
	}
	return this;
}

// @function stop(ev: DOMEvent): this
// Does `stopPropagation` and `preventDefault` at the same time.
function stop(e) {
	preventDefault(e);
	stopPropagation(e);
	return this;
}

// @function getMousePosition(ev: DOMEvent, container?: HTMLElement): Point
// Gets normalized mouse position from a DOM event relative to the
// `container` or to the whole page if not specified.
function getMousePosition(e, container) {
	if (!container) {
		return new Point(e.clientX, e.clientY);
	}

	var rect = container.getBoundingClientRect();

	var scaleX = rect.width / container.offsetWidth || 1;
	var scaleY = rect.height / container.offsetHeight || 1;
	return new Point(
		e.clientX / scaleX - rect.left - container.clientLeft,
		e.clientY / scaleY - rect.top - container.clientTop);
}

// Chrome on Win scrolls double the pixels as in other platforms (see #4538),
// and Firefox scrolls device pixels, not CSS pixels
var wheelPxFactor =
	(win && chrome) ? 2 * window.devicePixelRatio :
	gecko ? window.devicePixelRatio : 1;

// @function getWheelDelta(ev: DOMEvent): Number
// Gets normalized wheel delta from a mousewheel DOM event, in vertical
// pixels scrolled (negative if scrolling down).
// Events from pointing devices without precise scrolling are mapped to
// a best guess of 60 pixels.
function getWheelDelta(e) {
	return (edge) ? e.wheelDeltaY / 2 : // Don't trust window-geometry-based delta
	       (e.deltaY && e.deltaMode === 0) ? -e.deltaY / wheelPxFactor : // Pixels
	       (e.deltaY && e.deltaMode === 1) ? -e.deltaY * 20 : // Lines
	       (e.deltaY && e.deltaMode === 2) ? -e.deltaY * 60 : // Pages
	       (e.deltaX || e.deltaZ) ? 0 :	// Skip horizontal/depth wheel events
	       e.wheelDelta ? (e.wheelDeltaY || e.wheelDelta) / 2 : // Legacy IE pixels
	       (e.detail && Math.abs(e.detail) < 32765) ? -e.detail * 20 : // Legacy Moz lines
	       e.detail ? e.detail / -32765 * 60 : // Legacy Moz pages
	       0;
}

var skipEvents = {};

function fakeStop(e) {
	// fakes stopPropagation by setting a special event flag, checked/reset with skipped(e)
	skipEvents[e.type] = true;
}

function skipped(e) {
	var events = skipEvents[e.type];
	// reset when checking, as it's only used in map container and propagates outside of the map
	skipEvents[e.type] = false;
	return events;
}

// check if element really left/entered the event target (for mouseenter/mouseleave)
function isExternalTarget(el, e) {

	var related = e.relatedTarget;

	if (!related) { return true; }

	try {
		while (related && (related !== el)) {
			related = related.parentNode;
		}
	} catch (err) {
		return false;
	}
	return (related !== el);
}

var lastClick;

// this is a horrible workaround for a bug in Android where a single touch triggers two click events
function filterClick(e, handler) {
	var timeStamp = (e.timeStamp || (e.originalEvent && e.originalEvent.timeStamp)),
	    elapsed = lastClick && (timeStamp - lastClick);

	// are they closer together than 500ms yet more than 100ms?
	// Android typically triggers them ~300ms apart while multiple listeners
	// on the same event should be triggered far faster;
	// or check if click is simulated on the element, and if it is, reject any non-simulated events

	if ((elapsed && elapsed > 100 && elapsed < 500) || (e.target._simulatedClick && !e._simulated)) {
		stop(e);
		return;
	}
	lastClick = timeStamp;

	handler(e);
}




var DomEvent = (Object.freeze || Object)({
	on: on,
	off: off,
	stopPropagation: stopPropagation,
	disableScrollPropagation: disableScrollPropagation,
	disableClickPropagation: disableClickPropagation,
	preventDefault: preventDefault,
	stop: stop,
	getMousePosition: getMousePosition,
	getWheelDelta: getWheelDelta,
	fakeStop: fakeStop,
	skipped: skipped,
	isExternalTarget: isExternalTarget,
	addListener: on,
	removeListener: off
});

/*
 * @namespace DomUtil
 *
 * Utility functions to work with the [DOM](https://developer.mozilla.org/docs/Web/API/Document_Object_Model)
 * tree, used by Leaflet internally.
 *
 * Most functions expecting or returning a `HTMLElement` also work for
 * SVG elements. The only difference is that classes refer to CSS classes
 * in HTML and SVG classes in SVG.
 */


// @property TRANSFORM: String
// Vendor-prefixed transform style name (e.g. `'webkitTransform'` for WebKit).
var TRANSFORM = testProp(
	['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

// webkitTransition comes first because some browser versions that drop vendor prefix don't do
// the same for the transitionend event, in particular the Android 4.1 stock browser

// @property TRANSITION: String
// Vendor-prefixed transition style name.
var TRANSITION = testProp(
	['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

// @property TRANSITION_END: String
// Vendor-prefixed transitionend event name.
var TRANSITION_END =
	TRANSITION === 'webkitTransition' || TRANSITION === 'OTransition' ? TRANSITION + 'End' : 'transitionend';


// @function get(id: String|HTMLElement): HTMLElement
// Returns an element given its DOM id, or returns the element itself
// if it was passed directly.
function get(id) {
	return typeof id === 'string' ? document.getElementById(id) : id;
}

// @function getStyle(el: HTMLElement, styleAttrib: String): String
// Returns the value for a certain style attribute on an element,
// including computed values or values set through CSS.
function getStyle(el, style) {
	var value = el.style[style] || (el.currentStyle && el.currentStyle[style]);

	if ((!value || value === 'auto') && document.defaultView) {
		var css = document.defaultView.getComputedStyle(el, null);
		value = css ? css[style] : null;
	}
	return value === 'auto' ? null : value;
}

// @function create(tagName: String, className?: String, container?: HTMLElement): HTMLElement
// Creates an HTML element with `tagName`, sets its class to `className`, and optionally appends it to `container` element.
function create$1(tagName, className, container) {
	var el = document.createElement(tagName);
	el.className = className || '';

	if (container) {
		container.appendChild(el);
	}
	return el;
}

// @function remove(el: HTMLElement)
// Removes `el` from its parent element
function remove(el) {
	var parent = el.parentNode;
	if (parent) {
		parent.removeChild(el);
	}
}

// @function empty(el: HTMLElement)
// Removes all of `el`'s children elements from `el`
function empty(el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

// @function toFront(el: HTMLElement)
// Makes `el` the last child of its parent, so it renders in front of the other children.
function toFront(el) {
	var parent = el.parentNode;
	if (parent.lastChild !== el) {
		parent.appendChild(el);
	}
}

// @function toBack(el: HTMLElement)
// Makes `el` the first child of its parent, so it renders behind the other children.
function toBack(el) {
	var parent = el.parentNode;
	if (parent.firstChild !== el) {
		parent.insertBefore(el, parent.firstChild);
	}
}

// @function hasClass(el: HTMLElement, name: String): Boolean
// Returns `true` if the element's class attribute contains `name`.
function hasClass(el, name) {
	if (el.classList !== undefined) {
		return el.classList.contains(name);
	}
	var className = getClass(el);
	return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
}

// @function addClass(el: HTMLElement, name: String)
// Adds `name` to the element's class attribute.
function addClass(el, name) {
	if (el.classList !== undefined) {
		var classes = splitWords(name);
		for (var i = 0, len = classes.length; i < len; i++) {
			el.classList.add(classes[i]);
		}
	} else if (!hasClass(el, name)) {
		var className = getClass(el);
		setClass(el, (className ? className + ' ' : '') + name);
	}
}

// @function removeClass(el: HTMLElement, name: String)
// Removes `name` from the element's class attribute.
function removeClass(el, name) {
	if (el.classList !== undefined) {
		el.classList.remove(name);
	} else {
		setClass(el, trim((' ' + getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
	}
}

// @function setClass(el: HTMLElement, name: String)
// Sets the element's class.
function setClass(el, name) {
	if (el.className.baseVal === undefined) {
		el.className = name;
	} else {
		// in case of SVG element
		el.className.baseVal = name;
	}
}

// @function getClass(el: HTMLElement): String
// Returns the element's class.
function getClass(el) {
	return el.className.baseVal === undefined ? el.className : el.className.baseVal;
}

// @function setOpacity(el: HTMLElement, opacity: Number)
// Set the opacity of an element (including old IE support).
// `opacity` must be a number from `0` to `1`.
function setOpacity(el, value) {
	if ('opacity' in el.style) {
		el.style.opacity = value;
	} else if ('filter' in el.style) {
		_setOpacityIE(el, value);
	}
}

function _setOpacityIE(el, value) {
	var filter = false,
	    filterName = 'DXImageTransform.Microsoft.Alpha';

	// filters collection throws an error if we try to retrieve a filter that doesn't exist
	try {
		filter = el.filters.item(filterName);
	} catch (e) {
		// don't set opacity to 1 if we haven't already set an opacity,
		// it isn't needed and breaks transparent pngs.
		if (value === 1) { return; }
	}

	value = Math.round(value * 100);

	if (filter) {
		filter.Enabled = (value !== 100);
		filter.Opacity = value;
	} else {
		el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
	}
}

// @function testProp(props: String[]): String|false
// Goes through the array of style names and returns the first name
// that is a valid style name for an element. If no such name is found,
// it returns false. Useful for vendor-prefixed styles like `transform`.
function testProp(props) {
	var style = document.documentElement.style;

	for (var i = 0; i < props.length; i++) {
		if (props[i] in style) {
			return props[i];
		}
	}
	return false;
}

// @function setTransform(el: HTMLElement, offset: Point, scale?: Number)
// Resets the 3D CSS transform of `el` so it is translated by `offset` pixels
// and optionally scaled by `scale`. Does not have an effect if the
// browser doesn't support 3D CSS transforms.
function setTransform(el, offset, scale) {
	var pos = offset || new Point(0, 0);

	el.style[TRANSFORM] =
		(ie3d ?
			'translate(' + pos.x + 'px,' + pos.y + 'px)' :
			'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') +
		(scale ? ' scale(' + scale + ')' : '');
}

// @function setPosition(el: HTMLElement, position: Point)
// Sets the position of `el` to coordinates specified by `position`,
// using CSS translate or top/left positioning depending on the browser
// (used by Leaflet internally to position its layers).
function setPosition(el, point) {

	/*eslint-disable */
	el._leaflet_pos = point;
	/* eslint-enable */

	if (any3d) {
		setTransform(el, point);
	} else {
		el.style.left = point.x + 'px';
		el.style.top = point.y + 'px';
	}
}

// @function getPosition(el: HTMLElement): Point
// Returns the coordinates of an element previously positioned with setPosition.
function getPosition(el) {
	// this method is only used for elements previously positioned using setPosition,
	// so it's safe to cache the position for performance

	return el._leaflet_pos || new Point(0, 0);
}

// @function disableTextSelection()
// Prevents the user from generating `selectstart` DOM events, usually generated
// when the user drags the mouse through a page with text. Used internally
// by Leaflet to override the behaviour of any click-and-drag interaction on
// the map. Affects drag interactions on the whole document.

// @function enableTextSelection()
// Cancels the effects of a previous [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection).
var disableTextSelection;
var enableTextSelection;
var _userSelect;
if ('onselectstart' in document) {
	disableTextSelection = function () {
		on(window, 'selectstart', preventDefault);
	};
	enableTextSelection = function () {
		off(window, 'selectstart', preventDefault);
	};
} else {
	var userSelectProperty = testProp(
		['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

	disableTextSelection = function () {
		if (userSelectProperty) {
			var style = document.documentElement.style;
			_userSelect = style[userSelectProperty];
			style[userSelectProperty] = 'none';
		}
	};
	enableTextSelection = function () {
		if (userSelectProperty) {
			document.documentElement.style[userSelectProperty] = _userSelect;
			_userSelect = undefined;
		}
	};
}

// @function disableImageDrag()
// As [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection), but
// for `dragstart` DOM events, usually generated when the user drags an image.
function disableImageDrag() {
	on(window, 'dragstart', preventDefault);
}

// @function enableImageDrag()
// Cancels the effects of a previous [`L.DomUtil.disableImageDrag`](#domutil-disabletextselection).
function enableImageDrag() {
	off(window, 'dragstart', preventDefault);
}

var _outlineElement;
var _outlineStyle;
// @function preventOutline(el: HTMLElement)
// Makes the [outline](https://developer.mozilla.org/docs/Web/CSS/outline)
// of the element `el` invisible. Used internally by Leaflet to prevent
// focusable elements from displaying an outline when the user performs a
// drag interaction on them.
function preventOutline(element) {
	while (element.tabIndex === -1) {
		element = element.parentNode;
	}
	if (!element.style) { return; }
	restoreOutline();
	_outlineElement = element;
	_outlineStyle = element.style.outline;
	element.style.outline = 'none';
	on(window, 'keydown', restoreOutline);
}

// @function restoreOutline()
// Cancels the effects of a previous [`L.DomUtil.preventOutline`]().
function restoreOutline() {
	if (!_outlineElement) { return; }
	_outlineElement.style.outline = _outlineStyle;
	_outlineElement = undefined;
	_outlineStyle = undefined;
	off(window, 'keydown', restoreOutline);
}


var DomUtil = (Object.freeze || Object)({
	TRANSFORM: TRANSFORM,
	TRANSITION: TRANSITION,
	TRANSITION_END: TRANSITION_END,
	get: get,
	getStyle: getStyle,
	create: create$1,
	remove: remove,
	empty: empty,
	toFront: toFront,
	toBack: toBack,
	hasClass: hasClass,
	addClass: addClass,
	removeClass: removeClass,
	setClass: setClass,
	getClass: getClass,
	setOpacity: setOpacity,
	testProp: testProp,
	setTransform: setTransform,
	setPosition: setPosition,
	getPosition: getPosition,
	disableTextSelection: disableTextSelection,
	enableTextSelection: enableTextSelection,
	disableImageDrag: disableImageDrag,
	enableImageDrag: enableImageDrag,
	preventOutline: preventOutline,
	restoreOutline: restoreOutline
});

/*
 * @class PosAnimation
 * @aka L.PosAnimation
 * @inherits Evented
 * Used internally for panning animations, utilizing CSS3 Transitions for modern browsers and a timer fallback for IE6-9.
 *
 * @example
 * ```js
 * var fx = new L.PosAnimation();
 * fx.run(el, [300, 500], 0.5);
 * ```
 *
 * @constructor L.PosAnimation()
 * Creates a `PosAnimation` object.
 *
 */

var PosAnimation = Evented.extend({

	// @method run(el: HTMLElement, newPos: Point, duration?: Number, easeLinearity?: Number)
	// Run an animation of a given element to a new position, optionally setting
	// duration in seconds (`0.25` by default) and easing linearity factor (3rd
	// argument of the [cubic bezier curve](http://cubic-bezier.com/#0,0,.5,1),
	// `0.5` by default).
	run: function (el, newPos, duration, easeLinearity) {
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._duration = duration || 0.25;
		this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

		this._startPos = getPosition(el);
		this._offset = newPos.subtract(this._startPos);
		this._startTime = +new Date();

		// @event start: Event
		// Fired when the animation starts
		this.fire('start');

		this._animate();
	},

	// @method stop()
	// Stops the animation (if currently running).
	stop: function () {
		if (!this._inProgress) { return; }

		this._step(true);
		this._complete();
	},

	_animate: function () {
		// animation loop
		this._animId = requestAnimFrame(this._animate, this);
		this._step();
	},

	_step: function (round) {
		var elapsed = (+new Date()) - this._startTime,
		    duration = this._duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._easeOut(elapsed / duration), round);
		} else {
			this._runFrame(1);
			this._complete();
		}
	},

	_runFrame: function (progress, round) {
		var pos = this._startPos.add(this._offset.multiplyBy(progress));
		if (round) {
			pos._round();
		}
		setPosition(this._el, pos);

		// @event step: Event
		// Fired continuously during the animation.
		this.fire('step');
	},

	_complete: function () {
		cancelAnimFrame(this._animId);

		this._inProgress = false;
		// @event end: Event
		// Fired when the animation ends.
		this.fire('end');
	},

	_easeOut: function (t) {
		return 1 - Math.pow(1 - t, this._easeOutPower);
	}
});

/*
 * @class Map
 * @aka L.Map
 * @inherits Evented
 *
 * The central class of the API — it is used to create a map on a page and manipulate it.
 *
 * @example
 *
 * ```js
 * // initialize the map on the "map" div with a given center and zoom
 * var map = L.map('map', {
 * 	center: [51.505, -0.09],
 * 	zoom: 13
 * });
 * ```
 *
 */

var Map = Evented.extend({

	options: {
		// @section Map State Options
		// @option crs: CRS = L.CRS.EPSG3857
		// The [Coordinate Reference System](#crs) to use. Don't change this if you're not
		// sure what it means.
		crs: EPSG3857,

		// @option center: LatLng = undefined
		// Initial geographic center of the map
		center: undefined,

		// @option zoom: Number = undefined
		// Initial map zoom level
		zoom: undefined,

		// @option minZoom: Number = *
		// Minimum zoom level of the map.
		// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
		// the lowest of their `minZoom` options will be used instead.
		minZoom: undefined,

		// @option maxZoom: Number = *
		// Maximum zoom level of the map.
		// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
		// the highest of their `maxZoom` options will be used instead.
		maxZoom: undefined,

		// @option layers: Layer[] = []
		// Array of layers that will be added to the map initially
		layers: [],

		// @option maxBounds: LatLngBounds = null
		// When this option is set, the map restricts the view to the given
		// geographical bounds, bouncing the user back if the user tries to pan
		// outside the view. To set the restriction dynamically, use
		// [`setMaxBounds`](#map-setmaxbounds) method.
		maxBounds: undefined,

		// @option renderer: Renderer = *
		// The default method for drawing vector layers on the map. `L.SVG`
		// or `L.Canvas` by default depending on browser support.
		renderer: undefined,


		// @section Animation Options
		// @option zoomAnimation: Boolean = true
		// Whether the map zoom animation is enabled. By default it's enabled
		// in all browsers that support CSS3 Transitions except Android.
		zoomAnimation: true,

		// @option zoomAnimationThreshold: Number = 4
		// Won't animate zoom if the zoom difference exceeds this value.
		zoomAnimationThreshold: 4,

		// @option fadeAnimation: Boolean = true
		// Whether the tile fade animation is enabled. By default it's enabled
		// in all browsers that support CSS3 Transitions except Android.
		fadeAnimation: true,

		// @option markerZoomAnimation: Boolean = true
		// Whether markers animate their zoom with the zoom animation, if disabled
		// they will disappear for the length of the animation. By default it's
		// enabled in all browsers that support CSS3 Transitions except Android.
		markerZoomAnimation: true,

		// @option transform3DLimit: Number = 2^23
		// Defines the maximum size of a CSS translation transform. The default
		// value should not be changed unless a web browser positions layers in
		// the wrong place after doing a large `panBy`.
		transform3DLimit: 8388608, // Precision limit of a 32-bit float

		// @section Interaction Options
		// @option zoomSnap: Number = 1
		// Forces the map's zoom level to always be a multiple of this, particularly
		// right after a [`fitBounds()`](#map-fitbounds) or a pinch-zoom.
		// By default, the zoom level snaps to the nearest integer; lower values
		// (e.g. `0.5` or `0.1`) allow for greater granularity. A value of `0`
		// means the zoom level will not be snapped after `fitBounds` or a pinch-zoom.
		zoomSnap: 1,

		// @option zoomDelta: Number = 1
		// Controls how much the map's zoom level will change after a
		// [`zoomIn()`](#map-zoomin), [`zoomOut()`](#map-zoomout), pressing `+`
		// or `-` on the keyboard, or using the [zoom controls](#control-zoom).
		// Values smaller than `1` (e.g. `0.5`) allow for greater granularity.
		zoomDelta: 1,

		// @option trackResize: Boolean = true
		// Whether the map automatically handles browser window resize to update itself.
		trackResize: true
	},

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = setOptions(this, options);

		this._initContainer(id);
		this._initLayout();

		// hack for https://github.com/Leaflet/Leaflet/issues/1980
		this._onResize = bind(this._onResize, this);

		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.zoom !== undefined) {
			this._zoom = this._limitZoom(options.zoom);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(toLatLng(options.center), options.zoom, {reset: true});
		}

		this._handlers = [];
		this._layers = {};
		this._zoomBoundLayers = {};
		this._sizeChanged = true;

		this.callInitHooks();

		// don't animate on browsers without hardware-accelerated transitions or old Android/Opera
		this._zoomAnimated = TRANSITION && any3d && !mobileOpera &&
				this.options.zoomAnimation;

		// zoom transitions run with the same duration for all layers, so if one of transitionend events
		// happens after starting zoom animation (propagating to the map pane), we know that it ended globally
		if (this._zoomAnimated) {
			this._createAnimProxy();
			on(this._proxy, TRANSITION_END, this._catchTransitionEnd, this);
		}

		this._addLayers(this.options.layers);
	},


	// @section Methods for modifying map state

	// @method setView(center: LatLng, zoom: Number, options?: Zoom/pan options): this
	// Sets the view of the map (geographical center and zoom) with the given
	// animation options.
	setView: function (center, zoom, options) {

		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(toLatLng(center), zoom, this.options.maxBounds);
		options = options || {};

		this._stop();

		if (this._loaded && !options.reset && options !== true) {

			if (options.animate !== undefined) {
				options.zoom = extend({animate: options.animate}, options.zoom);
				options.pan = extend({animate: options.animate, duration: options.duration}, options.pan);
			}

			// try animating pan or zoom
			var moved = (this._zoom !== zoom) ?
				this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (moved) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom);

		return this;
	},

	// @method setZoom(zoom: Number, options?: Zoom/pan options): this
	// Sets the zoom of the map.
	setZoom: function (zoom, options) {
		if (!this._loaded) {
			this._zoom = zoom;
			return this;
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	},

	// @method zoomIn(delta?: Number, options?: Zoom options): this
	// Increases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
	zoomIn: function (delta, options) {
		delta = delta || (any3d ? this.options.zoomDelta : 1);
		return this.setZoom(this._zoom + delta, options);
	},

	// @method zoomOut(delta?: Number, options?: Zoom options): this
	// Decreases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
	zoomOut: function (delta, options) {
		delta = delta || (any3d ? this.options.zoomDelta : 1);
		return this.setZoom(this._zoom - delta, options);
	},

	// @method setZoomAround(latlng: LatLng, zoom: Number, options: Zoom options): this
	// Zooms the map while keeping a specified geographical point on the map
	// stationary (e.g. used internally for scroll zoom and double-click zoom).
	// @alternative
	// @method setZoomAround(offset: Point, zoom: Number, options: Zoom options): this
	// Zooms the map while keeping a specified pixel on the map (relative to the top-left corner) stationary.
	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof Point ? latlng : this.latLngToContainerPoint(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	_getBoundsCenterZoom: function (bounds, options) {

		options = options || {};
		bounds = bounds.getBounds ? bounds.getBounds() : toLatLngBounds(bounds);

		var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]),

		    zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

		zoom = (typeof options.maxZoom === 'number') ? Math.min(options.maxZoom, zoom) : zoom;

		if (zoom === Infinity) {
			return {
				center: bounds.getCenter(),
				zoom: zoom
			};
		}

		var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		return {
			center: center,
			zoom: zoom
		};
	},

	// @method fitBounds(bounds: LatLngBounds, options?: fitBounds options): this
	// Sets a map view that contains the given geographical bounds with the
	// maximum zoom level possible.
	fitBounds: function (bounds, options) {

		bounds = toLatLngBounds(bounds);

		if (!bounds.isValid()) {
			throw new Error('Bounds are not valid.');
		}

		var target = this._getBoundsCenterZoom(bounds, options);
		return this.setView(target.center, target.zoom, options);
	},

	// @method fitWorld(options?: fitBounds options): this
	// Sets a map view that mostly contains the whole world with the maximum
	// zoom level possible.
	fitWorld: function (options) {
		return this.fitBounds([[-90, -180], [90, 180]], options);
	},

	// @method panTo(latlng: LatLng, options?: Pan options): this
	// Pans the map to a given center.
	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	// @method panBy(offset: Point, options?: Pan options): this
	// Pans the map by a given number of pixels (animated).
	panBy: function (offset, options) {
		offset = toPoint(offset).round();
		options = options || {};

		if (!offset.x && !offset.y) {
			return this.fire('moveend');
		}
		// If we pan too far, Chrome gets issues with tiles
		// and makes them disappear or appear in the wrong place (slightly offset) #2602
		if (options.animate !== true && !this.getSize().contains(offset)) {
			this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
			return this;
		}

		if (!this._panAnim) {
			this._panAnim = new PosAnimation();

			this._panAnim.on({
				'step': this._onPanTransitionStep,
				'end': this._onPanTransitionEnd
			}, this);
		}

		// don't fire movestart if animating inertia
		if (!options.noMoveStart) {
			this.fire('movestart');
		}

		// animate pan unless animate: false specified
		if (options.animate !== false) {
			addClass(this._mapPane, 'leaflet-pan-anim');

			var newPos = this._getMapPanePos().subtract(offset).round();
			this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
	},

	// @method flyTo(latlng: LatLng, zoom?: Number, options?: Zoom/pan options): this
	// Sets the view of the map (geographical center and zoom) performing a smooth
	// pan-zoom animation.
	flyTo: function (targetCenter, targetZoom, options) {

		options = options || {};
		if (options.animate === false || !any3d) {
			return this.setView(targetCenter, targetZoom, options);
		}

		this._stop();

		var from = this.project(this.getCenter()),
		    to = this.project(targetCenter),
		    size = this.getSize(),
		    startZoom = this._zoom;

		targetCenter = toLatLng(targetCenter);
		targetZoom = targetZoom === undefined ? startZoom : targetZoom;

		var w0 = Math.max(size.x, size.y),
		    w1 = w0 * this.getZoomScale(startZoom, targetZoom),
		    u1 = (to.distanceTo(from)) || 1,
		    rho = 1.42,
		    rho2 = rho * rho;

		function r(i) {
			var s1 = i ? -1 : 1,
			    s2 = i ? w1 : w0,
			    t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1,
			    b1 = 2 * s2 * rho2 * u1,
			    b = t1 / b1,
			    sq = Math.sqrt(b * b + 1) - b;

			    // workaround for floating point precision bug when sq = 0, log = -Infinite,
			    // thus triggering an infinite loop in flyTo
			    var log = sq < 0.000000001 ? -18 : Math.log(sq);

			return log;
		}

		function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
		function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
		function tanh(n) { return sinh(n) / cosh(n); }

		var r0 = r(0);

		function w(s) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
		function u(s) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

		function easeOut(t) { return 1 - Math.pow(1 - t, 1.5); }

		var start = Date.now(),
		    S = (r(1) - r0) / rho,
		    duration = options.duration ? 1000 * options.duration : 1000 * S * 0.8;

		function frame() {
			var t = (Date.now() - start) / duration,
			    s = easeOut(t) * S;

			if (t <= 1) {
				this._flyToFrame = requestAnimFrame(frame, this);

				this._move(
					this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
					this.getScaleZoom(w0 / w(s), startZoom),
					{flyTo: true});

			} else {
				this
					._move(targetCenter, targetZoom)
					._moveEnd(true);
			}
		}

		this._moveStart(true, options.noMoveStart);

		frame.call(this);
		return this;
	},

	// @method flyToBounds(bounds: LatLngBounds, options?: fitBounds options): this
	// Sets the view of the map with a smooth animation like [`flyTo`](#map-flyto),
	// but takes a bounds parameter like [`fitBounds`](#map-fitbounds).
	flyToBounds: function (bounds, options) {
		var target = this._getBoundsCenterZoom(bounds, options);
		return this.flyTo(target.center, target.zoom, options);
	},

	// @method setMaxBounds(bounds: Bounds): this
	// Restricts the map view to the given bounds (see the [maxBounds](#map-maxbounds) option).
	setMaxBounds: function (bounds) {
		bounds = toLatLngBounds(bounds);

		if (!bounds.isValid()) {
			this.options.maxBounds = null;
			return this.off('moveend', this._panInsideMaxBounds);
		} else if (this.options.maxBounds) {
			this.off('moveend', this._panInsideMaxBounds);
		}

		this.options.maxBounds = bounds;

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		return this.on('moveend', this._panInsideMaxBounds);
	},

	// @method setMinZoom(zoom: Number): this
	// Sets the lower limit for the available zoom levels (see the [minZoom](#map-minzoom) option).
	setMinZoom: function (zoom) {
		var oldZoom = this.options.minZoom;
		this.options.minZoom = zoom;

		if (this._loaded && oldZoom !== zoom) {
			this.fire('zoomlevelschange');

			if (this.getZoom() < this.options.minZoom) {
				return this.setZoom(zoom);
			}
		}

		return this;
	},

	// @method setMaxZoom(zoom: Number): this
	// Sets the upper limit for the available zoom levels (see the [maxZoom](#map-maxzoom) option).
	setMaxZoom: function (zoom) {
		var oldZoom = this.options.maxZoom;
		this.options.maxZoom = zoom;

		if (this._loaded && oldZoom !== zoom) {
			this.fire('zoomlevelschange');

			if (this.getZoom() > this.options.maxZoom) {
				return this.setZoom(zoom);
			}
		}

		return this;
	},

	// @method panInsideBounds(bounds: LatLngBounds, options?: Pan options): this
	// Pans the map to the closest view that would lie inside the given bounds (if it's not already), controlling the animation using the options specific, if any.
	panInsideBounds: function (bounds, options) {
		this._enforcingBounds = true;
		var center = this.getCenter(),
		    newCenter = this._limitCenter(center, this._zoom, toLatLngBounds(bounds));

		if (!center.equals(newCenter)) {
			this.panTo(newCenter, options);
		}

		this._enforcingBounds = false;
		return this;
	},

	// @method invalidateSize(options: Zoom/pan options): this
	// Checks if the map container size changed and updates the map if so —
	// call it after you've changed the map size dynamically, also animating
	// pan by default. If `options.pan` is `false`, panning will not occur.
	// If `options.debounceMoveend` is `true`, it will delay `moveend` event so
	// that it doesn't happen often even if the method is called many
	// times in a row.

	// @alternative
	// @method invalidateSize(animate: Boolean): this
	// Checks if the map container size changed and updates the map if so —
	// call it after you've changed the map size dynamically, also animating
	// pan by default.
	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = extend({
			animate: false,
			pan: true
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;
		this._lastCenter = null;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		// @section Map state change events
		// @event resize: ResizeEvent
		// Fired when the map is resized.
		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	// @section Methods for modifying map state
	// @method stop(): this
	// Stops the currently running `panTo` or `flyTo` animation, if any.
	stop: function () {
		this.setZoom(this._limitZoom(this._zoom));
		if (!this.options.zoomSnap) {
			this.fire('viewreset');
		}
		return this._stop();
	},

	// @section Geolocation methods
	// @method locate(options?: Locate options): this
	// Tries to locate the user using the Geolocation API, firing a [`locationfound`](#map-locationfound)
	// event with location data on success or a [`locationerror`](#map-locationerror) event on failure,
	// and optionally sets the map view to the user's location with respect to
	// detection accuracy (or to the world view if geolocation failed).
	// Note that, if your page doesn't use HTTPS, this method will fail in
	// modern browsers ([Chrome 50 and newer](https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-powerful-features-on-insecure-origins))
	// See `Locate options` for more details.
	locate: function (options) {

		options = this._locateOptions = extend({
			timeout: 10000,
			watch: false
			// setView: false
			// maxZoom: <Number>
			// maximumAge: 0
			// enableHighAccuracy: false
		}, options);

		if (!('geolocation' in navigator)) {
			this._handleGeolocationError({
				code: 0,
				message: 'Geolocation not supported.'
			});
			return this;
		}

		var onResponse = bind(this._handleGeolocationResponse, this),
		    onError = bind(this._handleGeolocationError, this);

		if (options.watch) {
			this._locationWatchId =
			        navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	},

	// @method stopLocate(): this
	// Stops watching location previously initiated by `map.locate({watch: true})`
	// and aborts resetting the map view if map.locate was called with
	// `{setView: true}`.
	stopLocate: function () {
		if (navigator.geolocation && navigator.geolocation.clearWatch) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	},

	_handleGeolocationError: function (error) {
		var c = error.code,
		    message = error.message ||
		            (c === 1 ? 'permission denied' :
		            (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions.setView && !this._loaded) {
			this.fitWorld();
		}

		// @section Location events
		// @event locationerror: ErrorEvent
		// Fired when geolocation (using the [`locate`](#map-locate) method) failed.
		this.fire('locationerror', {
			code: c,
			message: 'Geolocation error: ' + message + '.'
		});
	},

	_handleGeolocationResponse: function (pos) {
		var lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new LatLng(lat, lng),
		    bounds = latlng.toBounds(pos.coords.accuracy),
		    options = this._locateOptions;

		if (options.setView) {
			var zoom = this.getBoundsZoom(bounds);
			this.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
		}

		var data = {
			latlng: latlng,
			bounds: bounds,
			timestamp: pos.timestamp
		};

		for (var i in pos.coords) {
			if (typeof pos.coords[i] === 'number') {
				data[i] = pos.coords[i];
			}
		}

		// @event locationfound: LocationEvent
		// Fired when geolocation (using the [`locate`](#map-locate) method)
		// went successfully.
		this.fire('locationfound', data);
	},

	// TODO Appropriate docs section?
	// @section Other Methods
	// @method addHandler(name: String, HandlerClass: Function): this
	// Adds a new `Handler` to the map, given its name and constructor function.
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		return this;
	},

	// @method remove(): this
	// Destroys the map and clears all related event listeners.
	remove: function () {

		this._initEvents(true);

		if (this._containerId !== this._container._leaflet_id) {
			throw new Error('Map container is being reused by another instance');
		}

		try {
			// throws error in IE6-8
			delete this._container._leaflet_id;
			delete this._containerId;
		} catch (e) {
			/*eslint-disable */
			this._container._leaflet_id = undefined;
			/* eslint-enable */
			this._containerId = undefined;
		}

		if (this._locationWatchId !== undefined) {
			this.stopLocate();
		}

		this._stop();

		remove(this._mapPane);

		if (this._clearControlPos) {
			this._clearControlPos();
		}

		this._clearHandlers();

		if (this._loaded) {
			// @section Map state change events
			// @event unload: Event
			// Fired when the map is destroyed with [remove](#map-remove) method.
			this.fire('unload');
		}

		var i;
		for (i in this._layers) {
			this._layers[i].remove();
		}
		for (i in this._panes) {
			remove(this._panes[i]);
		}

		this._layers = [];
		this._panes = [];
		delete this._mapPane;
		delete this._renderer;

		return this;
	},

	// @section Other Methods
	// @method createPane(name: String, container?: HTMLElement): HTMLElement
	// Creates a new [map pane](#map-pane) with the given name if it doesn't exist already,
	// then returns it. The pane is created as a child of `container`, or
	// as a child of the main map pane if not set.
	createPane: function (name, container) {
		var className = 'leaflet-pane' + (name ? ' leaflet-' + name.replace('Pane', '') + '-pane' : ''),
		    pane = create$1('div', className, container || this._mapPane);

		if (name) {
			this._panes[name] = pane;
		}
		return pane;
	},

	// @section Methods for Getting Map State

	// @method getCenter(): LatLng
	// Returns the geographical center of the map view
	getCenter: function () {
		this._checkIfLoaded();

		if (this._lastCenter && !this._moved()) {
			return this._lastCenter;
		}
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	// @method getZoom(): Number
	// Returns the current zoom level of the map view
	getZoom: function () {
		return this._zoom;
	},

	// @method getBounds(): LatLngBounds
	// Returns the geographical bounds visible in the current map view
	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new LatLngBounds(sw, ne);
	},

	// @method getMinZoom(): Number
	// Returns the minimum zoom level of the map (if set in the `minZoom` option of the map or of any layers), or `0` by default.
	getMinZoom: function () {
		return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
	},

	// @method getMaxZoom(): Number
	// Returns the maximum zoom level of the map (if set in the `maxZoom` option of the map or of any layers).
	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	// @method getBoundsZoom(bounds: LatLngBounds, inside?: Boolean): Number
	// Returns the maximum zoom level on which the given bounds fit to the map
	// view in its entirety. If `inside` (optional) is set to `true`, the method
	// instead returns the minimum zoom level on which the map view fits into
	// the given bounds in its entirety.
	getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
		bounds = toLatLngBounds(bounds);
		padding = toPoint(padding || [0, 0]);

		var zoom = this.getZoom() || 0,
		    min = this.getMinZoom(),
		    max = this.getMaxZoom(),
		    nw = bounds.getNorthWest(),
		    se = bounds.getSouthEast(),
		    size = this.getSize().subtract(padding),
		    boundsSize = toBounds(this.project(se, zoom), this.project(nw, zoom)).getSize(),
		    snap = any3d ? this.options.zoomSnap : 1,
		    scalex = size.x / boundsSize.x,
		    scaley = size.y / boundsSize.y,
		    scale = inside ? Math.max(scalex, scaley) : Math.min(scalex, scaley);

		zoom = this.getScaleZoom(scale, zoom);

		if (snap) {
			zoom = Math.round(zoom / (snap / 100)) * (snap / 100); // don't jump if within 1% of a snap level
			zoom = inside ? Math.ceil(zoom / snap) * snap : Math.floor(zoom / snap) * snap;
		}

		return Math.max(min, Math.min(max, zoom));
	},

	// @method getSize(): Point
	// Returns the current size of the map container (in pixels).
	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new Point(
				this._container.clientWidth || 0,
				this._container.clientHeight || 0);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	// @method getPixelBounds(): Bounds
	// Returns the bounds of the current map view in projected pixel
	// coordinates (sometimes useful in layer and overlay implementations).
	getPixelBounds: function (center, zoom) {
		var topLeftPoint = this._getTopLeftPoint(center, zoom);
		return new Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	// TODO: Check semantics - isn't the pixel origin the 0,0 coord relative to
	// the map pane? "left point of the map layer" can be confusing, specially
	// since there can be negative offsets.
	// @method getPixelOrigin(): Point
	// Returns the projected pixel coordinates of the top left point of
	// the map layer (useful in custom layer and overlay implementations).
	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._pixelOrigin;
	},

	// @method getPixelWorldBounds(zoom?: Number): Bounds
	// Returns the world's bounds in pixel coordinates for zoom level `zoom`.
	// If `zoom` is omitted, the map's current zoom level is used.
	getPixelWorldBounds: function (zoom) {
		return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
	},

	// @section Other Methods

	// @method getPane(pane: String|HTMLElement): HTMLElement
	// Returns a [map pane](#map-pane), given its name or its HTML element (its identity).
	getPane: function (pane) {
		return typeof pane === 'string' ? this._panes[pane] : pane;
	},

	// @method getPanes(): Object
	// Returns a plain object containing the names of all [panes](#map-pane) as keys and
	// the panes as values.
	getPanes: function () {
		return this._panes;
	},

	// @method getContainer: HTMLElement
	// Returns the HTML element that contains the map.
	getContainer: function () {
		return this._container;
	},


	// @section Conversion Methods

	// @method getZoomScale(toZoom: Number, fromZoom: Number): Number
	// Returns the scale factor to be applied to a map transition from zoom level
	// `fromZoom` to `toZoom`. Used internally to help with zoom animations.
	getZoomScale: function (toZoom, fromZoom) {
		// TODO replace with universal implementation after refactoring projections
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return crs.scale(toZoom) / crs.scale(fromZoom);
	},

	// @method getScaleZoom(scale: Number, fromZoom: Number): Number
	// Returns the zoom level that the map would end up at, if it is at `fromZoom`
	// level and everything is scaled by a factor of `scale`. Inverse of
	// [`getZoomScale`](#map-getZoomScale).
	getScaleZoom: function (scale, fromZoom) {
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		var zoom = crs.zoom(scale * crs.scale(fromZoom));
		return isNaN(zoom) ? Infinity : zoom;
	},

	// @method project(latlng: LatLng, zoom: Number): Point
	// Projects a geographical coordinate `LatLng` according to the projection
	// of the map's CRS, then scales it according to `zoom` and the CRS's
	// `Transformation`. The result is pixel coordinate relative to
	// the CRS origin.
	project: function (latlng, zoom) {
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.latLngToPoint(toLatLng(latlng), zoom);
	},

	// @method unproject(point: Point, zoom: Number): LatLng
	// Inverse of [`project`](#map-project).
	unproject: function (point, zoom) {
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(toPoint(point), zoom);
	},

	// @method layerPointToLatLng(point: Point): LatLng
	// Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
	// returns the corresponding geographical coordinate (for the current zoom level).
	layerPointToLatLng: function (point) {
		var projectedPoint = toPoint(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	// @method latLngToLayerPoint(latlng: LatLng): Point
	// Given a geographical coordinate, returns the corresponding pixel coordinate
	// relative to the [origin pixel](#map-getpixelorigin).
	latLngToLayerPoint: function (latlng) {
		var projectedPoint = this.project(toLatLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	// @method wrapLatLng(latlng: LatLng): LatLng
	// Returns a `LatLng` where `lat` and `lng` has been wrapped according to the
	// map's CRS's `wrapLat` and `wrapLng` properties, if they are outside the
	// CRS's bounds.
	// By default this means longitude is wrapped around the dateline so its
	// value is between -180 and +180 degrees.
	wrapLatLng: function (latlng) {
		return this.options.crs.wrapLatLng(toLatLng(latlng));
	},

	// @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
	// Returns a `LatLngBounds` with the same size as the given one, ensuring that
	// its center is within the CRS's bounds.
	// By default this means the center longitude is wrapped around the dateline so its
	// value is between -180 and +180 degrees, and the majority of the bounds
	// overlaps the CRS's bounds.
	wrapLatLngBounds: function (latlng) {
		return this.options.crs.wrapLatLngBounds(toLatLngBounds(latlng));
	},

	// @method distance(latlng1: LatLng, latlng2: LatLng): Number
	// Returns the distance between two geographical coordinates according to
	// the map's CRS. By default this measures distance in meters.
	distance: function (latlng1, latlng2) {
		return this.options.crs.distance(toLatLng(latlng1), toLatLng(latlng2));
	},

	// @method containerPointToLayerPoint(point: Point): Point
	// Given a pixel coordinate relative to the map container, returns the corresponding
	// pixel coordinate relative to the [origin pixel](#map-getpixelorigin).
	containerPointToLayerPoint: function (point) { // (Point)
		return toPoint(point).subtract(this._getMapPanePos());
	},

	// @method layerPointToContainerPoint(point: Point): Point
	// Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
	// returns the corresponding pixel coordinate relative to the map container.
	layerPointToContainerPoint: function (point) { // (Point)
		return toPoint(point).add(this._getMapPanePos());
	},

	// @method containerPointToLatLng(point: Point): LatLng
	// Given a pixel coordinate relative to the map container, returns
	// the corresponding geographical coordinate (for the current zoom level).
	containerPointToLatLng: function (point) {
		var layerPoint = this.containerPointToLayerPoint(toPoint(point));
		return this.layerPointToLatLng(layerPoint);
	},

	// @method latLngToContainerPoint(latlng: LatLng): Point
	// Given a geographical coordinate, returns the corresponding pixel coordinate
	// relative to the map container.
	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(toLatLng(latlng)));
	},

	// @method mouseEventToContainerPoint(ev: MouseEvent): Point
	// Given a MouseEvent object, returns the pixel coordinate relative to the
	// map container where the event took place.
	mouseEventToContainerPoint: function (e) {
		return getMousePosition(e, this._container);
	},

	// @method mouseEventToLayerPoint(ev: MouseEvent): Point
	// Given a MouseEvent object, returns the pixel coordinate relative to
	// the [origin pixel](#map-getpixelorigin) where the event took place.
	mouseEventToLayerPoint: function (e) {
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	// @method mouseEventToLatLng(ev: MouseEvent): LatLng
	// Given a MouseEvent object, returns geographical coordinate where the
	// event took place.
	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},


	// map initialization methods

	_initContainer: function (id) {
		var container = this._container = get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet_id) {
			throw new Error('Map container is already initialized.');
		}

		on(container, 'scroll', this._onScroll, this);
		this._containerId = stamp(container);
	},

	_initLayout: function () {
		var container = this._container;

		this._fadeAnimated = this.options.fadeAnimation && any3d;

		addClass(container, 'leaflet-container' +
			(touch ? ' leaflet-touch' : '') +
			(retina ? ' leaflet-retina' : '') +
			(ielt9 ? ' leaflet-oldie' : '') +
			(safari ? ' leaflet-safari' : '') +
			(this._fadeAnimated ? ' leaflet-fade-anim' : ''));

		var position = getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
			container.style.position = 'relative';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};
		this._paneRenderers = {};

		// @section
		//
		// Panes are DOM elements used to control the ordering of layers on the map. You
		// can access panes with [`map.getPane`](#map-getpane) or
		// [`map.getPanes`](#map-getpanes) methods. New panes can be created with the
		// [`map.createPane`](#map-createpane) method.
		//
		// Every map has the following default panes that differ only in zIndex.
		//
		// @pane mapPane: HTMLElement = 'auto'
		// Pane that contains all other map panes

		this._mapPane = this.createPane('mapPane', this._container);
		setPosition(this._mapPane, new Point(0, 0));

		// @pane tilePane: HTMLElement = 200
		// Pane for `GridLayer`s and `TileLayer`s
		this.createPane('tilePane');
		// @pane overlayPane: HTMLElement = 400
		// Pane for vectors (`Path`s, like `Polyline`s and `Polygon`s), `ImageOverlay`s and `VideoOverlay`s
		this.createPane('shadowPane');
		// @pane shadowPane: HTMLElement = 500
		// Pane for overlay shadows (e.g. `Marker` shadows)
		this.createPane('overlayPane');
		// @pane markerPane: HTMLElement = 600
		// Pane for `Icon`s of `Marker`s
		this.createPane('markerPane');
		// @pane tooltipPane: HTMLElement = 650
		// Pane for `Tooltip`s.
		this.createPane('tooltipPane');
		// @pane popupPane: HTMLElement = 700
		// Pane for `Popup`s.
		this.createPane('popupPane');

		if (!this.options.markerZoomAnimation) {
			addClass(panes.markerPane, 'leaflet-zoom-hide');
			addClass(panes.shadowPane, 'leaflet-zoom-hide');
		}
	},


	// private methods that modify map state

	// @section Map state change events
	_resetView: function (center, zoom) {
		setPosition(this._mapPane, new Point(0, 0));

		var loading = !this._loaded;
		this._loaded = true;
		zoom = this._limitZoom(zoom);

		this.fire('viewprereset');

		var zoomChanged = this._zoom !== zoom;
		this
			._moveStart(zoomChanged, false)
			._move(center, zoom)
			._moveEnd(zoomChanged);

		// @event viewreset: Event
		// Fired when the map needs to redraw its content (this usually happens
		// on map zoom or load). Very useful for creating custom overlays.
		this.fire('viewreset');

		// @event load: Event
		// Fired when the map is initialized (when its center and zoom are set
		// for the first time).
		if (loading) {
			this.fire('load');
		}
	},

	_moveStart: function (zoomChanged, noMoveStart) {
		// @event zoomstart: Event
		// Fired when the map zoom is about to change (e.g. before zoom animation).
		// @event movestart: Event
		// Fired when the view of the map starts changing (e.g. user starts dragging the map).
		if (zoomChanged) {
			this.fire('zoomstart');
		}
		if (!noMoveStart) {
			this.fire('movestart');
		}
		return this;
	},

	_move: function (center, zoom, data) {
		if (zoom === undefined) {
			zoom = this._zoom;
		}
		var zoomChanged = this._zoom !== zoom;

		this._zoom = zoom;
		this._lastCenter = center;
		this._pixelOrigin = this._getNewPixelOrigin(center);

		// @event zoom: Event
		// Fired repeatedly during any change in zoom level, including zoom
		// and fly animations.
		if (zoomChanged || (data && data.pinch)) {	// Always fire 'zoom' if pinching because #3530
			this.fire('zoom', data);
		}

		// @event move: Event
		// Fired repeatedly during any movement of the map, including pan and
		// fly animations.
		return this.fire('move', data);
	},

	_moveEnd: function (zoomChanged) {
		// @event zoomend: Event
		// Fired when the map has changed, after any animations.
		if (zoomChanged) {
			this.fire('zoomend');
		}

		// @event moveend: Event
		// Fired when the center of the map stops changing (e.g. user stopped
		// dragging the map).
		return this.fire('moveend');
	},

	_stop: function () {
		cancelAnimFrame(this._flyToFrame);
		if (this._panAnim) {
			this._panAnim.stop();
		}
		return this;
	},

	_rawPanBy: function (offset) {
		setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_panInsideMaxBounds: function () {
		if (!this._enforcingBounds) {
			this.panInsideBounds(this.options.maxBounds);
		}
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// DOM event handling

	// @section Interaction events
	_initEvents: function (remove$$1) {
		this._targets = {};
		this._targets[stamp(this._container)] = this;

		var onOff = remove$$1 ? off : on;

		// @event click: MouseEvent
		// Fired when the user clicks (or taps) the map.
		// @event dblclick: MouseEvent
		// Fired when the user double-clicks (or double-taps) the map.
		// @event mousedown: MouseEvent
		// Fired when the user pushes the mouse button on the map.
		// @event mouseup: MouseEvent
		// Fired when the user releases the mouse button on the map.
		// @event mouseover: MouseEvent
		// Fired when the mouse enters the map.
		// @event mouseout: MouseEvent
		// Fired when the mouse leaves the map.
		// @event mousemove: MouseEvent
		// Fired while the mouse moves over the map.
		// @event contextmenu: MouseEvent
		// Fired when the user pushes the right mouse button on the map, prevents
		// default browser context menu from showing if there are listeners on
		// this event. Also fired on mobile when the user holds a single touch
		// for a second (also called long press).
		// @event keypress: KeyboardEvent
		// Fired when the user presses a key from the keyboard while the map is focused.
		onOff(this._container, 'click dblclick mousedown mouseup ' +
			'mouseover mouseout mousemove contextmenu keypress', this._handleDOMEvent, this);

		if (this.options.trackResize) {
			onOff(window, 'resize', this._onResize, this);
		}

		if (any3d && this.options.transform3DLimit) {
			(remove$$1 ? this.off : this.on).call(this, 'moveend', this._onMoveEnd);
		}
	},

	_onResize: function () {
		cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = requestAnimFrame(
		        function () { this.invalidateSize({debounceMoveend: true}); }, this);
	},

	_onScroll: function () {
		this._container.scrollTop  = 0;
		this._container.scrollLeft = 0;
	},

	_onMoveEnd: function () {
		var pos = this._getMapPanePos();
		if (Math.max(Math.abs(pos.x), Math.abs(pos.y)) >= this.options.transform3DLimit) {
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1203873 but Webkit also have
			// a pixel offset on very high values, see: http://jsfiddle.net/dg6r5hhb/
			this._resetView(this.getCenter(), this.getZoom());
		}
	},

	_findEventTargets: function (e, type) {
		var targets = [],
		    target,
		    isHover = type === 'mouseout' || type === 'mouseover',
		    src = e.target || e.srcElement,
		    dragging = false;

		while (src) {
			target = this._targets[stamp(src)];
			if (target && (type === 'click' || type === 'preclick') && !e._simulated && this._draggableMoved(target)) {
				// Prevent firing click after you just dragged an object.
				dragging = true;
				break;
			}
			if (target && target.listens(type, true)) {
				if (isHover && !isExternalTarget(src, e)) { break; }
				targets.push(target);
				if (isHover) { break; }
			}
			if (src === this._container) { break; }
			src = src.parentNode;
		}
		if (!targets.length && !dragging && !isHover && isExternalTarget(src, e)) {
			targets = [this];
		}
		return targets;
	},

	_handleDOMEvent: function (e) {
		if (!this._loaded || skipped(e)) { return; }

		var type = e.type;

		if (type === 'mousedown' || type === 'keypress') {
			// prevents outline when clicking on keyboard-focusable element
			preventOutline(e.target || e.srcElement);
		}

		this._fireDOMEvent(e, type);
	},

	_mouseEvents: ['click', 'dblclick', 'mouseover', 'mouseout', 'contextmenu'],

	_fireDOMEvent: function (e, type, targets) {

		if (e.type === 'click') {
			// Fire a synthetic 'preclick' event which propagates up (mainly for closing popups).
			// @event preclick: MouseEvent
			// Fired before mouse click on the map (sometimes useful when you
			// want something to happen on click before any existing click
			// handlers start running).
			var synth = extend({}, e);
			synth.type = 'preclick';
			this._fireDOMEvent(synth, synth.type, targets);
		}

		if (e._stopped) { return; }

		// Find the layer the event is propagating from and its parents.
		targets = (targets || []).concat(this._findEventTargets(e, type));

		if (!targets.length) { return; }

		var target = targets[0];
		if (type === 'contextmenu' && target.listens(type, true)) {
			preventDefault(e);
		}

		var data = {
			originalEvent: e
		};

		if (e.type !== 'keypress') {
			var isMarker = target.getLatLng && (!target._radius || target._radius <= 10);
			data.containerPoint = isMarker ?
				this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
			data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
			data.latlng = isMarker ? target.getLatLng() : this.layerPointToLatLng(data.layerPoint);
		}

		for (var i = 0; i < targets.length; i++) {
			targets[i].fire(type, data, true);
			if (data.originalEvent._stopped ||
				(targets[i].options.bubblingMouseEvents === false && indexOf(this._mouseEvents, type) !== -1)) { return; }
		}
	},

	_draggableMoved: function (obj) {
		obj = obj.dragging && obj.dragging.enabled() ? obj : this;
		return (obj.dragging && obj.dragging.moved()) || (this.boxZoom && this.boxZoom.moved());
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	// @section Other Methods

	// @method whenReady(fn: Function, context?: Object): this
	// Runs the given function `fn` when the map gets initialized with
	// a view (center and zoom) and at least one layer, or immediately
	// if it's already initialized, optionally passing a function context.
	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, {target: this});
		} else {
			this.on('load', callback, context);
		}
		return this;
	},


	// private methods for getting map state

	_getMapPanePos: function () {
		return getPosition(this._mapPane) || new Point(0, 0);
	},

	_moved: function () {
		var pos = this._getMapPanePos();
		return pos && !pos.equals([0, 0]);
	},

	_getTopLeftPoint: function (center, zoom) {
		var pixelOrigin = center && zoom !== undefined ?
			this._getNewPixelOrigin(center, zoom) :
			this.getPixelOrigin();
		return pixelOrigin.subtract(this._getMapPanePos());
	},

	_getNewPixelOrigin: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
	},

	_latLngToNewLayerPoint: function (latlng, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return this.project(latlng, zoom)._subtract(topLeft);
	},

	_latLngBoundsToNewLayerBounds: function (latLngBounds, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return toBounds([
			this.project(latLngBounds.getSouthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getSouthEast(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthEast(), zoom)._subtract(topLeft)
		]);
	},

	// layer point of the current center
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	},

	// offset of the specified place to the current center in pixels
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// adjust center for view to get inside bounds
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		// If offset is less than a pixel, ignore.
		// This prevents unstable projections from getting into
		// an infinite loop of tiny offsets.
		if (offset.round().equals([0, 0])) {
			return center;
		}

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// adjust offset for view to get inside bounds
	_limitOffset: function (offset, bounds) {
		if (!bounds) { return offset; }

		var viewBounds = this.getPixelBounds(),
		    newBounds = new Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	},

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var projectedMaxBounds = toBounds(
		        this.project(maxBounds.getNorthEast(), zoom),
		        this.project(maxBounds.getSouthWest(), zoom)
		    ),
		    minOffset = projectedMaxBounds.min.subtract(pxBounds.min),
		    maxOffset = projectedMaxBounds.max.subtract(pxBounds.max),

		    dx = this._rebound(minOffset.x, -maxOffset.x),
		    dy = this._rebound(minOffset.y, -maxOffset.y);

		return new Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom(),
		    snap = any3d ? this.options.zoomSnap : 1;
		if (snap) {
			zoom = Math.round(zoom / snap) * snap;
		}
		return Math.max(min, Math.min(max, zoom));
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		removeClass(this._mapPane, 'leaflet-pan-anim');
		this.fire('moveend');
	},

	_tryAnimatedPan: function (center, options) {
		// difference between the new and current centers in pixels
		var offset = this._getCenterOffset(center)._trunc();

		// don't animate too far unless animate: true specified in options
		if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

		this.panBy(offset, options);

		return true;
	},

	_createAnimProxy: function () {

		var proxy = this._proxy = create$1('div', 'leaflet-proxy leaflet-zoom-animated');
		this._panes.mapPane.appendChild(proxy);

		this.on('zoomanim', function (e) {
			var prop = TRANSFORM,
			    transform = this._proxy.style[prop];

			setTransform(this._proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));

			// workaround for case when transform is the same and so transitionend event is not fired
			if (transform === this._proxy.style[prop] && this._animatingZoom) {
				this._onZoomTransitionEnd();
			}
		}, this);

		this.on('load moveend', function () {
			var c = this.getCenter(),
			    z = this.getZoom();
			setTransform(this._proxy, this.project(c, z), this.getZoomScale(z, 1));
		}, this);

		this._on('unload', this._destroyAnimProxy, this);
	},

	_destroyAnimProxy: function () {
		remove(this._proxy);
		delete this._proxy;
	},

	_catchTransitionEnd: function (e) {
		if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
			this._onZoomTransitionEnd();
		}
	},

	_nothingToAnimate: function () {
		return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
	},

	_tryAnimatedZoom: function (center, zoom, options) {

		if (this._animatingZoom) { return true; }

		options = options || {};

		// don't animate if disabled, not supported or zoom difference is too large
		if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
		        Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

		// offset is the pixel coords of the zoom origin relative to the current center
		var scale = this.getZoomScale(zoom),
		    offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale);

		// don't animate if the zoom origin isn't within one screen from the current center, unless forced
		if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

		requestAnimFrame(function () {
			this
			    ._moveStart(true, false)
			    ._animateZoom(center, zoom, true);
		}, this);

		return true;
	},

	_animateZoom: function (center, zoom, startAnim, noUpdate) {
		if (!this._mapPane) { return; }

		if (startAnim) {
			this._animatingZoom = true;

			// remember what center/zoom to set after animation
			this._animateToCenter = center;
			this._animateToZoom = zoom;

			addClass(this._mapPane, 'leaflet-zoom-anim');
		}

		// @event zoomanim: ZoomAnimEvent
		// Fired on every frame of a zoom animation
		this.fire('zoomanim', {
			center: center,
			zoom: zoom,
			noUpdate: noUpdate
		});

		// Work around webkit not firing 'transitionend', see https://github.com/Leaflet/Leaflet/issues/3689, 2693
		setTimeout(bind(this._onZoomTransitionEnd, this), 250);
	},

	_onZoomTransitionEnd: function () {
		if (!this._animatingZoom) { return; }

		if (this._mapPane) {
			removeClass(this._mapPane, 'leaflet-zoom-anim');
		}

		this._animatingZoom = false;

		this._move(this._animateToCenter, this._animateToZoom);

		// This anim frame should prevent an obscure iOS webkit tile loading race condition.
		requestAnimFrame(function () {
			this._moveEnd(true);
		}, this);
	}
});

// @section

// @factory L.map(id: String, options?: Map options)
// Instantiates a map object given the DOM ID of a `<div>` element
// and optionally an object literal with `Map options`.
//
// @alternative
// @factory L.map(el: HTMLElement, options?: Map options)
// Instantiates a map object given an instance of a `<div>` HTML element
// and optionally an object literal with `Map options`.
function createMap(id, options) {
	return new Map(id, options);
}

/*
 * @class Control
 * @aka L.Control
 * @inherits Class
 *
 * L.Control is a base class for implementing map controls. Handles positioning.
 * All other controls extend from this class.
 */

var Control = Class.extend({
	// @section
	// @aka Control options
	options: {
		// @option position: String = 'topright'
		// The position of the control (one of the map corners). Possible values are `'topleft'`,
		// `'topright'`, `'bottomleft'` or `'bottomright'`
		position: 'topright'
	},

	initialize: function (options) {
		setOptions(this, options);
	},

	/* @section
	 * Classes extending L.Control will inherit the following methods:
	 *
	 * @method getPosition: string
	 * Returns the position of the control.
	 */
	getPosition: function () {
		return this.options.position;
	},

	// @method setPosition(position: string): this
	// Sets the position of the control.
	setPosition: function (position) {
		var map = this._map;

		if (map) {
			map.removeControl(this);
		}

		this.options.position = position;

		if (map) {
			map.addControl(this);
		}

		return this;
	},

	// @method getContainer: HTMLElement
	// Returns the HTMLElement that contains the control.
	getContainer: function () {
		return this._container;
	},

	// @method addTo(map: Map): this
	// Adds the control to the given map.
	addTo: function (map) {
		this.remove();
		this._map = map;

		var container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		addClass(container, 'leaflet-control');

		if (pos.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		return this;
	},

	// @method remove: this
	// Removes the control from the map it is currently active on.
	remove: function () {
		if (!this._map) {
			return this;
		}

		remove(this._container);

		if (this.onRemove) {
			this.onRemove(this._map);
		}

		this._map = null;

		return this;
	},

	_refocusOnMap: function (e) {
		// if map exists and event is not a keyboard event
		if (this._map && e && e.screenX > 0 && e.screenY > 0) {
			this._map.getContainer().focus();
		}
	}
});

var control = function (options) {
	return new Control(options);
};

/* @section Extension methods
 * @uninheritable
 *
 * Every control should extend from `L.Control` and (re-)implement the following methods.
 *
 * @method onAdd(map: Map): HTMLElement
 * Should return the container DOM element for the control and add listeners on relevant map events. Called on [`control.addTo(map)`](#control-addTo).
 *
 * @method onRemove(map: Map)
 * Optional method. Should contain all clean up code that removes the listeners previously added in [`onAdd`](#control-onadd). Called on [`control.remove()`](#control-remove).
 */

/* @namespace Map
 * @section Methods for Layers and Controls
 */
Map.include({
	// @method addControl(control: Control): this
	// Adds the given control to the map
	addControl: function (control) {
		control.addTo(this);
		return this;
	},

	// @method removeControl(control: Control): this
	// Removes the given control from the map
	removeControl: function (control) {
		control.remove();
		return this;
	},

	_initControlPos: function () {
		var corners = this._controlCorners = {},
		    l = 'leaflet-',
		    container = this._controlContainer =
		            create$1('div', l + 'control-container', this._container);

		function createCorner(vSide, hSide) {
			var className = l + vSide + ' ' + l + hSide;

			corners[vSide + hSide] = create$1('div', className, container);
		}

		createCorner('top', 'left');
		createCorner('top', 'right');
		createCorner('bottom', 'left');
		createCorner('bottom', 'right');
	},

	_clearControlPos: function () {
		for (var i in this._controlCorners) {
			remove(this._controlCorners[i]);
		}
		remove(this._controlContainer);
		delete this._controlCorners;
		delete this._controlContainer;
	}
});

/*
 * @class Control.Layers
 * @aka L.Control.Layers
 * @inherits Control
 *
 * The layers control gives users the ability to switch between different base layers and switch overlays on/off (check out the [detailed example](http://leafletjs.com/examples/layers-control/)). Extends `Control`.
 *
 * @example
 *
 * ```js
 * var baseLayers = {
 * 	"Mapbox": mapbox,
 * 	"OpenStreetMap": osm
 * };
 *
 * var overlays = {
 * 	"Marker": marker,
 * 	"Roads": roadsLayer
 * };
 *
 * L.control.layers(baseLayers, overlays).addTo(map);
 * ```
 *
 * The `baseLayers` and `overlays` parameters are object literals with layer names as keys and `Layer` objects as values:
 *
 * ```js
 * {
 *     "<someName1>": layer1,
 *     "<someName2>": layer2
 * }
 * ```
 *
 * The layer names can contain HTML, which allows you to add additional styling to the items:
 *
 * ```js
 * {"<img src='my-layer-icon' /> <span class='my-layer-item'>My Layer</span>": myLayer}
 * ```
 */

var Layers = Control.extend({
	// @section
	// @aka Control.Layers options
	options: {
		// @option collapsed: Boolean = true
		// If `true`, the control will be collapsed into an icon and expanded on mouse hover or touch.
		collapsed: true,
		position: 'topright',

		// @option autoZIndex: Boolean = true
		// If `true`, the control will assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off.
		autoZIndex: true,

		// @option hideSingleBase: Boolean = false
		// If `true`, the base layers in the control will be hidden when there is only one.
		hideSingleBase: false,

		// @option sortLayers: Boolean = false
		// Whether to sort the layers. When `false`, layers will keep the order
		// in which they were added to the control.
		sortLayers: false,

		// @option sortFunction: Function = *
		// A [compare function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
		// that will be used for sorting the layers, when `sortLayers` is `true`.
		// The function receives both the `L.Layer` instances and their names, as in
		// `sortFunction(layerA, layerB, nameA, nameB)`.
		// By default, it sorts layers alphabetically by their name.
		sortFunction: function (layerA, layerB, nameA, nameB) {
			return nameA < nameB ? -1 : (nameB < nameA ? 1 : 0);
		}
	},

	initialize: function (baseLayers, overlays, options) {
		setOptions(this, options);

		this._layerControlInputs = [];
		this._layers = [];
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	},

	onAdd: function (map) {
		this._initLayout();
		this._update();

		this._map = map;
		map.on('zoomend', this._checkDisabledLayers, this);

		for (var i = 0; i < this._layers.length; i++) {
			this._layers[i].layer.on('add remove', this._onLayerChange, this);
		}

		return this._container;
	},

	addTo: function (map) {
		Control.prototype.addTo.call(this, map);
		// Trigger expand after Layers Control has been inserted into DOM so that is now has an actual height.
		return this._expandIfNotCollapsed();
	},

	onRemove: function () {
		this._map.off('zoomend', this._checkDisabledLayers, this);

		for (var i = 0; i < this._layers.length; i++) {
			this._layers[i].layer.off('add remove', this._onLayerChange, this);
		}
	},

	// @method addBaseLayer(layer: Layer, name: String): this
	// Adds a base layer (radio button entry) with the given name to the control.
	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name);
		return (this._map) ? this._update() : this;
	},

	// @method addOverlay(layer: Layer, name: String): this
	// Adds an overlay (checkbox entry) with the given name to the control.
	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		return (this._map) ? this._update() : this;
	},

	// @method removeLayer(layer: Layer): this
	// Remove the given layer from the control.
	removeLayer: function (layer) {
		layer.off('add remove', this._onLayerChange, this);

		var obj = this._getLayer(stamp(layer));
		if (obj) {
			this._layers.splice(this._layers.indexOf(obj), 1);
		}
		return (this._map) ? this._update() : this;
	},

	// @method expand(): this
	// Expand the control container if collapsed.
	expand: function () {
		addClass(this._container, 'leaflet-control-layers-expanded');
		this._form.style.height = null;
		var acceptableHeight = this._map.getSize().y - (this._container.offsetTop + 50);
		if (acceptableHeight < this._form.clientHeight) {
			addClass(this._form, 'leaflet-control-layers-scrollbar');
			this._form.style.height = acceptableHeight + 'px';
		} else {
			removeClass(this._form, 'leaflet-control-layers-scrollbar');
		}
		this._checkDisabledLayers();
		return this;
	},

	// @method collapse(): this
	// Collapse the control container if expanded.
	collapse: function () {
		removeClass(this._container, 'leaflet-control-layers-expanded');
		return this;
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		    container = this._container = create$1('div', className),
		    collapsed = this.options.collapsed;

		// makes this work on IE touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		disableClickPropagation(container);
		disableScrollPropagation(container);

		var form = this._form = create$1('form', className + '-list');

		if (collapsed) {
			this._map.on('click', this.collapse, this);

			if (!android) {
				on(container, {
					mouseenter: this.expand,
					mouseleave: this.collapse
				}, this);
			}
		}

		var link = this._layersLink = create$1('a', className + '-toggle', container);
		link.href = '#';
		link.title = 'Layers';

		if (touch) {
			on(link, 'click', stop);
			on(link, 'click', this.expand, this);
		} else {
			on(link, 'focus', this.expand, this);
		}

		if (!collapsed) {
			this.expand();
		}

		this._baseLayersList = create$1('div', className + '-base', form);
		this._separator = create$1('div', className + '-separator', form);
		this._overlaysList = create$1('div', className + '-overlays', form);

		container.appendChild(form);
	},

	_getLayer: function (id) {
		for (var i = 0; i < this._layers.length; i++) {

			if (this._layers[i] && stamp(this._layers[i].layer) === id) {
				return this._layers[i];
			}
		}
	},

	_addLayer: function (layer, name, overlay) {
		if (this._map) {
			layer.on('add remove', this._onLayerChange, this);
		}

		this._layers.push({
			layer: layer,
			name: name,
			overlay: overlay
		});

		if (this.options.sortLayers) {
			this._layers.sort(bind(function (a, b) {
				return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
			}, this));
		}

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}

		this._expandIfNotCollapsed();
	},

	_update: function () {
		if (!this._container) { return this; }

		empty(this._baseLayersList);
		empty(this._overlaysList);

		this._layerControlInputs = [];
		var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;

		for (i = 0; i < this._layers.length; i++) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
			baseLayersCount += !obj.overlay ? 1 : 0;
		}

		// Hide base layers section if there's only one layer.
		if (this.options.hideSingleBase) {
			baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
			this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';

		return this;
	},

	_onLayerChange: function (e) {
		if (!this._handlingClick) {
			this._update();
		}

		var obj = this._getLayer(stamp(e.target));

		// @namespace Map
		// @section Layer events
		// @event baselayerchange: LayersControlEvent
		// Fired when the base layer is changed through the [layer control](#control-layers).
		// @event overlayadd: LayersControlEvent
		// Fired when an overlay is selected through the [layer control](#control-layers).
		// @event overlayremove: LayersControlEvent
		// Fired when an overlay is deselected through the [layer control](#control-layers).
		// @namespace Control.Layers
		// var type = obj.overlay ?
		var type = obj && obj.overlay ?		// Add by Geomixer
			(e.type === 'add' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'add' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, obj);
		}
	},

	// IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
	_createRadioElement: function (name, checked) {

		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' +
				name + '"' + (checked ? ' checked="checked"' : '') + '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

	_addItem: function (obj) {
		var label = document.createElement('label'),
		    checked = this._map.hasLayer(obj.layer),
		    input;

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('leaflet-base-layers', checked);
		}

		this._layerControlInputs.push(input);
		input.layerId = stamp(obj.layer);

		on(input, 'click', this._onInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + obj.name;

		// Helps from preventing layer control flicker when checkboxes are disabled
		// https://github.com/Leaflet/Leaflet/issues/2771
		var holder = document.createElement('div');

		label.appendChild(holder);
		holder.appendChild(input);
		holder.appendChild(name);

		var container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);

		this._checkDisabledLayers();
		return label;
	},

	_onInputClick: function () {
		var inputs = this._layerControlInputs,
		    input, layer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._getLayer(input.layerId).layer;

			if (input.checked) {
				addedLayers.push(layer);
			} else if (!input.checked) {
				removedLayers.push(layer);
			}
		}

		// Bugfix issue 2318: Should remove all old layers before readding new ones
		for (i = 0; i < removedLayers.length; i++) {
			if (this._map.hasLayer(removedLayers[i])) {
				this._map.removeLayer(removedLayers[i]);
			}
		}
		for (i = 0; i < addedLayers.length; i++) {
			if (!this._map.hasLayer(addedLayers[i])) {
				this._map.addLayer(addedLayers[i]);
			}
		}

		this._handlingClick = false;

		this._refocusOnMap();
	},

	_checkDisabledLayers: function () {
		var inputs = this._layerControlInputs,
		    input,
		    layer,
		    zoom = this._map.getZoom();

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._getLayer(input.layerId).layer;
			input.disabled = (layer.options.minZoom !== undefined && zoom < layer.options.minZoom) ||
			                 (layer.options.maxZoom !== undefined && zoom > layer.options.maxZoom);

		}
	},

	_expandIfNotCollapsed: function () {
		if (this._map && !this.options.collapsed) {
			this.expand();
		}
		return this;
	},

	_expand: function () {
		// Backward compatibility, remove me in 1.1.
		return this.expand();
	},

	_collapse: function () {
		// Backward compatibility, remove me in 1.1.
		return this.collapse();
	}

});


// @factory L.control.layers(baselayers?: Object, overlays?: Object, options?: Control.Layers options)
// Creates an attribution control with the given layers. Base layers will be switched with radio buttons, while overlays will be switched with checkboxes. Note that all base layers should be passed in the base layers object, but only one should be added to the map during map instantiation.
var layers = function (baseLayers, overlays, options) {
	return new Layers(baseLayers, overlays, options);
};

/*
 * @class Control.Zoom
 * @aka L.Control.Zoom
 * @inherits Control
 *
 * A basic zoom control with two buttons (zoom in and zoom out). It is put on the map by default unless you set its [`zoomControl` option](#map-zoomcontrol) to `false`. Extends `Control`.
 */

var Zoom = Control.extend({
	// @section
	// @aka Control.Zoom options
	options: {
		position: 'topleft',

		// @option zoomInText: String = '+'
		// The text set on the 'zoom in' button.
		zoomInText: '+',

		// @option zoomInTitle: String = 'Zoom in'
		// The title set on the 'zoom in' button.
		zoomInTitle: 'Zoom in',

		// @option zoomOutText: String = '&#x2212;'
		// The text set on the 'zoom out' button.
		zoomOutText: '&#x2212;',

		// @option zoomOutTitle: String = 'Zoom out'
		// The title set on the 'zoom out' button.
		zoomOutTitle: 'Zoom out'
	},

	onAdd: function (map) {
		var zoomName = 'leaflet-control-zoom',
		    container = create$1('div', zoomName + ' leaflet-bar'),
		    options = this.options;

		this._zoomInButton  = this._createButton(options.zoomInText, options.zoomInTitle,
		        zoomName + '-in',  container, this._zoomIn);
		this._zoomOutButton = this._createButton(options.zoomOutText, options.zoomOutTitle,
		        zoomName + '-out', container, this._zoomOut);

		this._updateDisabled();
		map.on('zoomend zoomlevelschange', this._updateDisabled, this);

		return container;
	},

	onRemove: function (map) {
		map.off('zoomend zoomlevelschange', this._updateDisabled, this);
	},

	disable: function () {
		this._disabled = true;
		this._updateDisabled();
		return this;
	},

	enable: function () {
		this._disabled = false;
		this._updateDisabled();
		return this;
	},

	_zoomIn: function (e) {
		if (!this._disabled && this._map._zoom < this._map.getMaxZoom()) {
			this._map.zoomIn(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
		}
	},

	_zoomOut: function (e) {
		if (!this._disabled && this._map._zoom > this._map.getMinZoom()) {
			this._map.zoomOut(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
		}
	},

	_createButton: function (html, title, className, container, fn) {
		var link = create$1('a', className, container);
		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		/*
		 * Will force screen readers like VoiceOver to read this as "Zoom in - button"
		 */
		link.setAttribute('role', 'button');
		link.setAttribute('aria-label', title);

		disableClickPropagation(link);
		on(link, 'click', stop);
		on(link, 'click', fn, this);
		on(link, 'click', this._refocusOnMap, this);

		return link;
	},

	_updateDisabled: function () {
		var map = this._map,
		    className = 'leaflet-disabled';

		removeClass(this._zoomInButton, className);
		removeClass(this._zoomOutButton, className);

		if (this._disabled || map._zoom === map.getMinZoom()) {
			addClass(this._zoomOutButton, className);
		}
		if (this._disabled || map._zoom === map.getMaxZoom()) {
			addClass(this._zoomInButton, className);
		}
	}
});

// @namespace Map
// @section Control options
// @option zoomControl: Boolean = true
// Whether a [zoom control](#control-zoom) is added to the map by default.
Map.mergeOptions({
	zoomControl: true
});

Map.addInitHook(function () {
	if (this.options.zoomControl) {
		this.zoomControl = new Zoom();
		this.addControl(this.zoomControl);
	}
});

// @namespace Control.Zoom
// @factory L.control.zoom(options: Control.Zoom options)
// Creates a zoom control
var zoom = function (options) {
	return new Zoom(options);
};

/*
 * @class Control.Scale
 * @aka L.Control.Scale
 * @inherits Control
 *
 * A simple scale control that shows the scale of the current center of screen in metric (m/km) and imperial (mi/ft) systems. Extends `Control`.
 *
 * @example
 *
 * ```js
 * L.control.scale().addTo(map);
 * ```
 */

var Scale = Control.extend({
	// @section
	// @aka Control.Scale options
	options: {
		position: 'bottomleft',

		// @option maxWidth: Number = 100
		// Maximum width of the control in pixels. The width is set dynamically to show round values (e.g. 100, 200, 500).
		maxWidth: 100,

		// @option metric: Boolean = True
		// Whether to show the metric scale line (m/km).
		metric: true,

		// @option imperial: Boolean = True
		// Whether to show the imperial scale line (mi/ft).
		imperial: true

		// @option updateWhenIdle: Boolean = false
		// If `true`, the control is updated on [`moveend`](#map-moveend), otherwise it's always up-to-date (updated on [`move`](#map-move)).
	},

	onAdd: function (map) {
		var className = 'leaflet-control-scale',
		    container = create$1('div', className),
		    options = this.options;

		this._addScales(options, className + '-line', container);

		map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
		map.whenReady(this._update, this);

		return container;
	},

	onRemove: function (map) {
		map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
	},

	_addScales: function (options, className, container) {
		if (options.metric) {
			this._mScale = create$1('div', className, container);
		}
		if (options.imperial) {
			this._iScale = create$1('div', className, container);
		}
	},

	_update: function () {
		var map = this._map,
		    y = map.getSize().y / 2;

		var maxMeters = map.distance(
			map.containerPointToLatLng([0, y]),
			map.containerPointToLatLng([this.options.maxWidth, y]));

		this._updateScales(maxMeters);
	},

	_updateScales: function (maxMeters) {
		if (this.options.metric && maxMeters) {
			this._updateMetric(maxMeters);
		}
		if (this.options.imperial && maxMeters) {
			this._updateImperial(maxMeters);
		}
	},

	_updateMetric: function (maxMeters) {
		var meters = this._getRoundNum(maxMeters),
		    label = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';

		this._updateScale(this._mScale, label, meters / maxMeters);
	},

	_updateImperial: function (maxMeters) {
		var maxFeet = maxMeters * 3.2808399,
		    maxMiles, miles, feet;

		if (maxFeet > 5280) {
			maxMiles = maxFeet / 5280;
			miles = this._getRoundNum(maxMiles);
			this._updateScale(this._iScale, miles + ' mi', miles / maxMiles);

		} else {
			feet = this._getRoundNum(maxFeet);
			this._updateScale(this._iScale, feet + ' ft', feet / maxFeet);
		}
	},

	_updateScale: function (scale, text, ratio) {
		scale.style.width = Math.round(this.options.maxWidth * ratio) + 'px';
		scale.innerHTML = text;
	},

	_getRoundNum: function (num) {
		var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
		    d = num / pow10;

		d = d >= 10 ? 10 :
		    d >= 5 ? 5 :
		    d >= 3 ? 3 :
		    d >= 2 ? 2 : 1;

		return pow10 * d;
	}
});


// @factory L.control.scale(options?: Control.Scale options)
// Creates an scale control with the given options.
var scale = function (options) {
	return new Scale(options);
};

/*
 * @class Control.Attribution
 * @aka L.Control.Attribution
 * @inherits Control
 *
 * The attribution control allows you to display attribution data in a small text box on a map. It is put on the map by default unless you set its [`attributionControl` option](#map-attributioncontrol) to `false`, and it fetches attribution texts from layers with the [`getAttribution` method](#layer-getattribution) automatically. Extends Control.
 */

var Attribution = Control.extend({
	// @section
	// @aka Control.Attribution options
	options: {
		position: 'bottomright',

		// @option prefix: String = 'Leaflet'
		// The HTML text shown before the attributions. Pass `false` to disable.
		prefix: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>'
	},

	initialize: function (options) {
		setOptions(this, options);

		this._attributions = {};
	},

	onAdd: function (map) {
		map.attributionControl = this;
		this._container = create$1('div', 'leaflet-control-attribution');
		disableClickPropagation(this._container);

		// TODO ugly, refactor
		for (var i in map._layers) {
			if (map._layers[i].getAttribution) {
				this.addAttribution(map._layers[i].getAttribution());
			}
		}

		this._update();

		return this._container;
	},

	// @method setPrefix(prefix: String): this
	// Sets the text before the attributions.
	setPrefix: function (prefix) {
		this.options.prefix = prefix;
		this._update();
		return this;
	},

	// @method addAttribution(text: String): this
	// Adds an attribution text (e.g. `'Vector data &copy; Mapbox'`).
	addAttribution: function (text) {
		if (!text) { return this; }

		if (!this._attributions[text]) {
			this._attributions[text] = 0;
		}
		this._attributions[text]++;

		this._update();

		return this;
	},

	// @method removeAttribution(text: String): this
	// Removes an attribution text.
	removeAttribution: function (text) {
		if (!text) { return this; }

		if (this._attributions[text]) {
			this._attributions[text]--;
			this._update();
		}

		return this;
	},

	_update: function () {
		if (!this._map) { return; }

		var attribs = [];

		for (var i in this._attributions) {
			if (this._attributions[i]) {
				attribs.push(i);
			}
		}

		var prefixAndAttribs = [];

		if (this.options.prefix) {
			prefixAndAttribs.push(this.options.prefix);
		}
		if (attribs.length) {
			prefixAndAttribs.push(attribs.join(', '));
		}

		this._container.innerHTML = prefixAndAttribs.join(' | ');
	}
});

// @namespace Map
// @section Control options
// @option attributionControl: Boolean = true
// Whether a [attribution control](#control-attribution) is added to the map by default.
Map.mergeOptions({
	attributionControl: true
});

Map.addInitHook(function () {
	if (this.options.attributionControl) {
		new Attribution().addTo(this);
	}
});

// @namespace Control.Attribution
// @factory L.control.attribution(options: Control.Attribution options)
// Creates an attribution control.
var attribution = function (options) {
	return new Attribution(options);
};

Control.Layers = Layers;
Control.Zoom = Zoom;
Control.Scale = Scale;
Control.Attribution = Attribution;

control.layers = layers;
control.zoom = zoom;
control.scale = scale;
control.attribution = attribution;

/*
	L.Handler is a base class for handler classes that are used internally to inject
	interaction features like dragging to classes like Map and Marker.
*/

// @class Handler
// @aka L.Handler
// Abstract class for map interaction handlers

var Handler = Class.extend({
	initialize: function (map) {
		this._map = map;
	},

	// @method enable(): this
	// Enables the handler
	enable: function () {
		if (this._enabled) { return this; }

		this._enabled = true;
		this.addHooks();
		return this;
	},

	// @method disable(): this
	// Disables the handler
	disable: function () {
		if (!this._enabled) { return this; }

		this._enabled = false;
		this.removeHooks();
		return this;
	},

	// @method enabled(): Boolean
	// Returns `true` if the handler is enabled
	enabled: function () {
		return !!this._enabled;
	}

	// @section Extension methods
	// Classes inheriting from `Handler` must implement the two following methods:
	// @method addHooks()
	// Called when the handler is enabled, should add event hooks.
	// @method removeHooks()
	// Called when the handler is disabled, should remove the event hooks added previously.
});

// @section There is static function which can be called without instantiating L.Handler:
// @function addTo(map: Map, name: String): this
// Adds a new Handler to the given map with the given name.
Handler.addTo = function (map, name) {
	map.addHandler(name, this);
	return this;
};

var Mixin = {Events: Events};

/*
 * @class Draggable
 * @aka L.Draggable
 * @inherits Evented
 *
 * A class for making DOM elements draggable (including touch support).
 * Used internally for map and marker dragging. Only works for elements
 * that were positioned with [`L.DomUtil.setPosition`](#domutil-setposition).
 *
 * @example
 * ```js
 * var draggable = new L.Draggable(elementToDrag);
 * draggable.enable();
 * ```
 */

var START = touch ? 'touchstart mousedown' : 'mousedown';
var END = {
	mousedown: 'mouseup',
	touchstart: 'touchend',
	pointerdown: 'touchend',
	MSPointerDown: 'touchend'
};
var MOVE = {
	mousedown: 'mousemove',
	touchstart: 'touchmove',
	pointerdown: 'touchmove',
	MSPointerDown: 'touchmove'
};


var Draggable = Evented.extend({

	options: {
		// @section
		// @aka Draggable options
		// @option clickTolerance: Number = 3
		// The max number of pixels a user can shift the mouse pointer during a click
		// for it to be considered a valid click (as opposed to a mouse drag).
		clickTolerance: 3
	},

	// @constructor L.Draggable(el: HTMLElement, dragHandle?: HTMLElement, preventOutline?: Boolean, options?: Draggable options)
	// Creates a `Draggable` object for moving `el` when you start dragging the `dragHandle` element (equals `el` itself by default).
	initialize: function (element, dragStartTarget, preventOutline$$1, options) {
		setOptions(this, options);

		this._element = element;
		this._dragStartTarget = dragStartTarget || element;
		this._preventOutline = preventOutline$$1;
	},

	// @method enable()
	// Enables the dragging ability
	enable: function () {
		if (this._enabled) { return; }

		on(this._dragStartTarget, START, this._onDown, this);

		this._enabled = true;
	},

	// @method disable()
	// Disables the dragging ability
	disable: function () {
		if (!this._enabled) { return; }

		// If we're currently dragging this draggable,
		// disabling it counts as first ending the drag.
		if (Draggable._dragging === this) {
			this.finishDrag();
		}

		off(this._dragStartTarget, START, this._onDown, this);

		this._enabled = false;
		this._moved = false;
	},

	_onDown: function (e) {
		// Ignore simulated events, since we handle both touch and
		// mouse explicitly; otherwise we risk getting duplicates of
		// touch events, see #4315.
		// Also ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (e._simulated || !this._enabled) { return; }

		this._moved = false;

		if (hasClass(this._element, 'leaflet-zoom-anim')) { return; }

		if (Draggable._dragging || e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }
		Draggable._dragging = this;  // Prevent dragging multiple objects at once.

		if (this._preventOutline) {
			preventOutline(this._element);
		}

		disableImageDrag();
		disableTextSelection();

		if (this._moving) { return; }

		// @event down: Event
		// Fired when a drag is about to start.
		this.fire('down');

		var first = e.touches ? e.touches[0] : e;

		this._startPoint = new Point(first.clientX, first.clientY);

		on(document, MOVE[e.type], this._onMove, this);
		on(document, END[e.type], this._onUp, this);
	},

	_onMove: function (e) {
		// Ignore simulated events, since we handle both touch and
		// mouse explicitly; otherwise we risk getting duplicates of
		// touch events, see #4315.
		// Also ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (e._simulated || !this._enabled) { return; }

		if (e.touches && e.touches.length > 1) {
			this._moved = true;
			return;
		}

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
		    newPoint = new Point(first.clientX, first.clientY),
		    offset = newPoint.subtract(this._startPoint);

		if (!offset.x && !offset.y) { return; }
		if (Math.abs(offset.x) + Math.abs(offset.y) < this.options.clickTolerance) { return; }

		preventDefault(e);

		if (!this._moved) {
			// @event dragstart: Event
			// Fired when a drag starts
			this.fire('dragstart');

			this._moved = true;
			this._startPos = getPosition(this._element).subtract(offset);

			addClass(document.body, 'leaflet-dragging');

			this._lastTarget = e.target || e.srcElement;
			// IE and Edge do not give the <use> element, so fetch it
			// if necessary
			if ((window.SVGElementInstance) && (this._lastTarget instanceof SVGElementInstance)) {
				this._lastTarget = this._lastTarget.correspondingUseElement;
			}
			addClass(this._lastTarget, 'leaflet-drag-target');
		}

		this._newPos = this._startPos.add(offset);
		this._moving = true;

		cancelAnimFrame(this._animRequest);
		this._lastEvent = e;
		this._animRequest = requestAnimFrame(this._updatePosition, this, true);
	},

	_updatePosition: function () {
		var e = {originalEvent: this._lastEvent};

		// @event predrag: Event
		// Fired continuously during dragging *before* each corresponding
		// update of the element's position.
		this.fire('predrag', e);
		setPosition(this._element, this._newPos);

		// @event drag: Event
		// Fired continuously during dragging.
		this.fire('drag', e);
	},

	_onUp: function (e) {
		// Ignore simulated events, since we handle both touch and
		// mouse explicitly; otherwise we risk getting duplicates of
		// touch events, see #4315.
		// Also ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (e._simulated || !this._enabled) { return; }
		this.finishDrag();
	},

	finishDrag: function () {
		removeClass(document.body, 'leaflet-dragging');

		if (this._lastTarget) {
			removeClass(this._lastTarget, 'leaflet-drag-target');
			this._lastTarget = null;
		}

		for (var i in MOVE) {
			off(document, MOVE[i], this._onMove, this);
			off(document, END[i], this._onUp, this);
		}

		enableImageDrag();
		enableTextSelection();

		if (this._moved && this._moving) {
			// ensure drag is not fired after dragend
			cancelAnimFrame(this._animRequest);

			// @event dragend: DragEndEvent
			// Fired when the drag ends.
			this.fire('dragend', {
				distance: this._newPos.distanceTo(this._startPos)
			});
		}

		this._moving = false;
		Draggable._dragging = false;
	}

});

/*
 * @namespace LineUtil
 *
 * Various utility functions for polyline points processing, used by Leaflet internally to make polylines lightning-fast.
 */

// Simplify polyline with vertex reduction and Douglas-Peucker simplification.
// Improves rendering performance dramatically by lessening the number of points to draw.

// @function simplify(points: Point[], tolerance: Number): Point[]
// Dramatically reduces the number of points in a polyline while retaining
// its shape and returns a new array of simplified points, using the
// [Douglas-Peucker algorithm](http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm).
// Used for a huge performance boost when processing/displaying Leaflet polylines for
// each zoom level and also reducing visual noise. tolerance affects the amount of
// simplification (lesser value means higher quality but slower and with more points).
// Also released as a separated micro-library [Simplify.js](http://mourner.github.com/simplify-js/).
function simplify(points, tolerance) {
	if (!tolerance || !points.length) {
		return points.slice();
	}

	var sqTolerance = tolerance * tolerance;

	    // stage 1: vertex reduction
	    points = _reducePoints(points, sqTolerance);

	    // stage 2: Douglas-Peucker simplification
	    points = _simplifyDP(points, sqTolerance);

	return points;
}

// @function pointToSegmentDistance(p: Point, p1: Point, p2: Point): Number
// Returns the distance between point `p` and segment `p1` to `p2`.
function pointToSegmentDistance(p, p1, p2) {
	return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
}

// @function closestPointOnSegment(p: Point, p1: Point, p2: Point): Number
// Returns the closest point from a point `p` on a segment `p1` to `p2`.
function closestPointOnSegment(p, p1, p2) {
	return _sqClosestPointOnSegment(p, p1, p2);
}

// Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
function _simplifyDP(points, sqTolerance) {

	var len = points.length,
	    ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
	    markers = new ArrayConstructor(len);

	    markers[0] = markers[len - 1] = 1;

	_simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

	var i,
	    newPoints = [];

	for (i = 0; i < len; i++) {
		if (markers[i]) {
			newPoints.push(points[i]);
		}
	}

	return newPoints;
}

function _simplifyDPStep(points, markers, sqTolerance, first, last) {

	var maxSqDist = 0,
	index, i, sqDist;

	for (i = first + 1; i <= last - 1; i++) {
		sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);

		if (sqDist > maxSqDist) {
			index = i;
			maxSqDist = sqDist;
		}
	}

	if (maxSqDist > sqTolerance) {
		markers[index] = 1;

		_simplifyDPStep(points, markers, sqTolerance, first, index);
		_simplifyDPStep(points, markers, sqTolerance, index, last);
	}
}

// reduce points that are too close to each other to a single point
function _reducePoints(points, sqTolerance) {
	var reducedPoints = [points[0]];

	for (var i = 1, prev = 0, len = points.length; i < len; i++) {
		if (_sqDist(points[i], points[prev]) > sqTolerance) {
			reducedPoints.push(points[i]);
			prev = i;
		}
	}
	if (prev < len - 1) {
		reducedPoints.push(points[len - 1]);
	}
	return reducedPoints;
}

var _lastCode;

// @function clipSegment(a: Point, b: Point, bounds: Bounds, useLastCode?: Boolean, round?: Boolean): Point[]|Boolean
// Clips the segment a to b by rectangular bounds with the
// [Cohen-Sutherland algorithm](https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm)
// (modifying the segment points directly!). Used by Leaflet to only show polyline
// points that are on the screen or near, increasing performance.
function clipSegment(a, b, bounds, useLastCode, round) {
	var codeA = useLastCode ? _lastCode : _getBitCode(a, bounds),
	    codeB = _getBitCode(b, bounds),

	    codeOut, p, newCode;

	    // save 2nd code to avoid calculating it on the next segment
	    _lastCode = codeB;

	while (true) {
		// if a,b is inside the clip window (trivial accept)
		if (!(codeA | codeB)) {
			return [a, b];
		}

		// if a,b is outside the clip window (trivial reject)
		if (codeA & codeB) {
			return false;
		}

		// other cases
		codeOut = codeA || codeB;
		p = _getEdgeIntersection(a, b, codeOut, bounds, round);
		newCode = _getBitCode(p, bounds);

		if (codeOut === codeA) {
			a = p;
			codeA = newCode;
		} else {
			b = p;
			codeB = newCode;
		}
	}
}

function _getEdgeIntersection(a, b, code, bounds, round) {
	var dx = b.x - a.x,
	    dy = b.y - a.y,
	    min = bounds.min,
	    max = bounds.max,
	    x, y;

	if (code & 8) { // top
		x = a.x + dx * (max.y - a.y) / dy;
		y = max.y;

	} else if (code & 4) { // bottom
		x = a.x + dx * (min.y - a.y) / dy;
		y = min.y;

	} else if (code & 2) { // right
		x = max.x;
		y = a.y + dy * (max.x - a.x) / dx;

	} else if (code & 1) { // left
		x = min.x;
		y = a.y + dy * (min.x - a.x) / dx;
	}

	return new Point(x, y, round);
}

function _getBitCode(p, bounds) {
	var code = 0;

	if (p.x < bounds.min.x) { // left
		code |= 1;
	} else if (p.x > bounds.max.x) { // right
		code |= 2;
	}

	if (p.y < bounds.min.y) { // bottom
		code |= 4;
	} else if (p.y > bounds.max.y) { // top
		code |= 8;
	}

	return code;
}

// square distance (to avoid unnecessary Math.sqrt calls)
function _sqDist(p1, p2) {
	var dx = p2.x - p1.x,
	    dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}

// return closest point on segment or distance to that point
function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
	var x = p1.x,
	    y = p1.y,
	    dx = p2.x - x,
	    dy = p2.y - y,
	    dot = dx * dx + dy * dy,
	    t;

	if (dot > 0) {
		t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

		if (t > 1) {
			x = p2.x;
			y = p2.y;
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}

	dx = p.x - x;
	dy = p.y - y;

	return sqDist ? dx * dx + dy * dy : new Point(x, y);
}


// @function isFlat(latlngs: LatLng[]): Boolean
// Returns true if `latlngs` is a flat array, false is nested.
function isFlat(latlngs) {
	return !isArray(latlngs[0]) || (typeof latlngs[0][0] !== 'object' && typeof latlngs[0][0] !== 'undefined');
}

function _flat(latlngs) {
	console.warn('Deprecated use of _flat, please use L.LineUtil.isFlat instead.');
	return isFlat(latlngs);
}


var LineUtil = (Object.freeze || Object)({
	simplify: simplify,
	pointToSegmentDistance: pointToSegmentDistance,
	closestPointOnSegment: closestPointOnSegment,
	clipSegment: clipSegment,
	_getEdgeIntersection: _getEdgeIntersection,
	_getBitCode: _getBitCode,
	_sqClosestPointOnSegment: _sqClosestPointOnSegment,
	isFlat: isFlat,
	_flat: _flat
});

/*
 * @namespace PolyUtil
 * Various utility functions for polygon geometries.
 */

/* @function clipPolygon(points: Point[], bounds: Bounds, round?: Boolean): Point[]
 * Clips the polygon geometry defined by the given `points` by the given bounds (using the [Sutherland-Hodgman algorithm](https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm)).
 * Used by Leaflet to only show polygon points that are on the screen or near, increasing
 * performance. Note that polygon points needs different algorithm for clipping
 * than polyline, so there's a separate method for it.
 */
function clipPolygon(points, bounds, round) {
	var clippedPoints,
	    edges = [1, 4, 2, 8],
	    i, j, k,
	    a, b,
	    len, edge, p;

	for (i = 0, len = points.length; i < len; i++) {
		points[i]._code = _getBitCode(points[i], bounds);
	}

	// for each edge (left, bottom, right, top)
	for (k = 0; k < 4; k++) {
		edge = edges[k];
		clippedPoints = [];

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			a = points[i];
			b = points[j];

			// if a is inside the clip window
			if (!(a._code & edge)) {
				// if b is outside the clip window (a->b goes out of screen)
				if (b._code & edge) {
					p = _getEdgeIntersection(b, a, edge, bounds, round);
					p._code = _getBitCode(p, bounds);
					clippedPoints.push(p);
				}
				clippedPoints.push(a);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(b._code & edge)) {
				p = _getEdgeIntersection(b, a, edge, bounds, round);
				p._code = _getBitCode(p, bounds);
				clippedPoints.push(p);
			}
		}
		points = clippedPoints;
	}

	return points;
}


var PolyUtil = (Object.freeze || Object)({
	clipPolygon: clipPolygon
});

/*
 * @namespace Projection
 * @section
 * Leaflet comes with a set of already defined Projections out of the box:
 *
 * @projection L.Projection.LonLat
 *
 * Equirectangular, or Plate Carree projection — the most simple projection,
 * mostly used by GIS enthusiasts. Directly maps `x` as longitude, and `y` as
 * latitude. Also suitable for flat worlds, e.g. game maps. Used by the
 * `EPSG:4326` and `Simple` CRS.
 */

var LonLat = {
	project: function (latlng) {
		return new Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new LatLng(point.y, point.x);
	},

	bounds: new Bounds([-180, -90], [180, 90])
};

/*
 * @namespace Projection
 * @projection L.Projection.Mercator
 *
 * Elliptical Mercator projection — more complex than Spherical Mercator. Takes into account that Earth is a geoid, not a perfect sphere. Used by the EPSG:3395 CRS.
 */

var Mercator = {
	R: 6378137,
	R_MINOR: 6356752.314245179,

	bounds: new Bounds([-20037508.34279, -15496570.73972], [20037508.34279, 18764656.23138]),

	project: function (latlng) {
		var d = Math.PI / 180,
		    r = this.R,
		    y = latlng.lat * d,
		    tmp = this.R_MINOR / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    con = e * Math.sin(y);

		var ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
		y = -r * Math.log(Math.max(ts, 1E-10));

		return new Point(latlng.lng * d * r, y);
	},

	unproject: function (point) {
		var d = 180 / Math.PI,
		    r = this.R,
		    tmp = this.R_MINOR / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    ts = Math.exp(-point.y / r),
		    phi = Math.PI / 2 - 2 * Math.atan(ts);

		for (var i = 0, dphi = 0.1, con; i < 15 && Math.abs(dphi) > 1e-7; i++) {
			con = e * Math.sin(phi);
			con = Math.pow((1 - con) / (1 + con), e / 2);
			dphi = Math.PI / 2 - 2 * Math.atan(ts * con) - phi;
			phi += dphi;
		}

		return new LatLng(phi * d, point.x * d / r);
	}
};

/*
 * @class Projection

 * An object with methods for projecting geographical coordinates of the world onto
 * a flat surface (and back). See [Map projection](http://en.wikipedia.org/wiki/Map_projection).

 * @property bounds: Bounds
 * The bounds (specified in CRS units) where the projection is valid

 * @method project(latlng: LatLng): Point
 * Projects geographical coordinates into a 2D point.
 * Only accepts actual `L.LatLng` instances, not arrays.

 * @method unproject(point: Point): LatLng
 * The inverse of `project`. Projects a 2D point into a geographical location.
 * Only accepts actual `L.Point` instances, not arrays.

 * Note that the projection instances do not inherit from Leafet's `Class` object,
 * and can't be instantiated. Also, new classes can't inherit from them,
 * and methods can't be added to them with the `include` function.

 */




var index = (Object.freeze || Object)({
	LonLat: LonLat,
	Mercator: Mercator,
	SphericalMercator: SphericalMercator
});

/*
 * @namespace CRS
 * @crs L.CRS.EPSG3395
 *
 * Rarely used by some commercial tile providers. Uses Elliptical Mercator projection.
 */
var EPSG3395 = extend({}, Earth, {
	code: 'EPSG:3395',
	projection: Mercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * Mercator.R);
		return toTransformation(scale, 0.5, -scale, 0.5);
	}())
});

/*
 * @namespace CRS
 * @crs L.CRS.EPSG4326
 *
 * A common CRS among GIS enthusiasts. Uses simple Equirectangular projection.
 *
 * Leaflet 1.0.x complies with the [TMS coordinate scheme for EPSG:4326](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification#global-geodetic),
 * which is a breaking change from 0.7.x behaviour.  If you are using a `TileLayer`
 * with this CRS, ensure that there are two 256x256 pixel tiles covering the
 * whole earth at zoom level zero, and that the tile coordinate origin is (-180,+90),
 * or (-180,-90) for `TileLayer`s with [the `tms` option](#tilelayer-tms) set.
 */

var EPSG4326 = extend({}, Earth, {
	code: 'EPSG:4326',
	projection: LonLat,
	transformation: toTransformation(1 / 180, 1, -1 / 180, 0.5)
});

/*
 * @namespace CRS
 * @crs L.CRS.Simple
 *
 * A simple CRS that maps longitude and latitude into `x` and `y` directly.
 * May be used for maps of flat surfaces (e.g. game maps). Note that the `y`
 * axis should still be inverted (going from bottom to top). `distance()` returns
 * simple euclidean distance.
 */

var Simple = extend({}, CRS, {
	projection: LonLat,
	transformation: toTransformation(1, 0, -1, 0),

	scale: function (zoom) {
		return Math.pow(2, zoom);
	},

	zoom: function (scale) {
		return Math.log(scale) / Math.LN2;
	},

	distance: function (latlng1, latlng2) {
		var dx = latlng2.lng - latlng1.lng,
		    dy = latlng2.lat - latlng1.lat;

		return Math.sqrt(dx * dx + dy * dy);
	},

	infinite: true
});

CRS.Earth = Earth;
CRS.EPSG3395 = EPSG3395;
CRS.EPSG3857 = EPSG3857;
CRS.EPSG900913 = EPSG900913;
CRS.EPSG4326 = EPSG4326;
CRS.Simple = Simple;

/*
 * @class Layer
 * @inherits Evented
 * @aka L.Layer
 * @aka ILayer
 *
 * A set of methods from the Layer base class that all Leaflet layers use.
 * Inherits all methods, options and events from `L.Evented`.
 *
 * @example
 *
 * ```js
 * var layer = L.Marker(latlng).addTo(map);
 * layer.addTo(map);
 * layer.remove();
 * ```
 *
 * @event add: Event
 * Fired after the layer is added to a map
 *
 * @event remove: Event
 * Fired after the layer is removed from a map
 */


var Layer = Evented.extend({

	// Classes extending `L.Layer` will inherit the following options:
	options: {
		// @option pane: String = 'overlayPane'
		// By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding this option will cause the layer to be placed on another pane by default.
		pane: 'overlayPane',

		// @option attribution: String = null
		// String to be shown in the attribution control, describes the layer data, e.g. "© Mapbox".
		attribution: null,

		bubblingMouseEvents: true
	},

	/* @section
	 * Classes extending `L.Layer` will inherit the following methods:
	 *
	 * @method addTo(map: Map|LayerGroup): this
	 * Adds the layer to the given map or layer group.
	 */
	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	// @method remove: this
	// Removes the layer from the map it is currently active on.
	remove: function () {
		return this.removeFrom(this._map || this._mapToAdd);
	},

	// @method removeFrom(map: Map): this
	// Removes the layer from the given map
	removeFrom: function (obj) {
		if (obj) {
			obj.removeLayer(this);
		}
		return this;
	},

	// @method getPane(name? : String): HTMLElement
	// Returns the `HTMLElement` representing the named pane on the map. If `name` is omitted, returns the pane for this layer.
	getPane: function (name) {
		return this._map.getPane(name ? (this.options[name] || name) : this.options.pane);
	},

	addInteractiveTarget: function (targetEl) {
		this._map._targets[stamp(targetEl)] = this;
		return this;
	},

	removeInteractiveTarget: function (targetEl) {
		delete this._map._targets[stamp(targetEl)];
		return this;
	},

	// @method getAttribution: String
	// Used by the `attribution control`, returns the [attribution option](#gridlayer-attribution).
	getAttribution: function () {
		return this.options.attribution;
	},

	_layerAdd: function (e) {
		var map = e.target;

		// check in case layer gets added and then removed before the map is ready
		if (!map.hasLayer(this)) { return; }

		this._map = map;
		this._zoomAnimated = map._zoomAnimated;

		if (this.getEvents) {
			var events = this.getEvents();
			map.on(events, this);
			this.once('remove', function () {
				map.off(events, this);
			}, this);
		}

		this.onAdd(map);

		if (this.getAttribution && map.attributionControl) {
			map.attributionControl.addAttribution(this.getAttribution());
		}

		this.fire('add');
		map.fire('layeradd', {layer: this});
	}
});

/* @section Extension methods
 * @uninheritable
 *
 * Every layer should extend from `L.Layer` and (re-)implement the following methods.
 *
 * @method onAdd(map: Map): this
 * Should contain code that creates DOM elements for the layer, adds them to `map panes` where they should belong and puts listeners on relevant map events. Called on [`map.addLayer(layer)`](#map-addlayer).
 *
 * @method onRemove(map: Map): this
 * Should contain all clean up code that removes the layer's elements from the DOM and removes listeners previously added in [`onAdd`](#layer-onadd). Called on [`map.removeLayer(layer)`](#map-removelayer).
 *
 * @method getEvents(): Object
 * This optional method should return an object like `{ viewreset: this._reset }` for [`addEventListener`](#evented-addeventlistener). The event handlers in this object will be automatically added and removed from the map with your layer.
 *
 * @method getAttribution(): String
 * This optional method should return a string containing HTML to be shown on the `Attribution control` whenever the layer is visible.
 *
 * @method beforeAdd(map: Map): this
 * Optional method. Called on [`map.addLayer(layer)`](#map-addlayer), before the layer is added to the map, before events are initialized, without waiting until the map is in a usable state. Use for early initialization only.
 */


/* @namespace Map
 * @section Layer events
 *
 * @event layeradd: LayerEvent
 * Fired when a new layer is added to the map.
 *
 * @event layerremove: LayerEvent
 * Fired when some layer is removed from the map
 *
 * @section Methods for Layers and Controls
 */
Map.include({
	// @method addLayer(layer: Layer): this
	// Adds the given layer to the map
	addLayer: function (layer) {
		if (!layer._layerAdd) {
			throw new Error('The provided object is not a Layer.');
		}

		var id = stamp(layer);
		if (this._layers[id]) { return this; }
		this._layers[id] = layer;

		layer._mapToAdd = this;

		if (layer.beforeAdd) {
			layer.beforeAdd(this);
		}

		this.whenReady(layer._layerAdd, layer);

		return this;
	},

	// @method removeLayer(layer: Layer): this
	// Removes the given layer from the map.
	removeLayer: function (layer) {
		var id = stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		if (layer.getAttribution && this.attributionControl) {
			this.attributionControl.removeAttribution(layer.getAttribution());
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer: layer});
			layer.fire('remove');
		}

		layer._map = layer._mapToAdd = null;

		return this;
	},

	// @method hasLayer(layer: Layer): Boolean
	// Returns `true` if the given layer is currently added to the map
	hasLayer: function (layer) {
		return !!layer && (stamp(layer) in this._layers);
	},

	/* @method eachLayer(fn: Function, context?: Object): this
	 * Iterates over the layers of the map, optionally specifying context of the iterator function.
	 * ```
	 * map.eachLayer(function(layer){
	 *     layer.bindPopup('Hello');
	 * });
	 * ```
	 */
	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	_addLayers: function (layers) {
		layers = layers ? (isArray(layers) ? layers : [layers]) : [];

		for (var i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},

	_addZoomLimit: function (layer) {
		if (isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
			this._zoomBoundLayers[stamp(layer)] = layer;
			this._updateZoomLevels();
		}
	},

	_removeZoomLimit: function (layer) {
		var id = stamp(layer);

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}
	},

	_updateZoomLevels: function () {
		var minZoom = Infinity,
		    maxZoom = -Infinity,
		    oldZoomSpan = this._getZoomSpan();

		for (var i in this._zoomBoundLayers) {
			var options = this._zoomBoundLayers[i].options;

			minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
			maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
		}

		this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
		this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;

		// @section Map state change events
		// @event zoomlevelschange: Event
		// Fired when the number of zoomlevels on the map is changed due
		// to adding or removing a layer.
		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}

		if (this.options.maxZoom === undefined && this._layersMaxZoom && this.getZoom() > this._layersMaxZoom) {
			this.setZoom(this._layersMaxZoom);
		}
		if (this.options.minZoom === undefined && this._layersMinZoom && this.getZoom() < this._layersMinZoom) {
			this.setZoom(this._layersMinZoom);
		}
	}
});

/*
 * @class LayerGroup
 * @aka L.LayerGroup
 * @inherits Layer
 *
 * Used to group several layers and handle them as one. If you add it to the map,
 * any layers added or removed from the group will be added/removed on the map as
 * well. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * L.layerGroup([marker1, marker2])
 * 	.addLayer(polyline)
 * 	.addTo(map);
 * ```
 */

var LayerGroup = Layer.extend({

	initialize: function (layers, options) {
		setOptions(this, options);

		this._layers = {};

		var i, len;

		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	},

	// @method addLayer(layer: Layer): this
	// Adds the given layer to the group.
	addLayer: function (layer) {
		var id = this.getLayerId(layer);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this;
	},

	// @method removeLayer(layer: Layer): this
	// Removes the given layer from the group.
	// @alternative
	// @method removeLayer(id: Number): this
	// Removes the layer with the given internal ID from the group.
	removeLayer: function (layer) {
		var id = layer in this._layers ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	},

	// @method hasLayer(layer: Layer): Boolean
	// Returns `true` if the given layer is currently added to the group.
	// @alternative
	// @method hasLayer(id: Number): Boolean
	// Returns `true` if the given internal ID is currently added to the group.
	hasLayer: function (layer) {
		return !!layer && (layer in this._layers || this.getLayerId(layer) in this._layers);
	},

	// @method clearLayers(): this
	// Removes all the layers from the group.
	clearLayers: function () {
		return this.eachLayer(this.removeLayer, this);
	},

	// @method invoke(methodName: String, …): this
	// Calls `methodName` on every layer contained in this group, passing any
	// additional parameters. Has no effect if the layers contained do not
	// implement `methodName`.
	invoke: function (methodName) {
		var args = Array.prototype.slice.call(arguments, 1),
		    i, layer;

		for (i in this._layers) {
			layer = this._layers[i];

			if (layer[methodName]) {
				layer[methodName].apply(layer, args);
			}
		}

		return this;
	},

	onAdd: function (map) {
		this.eachLayer(map.addLayer, map);
	},

	onRemove: function (map) {
		this.eachLayer(map.removeLayer, map);
	},

	// @method eachLayer(fn: Function, context?: Object): this
	// Iterates over the layers of the group, optionally specifying context of the iterator function.
	// ```js
	// group.eachLayer(function (layer) {
	// 	layer.bindPopup('Hello');
	// });
	// ```
	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	// @method getLayer(id: Number): Layer
	// Returns the layer with the given internal ID.
	getLayer: function (id) {
		return this._layers[id];
	},

	// @method getLayers(): Layer[]
	// Returns an array of all the layers added to the group.
	getLayers: function () {
		var layers = [];
		this.eachLayer(layers.push, layers);
		return layers;
	},

	// @method setZIndex(zIndex: Number): this
	// Calls `setZIndex` on every layer contained in this group, passing the z-index.
	setZIndex: function (zIndex) {
		return this.invoke('setZIndex', zIndex);
	},

	// @method getLayerId(layer: Layer): Number
	// Returns the internal ID for a layer
	getLayerId: function (layer) {
		return stamp(layer);
	}
});


// @factory L.layerGroup(layers?: Layer[], options?: Object)
// Create a layer group, optionally given an initial set of layers and an `options` object.
var layerGroup = function (layers, options) {
	return new LayerGroup(layers, options);
};

/*
 * @class FeatureGroup
 * @aka L.FeatureGroup
 * @inherits LayerGroup
 *
 * Extended `LayerGroup` that makes it easier to do the same thing to all its member layers:
 *  * [`bindPopup`](#layer-bindpopup) binds a popup to all of the layers at once (likewise with [`bindTooltip`](#layer-bindtooltip))
 *  * Events are propagated to the `FeatureGroup`, so if the group has an event
 * handler, it will handle events from any of the layers. This includes mouse events
 * and custom events.
 *  * Has `layeradd` and `layerremove` events
 *
 * @example
 *
 * ```js
 * L.featureGroup([marker1, marker2, polyline])
 * 	.bindPopup('Hello world!')
 * 	.on('click', function() { alert('Clicked on a member of the group!'); })
 * 	.addTo(map);
 * ```
 */

var FeatureGroup = LayerGroup.extend({

	addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		layer.addEventParent(this);

		LayerGroup.prototype.addLayer.call(this, layer);

		// @event layeradd: LayerEvent
		// Fired when a layer is added to this `FeatureGroup`
		return this.fire('layeradd', {layer: layer});
	},

	removeLayer: function (layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (layer in this._layers) {
			layer = this._layers[layer];
		}

		layer.removeEventParent(this);

		LayerGroup.prototype.removeLayer.call(this, layer);

		// @event layerremove: LayerEvent
		// Fired when a layer is removed from this `FeatureGroup`
		return this.fire('layerremove', {layer: layer});
	},

	// @method setStyle(style: Path options): this
	// Sets the given path options to each layer of the group that has a `setStyle` method.
	setStyle: function (style) {
		return this.invoke('setStyle', style);
	},

	// @method bringToFront(): this
	// Brings the layer group to the top of all other layers
	bringToFront: function () {
		return this.invoke('bringToFront');
	},

	// @method bringToBack(): this
	// Brings the layer group to the back of all other layers
	bringToBack: function () {
		return this.invoke('bringToBack');
	},

	// @method getBounds(): LatLngBounds
	// Returns the LatLngBounds of the Feature Group (created from bounds and coordinates of its children).
	getBounds: function () {
		var bounds = new LatLngBounds();

		for (var id in this._layers) {
			var layer = this._layers[id];
			bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
		}
		return bounds;
	}
});

// @factory L.featureGroup(layers: Layer[])
// Create a feature group, optionally given an initial set of layers.
var featureGroup = function (layers) {
	return new FeatureGroup(layers);
};

/*
 * @class Icon
 * @aka L.Icon
 *
 * Represents an icon to provide when creating a marker.
 *
 * @example
 *
 * ```js
 * var myIcon = L.icon({
 *     iconUrl: 'my-icon.png',
 *     iconRetinaUrl: 'my-icon@2x.png',
 *     iconSize: [38, 95],
 *     iconAnchor: [22, 94],
 *     popupAnchor: [-3, -76],
 *     shadowUrl: 'my-icon-shadow.png',
 *     shadowRetinaUrl: 'my-icon-shadow@2x.png',
 *     shadowSize: [68, 95],
 *     shadowAnchor: [22, 94]
 * });
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * `L.Icon.Default` extends `L.Icon` and is the blue icon Leaflet uses for markers by default.
 *
 */

var Icon = Class.extend({

	/* @section
	 * @aka Icon options
	 *
	 * @option iconUrl: String = null
	 * **(required)** The URL to the icon image (absolute or relative to your script path).
	 *
	 * @option iconRetinaUrl: String = null
	 * The URL to a retina sized version of the icon image (absolute or relative to your
	 * script path). Used for Retina screen devices.
	 *
	 * @option iconSize: Point = null
	 * Size of the icon image in pixels.
	 *
	 * @option iconAnchor: Point = null
	 * The coordinates of the "tip" of the icon (relative to its top left corner). The icon
	 * will be aligned so that this point is at the marker's geographical location. Centered
	 * by default if size is specified, also can be set in CSS with negative margins.
	 *
	 * @option popupAnchor: Point = [0, 0]
	 * The coordinates of the point from which popups will "open", relative to the icon anchor.
	 *
	 * @option tooltipAnchor: Point = [0, 0]
	 * The coordinates of the point from which tooltips will "open", relative to the icon anchor.
	 *
	 * @option shadowUrl: String = null
	 * The URL to the icon shadow image. If not specified, no shadow image will be created.
	 *
	 * @option shadowRetinaUrl: String = null
	 *
	 * @option shadowSize: Point = null
	 * Size of the shadow image in pixels.
	 *
	 * @option shadowAnchor: Point = null
	 * The coordinates of the "tip" of the shadow (relative to its top left corner) (the same
	 * as iconAnchor if not specified).
	 *
	 * @option className: String = ''
	 * A custom class name to assign to both icon and shadow images. Empty by default.
	 */

	options: {
		popupAnchor: [0, 0],
		tooltipAnchor: [0, 0],
	},

	initialize: function (options) {
		setOptions(this, options);
	},

	// @method createIcon(oldIcon?: HTMLElement): HTMLElement
	// Called internally when the icon has to be shown, returns a `<img>` HTML element
	// styled according to the options.
	createIcon: function (oldIcon) {
		return this._createIcon('icon', oldIcon);
	},

	// @method createShadow(oldIcon?: HTMLElement): HTMLElement
	// As `createIcon`, but for the shadow beneath it.
	createShadow: function (oldIcon) {
		return this._createIcon('shadow', oldIcon);
	},

	_createIcon: function (name, oldIcon) {
		var src = this._getIconUrl(name);

		if (!src) {
			if (name === 'icon') {
				throw new Error('iconUrl not set in Icon options (see the docs).');
			}
			return null;
		}

		var img = this._createImg(src, oldIcon && oldIcon.tagName === 'IMG' ? oldIcon : null);
		this._setIconStyles(img, name);

		return img;
	},

	_setIconStyles: function (img, name) {
		var options = this.options;
		var sizeOption = options[name + 'Size'];

		if (typeof sizeOption === 'number') {
			sizeOption = [sizeOption, sizeOption];
		}

		var size = toPoint(sizeOption),
		    anchor = toPoint(name === 'shadow' && options.shadowAnchor || options.iconAnchor ||
		            size && size.divideBy(2, true));

		img.className = 'leaflet-marker-' + name + ' ' + (options.className || '');

		if (anchor) {
			img.style.marginLeft = (-anchor.x) + 'px';
			img.style.marginTop  = (-anchor.y) + 'px';
		}

		if (size) {
			img.style.width  = size.x + 'px';
			img.style.height = size.y + 'px';
		}
	},

	_createImg: function (src, el) {
		el = el || document.createElement('img');
		el.src = src;
		return el;
	},

	_getIconUrl: function (name) {
		return retina && this.options[name + 'RetinaUrl'] || this.options[name + 'Url'];
	}
});


// @factory L.icon(options: Icon options)
// Creates an icon instance with the given options.
function icon(options) {
	return new Icon(options);
}

/*
 * @miniclass Icon.Default (Icon)
 * @aka L.Icon.Default
 * @section
 *
 * A trivial subclass of `Icon`, represents the icon to use in `Marker`s when
 * no icon is specified. Points to the blue marker image distributed with Leaflet
 * releases.
 *
 * In order to customize the default icon, just change the properties of `L.Icon.Default.prototype.options`
 * (which is a set of `Icon options`).
 *
 * If you want to _completely_ replace the default icon, override the
 * `L.Marker.prototype.options.icon` with your own icon instead.
 */

var IconDefault = Icon.extend({

	options: {
		iconUrl:       'marker-icon.png',
		iconRetinaUrl: 'marker-icon-2x.png',
		shadowUrl:     'marker-shadow.png',
		iconSize:    [25, 41],
		iconAnchor:  [12, 41],
		popupAnchor: [1, -34],
		tooltipAnchor: [16, -28],
		shadowSize:  [41, 41]
	},

	_getIconUrl: function (name) {
		if (!IconDefault.imagePath) {	// Deprecated, backwards-compatibility only
			IconDefault.imagePath = this._detectIconPath();
		}

		// @option imagePath: String
		// `Icon.Default` will try to auto-detect the location of the
		// blue icon images. If you are placing these images in a non-standard
		// way, set this option to point to the right path.
		return (this.options.imagePath || IconDefault.imagePath) + Icon.prototype._getIconUrl.call(this, name);
	},

	_detectIconPath: function () {
		var el = create$1('div',  'leaflet-default-icon-path', document.body);
		var path = getStyle(el, 'background-image') ||
		           getStyle(el, 'backgroundImage');	// IE8

		document.body.removeChild(el);

		if (path === null || path.indexOf('url') !== 0) {
			path = '';
		} else {
			path = path.replace(/^url\(["']?/, '').replace(/marker-icon\.png["']?\)$/, '');
		}

		return path;
	}
});

/*
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 */


/* @namespace Marker
 * @section Interaction handlers
 *
 * Interaction handlers are properties of a marker instance that allow you to control interaction behavior in runtime, enabling or disabling certain features such as dragging (see `Handler` methods). Example:
 *
 * ```js
 * marker.dragging.disable();
 * ```
 *
 * @property dragging: Handler
 * Marker dragging handler (by both mouse and touch). Only valid when the marker is on the map (Otherwise set [`marker.options.draggable`](#marker-draggable)).
 */

var MarkerDrag = Handler.extend({
	initialize: function (marker) {
		this._marker = marker;
	},

	addHooks: function () {
		var icon = this._marker._icon;

		if (!this._draggable) {
			this._draggable = new Draggable(icon, icon, true);
		}

		this._draggable.on({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).enable();

		addClass(icon, 'leaflet-marker-draggable');
	},

	removeHooks: function () {
		this._draggable.off({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).disable();

		if (this._marker._icon) {
			removeClass(this._marker._icon, 'leaflet-marker-draggable');
		}
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_adjustPan: function (e) {
		var marker = this._marker,
		    map = marker._map,
		    speed = this._marker.options.autoPanSpeed,
		    padding = this._marker.options.autoPanPadding,
		    iconPos = L.DomUtil.getPosition(marker._icon),
		    bounds = map.getPixelBounds(),
		    origin = map.getPixelOrigin();

		var panBounds = toBounds(
			bounds.min._subtract(origin).add(padding),
			bounds.max._subtract(origin).subtract(padding)
		);

		if (!panBounds.contains(iconPos)) {
			// Compute incremental movement
			var movement = toPoint(
				(Math.max(panBounds.max.x, iconPos.x) - panBounds.max.x) / (bounds.max.x - panBounds.max.x) -
				(Math.min(panBounds.min.x, iconPos.x) - panBounds.min.x) / (bounds.min.x - panBounds.min.x),

				(Math.max(panBounds.max.y, iconPos.y) - panBounds.max.y) / (bounds.max.y - panBounds.max.y) -
				(Math.min(panBounds.min.y, iconPos.y) - panBounds.min.y) / (bounds.min.y - panBounds.min.y)
			).multiplyBy(speed);

			map.panBy(movement, {animate: false});

			this._draggable._newPos._add(movement);
			this._draggable._startPos._add(movement);

			L.DomUtil.setPosition(marker._icon, this._draggable._newPos);
			this._onDrag(e);

			this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
		}
	},

	_onDragStart: function () {
		// @section Dragging events
		// @event dragstart: Event
		// Fired when the user starts dragging the marker.

		// @event movestart: Event
		// Fired when the marker starts moving (because of dragging).

		this._oldLatLng = this._marker.getLatLng();
		this._marker
		    .closePopup()
		    .fire('movestart')
		    .fire('dragstart');
	},

	_onPreDrag: function (e) {
		if (this._marker.options.autoPan) {
			cancelAnimFrame(this._panRequest);
			this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
		}
	},

	_onDrag: function (e) {
		var marker = this._marker,
		    shadow = marker._shadow,
		iconPos = getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		// update shadow position
		if (shadow) {
			setPosition(shadow, iconPos);
		}

		marker._latlng = latlng;
		e.latlng = latlng;
		e.oldLatLng = this._oldLatLng;

		// @event drag: Event
		// Fired repeatedly while the user drags the marker.
		marker
		    .fire('move', e)
		    .fire('drag', e);
	},

	_onDragEnd: function (e) {
		// @event dragend: DragEndEvent
		// Fired when the user stops dragging the marker.

		 cancelAnimFrame(this._panRequest);

		// @event moveend: Event
		// Fired when the marker stops moving (because of dragging).
		delete this._oldLatLng;
		this._marker
		    .fire('moveend')
		    .fire('dragend', e);
	}
});

/*
 * @class Marker
 * @inherits Interactive layer
 * @aka L.Marker
 * L.Marker is used to display clickable/draggable icons on the map. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * L.marker([50.5, 30.5]).addTo(map);
 * ```
 */

var Marker = Layer.extend({

	// @section
	// @aka Marker options
	options: {
		// @option icon: Icon = *
		// Icon instance to use for rendering the marker.
		// See [Icon documentation](#L.Icon) for details on how to customize the marker icon.
		// If not specified, a common instance of `L.Icon.Default` is used.
		icon: new IconDefault(),

		// Option inherited from "Interactive layer" abstract class
		interactive: true,

		// @option draggable: Boolean = false
		// Whether the marker is draggable with mouse/touch or not.
		draggable: false,

		// @option autoPan: Boolean = false
		// Set it to `true` if you want the map to do panning animation when marker hits the edges.
		autoPan: false,

		// @option autoPanPadding: Point = Point(50, 50)
		// Equivalent of setting both top left and bottom right autopan padding to the same value.
		autoPanPadding: [50, 50],

		// @option autoPanSpeed: Number = 10
		// Number of pixels the map should move by.
		autoPanSpeed: 10,

		// @option keyboard: Boolean = true
		// Whether the marker can be tabbed to with a keyboard and clicked by pressing enter.
		keyboard: true,

		// @option title: String = ''
		// Text for the browser tooltip that appear on marker hover (no tooltip by default).
		title: '',

		// @option alt: String = ''
		// Text for the `alt` attribute of the icon image (useful for accessibility).
		alt: '',

		// @option zIndexOffset: Number = 0
		// By default, marker images zIndex is set automatically based on its latitude. Use this option if you want to put the marker on top of all others (or below), specifying a high value like `1000` (or high negative value, respectively).
		zIndexOffset: 0,

		// @option opacity: Number = 1.0
		// The opacity of the marker.
		opacity: 1,

		// @option riseOnHover: Boolean = false
		// If `true`, the marker will get on top of others when you hover the mouse over it.
		riseOnHover: false,

		// @option riseOffset: Number = 250
		// The z-index offset used for the `riseOnHover` feature.
		riseOffset: 250,

		// @option pane: String = 'markerPane'
		// `Map pane` where the markers icon will be added.
		pane: 'markerPane',

		// @option bubblingMouseEvents: Boolean = false
		// When `true`, a mouse event on this marker will trigger the same event on the map
		// (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
		bubblingMouseEvents: false
	},

	/* @section
	 *
	 * In addition to [shared layer methods](#Layer) like `addTo()` and `remove()` and [popup methods](#Popup) like bindPopup() you can also use the following methods:
	 */

	initialize: function (latlng, options) {
		setOptions(this, options);
		this._latlng = toLatLng(latlng);
	},

	onAdd: function (map) {
		this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;

		if (this._zoomAnimated) {
			map.on('zoomanim', this._animateZoom, this);
		}

		this._initIcon();
		this.update();
	},

	onRemove: function (map) {
		if (this.dragging && this.dragging.enabled()) {
			this.options.draggable = true;
			this.dragging.removeHooks();
		}
		delete this.dragging;

		if (this._zoomAnimated) {
			map.off('zoomanim', this._animateZoom, this);
		}

		this._removeIcon();
		this._removeShadow();
	},

	getEvents: function () {
		return {
			zoom: this.update,
			viewreset: this.update
		};
	},

	// @method getLatLng: LatLng
	// Returns the current geographical position of the marker.
	getLatLng: function () {
		return this._latlng;
	},

	// @method setLatLng(latlng: LatLng): this
	// Changes the marker position to the given point.
	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = toLatLng(latlng);
		this.update();

		// @event move: Event
		// Fired when the marker is moved via [`setLatLng`](#marker-setlatlng) or by [dragging](#marker-dragging). Old and new coordinates are included in event arguments as `oldLatLng`, `latlng`.
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	// @method setZIndexOffset(offset: Number): this
	// Changes the [zIndex offset](#marker-zindexoffset) of the marker.
	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		return this.update();
	},

	// @method setIcon(icon: Icon): this
	// Changes the marker icon.
	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		if (this._popup) {
			this.bindPopup(this._popup, this._popup.options);
		}

		return this;
	},

	getElement: function () {
		return this._icon;
	},

	update: function () {

		if (this._icon && this._map) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}

		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    classToAdd = 'leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

		var icon = options.icon.createIcon(this._icon),
		    addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}

			if (icon.tagName === 'IMG') {
				icon.alt = options.alt || '';
			}
		}

		addClass(icon, classToAdd);

		if (options.keyboard) {
			icon.tabIndex = '0';
		}

		this._icon = icon;

		if (options.riseOnHover) {
			this.on({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		var newShadow = options.icon.createShadow(this._shadow),
		    addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			addClass(newShadow, classToAdd);
			newShadow.alt = '';
		}
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		if (addIcon) {
			this.getPane().appendChild(this._icon);
		}
		this._initInteraction();
		if (newShadow && addShadow) {
			this.getPane('shadowPane').appendChild(this._shadow);
		}
	},

	_removeIcon: function () {
		if (this.options.riseOnHover) {
			this.off({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		remove(this._icon);
		this.removeInteractiveTarget(this._icon);

		this._icon = null;
	},

	_removeShadow: function () {
		if (this._shadow) {
			remove(this._shadow);
		}
		this._shadow = null;
	},

	_setPos: function (pos) {
		setPosition(this._icon, pos);

		if (this._shadow) {
			setPosition(this._shadow, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		this._icon.style.zIndex = this._zIndex + offset;
	},

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
	},

	_initInteraction: function () {

		if (!this.options.interactive) { return; }

		addClass(this._icon, 'leaflet-interactive');

		this.addInteractiveTarget(this._icon);

		if (MarkerDrag) {
			var draggable = this.options.draggable;
			if (this.dragging) {
				draggable = this.dragging.enabled();
				this.dragging.disable();
			}

			this.dragging = new MarkerDrag(this);

			if (draggable) {
				this.dragging.enable();
			}
		}
	},

	// @method setOpacity(opacity: Number): this
	// Changes the opacity of the marker.
	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;

		setOpacity(this._icon, opacity);

		if (this._shadow) {
			setOpacity(this._shadow, opacity);
		}
	},

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	},

	_getPopupAnchor: function () {
		return this.options.icon.options.popupAnchor;
	},

	_getTooltipAnchor: function () {
		return this.options.icon.options.tooltipAnchor;
	}
});


// factory L.marker(latlng: LatLng, options? : Marker options)

// @factory L.marker(latlng: LatLng, options? : Marker options)
// Instantiates a Marker object given a geographical point and optionally an options object.
function marker(latlng, options) {
	return new Marker(latlng, options);
}

/*
 * @class Path
 * @aka L.Path
 * @inherits Interactive layer
 *
 * An abstract class that contains options and constants shared between vector
 * overlays (Polygon, Polyline, Circle). Do not use it directly. Extends `Layer`.
 */

var Path = Layer.extend({

	// @section
	// @aka Path options
	options: {
		// @option stroke: Boolean = true
		// Whether to draw stroke along the path. Set it to `false` to disable borders on polygons or circles.
		stroke: true,

		// @option color: String = '#3388ff'
		// Stroke color
		color: '#3388ff',

		// @option weight: Number = 3
		// Stroke width in pixels
		weight: 3,

		// @option opacity: Number = 1.0
		// Stroke opacity
		opacity: 1,

		// @option lineCap: String= 'round'
		// A string that defines [shape to be used at the end](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap) of the stroke.
		lineCap: 'round',

		// @option lineJoin: String = 'round'
		// A string that defines [shape to be used at the corners](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin) of the stroke.
		lineJoin: 'round',

		// @option dashArray: String = null
		// A string that defines the stroke [dash pattern](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
		dashArray: null,

		// @option dashOffset: String = null
		// A string that defines the [distance into the dash pattern to start the dash](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
		dashOffset: null,

		// @option fill: Boolean = depends
		// Whether to fill the path with color. Set it to `false` to disable filling on polygons or circles.
		fill: false,

		// @option fillColor: String = *
		// Fill color. Defaults to the value of the [`color`](#path-color) option
		fillColor: null,

		// @option fillOpacity: Number = 0.2
		// Fill opacity.
		fillOpacity: 0.2,

		// @option fillRule: String = 'evenodd'
		// A string that defines [how the inside of a shape](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule) is determined.
		fillRule: 'evenodd',

		// className: '',

		// Option inherited from "Interactive layer" abstract class
		interactive: true,

		// @option bubblingMouseEvents: Boolean = true
		// When `true`, a mouse event on this path will trigger the same event on the map
		// (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
		bubblingMouseEvents: true
	},

	beforeAdd: function (map) {
		// Renderer is set here because we need to call renderer.getEvents
		// before this.getEvents.
		this._renderer = map.getRenderer(this);
	},

	onAdd: function () {
		this._renderer._initPath(this);
		this._reset();
		this._renderer._addPath(this);
	},

	onRemove: function () {
		this._renderer._removePath(this);
	},

	// @method redraw(): this
	// Redraws the layer. Sometimes useful after you changed the coordinates that the path uses.
	redraw: function () {
		if (this._map) {
			this._renderer._updatePath(this);
		}
		return this;
	},

	// @method setStyle(style: Path options): this
	// Changes the appearance of a Path based on the options in the `Path options` object.
	setStyle: function (style) {
		setOptions(this, style);
		if (this._renderer) {
			this._renderer._updateStyle(this);
		}
		return this;
	},

	// @method bringToFront(): this
	// Brings the layer to the top of all path layers.
	bringToFront: function () {
		if (this._renderer) {
			this._renderer._bringToFront(this);
		}
		return this;
	},

	// @method bringToBack(): this
	// Brings the layer to the bottom of all path layers.
	bringToBack: function () {
		if (this._renderer) {
			this._renderer._bringToBack(this);
		}
		return this;
	},

	getElement: function () {
		return this._path;
	},

	_reset: function () {
		// defined in child classes
		this._project();
		this._update();
	},

	_clickTolerance: function () {
		// used when doing hit detection for Canvas layers
		return (this.options.stroke ? this.options.weight / 2 : 0) + this._renderer.options.tolerance;
	}
});

/*
 * @class CircleMarker
 * @aka L.CircleMarker
 * @inherits Path
 *
 * A circle of a fixed size with radius specified in pixels. Extends `Path`.
 */

var CircleMarker = Path.extend({

	// @section
	// @aka CircleMarker options
	options: {
		fill: true,

		// @option radius: Number = 10
		// Radius of the circle marker, in pixels
		radius: 10
	},

	initialize: function (latlng, options) {
		setOptions(this, options);
		this._latlng = toLatLng(latlng);
		this._radius = this.options.radius;
	},

	// @method setLatLng(latLng: LatLng): this
	// Sets the position of a circle marker to a new location.
	setLatLng: function (latlng) {
		this._latlng = toLatLng(latlng);
		this.redraw();
		return this.fire('move', {latlng: this._latlng});
	},

	// @method getLatLng(): LatLng
	// Returns the current geographical position of the circle marker
	getLatLng: function () {
		return this._latlng;
	},

	// @method setRadius(radius: Number): this
	// Sets the radius of a circle marker. Units are in pixels.
	setRadius: function (radius) {
		this.options.radius = this._radius = radius;
		return this.redraw();
	},

	// @method getRadius(): Number
	// Returns the current radius of the circle
	getRadius: function () {
		return this._radius;
	},

	setStyle : function (options) {
		var radius = options && options.radius || this._radius;
		Path.prototype.setStyle.call(this, options);
		this.setRadius(radius);
		return this;
	},

	_project: function () {
		this._point = this._map.latLngToLayerPoint(this._latlng);
		this._updateBounds();
	},

	_updateBounds: function () {
		var r = this._radius,
		    r2 = this._radiusY || r,
		    w = this._clickTolerance(),
		    p = [r + w, r2 + w];
		this._pxBounds = new Bounds(this._point.subtract(p), this._point.add(p));
	},

	_update: function () {
		if (this._map) {
			this._updatePath();
		}
	},

	_updatePath: function () {
		this._renderer._updateCircle(this);
	},

	_empty: function () {
		return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
	},

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint: function (p) {
		return p.distanceTo(this._point) <= this._radius + this._clickTolerance();
	}
});


// @factory L.circleMarker(latlng: LatLng, options?: CircleMarker options)
// Instantiates a circle marker object given a geographical point, and an optional options object.
function circleMarker(latlng, options) {
	return new CircleMarker(latlng, options);
}

/*
 * @class Circle
 * @aka L.Circle
 * @inherits CircleMarker
 *
 * A class for drawing circle overlays on a map. Extends `CircleMarker`.
 *
 * It's an approximation and starts to diverge from a real circle closer to poles (due to projection distortion).
 *
 * @example
 *
 * ```js
 * L.circle([50.5, 30.5], {radius: 200}).addTo(map);
 * ```
 */

var Circle = CircleMarker.extend({

	initialize: function (latlng, options, legacyOptions) {
		if (typeof options === 'number') {
			// Backwards compatibility with 0.7.x factory (latlng, radius, options?)
			options = extend({}, legacyOptions, {radius: options});
		}
		setOptions(this, options);
		this._latlng = toLatLng(latlng);

		if (isNaN(this.options.radius)) { throw new Error('Circle radius cannot be NaN'); }

		// @section
		// @aka Circle options
		// @option radius: Number; Radius of the circle, in meters.
		this._mRadius = this.options.radius;
	},

	// @method setRadius(radius: Number): this
	// Sets the radius of a circle. Units are in meters.
	setRadius: function (radius) {
		this._mRadius = radius;
		return this.redraw();
	},

	// @method getRadius(): Number
	// Returns the current radius of a circle. Units are in meters.
	getRadius: function () {
		return this._mRadius;
	},

	// @method getBounds(): LatLngBounds
	// Returns the `LatLngBounds` of the path.
	getBounds: function () {
		var half = [this._radius, this._radiusY || this._radius];

		return new LatLngBounds(
			this._map.layerPointToLatLng(this._point.subtract(half)),
			this._map.layerPointToLatLng(this._point.add(half)));
	},

	setStyle: Path.prototype.setStyle,

	_project: function () {

		var lng = this._latlng.lng,
		    lat = this._latlng.lat,
		    map = this._map,
		    crs = map.options.crs;

		if (crs.distance === Earth.distance) {
			var d = Math.PI / 180,
			    latR = (this._mRadius / Earth.R) / d,
			    top = map.project([lat + latR, lng]),
			    bottom = map.project([lat - latR, lng]),
			    p = top.add(bottom).divideBy(2),
			    lat2 = map.unproject(p).lat,
			    lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
			            (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;

			if (isNaN(lngR) || lngR === 0) {
				lngR = latR / Math.cos(Math.PI / 180 * lat); // Fallback for edge case, #2425
			}

			this._point = p.subtract(map.getPixelOrigin());
			this._radius = isNaN(lngR) ? 0 : p.x - map.project([lat2, lng - lngR]).x;
			this._radiusY = p.y - top.y;

		} else {
			var latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));

			this._point = map.latLngToLayerPoint(this._latlng);
			this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
		}

		this._updateBounds();
	}
});

// @factory L.circle(latlng: LatLng, options?: Circle options)
// Instantiates a circle object given a geographical point, and an options object
// which contains the circle radius.
// @alternative
// @factory L.circle(latlng: LatLng, radius: Number, options?: Circle options)
// Obsolete way of instantiating a circle, for compatibility with 0.7.x code.
// Do not use in new applications or plugins.
function circle(latlng, options, legacyOptions) {
	return new Circle(latlng, options, legacyOptions);
}

/*
 * @class Polyline
 * @aka L.Polyline
 * @inherits Path
 *
 * A class for drawing polyline overlays on a map. Extends `Path`.
 *
 * @example
 *
 * ```js
 * // create a red polyline from an array of LatLng points
 * var latlngs = [
 * 	[45.51, -122.68],
 * 	[37.77, -122.43],
 * 	[34.04, -118.2]
 * ];
 *
 * var polyline = L.polyline(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polyline
 * map.fitBounds(polyline.getBounds());
 * ```
 *
 * You can also pass a multi-dimensional array to represent a `MultiPolyline` shape:
 *
 * ```js
 * // create a red polyline from an array of arrays of LatLng points
 * var latlngs = [
 * 	[[45.51, -122.68],
 * 	 [37.77, -122.43],
 * 	 [34.04, -118.2]],
 * 	[[40.78, -73.91],
 * 	 [41.83, -87.62],
 * 	 [32.76, -96.72]]
 * ];
 * ```
 */


var Polyline = Path.extend({

	// @section
	// @aka Polyline options
	options: {
		// @option smoothFactor: Number = 1.0
		// How much to simplify the polyline on each zoom level. More means
		// better performance and smoother look, and less means more accurate representation.
		smoothFactor: 1.0,

		// @option noClip: Boolean = false
		// Disable polyline clipping.
		noClip: false
	},

	initialize: function (latlngs, options) {
		setOptions(this, options);
		this._setLatLngs(latlngs);
	},

	// @method getLatLngs(): LatLng[]
	// Returns an array of the points in the path, or nested arrays of points in case of multi-polyline.
	getLatLngs: function () {
		return this._latlngs;
	},

	// @method setLatLngs(latlngs: LatLng[]): this
	// Replaces all the points in the polyline with the given array of geographical points.
	setLatLngs: function (latlngs) {
		this._setLatLngs(latlngs);
		return this.redraw();
	},

	// @method isEmpty(): Boolean
	// Returns `true` if the Polyline has no LatLngs.
	isEmpty: function () {
		return !this._latlngs.length;
	},

	// @method closestLayerPoint: Point
	// Returns the point closest to `p` on the Polyline.
	closestLayerPoint: function (p) {
		var minDistance = Infinity,
		    minPoint = null,
		    closest = _sqClosestPointOnSegment,
		    p1, p2;

		for (var j = 0, jLen = this._parts.length; j < jLen; j++) {
			var points = this._parts[j];

			for (var i = 1, len = points.length; i < len; i++) {
				p1 = points[i - 1];
				p2 = points[i];

				var sqDist = closest(p, p1, p2, true);

				if (sqDist < minDistance) {
					minDistance = sqDist;
					minPoint = closest(p, p1, p2);
				}
			}
		}
		if (minPoint) {
			minPoint.distance = Math.sqrt(minDistance);
		}
		return minPoint;
	},

	// @method getCenter(): LatLng
	// Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the polyline.
	getCenter: function () {
		// throws error when not yet added to map as this center calculation requires projected coordinates
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}

		var i, halfDist, segDist, dist, p1, p2, ratio,
		    points = this._rings[0],
		    len = points.length;

		if (!len) { return null; }

		// polyline centroid algorithm; only uses the first ring if there are multiple

		for (i = 0, halfDist = 0; i < len - 1; i++) {
			halfDist += points[i].distanceTo(points[i + 1]) / 2;
		}

		// The line is so small in the current view that all points are on the same pixel.
		if (halfDist === 0) {
			return this._map.layerPointToLatLng(points[0]);
		}

		for (i = 0, dist = 0; i < len - 1; i++) {
			p1 = points[i];
			p2 = points[i + 1];
			segDist = p1.distanceTo(p2);
			dist += segDist;

			if (dist > halfDist) {
				ratio = (dist - halfDist) / segDist;
				return this._map.layerPointToLatLng([
					p2.x - ratio * (p2.x - p1.x),
					p2.y - ratio * (p2.y - p1.y)
				]);
			}
		}
	},

	// @method getBounds(): LatLngBounds
	// Returns the `LatLngBounds` of the path.
	getBounds: function () {
		return this._bounds;
	},

	// @method addLatLng(latlng: LatLng, latlngs? LatLng[]): this
	// Adds a given point to the polyline. By default, adds to the first ring of
	// the polyline in case of a multi-polyline, but can be overridden by passing
	// a specific ring as a LatLng array (that you can earlier access with [`getLatLngs`](#polyline-getlatlngs)).
	addLatLng: function (latlng, latlngs) {
		latlngs = latlngs || this._defaultShape();
		latlng = toLatLng(latlng);
		latlngs.push(latlng);
		this._bounds.extend(latlng);
		return this.redraw();
	},

	_setLatLngs: function (latlngs) {
		this._bounds = new LatLngBounds();
		this._latlngs = this._convertLatLngs(latlngs);
	},

	_defaultShape: function () {
		return isFlat(this._latlngs) ? this._latlngs : this._latlngs[0];
	},

	// recursively convert latlngs input into actual LatLng instances; calculate bounds along the way
	_convertLatLngs: function (latlngs) {
		var result = [],
		    flat = isFlat(latlngs);

		for (var i = 0, len = latlngs.length; i < len; i++) {
			if (flat) {
				result[i] = toLatLng(latlngs[i]);
				this._bounds.extend(result[i]);
			} else {
				result[i] = this._convertLatLngs(latlngs[i]);
			}
		}

		return result;
	},

	_project: function () {
		var pxBounds = new Bounds();
		this._rings = [];
		this._projectLatlngs(this._latlngs, this._rings, pxBounds);

		var w = this._clickTolerance(),
		    p = new Point(w, w);

		if (this._bounds.isValid() && pxBounds.isValid()) {
			pxBounds.min._subtract(p);
			pxBounds.max._add(p);
			this._pxBounds = pxBounds;
		}
	},

	// recursively turns latlngs into a set of rings with projected coordinates
	_projectLatlngs: function (latlngs, result, projectedBounds) {
		var flat = latlngs[0] instanceof LatLng,
		    len = latlngs.length,
		    i, ring;

		if (flat) {
			ring = [];
			for (i = 0; i < len; i++) {
				ring[i] = this._map.latLngToLayerPoint(latlngs[i]);
				projectedBounds.extend(ring[i]);
			}
			result.push(ring);
		} else {
			for (i = 0; i < len; i++) {
				this._projectLatlngs(latlngs[i], result, projectedBounds);
			}
		}
	},

	// clip polyline by renderer bounds so that we have less to render for performance
	_clipPoints: function () {
		var bounds = this._renderer._bounds;

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		var parts = this._parts,
		    i, j, k, len, len2, segment, points;

		for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
			points = this._rings[i];

			for (j = 0, len2 = points.length; j < len2 - 1; j++) {
				segment = clipSegment(points[j], points[j + 1], bounds, j, true);

				if (!segment) { continue; }

				parts[k] = parts[k] || [];
				parts[k].push(segment[0]);

				// if segment goes out of screen, or it's the last one, it's the end of the line part
				if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
					parts[k].push(segment[1]);
					k++;
				}
			}
		}
	},

	// simplify each clipped part of the polyline for performance
	_simplifyPoints: function () {
		var parts = this._parts,
		    tolerance = this.options.smoothFactor;

		for (var i = 0, len = parts.length; i < len; i++) {
			parts[i] = simplify(parts[i], tolerance);
		}
	},

	_update: function () {
		if (!this._map) { return; }

		this._clipPoints();
		this._simplifyPoints();
		this._updatePath();
	},

	_updatePath: function () {
		this._renderer._updatePoly(this);
	},

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint: function (p, closed) {
		var i, j, k, len, len2, part,
		    w = this._clickTolerance();

		if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

		// hit detection for polylines
		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				if (!closed && (j === 0)) { continue; }

				if (pointToSegmentDistance(p, part[k], part[j]) <= w) {
					return true;
				}
			}
		}
		return false;
	}
});

// @factory L.polyline(latlngs: LatLng[], options?: Polyline options)
// Instantiates a polyline object given an array of geographical points and
// optionally an options object. You can create a `Polyline` object with
// multiple separate lines (`MultiPolyline`) by passing an array of arrays
// of geographic points.
function polyline(latlngs, options) {
	return new Polyline(latlngs, options);
}

// Retrocompat. Allow plugins to support Leaflet versions before and after 1.1.
Polyline._flat = _flat;

/*
 * @class Polygon
 * @aka L.Polygon
 * @inherits Polyline
 *
 * A class for drawing polygon overlays on a map. Extends `Polyline`.
 *
 * Note that points you pass when creating a polygon shouldn't have an additional last point equal to the first one — it's better to filter out such points.
 *
 *
 * @example
 *
 * ```js
 * // create a red polygon from an array of LatLng points
 * var latlngs = [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]];
 *
 * var polygon = L.polygon(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polygon
 * map.fitBounds(polygon.getBounds());
 * ```
 *
 * You can also pass an array of arrays of latlngs, with the first array representing the outer shape and the other arrays representing holes in the outer shape:
 *
 * ```js
 * var latlngs = [
 *   [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *   [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 * ];
 * ```
 *
 * Additionally, you can pass a multi-dimensional array to represent a MultiPolygon shape.
 *
 * ```js
 * var latlngs = [
 *   [ // first polygon
 *     [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *     [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 *   ],
 *   [ // second polygon
 *     [[41, -111.03],[45, -111.04],[45, -104.05],[41, -104.05]]
 *   ]
 * ];
 * ```
 */

var Polygon = Polyline.extend({

	options: {
		fill: true
	},

	isEmpty: function () {
		return !this._latlngs.length || !this._latlngs[0].length;
	},

	getCenter: function () {
		// throws error when not yet added to map as this center calculation requires projected coordinates
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}

		var i, j, p1, p2, f, area, x, y, center,
		    points = this._rings[0],
		    len = points.length;

		if (!len) { return null; }

		// polygon centroid algorithm; only uses the first ring if there are multiple

		area = x = y = 0;

		for (i = 0, j = len - 1; i < len; j = i++) {
			p1 = points[i];
			p2 = points[j];

			f = p1.y * p2.x - p2.y * p1.x;
			x += (p1.x + p2.x) * f;
			y += (p1.y + p2.y) * f;
			area += f * 3;
		}

		if (area === 0) {
			// Polygon is so small that all points are on same pixel.
			center = points[0];
		} else {
			center = [x / area, y / area];
		}
		return this._map.layerPointToLatLng(center);
	},

	_convertLatLngs: function (latlngs) {
		var result = Polyline.prototype._convertLatLngs.call(this, latlngs),
		    len = result.length;

		// remove last point if it equals first one
		if (len >= 2 && result[0] instanceof LatLng && result[0].equals(result[len - 1])) {
			result.pop();
		}
		return result;
	},

	_setLatLngs: function (latlngs) {
		Polyline.prototype._setLatLngs.call(this, latlngs);
		if (isFlat(this._latlngs)) {
			this._latlngs = [this._latlngs];
		}
	},

	_defaultShape: function () {
		return isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
	},

	_clipPoints: function () {
		// polygons need a different clipping algorithm so we redefine that

		var bounds = this._renderer._bounds,
		    w = this.options.weight,
		    p = new Point(w, w);

		// increase clip padding by stroke width to avoid stroke on clip edges
		bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		for (var i = 0, len = this._rings.length, clipped; i < len; i++) {
			clipped = clipPolygon(this._rings[i], bounds, true);
			if (clipped.length) {
				this._parts.push(clipped);
			}
		}
	},

	_updatePath: function () {
		this._renderer._updatePoly(this, true);
	},

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint: function (p) {
		var inside = false,
		    part, p1, p2, i, j, k, len, len2;

		if (!this._pxBounds.contains(p)) { return false; }

		// ray casting algorithm for detecting if point is in polygon
		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				p1 = part[j];
				p2 = part[k];

				if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
					inside = !inside;
				}
			}
		}

		// also check if it's on polygon stroke
		return inside || Polyline.prototype._containsPoint.call(this, p, true);
	}

});


// @factory L.polygon(latlngs: LatLng[], options?: Polyline options)
function polygon(latlngs, options) {
	return new Polygon(latlngs, options);
}

/*
 * @class GeoJSON
 * @aka L.GeoJSON
 * @inherits FeatureGroup
 *
 * Represents a GeoJSON object or an array of GeoJSON objects. Allows you to parse
 * GeoJSON data and display it on the map. Extends `FeatureGroup`.
 *
 * @example
 *
 * ```js
 * L.geoJSON(data, {
 * 	style: function (feature) {
 * 		return {color: feature.properties.color};
 * 	}
 * }).bindPopup(function (layer) {
 * 	return layer.feature.properties.description;
 * }).addTo(map);
 * ```
 */

var GeoJSON = FeatureGroup.extend({

	/* @section
	 * @aka GeoJSON options
	 *
	 * @option pointToLayer: Function = *
	 * A `Function` defining how GeoJSON points spawn Leaflet layers. It is internally
	 * called when data is added, passing the GeoJSON point feature and its `LatLng`.
	 * The default is to spawn a default `Marker`:
	 * ```js
	 * function(geoJsonPoint, latlng) {
	 * 	return L.marker(latlng);
	 * }
	 * ```
	 *
	 * @option style: Function = *
	 * A `Function` defining the `Path options` for styling GeoJSON lines and polygons,
	 * called internally when data is added.
	 * The default value is to not override any defaults:
	 * ```js
	 * function (geoJsonFeature) {
	 * 	return {}
	 * }
	 * ```
	 *
	 * @option onEachFeature: Function = *
	 * A `Function` that will be called once for each created `Feature`, after it has
	 * been created and styled. Useful for attaching events and popups to features.
	 * The default is to do nothing with the newly created layers:
	 * ```js
	 * function (feature, layer) {}
	 * ```
	 *
	 * @option filter: Function = *
	 * A `Function` that will be used to decide whether to include a feature or not.
	 * The default is to include all features:
	 * ```js
	 * function (geoJsonFeature) {
	 * 	return true;
	 * }
	 * ```
	 * Note: dynamically changing the `filter` option will have effect only on newly
	 * added data. It will _not_ re-evaluate already included features.
	 *
	 * @option coordsToLatLng: Function = *
	 * A `Function` that will be used for converting GeoJSON coordinates to `LatLng`s.
	 * The default is the `coordsToLatLng` static method.
	 */

	initialize: function (geojson, options) {
		setOptions(this, options);

		this._layers = {};

		if (geojson) {
			this.addData(geojson);
		}
	},

	// @method addData( <GeoJSON> data ): this
	// Adds a GeoJSON object to the layer.
	addData: function (geojson) {
		var features = isArray(geojson) ? geojson : geojson.features,
		    i, len, feature;

		if (features) {
			for (i = 0, len = features.length; i < len; i++) {
				// only add this if geometry or geometries are set and not null
				feature = features[i];
				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
					this.addData(feature);
				}
			}
			return this;
		}

		var options = this.options;

		if (options.filter && !options.filter(geojson)) { return this; }

		var layer = geometryToLayer(geojson, options);
		if (!layer) {
			return this;
		}
		layer.feature = asFeature(geojson);

		layer.defaultOptions = layer.options;
		this.resetStyle(layer);

		if (options.onEachFeature) {
			options.onEachFeature(geojson, layer);
		}

		return this.addLayer(layer);
	},

	// @method resetStyle( <Path> layer ): this
	// Resets the given vector layer's style to the original GeoJSON style, useful for resetting style after hover events.
	resetStyle: function (layer) {
		// reset any custom styles
		layer.options = extend({}, layer.defaultOptions);
		this._setLayerStyle(layer, this.options.style);
		return this;
	},

	// @method setStyle( <Function> style ): this
	// Changes styles of GeoJSON vector layers with the given style function.
	setStyle: function (style) {
		return this.eachLayer(function (layer) {
			this._setLayerStyle(layer, style);
		}, this);
	},

	_setLayerStyle: function (layer, style) {
		if (typeof style === 'function') {
			style = style(layer.feature);
		}
		if (layer.setStyle) {
			layer.setStyle(style);
		}
	}
});

// @section
// There are several static functions which can be called without instantiating L.GeoJSON:

// @function geometryToLayer(featureData: Object, options?: GeoJSON options): Layer
// Creates a `Layer` from a given GeoJSON feature. Can use a custom
// [`pointToLayer`](#geojson-pointtolayer) and/or [`coordsToLatLng`](#geojson-coordstolatlng)
// functions if provided as options.
function geometryToLayer(geojson, options) {

	var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
	    coords = geometry ? geometry.coordinates : null,
	    layers = [],
	    pointToLayer = options && options.pointToLayer,
	    _coordsToLatLng = options && options.coordsToLatLng || coordsToLatLng,
	    latlng, latlngs, i, len;

	if (!coords && !geometry) {
		return null;
	}

	switch (geometry.type) {
	case 'Point':
		latlng = _coordsToLatLng(coords);
		return pointToLayer ? pointToLayer(geojson, latlng) : new Marker(latlng);

	case 'MultiPoint':
		for (i = 0, len = coords.length; i < len; i++) {
			latlng = _coordsToLatLng(coords[i]);
			layers.push(pointToLayer ? pointToLayer(geojson, latlng) : new Marker(latlng));
		}
		return new FeatureGroup(layers);

	case 'LineString':
	case 'MultiLineString':
		latlngs = coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
		return new Polyline(latlngs, options);

	case 'Polygon':
	case 'MultiPolygon':
		latlngs = coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
		return new Polygon(latlngs, options);

	case 'GeometryCollection':
		for (i = 0, len = geometry.geometries.length; i < len; i++) {
			var layer = geometryToLayer({
				geometry: geometry.geometries[i],
				type: 'Feature',
				properties: geojson.properties
			}, options);

			if (layer) {
				layers.push(layer);
			}
		}
		return new FeatureGroup(layers);

	default:
		throw new Error('Invalid GeoJSON object.');
	}
}

// @function coordsToLatLng(coords: Array): LatLng
// Creates a `LatLng` object from an array of 2 numbers (longitude, latitude)
// or 3 numbers (longitude, latitude, altitude) used in GeoJSON for points.
function coordsToLatLng(coords) {
	return new LatLng(coords[1], coords[0], coords[2]);
}

// @function coordsToLatLngs(coords: Array, levelsDeep?: Number, coordsToLatLng?: Function): Array
// Creates a multidimensional array of `LatLng`s from a GeoJSON coordinates array.
// `levelsDeep` specifies the nesting level (0 is for an array of points, 1 for an array of arrays of points, etc., 0 by default).
// Can use a custom [`coordsToLatLng`](#geojson-coordstolatlng) function.
function coordsToLatLngs(coords, levelsDeep, _coordsToLatLng) {
	var latlngs = [];

	for (var i = 0, len = coords.length, latlng; i < len; i++) {
		latlng = levelsDeep ?
			coordsToLatLngs(coords[i], levelsDeep - 1, _coordsToLatLng) :
			(_coordsToLatLng || coordsToLatLng)(coords[i]);

		latlngs.push(latlng);
	}

	return latlngs;
}

// @function latLngToCoords(latlng: LatLng, precision?: Number): Array
// Reverse of [`coordsToLatLng`](#geojson-coordstolatlng)
function latLngToCoords(latlng, precision) {
	precision = typeof precision === 'number' ? precision : 6;
	return latlng.alt !== undefined ?
		[formatNum(latlng.lng, precision), formatNum(latlng.lat, precision), formatNum(latlng.alt, precision)] :
		[formatNum(latlng.lng, precision), formatNum(latlng.lat, precision)];
}

// @function latLngsToCoords(latlngs: Array, levelsDeep?: Number, closed?: Boolean): Array
// Reverse of [`coordsToLatLngs`](#geojson-coordstolatlngs)
// `closed` determines whether the first point should be appended to the end of the array to close the feature, only used when `levelsDeep` is 0. False by default.
function latLngsToCoords(latlngs, levelsDeep, closed, precision) {
	var coords = [];

	for (var i = 0, len = latlngs.length; i < len; i++) {
		coords.push(levelsDeep ?
			latLngsToCoords(latlngs[i], levelsDeep - 1, closed, precision) :
			latLngToCoords(latlngs[i], precision));
	}

	if (!levelsDeep && closed) {
		coords.push(coords[0]);
	}

	return coords;
}

function getFeature(layer, newGeometry) {
	return layer.feature ?
		extend({}, layer.feature, {geometry: newGeometry}) :
		asFeature(newGeometry);
}

// @function asFeature(geojson: Object): Object
// Normalize GeoJSON geometries/features into GeoJSON features.
function asFeature(geojson) {
	if (geojson.type === 'Feature' || geojson.type === 'FeatureCollection') {
		return geojson;
	}

	return {
		type: 'Feature',
		properties: {},
		geometry: geojson
	};
}

var PointToGeoJSON = {
	toGeoJSON: function (precision) {
		return getFeature(this, {
			type: 'Point',
			coordinates: latLngToCoords(this.getLatLng(), precision)
		});
	}
};

// @namespace Marker
// @method toGeoJSON(): Object
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the marker (as a GeoJSON `Point` Feature).
Marker.include(PointToGeoJSON);

// @namespace CircleMarker
// @method toGeoJSON(): Object
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the circle marker (as a GeoJSON `Point` Feature).
Circle.include(PointToGeoJSON);
CircleMarker.include(PointToGeoJSON);


// @namespace Polyline
// @method toGeoJSON(): Object
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the polyline (as a GeoJSON `LineString` or `MultiLineString` Feature).
Polyline.include({
	toGeoJSON: function (precision) {
		var multi = !isFlat(this._latlngs);

		var coords = latLngsToCoords(this._latlngs, multi ? 1 : 0, false, precision);

		return getFeature(this, {
			type: (multi ? 'Multi' : '') + 'LineString',
			coordinates: coords
		});
	}
});

// @namespace Polygon
// @method toGeoJSON(): Object
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the polygon (as a GeoJSON `Polygon` or `MultiPolygon` Feature).
Polygon.include({
	toGeoJSON: function (precision) {
		var holes = !isFlat(this._latlngs),
		    multi = holes && !isFlat(this._latlngs[0]);

		var coords = latLngsToCoords(this._latlngs, multi ? 2 : holes ? 1 : 0, true, precision);

		if (!holes) {
			coords = [coords];
		}

		return getFeature(this, {
			type: (multi ? 'Multi' : '') + 'Polygon',
			coordinates: coords
		});
	}
});


// @namespace LayerGroup
LayerGroup.include({
	toMultiPoint: function (precision) {
		var coords = [];

		this.eachLayer(function (layer) {
			coords.push(layer.toGeoJSON(precision).geometry.coordinates);
		});

		return getFeature(this, {
			type: 'MultiPoint',
			coordinates: coords
		});
	},

	// @method toGeoJSON(): Object
	// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the layer group (as a GeoJSON `FeatureCollection`, `GeometryCollection`, or `MultiPoint`).
	toGeoJSON: function (precision) {

		var type = this.feature && this.feature.geometry && this.feature.geometry.type;

		if (type === 'MultiPoint') {
			return this.toMultiPoint(precision);
		}

		var isGeometryCollection = type === 'GeometryCollection',
		    jsons = [];

		this.eachLayer(function (layer) {
			if (layer.toGeoJSON) {
				var json = layer.toGeoJSON(precision);
				if (isGeometryCollection) {
					jsons.push(json.geometry);
				} else {
					var feature = asFeature(json);
					// Squash nested feature collections
					if (feature.type === 'FeatureCollection') {
						jsons.push.apply(jsons, feature.features);
					} else {
						jsons.push(feature);
					}
				}
			}
		});

		if (isGeometryCollection) {
			return getFeature(this, {
				geometries: jsons,
				type: 'GeometryCollection'
			});
		}

		return {
			type: 'FeatureCollection',
			features: jsons
		};
	}
});

// @namespace GeoJSON
// @factory L.geoJSON(geojson?: Object, options?: GeoJSON options)
// Creates a GeoJSON layer. Optionally accepts an object in
// [GeoJSON format](http://geojson.org/geojson-spec.html) to display on the map
// (you can alternatively add it later with `addData` method) and an `options` object.
function geoJSON(geojson, options) {
	return new GeoJSON(geojson, options);
}

// Backward compatibility.
var geoJson = geoJSON;

/*
 * @class ImageOverlay
 * @aka L.ImageOverlay
 * @inherits Interactive layer
 *
 * Used to load and display a single image over specific bounds of the map. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * var imageUrl = 'http://www.lib.utexas.edu/maps/historical/newark_nj_1922.jpg',
 * 	imageBounds = [[40.712216, -74.22655], [40.773941, -74.12544]];
 * L.imageOverlay(imageUrl, imageBounds).addTo(map);
 * ```
 */

var ImageOverlay = Layer.extend({

	// @section
	// @aka ImageOverlay options
	options: {
		// @option opacity: Number = 1.0
		// The opacity of the image overlay.
		opacity: 1,

		// @option alt: String = ''
		// Text for the `alt` attribute of the image (useful for accessibility).
		alt: '',

		// @option interactive: Boolean = false
		// If `true`, the image overlay will emit [mouse events](#interactive-layer) when clicked or hovered.
		interactive: false,

		// @option crossOrigin: Boolean = false
		// If true, the image will have its crossOrigin attribute set to ''. This is needed if you want to access image pixel data.
		crossOrigin: false,

		// @option errorOverlayUrl: String = ''
		// URL to the overlay image to show in place of the overlay that failed to load.
		errorOverlayUrl: '',

		// @option zIndex: Number = 1
		// The explicit [zIndex](https://developer.mozilla.org/docs/Web/CSS/CSS_Positioning/Understanding_z_index) of the tile layer.
		zIndex: 1,

		// @option className: String = ''
		// A custom class name to assign to the image. Empty by default.
		className: '',
	},

	initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._bounds = toLatLngBounds(bounds);

		setOptions(this, options);
	},

	onAdd: function () {
		if (!this._image) {
			this._initImage();

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}

		if (this.options.interactive) {
			addClass(this._image, 'leaflet-interactive');
			this.addInteractiveTarget(this._image);
		}

		this.getPane().appendChild(this._image);
		this._reset();
	},

	onRemove: function () {
		remove(this._image);
		if (this.options.interactive) {
			this.removeInteractiveTarget(this._image);
		}
	},

	// @method setOpacity(opacity: Number): this
	// Sets the opacity of the overlay.
	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._image) {
			this._updateOpacity();
		}
		return this;
	},

	setStyle: function (styleOpts) {
		if (styleOpts.opacity) {
			this.setOpacity(styleOpts.opacity);
		}
		return this;
	},

	// @method bringToFront(): this
	// Brings the layer to the top of all overlays.
	bringToFront: function () {
		if (this._map) {
			toFront(this._image);
		}
		return this;
	},

	// @method bringToBack(): this
	// Brings the layer to the bottom of all overlays.
	bringToBack: function () {
		if (this._map) {
			toBack(this._image);
		}
		return this;
	},

	// @method setUrl(url: String): this
	// Changes the URL of the image.
	setUrl: function (url) {
		this._url = url;

		if (this._image) {
			this._image.src = url;
		}
		return this;
	},

	// @method setBounds(bounds: LatLngBounds): this
	// Update the bounds that this ImageOverlay covers
	setBounds: function (bounds) {
		this._bounds = toLatLngBounds(bounds);

		if (this._map) {
			this._reset();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			zoom: this._reset,
			viewreset: this._reset
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	// @method: setZIndex(value: Number) : this
	// Changes the [zIndex](#imageoverlay-zindex) of the image overlay.
	setZIndex: function (value) {
		this.options.zIndex = value;
		this._updateZIndex();
		return this;
	},

	// @method getBounds(): LatLngBounds
	// Get the bounds that this ImageOverlay covers
	getBounds: function () {
		return this._bounds;
	},

	// @method getElement(): HTMLElement
	// Returns the instance of [`HTMLImageElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement)
	// used by this overlay.
	getElement: function () {
		return this._image;
	},

	_initImage: function () {
		var wasElementSupplied = this._url.tagName === 'IMG';
		var img = this._image = wasElementSupplied ? this._url : create$1('img');

		addClass(img, 'leaflet-image-layer');
		if (this._zoomAnimated) { addClass(img, 'leaflet-zoom-animated'); }
		if (this.options.className) { addClass(img, this.options.className); }

		img.onselectstart = falseFn;
		img.onmousemove = falseFn;

		// @event load: Event
		// Fired when the ImageOverlay layer has loaded its image
		img.onload = bind(this.fire, this, 'load');
		img.onerror = bind(this._overlayOnError, this, 'error');

		if (this.options.crossOrigin) {
			img.crossOrigin = '';
		}

		if (this.options.zIndex) {
			this._updateZIndex();
		}

		if (wasElementSupplied) {
			this._url = img.src;
			return;
		}

		img.src = this._url;
		img.alt = this.options.alt;
	},

	_animateZoom: function (e) {
		var scale = this._map.getZoomScale(e.zoom),
		    offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;

		setTransform(this._image, offset, scale);
	},

	_reset: function () {
		var image = this._image,
		    bounds = new Bounds(
		        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		        this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
		    size = bounds.getSize();

		setPosition(image, bounds.min);

		image.style.width  = size.x + 'px';
		image.style.height = size.y + 'px';
	},

	_updateOpacity: function () {
		setOpacity(this._image, this.options.opacity);
	},

	_updateZIndex: function () {
		if (this._image && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._image.style.zIndex = this.options.zIndex;
		}
	},

	_overlayOnError: function () {
		// @event error: Event
		// Fired when the ImageOverlay layer has loaded its image
		this.fire('error');

		var errorUrl = this.options.errorOverlayUrl;
		if (errorUrl && this._url !== errorUrl) {
			this._url = errorUrl;
			this._image.src = errorUrl;
		}
	}
});

// @factory L.imageOverlay(imageUrl: String, bounds: LatLngBounds, options?: ImageOverlay options)
// Instantiates an image overlay object given the URL of the image and the
// geographical bounds it is tied to.
var imageOverlay = function (url, bounds, options) {
	return new ImageOverlay(url, bounds, options);
};

/*
 * @class VideoOverlay
 * @aka L.VideoOverlay
 * @inherits ImageOverlay
 *
 * Used to load and display a video player over specific bounds of the map. Extends `ImageOverlay`.
 *
 * A video overlay uses the [`<video>`](https://developer.mozilla.org/docs/Web/HTML/Element/video)
 * HTML5 element.
 *
 * @example
 *
 * ```js
 * var videoUrl = 'https://www.mapbox.com/bites/00188/patricia_nasa.webm',
 * 	videoBounds = [[ 32, -130], [ 13, -100]];
 * L.VideoOverlay(videoUrl, videoBounds ).addTo(map);
 * ```
 */

var VideoOverlay = ImageOverlay.extend({

	// @section
	// @aka VideoOverlay options
	options: {
		// @option autoplay: Boolean = true
		// Whether the video starts playing automatically when loaded.
		autoplay: true,

		// @option loop: Boolean = true
		// Whether the video will loop back to the beginning when played.
		loop: true
	},

	_initImage: function () {
		var wasElementSupplied = this._url.tagName === 'VIDEO';
		var vid = this._image = wasElementSupplied ? this._url : create$1('video');

		addClass(vid, 'leaflet-image-layer');
		if (this._zoomAnimated) { addClass(vid, 'leaflet-zoom-animated'); }

		vid.onselectstart = falseFn;
		vid.onmousemove = falseFn;

		// @event load: Event
		// Fired when the video has finished loading the first frame
		vid.onloadeddata = bind(this.fire, this, 'load');

		if (wasElementSupplied) {
			var sourceElements = vid.getElementsByTagName('source');
			var sources = [];
			for (var j = 0; j < sourceElements.length; j++) {
				sources.push(sourceElements[j].src);
			}

			this._url = (sourceElements.length > 0) ? sources : [vid.src];
			return;
		}

		if (!isArray(this._url)) { this._url = [this._url]; }

		vid.autoplay = !!this.options.autoplay;
		vid.loop = !!this.options.loop;
		for (var i = 0; i < this._url.length; i++) {
			var source = create$1('source');
			source.src = this._url[i];
			vid.appendChild(source);
		}
	}

	// @method getElement(): HTMLVideoElement
	// Returns the instance of [`HTMLVideoElement`](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement)
	// used by this overlay.
});


// @factory L.videoOverlay(video: String|Array|HTMLVideoElement, bounds: LatLngBounds, options?: VideoOverlay options)
// Instantiates an image overlay object given the URL of the video (or array of URLs, or even a video element) and the
// geographical bounds it is tied to.

function videoOverlay(video, bounds, options) {
	return new VideoOverlay(video, bounds, options);
}

/*
 * @class DivOverlay
 * @inherits Layer
 * @aka L.DivOverlay
 * Base model for L.Popup and L.Tooltip. Inherit from it for custom popup like plugins.
 */

// @namespace DivOverlay
var DivOverlay = Layer.extend({

	// @section
	// @aka DivOverlay options
	options: {
		// @option offset: Point = Point(0, 7)
		// The offset of the popup position. Useful to control the anchor
		// of the popup when opening it on some overlays.
		offset: [0, 7],

		// @option className: String = ''
		// A custom CSS class name to assign to the popup.
		className: '',

		// @option pane: String = 'popupPane'
		// `Map pane` where the popup will be added.
		pane: 'popupPane'
	},

	initialize: function (options, source) {
		setOptions(this, options);

		this._source = source;
	},

	onAdd: function (map) {
		this._zoomAnimated = map._zoomAnimated;

		if (!this._container) {
			this._initLayout();
		}

		if (map._fadeAnimated) {
			setOpacity(this._container, 0);
		}

		clearTimeout(this._removeTimeout);
		this.getPane().appendChild(this._container);
		this.update();

		if (map._fadeAnimated) {
			setOpacity(this._container, 1);
		}

		this.bringToFront();
	},

	onRemove: function (map) {
		if (map._fadeAnimated) {
			setOpacity(this._container, 0);
			this._removeTimeout = setTimeout(bind(remove, undefined, this._container), 200);
		} else {
			remove(this._container);
		}
	},

	// @namespace Popup
	// @method getLatLng: LatLng
	// Returns the geographical point of popup.
	getLatLng: function () {
		return this._latlng;
	},

	// @method setLatLng(latlng: LatLng): this
	// Sets the geographical point where the popup will open.
	setLatLng: function (latlng) {
		this._latlng = toLatLng(latlng);
		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}
		return this;
	},

	// @method getContent: String|HTMLElement
	// Returns the content of the popup.
	getContent: function () {
		return this._content;
	},

	// @method setContent(htmlContent: String|HTMLElement|Function): this
	// Sets the HTML content of the popup. If a function is passed the source layer will be passed to the function. The function should return a `String` or `HTMLElement` to be used in the popup.
	setContent: function (content) {
		this._content = content;
		this.update();
		return this;
	},

	// @method getElement: String|HTMLElement
	// Alias for [getContent()](#popup-getcontent)
	getElement: function () {
		return this._container;
	},

	// @method update: null
	// Updates the popup content, layout and position. Useful for updating the popup after something inside changed, e.g. image loaded.
	update: function () {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	},

	getEvents: function () {
		var events = {
			zoom: this._updatePosition,
			viewreset: this._updatePosition
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}
		return events;
	},

	// @method isOpen: Boolean
	// Returns `true` when the popup is visible on the map.
	isOpen: function () {
		return !!this._map && this._map.hasLayer(this);
	},

	// @method bringToFront: this
	// Brings this popup in front of other popups (in the same map pane).
	bringToFront: function () {
		if (this._map) {
			toFront(this._container);
		}
		return this;
	},

	// @method bringToBack: this
	// Brings this popup to the back of other popups (in the same map pane).
	bringToBack: function () {
		if (this._map) {
			toBack(this._container);
		}
		return this;
	},

	_updateContent: function () {
		if (!this._content) { return; }

		var node = this._contentNode;
		var content = (typeof this._content === 'function') ? this._content(this._source || this) : this._content;

		if (typeof content === 'string') {
			node.innerHTML = content;
		} else {
			while (node.hasChildNodes()) {
				node.removeChild(node.firstChild);
			}
			node.appendChild(content);
		}
		this.fire('contentupdate');
	},

	_updatePosition: function () {
		if (!this._map) { return; }

		var pos = this._map.latLngToLayerPoint(this._latlng),
		    offset = toPoint(this.options.offset),
		    anchor = this._getAnchor();

		if (this._zoomAnimated) {
			setPosition(this._container, pos.add(anchor));
		} else {
			offset = offset.add(pos).add(anchor);
		}

		var bottom = this._containerBottom = -offset.y,
		    left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;

		// bottom position the popup in case the height of the popup changes (images loading etc)
		this._container.style.bottom = bottom + 'px';
		this._container.style.left = left + 'px';
	},

	_getAnchor: function () {
		return [0, 0];
	}

});

/*
 * @class Popup
 * @inherits DivOverlay
 * @aka L.Popup
 * Used to open popups in certain places of the map. Use [Map.openPopup](#map-openpopup) to
 * open popups while making sure that only one popup is open at one time
 * (recommended for usability), or use [Map.addLayer](#map-addlayer) to open as many as you want.
 *
 * @example
 *
 * If you want to just bind a popup to marker click and then open it, it's really easy:
 *
 * ```js
 * marker.bindPopup(popupContent).openPopup();
 * ```
 * Path overlays like polylines also have a `bindPopup` method.
 * Here's a more complicated way to open a popup on a map:
 *
 * ```js
 * var popup = L.popup()
 * 	.setLatLng(latlng)
 * 	.setContent('<p>Hello world!<br />This is a nice popup.</p>')
 * 	.openOn(map);
 * ```
 */


// @namespace Popup
var Popup = DivOverlay.extend({

	// @section
	// @aka Popup options
	options: {
		// @option maxWidth: Number = 300
		// Max width of the popup, in pixels.
		maxWidth: 300,

		// @option minWidth: Number = 50
		// Min width of the popup, in pixels.
		minWidth: 50,

		// @option maxHeight: Number = null
		// If set, creates a scrollable container of the given height
		// inside a popup if its content exceeds it.
		maxHeight: null,

		// @option autoPan: Boolean = true
		// Set it to `false` if you don't want the map to do panning animation
		// to fit the opened popup.
		autoPan: true,

		// @option autoPanPaddingTopLeft: Point = null
		// The margin between the popup and the top left corner of the map
		// view after autopanning was performed.
		autoPanPaddingTopLeft: null,

		// @option autoPanPaddingBottomRight: Point = null
		// The margin between the popup and the bottom right corner of the map
		// view after autopanning was performed.
		autoPanPaddingBottomRight: null,

		// @option autoPanPadding: Point = Point(5, 5)
		// Equivalent of setting both top left and bottom right autopan padding to the same value.
		autoPanPadding: [5, 5],

		// @option keepInView: Boolean = false
		// Set it to `true` if you want to prevent users from panning the popup
		// off of the screen while it is open.
		keepInView: false,

		// @option closeButton: Boolean = true
		// Controls the presence of a close button in the popup.
		closeButton: true,

		// @option autoClose: Boolean = true
		// Set it to `false` if you want to override the default behavior of
		// the popup closing when another popup is opened.
		autoClose: true,

		// @option closeOnEscapeKey: Boolean = true
		// Set it to `false` if you want to override the default behavior of
		// the ESC key for closing of the popup.
		closeOnEscapeKey: true,

		// @option closeOnClick: Boolean = *
		// Set it if you want to override the default behavior of the popup closing when user clicks
		// on the map. Defaults to the map's [`closePopupOnClick`](#map-closepopuponclick) option.

		// @option className: String = ''
		// A custom CSS class name to assign to the popup.
		className: ''
	},

	// @namespace Popup
	// @method openOn(map: Map): this
	// Adds the popup to the map and closes the previous one. The same as `map.openPopup(popup)`.
	openOn: function (map) {
		map.openPopup(this);
		return this;
	},

	onAdd: function (map) {
		DivOverlay.prototype.onAdd.call(this, map);

		// @namespace Map
		// @section Popup events
		// @event popupopen: PopupEvent
		// Fired when a popup is opened in the map
		map.fire('popupopen', {popup: this});

		if (this._source) {
			// @namespace Layer
			// @section Popup events
			// @event popupopen: PopupEvent
			// Fired when a popup bound to this layer is opened
			this._source.fire('popupopen', {popup: this}, true);
			// For non-path layers, we toggle the popup when clicking
			// again the layer, so prevent the map to reopen it.
			if (!(this._source instanceof Path)) {
				this._source.on('preclick', stopPropagation);
			}
		}
	},

	onRemove: function (map) {
		DivOverlay.prototype.onRemove.call(this, map);

		// @namespace Map
		// @section Popup events
		// @event popupclose: PopupEvent
		// Fired when a popup in the map is closed
		map.fire('popupclose', {popup: this});

		if (this._source) {
			// @namespace Layer
			// @section Popup events
			// @event popupclose: PopupEvent
			// Fired when a popup bound to this layer is closed
			this._source.fire('popupclose', {popup: this}, true);
			if (!(this._source instanceof Path)) {
				this._source.off('preclick', stopPropagation);
			}
		}
	},

	getEvents: function () {
		var events = DivOverlay.prototype.getEvents.call(this);

		if (this.options.closeOnClick !== undefined ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
			events.preclick = this._close;
		}

		if (this.options.keepInView) {
			events.moveend = this._adjustPan;
		}

		return events;
	},

	_close: function () {
		if (this._map) {
			this._map.closePopup(this);
		}
	},

	_initLayout: function () {
		var prefix = 'leaflet-popup',
		    container = this._container = create$1('div',
			prefix + ' ' + (this.options.className || '') +
			' leaflet-zoom-animated');

		var wrapper = this._wrapper = create$1('div', prefix + '-content-wrapper', container);
		this._contentNode = create$1('div', prefix + '-content', wrapper);

		disableClickPropagation(wrapper);
		disableScrollPropagation(this._contentNode);
		on(wrapper, 'contextmenu', stopPropagation);

		this._tipContainer = create$1('div', prefix + '-tip-container', container);
		this._tip = create$1('div', prefix + '-tip', this._tipContainer);

		if (this.options.closeButton) {
			var closeButton = this._closeButton = create$1('a', prefix + '-close-button', container);
			closeButton.href = '#close';
			closeButton.innerHTML = '&#215;';

			on(closeButton, 'click', this._onCloseButtonClick, this);
		}
	},

	_updateLayout: function () {
		var container = this._contentNode,
		    style = container.style;

		style.width = '';
		style.whiteSpace = 'nowrap';

		var width = container.offsetWidth;
		width = Math.min(width, this.options.maxWidth);
		width = Math.max(width, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';

		style.height = '';

		var height = container.offsetHeight,
		    maxHeight = this.options.maxHeight,
		    scrolledClass = 'leaflet-popup-scrolled';

		if (maxHeight && height > maxHeight) {
			style.height = maxHeight + 'px';
			addClass(container, scrolledClass);
		} else {
			removeClass(container, scrolledClass);
		}

		this._containerWidth = this._container.offsetWidth;
	},

	_animateZoom: function (e) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center),
		    anchor = this._getAnchor();
		setPosition(this._container, pos.add(anchor));
	},

	_adjustPan: function () {
		if (!this.options.autoPan || (this._map._panAnim && this._map._panAnim._inProgress)) { return; }

		var map = this._map,
		    marginBottom = parseInt(getStyle(this._container, 'marginBottom'), 10) || 0,
		    containerHeight = this._container.offsetHeight + marginBottom,
		    containerWidth = this._containerWidth,
		    layerPos = new Point(this._containerLeft, -containerHeight - this._containerBottom);

		layerPos._add(getPosition(this._container));

		var containerPos = map.layerPointToContainerPoint(layerPos),
		    padding = toPoint(this.options.autoPanPadding),
		    paddingTL = toPoint(this.options.autoPanPaddingTopLeft || padding),
		    paddingBR = toPoint(this.options.autoPanPaddingBottomRight || padding),
		    size = map.getSize(),
		    dx = 0,
		    dy = 0;

		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
		}
		if (containerPos.x - dx - paddingTL.x < 0) { // left
			dx = containerPos.x - paddingTL.x;
		}
		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
		}
		if (containerPos.y - dy - paddingTL.y < 0) { // top
			dy = containerPos.y - paddingTL.y;
		}

		// @namespace Map
		// @section Popup events
		// @event autopanstart: Event
		// Fired when the map starts autopanning when opening a popup.
		if (dx || dy) {
			map
			    .fire('autopanstart')
			    .panBy([dx, dy]);
		}
	},

	_onCloseButtonClick: function (e) {
		this._close();
		stop(e);
	},

	_getAnchor: function () {
		// Where should we anchor the popup on the source layer?
		return toPoint(this._source && this._source._getPopupAnchor ? this._source._getPopupAnchor() : [0, 0]);
	}

});

// @namespace Popup
// @factory L.popup(options?: Popup options, source?: Layer)
// Instantiates a `Popup` object given an optional `options` object that describes its appearance and location and an optional `source` object that is used to tag the popup with a reference to the Layer to which it refers.
var popup = function (options, source) {
	return new Popup(options, source);
};


/* @namespace Map
 * @section Interaction Options
 * @option closePopupOnClick: Boolean = true
 * Set it to `false` if you don't want popups to close when user clicks the map.
 */
Map.mergeOptions({
	closePopupOnClick: true
});


// @namespace Map
// @section Methods for Layers and Controls
Map.include({
	// @method openPopup(popup: Popup): this
	// Opens the specified popup while closing the previously opened (to make sure only one is opened at one time for usability).
	// @alternative
	// @method openPopup(content: String|HTMLElement, latlng: LatLng, options?: Popup options): this
	// Creates a popup with the specified content and options and opens it in the given point on a map.
	openPopup: function (popup, latlng, options) {
		if (!(popup instanceof Popup)) {
			popup = new Popup(options).setContent(popup);
		}

		if (latlng) {
			popup.setLatLng(latlng);
		}

		if (this.hasLayer(popup)) {
			return this;
		}

		if (this._popup && this._popup.options.autoClose) {
			this.closePopup();
		}

		this._popup = popup;
		return this.addLayer(popup);
	},

	// @method closePopup(popup?: Popup): this
	// Closes the popup previously opened with [openPopup](#map-openpopup) (or the given one).
	closePopup: function (popup) {
		if (!popup || popup === this._popup) {
			popup = this._popup;
			this._popup = null;
		}
		if (popup) {
			this.removeLayer(popup);
		}
		return this;
	}
});

/*
 * @namespace Layer
 * @section Popup methods example
 *
 * All layers share a set of methods convenient for binding popups to it.
 *
 * ```js
 * var layer = L.Polygon(latlngs).bindPopup('Hi There!').addTo(map);
 * layer.openPopup();
 * layer.closePopup();
 * ```
 *
 * Popups will also be automatically opened when the layer is clicked on and closed when the layer is removed from the map or another popup is opened.
 */

// @section Popup methods
Layer.include({

	// @method bindPopup(content: String|HTMLElement|Function|Popup, options?: Popup options): this
	// Binds a popup to the layer with the passed `content` and sets up the
	// necessary event listeners. If a `Function` is passed it will receive
	// the layer as the first argument and should return a `String` or `HTMLElement`.
	bindPopup: function (content, options) {

		if (content instanceof Popup) {
			setOptions(content, options);
			this._popup = content;
			content._source = this;
		} else {
			if (!this._popup || options) {
				this._popup = new Popup(options, this);
			}
			this._popup.setContent(content);
		}

		if (!this._popupHandlersAdded) {
			this.on({
				click: this._openPopup,
				keypress: this._onKeyPress,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = true;
		}

		return this;
	},

	// @method unbindPopup(): this
	// Removes the popup previously bound with `bindPopup`.
	unbindPopup: function () {
		if (this._popup) {
			this.off({
				click: this._openPopup,
				keypress: this._onKeyPress,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = false;
			this._popup = null;
		}
		return this;
	},

	// @method openPopup(latlng?: LatLng): this
	// Opens the bound popup at the specified `latlng` or at the default popup anchor if no `latlng` is passed.
	openPopup: function (layer, latlng) {
		if (!(layer instanceof Layer)) {
			latlng = layer;
			layer = this;
		}

		if (layer instanceof FeatureGroup) {
			for (var id in this._layers) {
				layer = this._layers[id];
				break;
			}
		}

		if (!latlng) {
			latlng = layer.getCenter ? layer.getCenter() : layer.getLatLng();
		}

		if (this._popup && this._map) {
			// set popup source to this layer
			this._popup._source = layer;

			// update the popup (content, layout, ect...)
			this._popup.update();

			// open the popup on the map
			this._map.openPopup(this._popup, latlng);
		}

		return this;
	},

	// @method closePopup(): this
	// Closes the popup bound to this layer if it is open.
	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	// @method togglePopup(): this
	// Opens or closes the popup bound to this layer depending on its current state.
	togglePopup: function (target) {
		if (this._popup) {
			if (this._popup._map) {
				this.closePopup();
			} else {
				this.openPopup(target);
			}
		}
		return this;
	},

	// @method isPopupOpen(): boolean
	// Returns `true` if the popup bound to this layer is currently open.
	isPopupOpen: function () {
		return (this._popup ? this._popup.isOpen() : false);
	},

	// @method setPopupContent(content: String|HTMLElement|Popup): this
	// Sets the content of the popup bound to this layer.
	setPopupContent: function (content) {
		if (this._popup) {
			this._popup.setContent(content);
		}
		return this;
	},

	// @method getPopup(): Popup
	// Returns the popup bound to this layer.
	getPopup: function () {
		return this._popup;
	},

	_openPopup: function (e) {
		var layer = e.layer || e.target;

		if (!this._popup) {
			return;
		}

		if (!this._map) {
			return;
		}

		// prevent map click
		stop(e);

		// if this inherits from Path its a vector and we can just
		// open the popup at the new location
		if (layer instanceof Path) {
			this.openPopup(e.layer || e.target, e.latlng);
			return;
		}

		// otherwise treat it like a marker and figure out
		// if we should toggle it open/closed
		if (this._map.hasLayer(this._popup) && this._popup._source === layer) {
			this.closePopup();
		} else {
			this.openPopup(layer, e.latlng);
		}
	},

	_movePopup: function (e) {
		this._popup.setLatLng(e.latlng);
	},

	_onKeyPress: function (e) {
		if (e.originalEvent.keyCode === 13) {
			this._openPopup(e);
		}
	}
});

/*
 * @class Tooltip
 * @inherits DivOverlay
 * @aka L.Tooltip
 * Used to display small texts on top of map layers.
 *
 * @example
 *
 * ```js
 * marker.bindTooltip("my tooltip text").openTooltip();
 * ```
 * Note about tooltip offset. Leaflet takes two options in consideration
 * for computing tooltip offsetting:
 * - the `offset` Tooltip option: it defaults to [0, 0], and it's specific to one tooltip.
 *   Add a positive x offset to move the tooltip to the right, and a positive y offset to
 *   move it to the bottom. Negatives will move to the left and top.
 * - the `tooltipAnchor` Icon option: this will only be considered for Marker. You
 *   should adapt this value if you use a custom icon.
 */


// @namespace Tooltip
var Tooltip = DivOverlay.extend({

	// @section
	// @aka Tooltip options
	options: {
		// @option pane: String = 'tooltipPane'
		// `Map pane` where the tooltip will be added.
		pane: 'tooltipPane',

		// @option offset: Point = Point(0, 0)
		// Optional offset of the tooltip position.
		offset: [0, 0],

		// @option direction: String = 'auto'
		// Direction where to open the tooltip. Possible values are: `right`, `left`,
		// `top`, `bottom`, `center`, `auto`.
		// `auto` will dynamically switch between `right` and `left` according to the tooltip
		// position on the map.
		direction: 'auto',

		// @option permanent: Boolean = false
		// Whether to open the tooltip permanently or only on mouseover.
		permanent: false,

		// @option sticky: Boolean = false
		// If true, the tooltip will follow the mouse instead of being fixed at the feature center.
		sticky: false,

		// @option interactive: Boolean = false
		// If true, the tooltip will listen to the feature events.
		interactive: false,

		// @option opacity: Number = 0.9
		// Tooltip container opacity.
		opacity: 0.9
	},

	onAdd: function (map) {
		DivOverlay.prototype.onAdd.call(this, map);
		this.setOpacity(this.options.opacity);

		// @namespace Map
		// @section Tooltip events
		// @event tooltipopen: TooltipEvent
		// Fired when a tooltip is opened in the map.
		map.fire('tooltipopen', {tooltip: this});

		if (this._source) {
			// @namespace Layer
			// @section Tooltip events
			// @event tooltipopen: TooltipEvent
			// Fired when a tooltip bound to this layer is opened.
			this._source.fire('tooltipopen', {tooltip: this}, true);
		}
	},

	onRemove: function (map) {
		DivOverlay.prototype.onRemove.call(this, map);

		// @namespace Map
		// @section Tooltip events
		// @event tooltipclose: TooltipEvent
		// Fired when a tooltip in the map is closed.
		map.fire('tooltipclose', {tooltip: this});

		if (this._source) {
			// @namespace Layer
			// @section Tooltip events
			// @event tooltipclose: TooltipEvent
			// Fired when a tooltip bound to this layer is closed.
			this._source.fire('tooltipclose', {tooltip: this}, true);
		}
	},

	getEvents: function () {
		var events = DivOverlay.prototype.getEvents.call(this);

		if (touch && !this.options.permanent) {
			events.preclick = this._close;
		}

		return events;
	},

	_close: function () {
		if (this._map) {
			this._map.closeTooltip(this);
		}
	},

	_initLayout: function () {
		var prefix = 'leaflet-tooltip',
		    className = prefix + ' ' + (this.options.className || '') + ' leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

		this._contentNode = this._container = create$1('div', className);
	},

	_updateLayout: function () {},

	_adjustPan: function () {},

	_setPosition: function (pos) {
		var map = this._map,
		    container = this._container,
		    centerPoint = map.latLngToContainerPoint(map.getCenter()),
		    tooltipPoint = map.layerPointToContainerPoint(pos),
		    direction = this.options.direction,
		    tooltipWidth = container.offsetWidth,
		    tooltipHeight = container.offsetHeight,
		    offset = toPoint(this.options.offset),
		    anchor = this._getAnchor();

		if (direction === 'top') {
			pos = pos.add(toPoint(-tooltipWidth / 2 + offset.x, -tooltipHeight + offset.y + anchor.y, true));
		} else if (direction === 'bottom') {
			pos = pos.subtract(toPoint(tooltipWidth / 2 - offset.x, -offset.y, true));
		} else if (direction === 'center') {
			pos = pos.subtract(toPoint(tooltipWidth / 2 + offset.x, tooltipHeight / 2 - anchor.y + offset.y, true));
		} else if (direction === 'right' || direction === 'auto' && tooltipPoint.x < centerPoint.x) {
			direction = 'right';
			pos = pos.add(toPoint(offset.x + anchor.x, anchor.y - tooltipHeight / 2 + offset.y, true));
		} else {
			direction = 'left';
			pos = pos.subtract(toPoint(tooltipWidth + anchor.x - offset.x, tooltipHeight / 2 - anchor.y - offset.y, true));
		}

		removeClass(container, 'leaflet-tooltip-right');
		removeClass(container, 'leaflet-tooltip-left');
		removeClass(container, 'leaflet-tooltip-top');
		removeClass(container, 'leaflet-tooltip-bottom');
		addClass(container, 'leaflet-tooltip-' + direction);
		setPosition(container, pos);
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		this._setPosition(pos);
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._container) {
			setOpacity(this._container, opacity);
		}
	},

	_animateZoom: function (e) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
		this._setPosition(pos);
	},

	_getAnchor: function () {
		// Where should we anchor the tooltip on the source layer?
		return toPoint(this._source && this._source._getTooltipAnchor && !this.options.sticky ? this._source._getTooltipAnchor() : [0, 0]);
	}

});

// @namespace Tooltip
// @factory L.tooltip(options?: Tooltip options, source?: Layer)
// Instantiates a Tooltip object given an optional `options` object that describes its appearance and location and an optional `source` object that is used to tag the tooltip with a reference to the Layer to which it refers.
var tooltip = function (options, source) {
	return new Tooltip(options, source);
};

// @namespace Map
// @section Methods for Layers and Controls
Map.include({

	// @method openTooltip(tooltip: Tooltip): this
	// Opens the specified tooltip.
	// @alternative
	// @method openTooltip(content: String|HTMLElement, latlng: LatLng, options?: Tooltip options): this
	// Creates a tooltip with the specified content and options and open it.
	openTooltip: function (tooltip, latlng, options) {
		if (!(tooltip instanceof Tooltip)) {
			tooltip = new Tooltip(options).setContent(tooltip);
		}

		if (latlng) {
			tooltip.setLatLng(latlng);
		}

		if (this.hasLayer(tooltip)) {
			return this;
		}

		return this.addLayer(tooltip);
	},

	// @method closeTooltip(tooltip?: Tooltip): this
	// Closes the tooltip given as parameter.
	closeTooltip: function (tooltip) {
		if (tooltip) {
			this.removeLayer(tooltip);
		}
		return this;
	}

});

/*
 * @namespace Layer
 * @section Tooltip methods example
 *
 * All layers share a set of methods convenient for binding tooltips to it.
 *
 * ```js
 * var layer = L.Polygon(latlngs).bindTooltip('Hi There!').addTo(map);
 * layer.openTooltip();
 * layer.closeTooltip();
 * ```
 */

// @section Tooltip methods
Layer.include({

	// @method bindTooltip(content: String|HTMLElement|Function|Tooltip, options?: Tooltip options): this
	// Binds a tooltip to the layer with the passed `content` and sets up the
	// necessary event listeners. If a `Function` is passed it will receive
	// the layer as the first argument and should return a `String` or `HTMLElement`.
	bindTooltip: function (content, options) {

		if (content instanceof Tooltip) {
			setOptions(content, options);
			this._tooltip = content;
			content._source = this;
		} else {
			if (!this._tooltip || options) {
				this._tooltip = new Tooltip(options, this);
			}
			this._tooltip.setContent(content);

		}

		this._initTooltipInteractions();

		if (this._tooltip.options.permanent && this._map && this._map.hasLayer(this)) {
			this.openTooltip();
		}

		return this;
	},

	// @method unbindTooltip(): this
	// Removes the tooltip previously bound with `bindTooltip`.
	unbindTooltip: function () {
		if (this._tooltip) {
			this._initTooltipInteractions(true);
			this.closeTooltip();
			this._tooltip = null;
		}
		return this;
	},

	_initTooltipInteractions: function (remove$$1) {
		if (!remove$$1 && this._tooltipHandlersAdded) { return; }
		var onOff = remove$$1 ? 'off' : 'on',
		    events = {
			remove: this.closeTooltip,
			move: this._moveTooltip
		    };
		if (!this._tooltip.options.permanent) {
			events.mouseover = this._openTooltip;
			events.mouseout = this.closeTooltip;
			if (this._tooltip.options.sticky) {
				events.mousemove = this._moveTooltip;
			}
			if (touch) {
				events.click = this._openTooltip;
			}
		} else {
			events.add = this._openTooltip;
		}
		this[onOff](events);
		this._tooltipHandlersAdded = !remove$$1;
	},

	// @method openTooltip(latlng?: LatLng): this
	// Opens the bound tooltip at the specified `latlng` or at the default tooltip anchor if no `latlng` is passed.
	openTooltip: function (layer, latlng) {
		if (!(layer instanceof Layer)) {
			latlng = layer;
			layer = this;
		}

		if (layer instanceof FeatureGroup) {
			for (var id in this._layers) {
				layer = this._layers[id];
				break;
			}
		}

		if (!latlng) {
			latlng = layer.getCenter ? layer.getCenter() : layer.getLatLng();
		}

		if (this._tooltip && this._map) {

			// set tooltip source to this layer
			this._tooltip._source = layer;

			// update the tooltip (content, layout, ect...)
			this._tooltip.update();

			// open the tooltip on the map
			this._map.openTooltip(this._tooltip, latlng);

			// Tooltip container may not be defined if not permanent and never
			// opened.
			if (this._tooltip.options.interactive && this._tooltip._container) {
				addClass(this._tooltip._container, 'leaflet-clickable');
				this.addInteractiveTarget(this._tooltip._container);
			}
		}

		return this;
	},

	// @method closeTooltip(): this
	// Closes the tooltip bound to this layer if it is open.
	closeTooltip: function () {
		if (this._tooltip) {
			this._tooltip._close();
			if (this._tooltip.options.interactive && this._tooltip._container) {
				removeClass(this._tooltip._container, 'leaflet-clickable');
				this.removeInteractiveTarget(this._tooltip._container);
			}
		}
		return this;
	},

	// @method toggleTooltip(): this
	// Opens or closes the tooltip bound to this layer depending on its current state.
	toggleTooltip: function (target) {
		if (this._tooltip) {
			if (this._tooltip._map) {
				this.closeTooltip();
			} else {
				this.openTooltip(target);
			}
		}
		return this;
	},

	// @method isTooltipOpen(): boolean
	// Returns `true` if the tooltip bound to this layer is currently open.
	isTooltipOpen: function () {
		return this._tooltip.isOpen();
	},

	// @method setTooltipContent(content: String|HTMLElement|Tooltip): this
	// Sets the content of the tooltip bound to this layer.
	setTooltipContent: function (content) {
		if (this._tooltip) {
			this._tooltip.setContent(content);
		}
		return this;
	},

	// @method getTooltip(): Tooltip
	// Returns the tooltip bound to this layer.
	getTooltip: function () {
		return this._tooltip;
	},

	_openTooltip: function (e) {
		var layer = e.layer || e.target;

		if (!this._tooltip || !this._map) {
			return;
		}
		this.openTooltip(layer, this._tooltip.options.sticky ? e.latlng : undefined);
	},

	_moveTooltip: function (e) {
		var latlng = e.latlng, containerPoint, layerPoint;
		if (this._tooltip.options.sticky && e.originalEvent) {
			containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
			layerPoint = this._map.containerPointToLayerPoint(containerPoint);
			latlng = this._map.layerPointToLatLng(layerPoint);
		}
		this._tooltip.setLatLng(latlng);
	}
});

/*
 * @class DivIcon
 * @aka L.DivIcon
 * @inherits Icon
 *
 * Represents a lightweight icon for markers that uses a simple `<div>`
 * element instead of an image. Inherits from `Icon` but ignores the `iconUrl` and shadow options.
 *
 * @example
 * ```js
 * var myIcon = L.divIcon({className: 'my-div-icon'});
 * // you can set .my-div-icon styles in CSS
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * By default, it has a 'leaflet-div-icon' CSS class and is styled as a little white square with a shadow.
 */

var DivIcon = Icon.extend({
	options: {
		// @section
		// @aka DivIcon options
		iconSize: [12, 12], // also can be set through CSS

		// iconAnchor: (Point),
		// popupAnchor: (Point),

		// @option html: String = ''
		// Custom HTML code to put inside the div element, empty by default.
		html: false,

		// @option bgPos: Point = [0, 0]
		// Optional relative position of the background, in pixels
		bgPos: null,

		className: 'leaflet-div-icon'
	},

	createIcon: function (oldIcon) {
		var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
		    options = this.options;

		div.innerHTML = options.html !== false ? options.html : '';

		if (options.bgPos) {
			var bgPos = toPoint(options.bgPos);
			div.style.backgroundPosition = (-bgPos.x) + 'px ' + (-bgPos.y) + 'px';
		}
		this._setIconStyles(div, 'icon');

		return div;
	},

	createShadow: function () {
		return null;
	}
});

// @factory L.divIcon(options: DivIcon options)
// Creates a `DivIcon` instance with the given options.
function divIcon(options) {
	return new DivIcon(options);
}

Icon.Default = IconDefault;

/*
 * @class GridLayer
 * @inherits Layer
 * @aka L.GridLayer
 *
 * Generic class for handling a tiled grid of HTML elements. This is the base class for all tile layers and replaces `TileLayer.Canvas`.
 * GridLayer can be extended to create a tiled grid of HTML elements like `<canvas>`, `<img>` or `<div>`. GridLayer will handle creating and animating these DOM elements for you.
 *
 *
 * @section Synchronous usage
 * @example
 *
 * To create a custom layer, extend GridLayer and implement the `createTile()` method, which will be passed a `Point` object with the `x`, `y`, and `z` (zoom level) coordinates to draw your tile.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords){
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // get a canvas context and draw something on it using coords.x, coords.y and coords.z
 *         var ctx = tile.getContext('2d');
 *
 *         // return the tile so it can be rendered on screen
 *         return tile;
 *     }
 * });
 * ```
 *
 * @section Asynchronous usage
 * @example
 *
 * Tile creation can also be asynchronous, this is useful when using a third-party drawing library. Once the tile is finished drawing it can be passed to the `done()` callback.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords, done){
 *         var error;
 *
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // draw something asynchronously and pass the tile to the done() callback
 *         setTimeout(function() {
 *             done(error, tile);
 *         }, 1000);
 *
 *         return tile;
 *     }
 * });
 * ```
 *
 * @section
 */


var GridLayer = Layer.extend({

	// @section
	// @aka GridLayer options
	options: {
		// @option tileSize: Number|Point = 256
		// Width and height of tiles in the grid. Use a number if width and height are equal, or `L.point(width, height)` otherwise.
		tileSize: 256,

		// @option opacity: Number = 1.0
		// Opacity of the tiles. Can be used in the `createTile()` function.
		opacity: 1,

		// @option updateWhenIdle: Boolean = (depends)
		// Load new tiles only when panning ends.
		// `true` by default on mobile browsers, in order to avoid too many requests and keep smooth navigation.
		// `false` otherwise in order to display new tiles _during_ panning, since it is easy to pan outside the
		// [`keepBuffer`](#gridlayer-keepbuffer) option in desktop browsers.
		updateWhenIdle: mobile,

		// @option updateWhenZooming: Boolean = true
		// By default, a smooth zoom animation (during a [touch zoom](#map-touchzoom) or a [`flyTo()`](#map-flyto)) will update grid layers every integer zoom level. Setting this option to `false` will update the grid layer only when the smooth animation ends.
		updateWhenZooming: true,

		// @option updateInterval: Number = 200
		// Tiles will not update more than once every `updateInterval` milliseconds when panning.
		updateInterval: 200,

		// @option zIndex: Number = 1
		// The explicit zIndex of the tile layer.
		zIndex: 1,

		// @option bounds: LatLngBounds = undefined
		// If set, tiles will only be loaded inside the set `LatLngBounds`.
		bounds: null,

		// @option minZoom: Number = 0
		// The minimum zoom level down to which this layer will be displayed (inclusive).
		minZoom: 0,

		// @option maxZoom: Number = undefined
		// The maximum zoom level up to which this layer will be displayed (inclusive).
		maxZoom: undefined,

		// @option maxNativeZoom: Number = undefined
		// Maximum zoom number the tile source has available. If it is specified,
		// the tiles on all zoom levels higher than `maxNativeZoom` will be loaded
		// from `maxNativeZoom` level and auto-scaled.
		maxNativeZoom: undefined,

		// @option minNativeZoom: Number = undefined
		// Minimum zoom number the tile source has available. If it is specified,
		// the tiles on all zoom levels lower than `minNativeZoom` will be loaded
		// from `minNativeZoom` level and auto-scaled.
		minNativeZoom: undefined,

		// @option noWrap: Boolean = false
		// Whether the layer is wrapped around the antimeridian. If `true`, the
		// GridLayer will only be displayed once at low zoom levels. Has no
		// effect when the [map CRS](#map-crs) doesn't wrap around. Can be used
		// in combination with [`bounds`](#gridlayer-bounds) to prevent requesting
		// tiles outside the CRS limits.
		noWrap: false,

		// @option pane: String = 'tilePane'
		// `Map pane` where the grid layer will be added.
		pane: 'tilePane',

		// @option className: String = ''
		// A custom class name to assign to the tile layer. Empty by default.
		className: '',

		// @option keepBuffer: Number = 2
		// When panning the map, keep this many rows and columns of tiles before unloading them.
		keepBuffer: 2
	},

	initialize: function (options) {
		setOptions(this, options);
	},

	onAdd: function () {
		this._initContainer();

		this._levels = {};
		this._tiles = {};

		this._resetView();
		this._update();
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
	},

	onRemove: function (map) {
		this._removeAllTiles();
		remove(this._container);
		map._removeZoomLimit(this);
		this._container = null;
		this._tileZoom = undefined;
	},

	// @method bringToFront: this
	// Brings the tile layer to the top of all tile layers.
	bringToFront: function () {
		if (this._map) {
			toFront(this._container);
			this._setAutoZIndex(Math.max);
		}
		return this;
	},

	// @method bringToBack: this
	// Brings the tile layer to the bottom of all tile layers.
	bringToBack: function () {
		if (this._map) {
			toBack(this._container);
			this._setAutoZIndex(Math.min);
		}
		return this;
	},

	// @method getContainer: HTMLElement
	// Returns the HTML element that contains the tiles for this layer.
	getContainer: function () {
		return this._container;
	},

	// @method setOpacity(opacity: Number): this
	// Changes the [opacity](#gridlayer-opacity) of the grid layer.
	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	// @method setZIndex(zIndex: Number): this
	// Changes the [zIndex](#gridlayer-zindex) of the grid layer.
	setZIndex: function (zIndex) {
		this.options.zIndex = zIndex;
		this._updateZIndex();

		return this;
	},

	// @method isLoading: Boolean
	// Returns `true` if any tile in the grid layer has not finished loading.
	isLoading: function () {
		return this._loading;
	},

	// @method redraw: this
	// Causes the layer to clear all the tiles and request them again.
	redraw: function () {
		if (this._map) {
			this._removeAllTiles();
			this._update();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			viewprereset: this._invalidateAll,
			viewreset: this._resetView,
			zoom: this._resetView,
			moveend: this._onMoveEnd
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			if (!this._onMove) {
				this._onMove = throttle(this._onMoveEnd, this.options.updateInterval, this);
			}

			events.move = this._onMove;
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	// @section Extension methods
	// Layers extending `GridLayer` shall reimplement the following method.
	// @method createTile(coords: Object, done?: Function): HTMLElement
	// Called only internally, must be overridden by classes extending `GridLayer`.
	// Returns the `HTMLElement` corresponding to the given `coords`. If the `done` callback
	// is specified, it must be called when the tile has finished loading and drawing.
	createTile: function () {
		return document.createElement('div');
	},

	// @section
	// @method getTileSize: Point
	// Normalizes the [tileSize option](#gridlayer-tilesize) into a point. Used by the `createTile()` method.
	getTileSize: function () {
		var s = this.options.tileSize;
		return s instanceof Point ? s : new Point(s, s);
	},

	_updateZIndex: function () {
		if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._container.style.zIndex = this.options.zIndex;
		}
	},

	_setAutoZIndex: function (compare) {
		// go through all other layers of the same pane, set zIndex to max + 1 (front) or min - 1 (back)

		var layers = this.getPane().children,
		    edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

		for (var i = 0, len = layers.length, zIndex; i < len; i++) {

			zIndex = layers[i].style.zIndex;

			if (layers[i] !== this._container && zIndex) {
				edgeZIndex = compare(edgeZIndex, +zIndex);
			}
		}

		if (isFinite(edgeZIndex)) {
			this.options.zIndex = edgeZIndex + compare(-1, 1);
			this._updateZIndex();
		}
	},

	_updateOpacity: function () {
		if (!this._map) { return; }

		// IE doesn't inherit filter opacity properly, so we're forced to set it on tiles
		if (ielt9) { return; }

		setOpacity(this._container, this.options.opacity);

		var now = +new Date(),
		    nextFrame = false,
		    willPrune = false;

		for (var key in this._tiles) {
			var tile = this._tiles[key];
			if (!tile.current || !tile.loaded) { continue; }

			var fade = Math.min(1, (now - tile.loaded) / 200);

			setOpacity(tile.el, fade);
			if (fade < 1) {
				nextFrame = true;
			} else {
				if (tile.active) {
					willPrune = true;
				} else {
					this._onOpaqueTile(tile);
				}
				tile.active = true;
			}
		}

		if (willPrune && !this._noPrune) { this._pruneTiles(); }

		if (nextFrame) {
			cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
		}
	},

	_onOpaqueTile: falseFn,

	_initContainer: function () {
		if (this._container) { return; }

		this._container = create$1('div', 'leaflet-layer ' + (this.options.className || ''));
		this._updateZIndex();

		if (this.options.opacity < 1) {
			this._updateOpacity();
		}

		this.getPane().appendChild(this._container);
	},

	_updateLevels: function () {

		var zoom = this._tileZoom,
		    maxZoom = this.options.maxZoom;

		if (zoom === undefined) { return undefined; }

		for (var z in this._levels) {
			if (this._levels[z].el.children.length || z === zoom) {
				this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
				this._onUpdateLevel(z);
			} else {
				remove(this._levels[z].el);
				this._removeTilesAtZoom(z);
				this._onRemoveLevel(z);
				delete this._levels[z];
			}
		}

		var level = this._levels[zoom],
		    map = this._map;

		if (!level) {
			level = this._levels[zoom] = {};

			level.el = create$1('div', 'leaflet-tile-container leaflet-zoom-animated', this._container);
			level.el.style.zIndex = maxZoom;

			level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
			level.zoom = zoom;

			this._setZoomTransform(level, map.getCenter(), map.getZoom());

			// force the browser to consider the newly added element for transition
			falseFn(level.el.offsetWidth);

			this._onCreateLevel(level);
		}

		this._level = level;

		return level;
	},

	_onUpdateLevel: falseFn,

	_onRemoveLevel: falseFn,

	_onCreateLevel: falseFn,

	_pruneTiles: function () {
		if (!this._map) {
			return;
		}

		var key, tile;

		var zoom = this._map.getZoom();
		if (zoom > this.options.maxZoom ||
			zoom < this.options.minZoom) {
			this._removeAllTiles();
			return;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			tile.retain = tile.current;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			if (tile.current && !tile.active) {
				var coords = tile.coords;
				if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
					this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
				}
			}
		}

		for (key in this._tiles) {
			if (!this._tiles[key].retain) {
				this._removeTile(key);
			}
		}
	},

	_removeTilesAtZoom: function (zoom) {
		for (var key in this._tiles) {
			if (this._tiles[key].coords.z !== zoom) {
				continue;
			}
			this._removeTile(key);
		}
	},

	_removeAllTiles: function () {
		for (var key in this._tiles) {
			this._removeTile(key);
		}
	},

	_invalidateAll: function () {
		for (var z in this._levels) {
			remove(this._levels[z].el);
			this._onRemoveLevel(z);
			delete this._levels[z];
		}
		this._removeAllTiles();

		this._tileZoom = undefined;
	},

	_retainParent: function (x, y, z, minZoom) {
		var x2 = Math.floor(x / 2),
		    y2 = Math.floor(y / 2),
		    z2 = z - 1,
		    coords2 = new Point(+x2, +y2);
		coords2.z = +z2;

		var key = this._tileCoordsToKey(coords2),
		    tile = this._tiles[key];

		if (tile && tile.active) {
			tile.retain = true;
			return true;

		} else if (tile && tile.loaded) {
			tile.retain = true;
		}

		if (z2 > minZoom) {
			return this._retainParent(x2, y2, z2, minZoom);
		}

		return false;
	},

	_retainChildren: function (x, y, z, maxZoom) {

		for (var i = 2 * x; i < 2 * x + 2; i++) {
			for (var j = 2 * y; j < 2 * y + 2; j++) {

				var coords = new Point(i, j);
				coords.z = z + 1;

				var key = this._tileCoordsToKey(coords),
				    tile = this._tiles[key];

				if (tile && tile.active) {
					tile.retain = true;
					continue;

				} else if (tile && tile.loaded) {
					tile.retain = true;
				}

				if (z + 1 < maxZoom) {
					this._retainChildren(i, j, z + 1, maxZoom);
				}
			}
		}
	},

	_resetView: function (e) {
		var animating = e && (e.pinch || e.flyTo);
		this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
	},

	_animateZoom: function (e) {
		this._setView(e.center, e.zoom, true, e.noUpdate);
	},

	_clampZoom: function (zoom) {
		var options = this.options;

		if (undefined !== options.minNativeZoom && zoom < options.minNativeZoom) {
			return options.minNativeZoom;
		}

		if (undefined !== options.maxNativeZoom && options.maxNativeZoom < zoom) {
			return options.maxNativeZoom;
		}

		return zoom;
	},

	_setView: function (center, zoom, noPrune, noUpdate) {
		var tileZoom = this._clampZoom(Math.round(zoom));
		if ((this.options.maxZoom !== undefined && tileZoom > this.options.maxZoom) ||
		    (this.options.minZoom !== undefined && tileZoom < this.options.minZoom)) {
			tileZoom = undefined;
		}

		var tileZoomChanged = this.options.updateWhenZooming && (tileZoom !== this._tileZoom);

		if (!noUpdate || tileZoomChanged) {

			this._tileZoom = tileZoom;

			if (this._abortLoading) {
				this._abortLoading();
			}

			this._updateLevels();
			this._resetGrid();

			if (tileZoom !== undefined) {
				this._update(center);
			}

			if (!noPrune) {
				this._pruneTiles();
			}

			// Flag to prevent _updateOpacity from pruning tiles during
			// a zoom anim or a pinch gesture
			this._noPrune = !!noPrune;
		}

		this._setZoomTransforms(center, zoom);
	},

	_setZoomTransforms: function (center, zoom) {
		for (var i in this._levels) {
			this._setZoomTransform(this._levels[i], center, zoom);
		}
	},

	_setZoomTransform: function (level, center, zoom) {
		var scale = this._map.getZoomScale(zoom, level.zoom),
		    translate = level.origin.multiplyBy(scale)
		        .subtract(this._map._getNewPixelOrigin(center, zoom)).round();

		if (any3d) {
			setTransform(level.el, translate, scale);
		} else {
			setPosition(level.el, translate);
		}
	},

	_resetGrid: function () {
		var map = this._map,
		    crs = map.options.crs,
		    tileSize = this._tileSize = this.getTileSize(),
		    tileZoom = this._tileZoom;

		var bounds = this._map.getPixelWorldBounds(this._tileZoom);
		if (bounds) {
			this._globalTileRange = this._pxBoundsToTileRange(bounds);
		}

		this._wrapX = crs.wrapLng && !this.options.noWrap && [
			Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
			Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y)
		];
		this._wrapY = crs.wrapLat && !this.options.noWrap && [
			Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
			Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y)
		];
	},

	_onMoveEnd: function () {
		if (!this._map || this._map._animatingZoom) { return; }

		this._update();
	},

	_getTiledPixelBounds: function (center) {
		var map = this._map,
		    mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom(),
		    scale = map.getZoomScale(mapZoom, this._tileZoom),
		    pixelCenter = map.project(center, this._tileZoom).floor(),
		    halfSize = map.getSize().divideBy(scale * 2);

		return new Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
	},

	// Private method to load tiles in the grid's active zoom level according to map bounds
	_update: function (center) {
		var map = this._map;
		if (!map) { return; }
		var zoom = this._clampZoom(map.getZoom());

		if (center === undefined) { center = map.getCenter(); }
		if (this._tileZoom === undefined) { return; }	// if out of minzoom/maxzoom

		var pixelBounds = this._getTiledPixelBounds(center),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    tileCenter = tileRange.getCenter(),
		    queue = [],
		    margin = this.options.keepBuffer,
		    noPruneRange = new Bounds(tileRange.getBottomLeft().subtract([margin, -margin]),
		                              tileRange.getTopRight().add([margin, -margin]));

		// Sanity check: panic if the tile range contains Infinity somewhere.
		if (!(isFinite(tileRange.min.x) &&
		      isFinite(tileRange.min.y) &&
		      isFinite(tileRange.max.x) &&
		      isFinite(tileRange.max.y))) { throw new Error('Attempted to load an infinite number of tiles'); }

		for (var key in this._tiles) {
			var c = this._tiles[key].coords;
			if (c.z !== this._tileZoom || !noPruneRange.contains(new Point(c.x, c.y))) {
				this._tiles[key].current = false;
			}
		}

		// _update just loads more tiles. If the tile zoom level differs too much
		// from the map's, let _setView reset levels and prune old tiles.
		if (Math.abs(zoom - this._tileZoom) > 1) { this._setView(center, zoom); return; }

		// create a queue of coordinates to load tiles from
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				var coords = new Point(i, j);
				coords.z = this._tileZoom;

				if (!this._isValidTile(coords)) { continue; }

				var tile = this._tiles[this._tileCoordsToKey(coords)];
				if (tile) {
					tile.current = true;
				} else {
					queue.push(coords);
				}
			}
		}

		// sort tile queue to load tiles in order of their distance to center
		queue.sort(function (a, b) {
			return a.distanceTo(tileCenter) - b.distanceTo(tileCenter);
		});

		if (queue.length !== 0) {
			// if it's the first batch of tiles to load
			if (!this._loading) {
				this._loading = true;
				// @event loading: Event
				// Fired when the grid layer starts loading tiles.
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			var fragment = document.createDocumentFragment();

			for (i = 0; i < queue.length; i++) {
				this._addTile(queue[i], fragment);
			}

			this._level.el.appendChild(fragment);
		}
	},

	_isValidTile: function (coords) {
		var crs = this._map.options.crs;

		if (!crs.infinite) {
			// don't load tile if it's out of bounds and not wrapped
			var bounds = this._globalTileRange;
			if ((!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x)) ||
			    (!crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y))) { return false; }
		}

		if (!this.options.bounds) { return true; }

		// don't load tile if it doesn't intersect the bounds in options
		var tileBounds = this._tileCoordsToBounds(coords);
		return toLatLngBounds(this.options.bounds).overlaps(tileBounds);
	},

	_keyToBounds: function (key) {
		return this._tileCoordsToBounds(this._keyToTileCoords(key));
	},

	_tileCoordsToNwSe: function (coords) {
		var map = this._map,
		    tileSize = this.getTileSize(),
		    nwPoint = coords.scaleBy(tileSize),
		    sePoint = nwPoint.add(tileSize),
		    nw = map.unproject(nwPoint, coords.z),
		    se = map.unproject(sePoint, coords.z);
		return [nw, se];
	},

	// converts tile coordinates to its geographical bounds
	_tileCoordsToBounds: function (coords) {
		var bp = this._tileCoordsToNwSe(coords),
		    bounds = new LatLngBounds(bp[0], bp[1]);

		if (!this.options.noWrap) {
			bounds = this._map.wrapLatLngBounds(bounds);
		}
		return bounds;
	},
	// converts tile coordinates to key for the tile cache
	_tileCoordsToKey: function (coords) {
		return coords.x + ':' + coords.y + ':' + coords.z;
	},

	// converts tile cache key to coordinates
	_keyToTileCoords: function (key) {
		var k = key.split(':'),
		    coords = new Point(+k[0], +k[1]);
		coords.z = +k[2];
		return coords;
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

		// Cancels any pending http requests associated with the tile
		// unless we're on Android's stock browser,
		// see https://github.com/Leaflet/Leaflet/issues/137
		if (!androidStock) {
			tile.el.setAttribute('src', emptyImageUrl);
		}
		remove(tile.el);

		delete this._tiles[key];

		// @event tileunload: TileEvent
		// Fired when a tile is removed (e.g. when a tile goes off the screen).
		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	},

	_initTile: function (tile) {
		addClass(tile, 'leaflet-tile');

		var tileSize = this.getTileSize();
		tile.style.width = tileSize.x + 'px';
		tile.style.height = tileSize.y + 'px';

		tile.onselectstart = falseFn;
		tile.onmousemove = falseFn;

		// update opacity on tiles in IE7-8 because of filter inheritance problems
		if (ielt9 && this.options.opacity < 1) {
			setOpacity(tile, this.options.opacity);
		}

		// without this hack, tiles disappear after zoom on Chrome for Android
		// https://github.com/Leaflet/Leaflet/issues/2078
		if (android && !android23) {
			tile.style.WebkitBackfaceVisibility = 'hidden';
		}
	},

	_addTile: function (coords, container) {
		var tilePos = this._getTilePos(coords),
		    key = this._tileCoordsToKey(coords);

		var tile = this.createTile(this._wrapCoords(coords), bind(this._tileReady, this, coords));

		this._initTile(tile);

		// if createTile is defined with a second argument ("done" callback),
		// we know that tile is async and will be ready later; otherwise
		if (this.createTile.length < 2) {
			// mark tile as ready, but delay one frame for opacity animation to happen
			requestAnimFrame(bind(this._tileReady, this, coords, null, tile));
		}

		setPosition(tile, tilePos);

		// save tile in cache
		this._tiles[key] = {
			el: tile,
			coords: coords,
			current: true
		};

		container.appendChild(tile);
		// @event tileloadstart: TileEvent
		// Fired when a tile is requested and starts loading.
		this.fire('tileloadstart', {
			tile: tile,
			coords: coords
		});
	},

	_tileReady: function (coords, err, tile) {
		if (!this._map) { return; }

		if (err) {
			// @event tileerror: TileErrorEvent
			// Fired when there is an error loading a tile.
			this.fire('tileerror', {
				error: err,
				tile: tile,
				coords: coords
			});
		}

		var key = this._tileCoordsToKey(coords);

		tile = this._tiles[key];
		if (!tile) { return; }

		tile.loaded = +new Date();
		if (this._map._fadeAnimated) {
			setOpacity(tile.el, 0);
			cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
		} else {
			tile.active = true;
			this._pruneTiles();
		}

		if (!err) {
			addClass(tile.el, 'leaflet-tile-loaded');

			// @event tileload: TileEvent
			// Fired when a tile loads.
			this.fire('tileload', {
				tile: tile.el,
				coords: coords
			});
		}

		if (this._noTilesToLoad()) {
			this._loading = false;
			// @event load: Event
			// Fired when the grid layer loaded all visible tiles.
			this.fire('load');

			if (ielt9 || !this._map._fadeAnimated) {
				requestAnimFrame(this._pruneTiles, this);
			} else {
				// Wait a bit more than 0.2 secs (the duration of the tile fade-in)
				// to trigger a pruning.
				setTimeout(bind(this._pruneTiles, this), 250);
			}
		}
	},

	_getTilePos: function (coords) {
		return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
	},

	_wrapCoords: function (coords) {
		var newCoords = new Point(
			this._wrapX ? wrapNum(coords.x, this._wrapX) : coords.x,
			this._wrapY ? wrapNum(coords.y, this._wrapY) : coords.y);
		newCoords.z = coords.z;
		return newCoords;
	},

	_pxBoundsToTileRange: function (bounds) {
		var tileSize = this.getTileSize();
		return new Bounds(
			bounds.min.unscaleBy(tileSize).floor(),
			bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1]));
	},

	_noTilesToLoad: function () {
		for (var key in this._tiles) {
			if (!this._tiles[key].loaded) { return false; }
		}
		return true;
	}
});

// @factory L.gridLayer(options?: GridLayer options)
// Creates a new instance of GridLayer with the supplied options.
function gridLayer(options) {
	return new GridLayer(options);
}

/*
 * @class TileLayer
 * @inherits GridLayer
 * @aka L.TileLayer
 * Used to load and display tile layers on the map. Extends `GridLayer`.
 *
 * @example
 *
 * ```js
 * L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', {foo: 'bar'}).addTo(map);
 * ```
 *
 * @section URL template
 * @example
 *
 * A string of the following form:
 *
 * ```
 * 'http://{s}.somedomain.com/blabla/{z}/{x}/{y}{r}.png'
 * ```
 *
 * `{s}` means one of the available subdomains (used sequentially to help with browser parallel requests per domain limitation; subdomain values are specified in options; `a`, `b` or `c` by default, can be omitted), `{z}` — zoom level, `{x}` and `{y}` — tile coordinates. `{r}` can be used to add "&commat;2x" to the URL to load retina tiles.
 *
 * You can use custom keys in the template, which will be [evaluated](#util-template) from TileLayer options, like this:
 *
 * ```
 * L.tileLayer('http://{s}.somedomain.com/{foo}/{z}/{x}/{y}.png', {foo: 'bar'});
 * ```
 */


var TileLayer = GridLayer.extend({

	// @section
	// @aka TileLayer options
	options: {
		// @option minZoom: Number = 0
		// The minimum zoom level down to which this layer will be displayed (inclusive).
		minZoom: 0,

		// @option maxZoom: Number = 18
		// The maximum zoom level up to which this layer will be displayed (inclusive).
		maxZoom: 18,

		// @option subdomains: String|String[] = 'abc'
		// Subdomains of the tile service. Can be passed in the form of one string (where each letter is a subdomain name) or an array of strings.
		subdomains: 'abc',

		// @option errorTileUrl: String = ''
		// URL to the tile image to show in place of the tile that failed to load.
		errorTileUrl: '',

		// @option zoomOffset: Number = 0
		// The zoom number used in tile URLs will be offset with this value.
		zoomOffset: 0,

		// @option tms: Boolean = false
		// If `true`, inverses Y axis numbering for tiles (turn this on for [TMS](https://en.wikipedia.org/wiki/Tile_Map_Service) services).
		tms: false,

		// @option zoomReverse: Boolean = false
		// If set to true, the zoom number used in tile URLs will be reversed (`maxZoom - zoom` instead of `zoom`)
		zoomReverse: false,

		// @option detectRetina: Boolean = false
		// If `true` and user is on a retina display, it will request four tiles of half the specified size and a bigger zoom level in place of one to utilize the high resolution.
		detectRetina: false,

		// @option crossOrigin: Boolean = false
		// If true, all tiles will have their crossOrigin attribute set to ''. This is needed if you want to access tile pixel data.
		crossOrigin: false
	},

	initialize: function (url, options) {

		this._url = url;

		options = setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);

			if (!options.zoomReverse) {
				options.zoomOffset++;
				options.maxZoom--;
			} else {
				options.zoomOffset--;
				options.minZoom++;
			}

			options.minZoom = Math.max(0, options.minZoom);
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		// for https://github.com/Leaflet/Leaflet/issues/137
		if (!android) {
			this.on('tileunload', this._onTileRemove);
		}
	},

	// @method setUrl(url: String, noRedraw?: Boolean): this
	// Updates the layer's URL template and redraws it (unless `noRedraw` is set to `true`).
	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	// @method createTile(coords: Object, done?: Function): HTMLElement
	// Called only internally, overrides GridLayer's [`createTile()`](#gridlayer-createtile)
	// to return an `<img>` HTML element with the appropriate image URL given `coords`. The `done`
	// callback is called when the tile has been loaded.
	createTile: function (coords, done) {
		var tile = document.createElement('img');

		on(tile, 'load', bind(this._tileOnLoad, this, done, tile));
		on(tile, 'error', bind(this._tileOnError, this, done, tile));

		if (this.options.crossOrigin) {
			tile.crossOrigin = '';
		}

		/*
		 Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		*/
		tile.alt = '';

		/*
		 Set role="presentation" to force screen readers to ignore this
		 https://www.w3.org/TR/wai-aria/roles#textalternativecomputation
		*/
		tile.setAttribute('role', 'presentation');

		tile.src = this.getTileUrl(coords);

		return tile;
	},

	// @section Extension methods
	// @uninheritable
	// Layers extending `TileLayer` might reimplement the following method.
	// @method getTileUrl(coords: Object): String
	// Called only internally, returns the URL for a tile given its coordinates.
	// Classes extending `TileLayer` can override this function to provide custom tile URL naming schemes.
	getTileUrl: function (coords) {
		var data = {
			r: retina ? '@2x' : '',
			s: this._getSubdomain(coords),
			x: coords.x,
			y: coords.y,
			z: this._getZoomForUrl()
		};
		if (this._map && !this._map.options.crs.infinite) {
			var invertedY = this._globalTileRange.max.y - coords.y;
			if (this.options.tms) {
				data['y'] = invertedY;
			}
			data['-y'] = invertedY;
		}

		return template(this._url, extend(data, this.options));
	},

	_tileOnLoad: function (done, tile) {
		// For https://github.com/Leaflet/Leaflet/issues/3332
		if (ielt9) {
			setTimeout(bind(done, this, null, tile), 0);
		} else {
			done(null, tile);
		}
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl && tile.getAttribute('src') !== errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_getZoomForUrl: function () {
		var zoom = this._tileZoom,
		maxZoom = this.options.maxZoom,
		zoomReverse = this.options.zoomReverse,
		zoomOffset = this.options.zoomOffset;

		if (zoomReverse) {
			zoom = maxZoom - zoom;
		}

		return zoom + zoomOffset;
	},

	_getSubdomain: function (tilePoint) {
		var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	},

	// stops loading all tiles in the background layer
	_abortLoading: function () {
		var i, tile;
		for (i in this._tiles) {
			if (this._tiles[i].coords.z !== this._tileZoom) {
				tile = this._tiles[i].el;

				tile.onload = falseFn;
				tile.onerror = falseFn;

				if (!tile.complete) {
					tile.src = emptyImageUrl;
					remove(tile);
					delete this._tiles[i];
				}
			}
		}
	}
});


// @factory L.tilelayer(urlTemplate: String, options?: TileLayer options)
// Instantiates a tile layer object given a `URL template` and optionally an options object.

function tileLayer(url, options) {
	return new TileLayer(url, options);
}

/*
 * @class TileLayer.WMS
 * @inherits TileLayer
 * @aka L.TileLayer.WMS
 * Used to display [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services as tile layers on the map. Extends `TileLayer`.
 *
 * @example
 *
 * ```js
 * var nexrad = L.tileLayer.wms("http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", {
 * 	layers: 'nexrad-n0r-900913',
 * 	format: 'image/png',
 * 	transparent: true,
 * 	attribution: "Weather data © 2012 IEM Nexrad"
 * });
 * ```
 */

var TileLayerWMS = TileLayer.extend({

	// @section
	// @aka TileLayer.WMS options
	// If any custom options not documented here are used, they will be sent to the
	// WMS server as extra parameters in each request URL. This can be useful for
	// [non-standard vendor WMS parameters](http://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
	defaultWmsParams: {
		service: 'WMS',
		request: 'GetMap',

		// @option layers: String = ''
		// **(required)** Comma-separated list of WMS layers to show.
		layers: '',

		// @option styles: String = ''
		// Comma-separated list of WMS styles.
		styles: '',

		// @option format: String = 'image/jpeg'
		// WMS image format (use `'image/png'` for layers with transparency).
		format: 'image/jpeg',

		// @option transparent: Boolean = false
		// If `true`, the WMS service will return images with transparency.
		transparent: false,

		// @option version: String = '1.1.1'
		// Version of the WMS service to use
		version: '1.1.1'
	},

	options: {
		// @option crs: CRS = null
		// Coordinate Reference System to use for the WMS requests, defaults to
		// map CRS. Don't change this if you're not sure what it means.
		crs: null,

		// @option uppercase: Boolean = false
		// If `true`, WMS request parameter keys will be uppercase.
		uppercase: false
	},

	initialize: function (url, options) {

		this._url = url;

		var wmsParams = extend({}, this.defaultWmsParams);

		// all keys that are not TileLayer options go to WMS params
		for (var i in options) {
			if (!(i in this.options)) {
				wmsParams[i] = options[i];
			}
		}

		options = setOptions(this, options);

		var realRetina = options.detectRetina && retina ? 2 : 1;
		var tileSize = this.getTileSize();
		wmsParams.width = tileSize.x * realRetina;
		wmsParams.height = tileSize.y * realRetina;

		this.wmsParams = wmsParams;
	},

	onAdd: function (map) {

		this._crs = this.options.crs || map.options.crs;
		this._wmsVersion = parseFloat(this.wmsParams.version);

		var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
		this.wmsParams[projectionKey] = this._crs.code;

		TileLayer.prototype.onAdd.call(this, map);
	},

	getTileUrl: function (coords) {

		var tileBounds = this._tileCoordsToNwSe(coords),
		    crs = this._crs,
		    bounds = toBounds(crs.project(tileBounds[0]), crs.project(tileBounds[1])),
		    min = bounds.min,
		    max = bounds.max,
		    bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ?
		    [min.y, min.x, max.y, max.x] :
		    [min.x, min.y, max.x, max.y]).join(','),
		url = L.TileLayer.prototype.getTileUrl.call(this, coords);
		return url +
			getParamString(this.wmsParams, url, this.options.uppercase) +
			(this.options.uppercase ? '&BBOX=' : '&bbox=') + bbox;
	},

	// @method setParams(params: Object, noRedraw?: Boolean): this
	// Merges an object with the new parameters and re-requests tiles on the current screen (unless `noRedraw` was set to true).
	setParams: function (params, noRedraw) {

		extend(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}
});


// @factory L.tileLayer.wms(baseUrl: String, options: TileLayer.WMS options)
// Instantiates a WMS tile layer object given a base URL of the WMS service and a WMS parameters/options object.
function tileLayerWMS(url, options) {
	return new TileLayerWMS(url, options);
}

TileLayer.WMS = TileLayerWMS;
tileLayer.wms = tileLayerWMS;

/*
 * @class Renderer
 * @inherits Layer
 * @aka L.Renderer
 *
 * Base class for vector renderer implementations (`SVG`, `Canvas`). Handles the
 * DOM container of the renderer, its bounds, and its zoom animation.
 *
 * A `Renderer` works as an implicit layer group for all `Path`s - the renderer
 * itself can be added or removed to the map. All paths use a renderer, which can
 * be implicit (the map will decide the type of renderer and use it automatically)
 * or explicit (using the [`renderer`](#path-renderer) option of the path).
 *
 * Do not use this class directly, use `SVG` and `Canvas` instead.
 *
 * @event update: Event
 * Fired when the renderer updates its bounds, center and zoom, for example when
 * its map has moved
 */

var Renderer = Layer.extend({

	// @section
	// @aka Renderer options
	options: {
		// @option padding: Number = 0.1
		// How much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction
		padding: 0.1,

		// @option tolerance: Number = 0
		// How much to extend click tolerance round a path/object on the map
		tolerance : 0
	},

	initialize: function (options) {
		setOptions(this, options);
		stamp(this);
		this._layers = this._layers || {};
	},

	onAdd: function () {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations

			if (this._zoomAnimated) {
				addClass(this._container, 'leaflet-zoom-animated');
			}
		}

		this.getPane().appendChild(this._container);
		this._update();
		this.on('update', this._updatePaths, this);
	},

	onRemove: function () {
		this.off('update', this._updatePaths, this);
		this._destroyContainer();
	},

	getEvents: function () {
		var events = {
			viewreset: this._reset,
			zoom: this._onZoom,
			moveend: this._update,
			zoomend: this._onZoomEnd
		};
		if (this._zoomAnimated) {
			events.zoomanim = this._onAnimZoom;
		}
		return events;
	},

	_onAnimZoom: function (ev) {
		this._updateTransform(ev.center, ev.zoom);
	},

	_onZoom: function () {
		this._updateTransform(this._map.getCenter(), this._map.getZoom());
	},

	_updateTransform: function (center, zoom) {
		var scale = this._map.getZoomScale(zoom, this._zoom),
		    position = getPosition(this._container),
		    viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding),
		    currentCenterPoint = this._map.project(this._center, zoom),
		    destCenterPoint = this._map.project(center, zoom),
		    centerOffset = destCenterPoint.subtract(currentCenterPoint),

		    topLeftOffset = viewHalf.multiplyBy(-scale).add(position).add(viewHalf).subtract(centerOffset);

		if (any3d) {
			setTransform(this._container, topLeftOffset, scale);
		} else {
			setPosition(this._container, topLeftOffset);
		}
	},

	_reset: function () {
		this._update();
		this._updateTransform(this._center, this._zoom);

		for (var id in this._layers) {
			this._layers[id]._reset();
		}
	},

	_onZoomEnd: function () {
		for (var id in this._layers) {
			this._layers[id]._project();
		}
	},

	_updatePaths: function () {
		for (var id in this._layers) {
			this._layers[id]._update();
		}
	},

	_update: function () {
		// Update pixel bounds of renderer container (for positioning/sizing/clipping later)
		// Subclasses are responsible of firing the 'update' event.
		var p = this.options.padding,
		    size = this._map.getSize(),
		    min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());

		this._center = this._map.getCenter();
		this._zoom = this._map.getZoom();
	}
});

/*
 * @class Canvas
 * @inherits Renderer
 * @aka L.Canvas
 *
 * Allows vector layers to be displayed with [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
 * Inherits `Renderer`.
 *
 * Due to [technical limitations](http://caniuse.com/#search=canvas), Canvas is not
 * available in all web browsers, notably IE8, and overlapping geometries might
 * not display properly in some edge cases.
 *
 * @example
 *
 * Use Canvas by default for all paths in the map:
 *
 * ```js
 * var map = L.map('map', {
 * 	renderer: L.canvas()
 * });
 * ```
 *
 * Use a Canvas renderer with extra padding for specific vector geometries:
 *
 * ```js
 * var map = L.map('map');
 * var myRenderer = L.canvas({ padding: 0.5 });
 * var line = L.polyline( coordinates, { renderer: myRenderer } );
 * var circle = L.circle( center, { renderer: myRenderer } );
 * ```
 */

var Canvas = Renderer.extend({
	getEvents: function () {
		var events = Renderer.prototype.getEvents.call(this);
		events.viewprereset = this._onViewPreReset;
		return events;
	},

	_onViewPreReset: function () {
		// Set a flag so that a viewprereset+moveend+viewreset only updates&redraws once
		this._postponeUpdatePaths = true;
	},

	onAdd: function () {
		Renderer.prototype.onAdd.call(this);

		// Redraw vectors since canvas is cleared upon removal,
		// in case of removing the renderer itself from the map.
		this._draw();
	},

	_initContainer: function () {
		var container = this._container = document.createElement('canvas');

		on(container, 'mousemove', throttle(this._onMouseMove, 32, this), this);
		on(container, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
		on(container, 'mouseout', this._handleMouseOut, this);

		this._ctx = container.getContext('2d');
	},

	_destroyContainer: function () {
		delete this._ctx;
		remove(this._container);
		off(this._container);
		delete this._container;
	},

	_updatePaths: function () {
		if (this._postponeUpdatePaths) { return; }

		var layer;
		this._redrawBounds = null;
		for (var id in this._layers) {
			layer = this._layers[id];
			layer._update();
		}
		this._redraw();
	},

	_update: function () {
		if (this._map._animatingZoom && this._bounds) { return; }

		this._drawnLayers = {};

		Renderer.prototype._update.call(this);

		var b = this._bounds,
		    container = this._container,
		    size = b.getSize(),
		    m = retina ? 2 : 1;

		setPosition(container, b.min);

		// set canvas size (also clearing it); use double size on retina
		container.width = m * size.x;
		container.height = m * size.y;
		container.style.width = size.x + 'px';
		container.style.height = size.y + 'px';

		if (retina) {
			this._ctx.scale(2, 2);
		}

		// translate so we use the same path coordinates after canvas element moves
		this._ctx.translate(-b.min.x, -b.min.y);

		// Tell paths to redraw themselves
		this.fire('update');
	},

	_reset: function () {
		Renderer.prototype._reset.call(this);

		if (this._postponeUpdatePaths) {
			this._postponeUpdatePaths = false;
			this._updatePaths();
		}
	},

	_initPath: function (layer) {
		this._updateDashArray(layer);
		this._layers[stamp(layer)] = layer;

		var order = layer._order = {
			layer: layer,
			prev: this._drawLast,
			next: null
		};
		if (this._drawLast) { this._drawLast.next = order; }
		this._drawLast = order;
		this._drawFirst = this._drawFirst || this._drawLast;
	},

	_addPath: function (layer) {
		this._requestRedraw(layer);
	},

	_removePath: function (layer) {
		var order = layer._order;
		var next = order.next;
		var prev = order.prev;

		if (next) {
			next.prev = prev;
		} else {
			this._drawLast = prev;
		}
		if (prev) {
			prev.next = next;
		} else {
			this._drawFirst = next;
		}

		delete layer._order;

		delete this._layers[L.stamp(layer)];

		this._requestRedraw(layer);
	},

	_updatePath: function (layer) {
		// Redraw the union of the layer's old pixel
		// bounds and the new pixel bounds.
		this._extendRedrawBounds(layer);
		layer._project();
		layer._update();
		// The redraw will extend the redraw bounds
		// with the new pixel bounds.
		this._requestRedraw(layer);
	},

	_updateStyle: function (layer) {
		this._updateDashArray(layer);
		this._requestRedraw(layer);
	},

	_updateDashArray: function (layer) {
		if (layer.options.dashArray) {
			var parts = layer.options.dashArray.split(','),
			    dashArray = [],
			    i;
			for (i = 0; i < parts.length; i++) {
				dashArray.push(Number(parts[i]));
			}
			layer.options._dashArray = dashArray;
		}
	},

	_requestRedraw: function (layer) {
		if (!this._map) { return; }

		this._extendRedrawBounds(layer);
		this._redrawRequest = this._redrawRequest || requestAnimFrame(this._redraw, this);
	},

	_extendRedrawBounds: function (layer) {
		if (layer._pxBounds) {
			var padding = (layer.options.weight || 0) + 1;
			this._redrawBounds = this._redrawBounds || new Bounds();
			this._redrawBounds.extend(layer._pxBounds.min.subtract([padding, padding]));
			this._redrawBounds.extend(layer._pxBounds.max.add([padding, padding]));
		}
	},

	_redraw: function () {
		this._redrawRequest = null;

		if (this._redrawBounds) {
			this._redrawBounds.min._floor();
			this._redrawBounds.max._ceil();
		}

		this._clear(); // clear layers in redraw bounds
		this._draw(); // draw layers

		this._redrawBounds = null;
	},

	_clear: function () {
		var bounds = this._redrawBounds;
		if (bounds) {
			var size = bounds.getSize();
			this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
		} else {
			this._ctx.clearRect(0, 0, this._container.width, this._container.height);
		}
	},

	_draw: function () {
		var layer, bounds = this._redrawBounds;
		this._ctx.save();
		if (bounds) {
			var size = bounds.getSize();
			this._ctx.beginPath();
			this._ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
			this._ctx.clip();
		}

		this._drawing = true;

		for (var order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (!bounds || (layer._pxBounds && layer._pxBounds.intersects(bounds))) {
				layer._updatePath();
			}
		}

		this._drawing = false;

		this._ctx.restore();  // Restore state before clipping.
	},

	_updatePoly: function (layer, closed) {
		if (!this._drawing) { return; }

		var i, j, len2, p,
		    parts = layer._parts,
		    len = parts.length,
		    ctx = this._ctx;

		if (!len) { return; }

		this._drawnLayers[layer._leaflet_id] = layer;

		ctx.beginPath();

		for (i = 0; i < len; i++) {
			for (j = 0, len2 = parts[i].length; j < len2; j++) {
				p = parts[i][j];
				ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y);
			}
			if (closed) {
				ctx.closePath();
			}
		}

		this._fillStroke(ctx, layer);

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
	},

	_updateCircle: function (layer) {

		if (!this._drawing || layer._empty()) { return; }

		var p = layer._point,
		    ctx = this._ctx,
		    r = Math.max(Math.round(layer._radius), 1),
		    s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;

		this._drawnLayers[layer._leaflet_id] = layer;

		if (s !== 1) {
			ctx.save();
			ctx.scale(1, s);
		}

		ctx.beginPath();
		ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			ctx.restore();
		}

		this._fillStroke(ctx, layer);
	},

	_fillStroke: function (ctx, layer) {
		var options = layer.options;

		if (options.fill) {
			ctx.globalAlpha = options.fillOpacity;
			ctx.fillStyle = options.fillColor || options.color;
			ctx.fill(options.fillRule || 'evenodd');
		}

		if (options.stroke && options.weight !== 0) {
			if (ctx.setLineDash) {
				ctx.setLineDash(layer.options && layer.options._dashArray || []);
			}
			ctx.globalAlpha = options.opacity;
			ctx.lineWidth = options.weight;
			ctx.strokeStyle = options.color;
			ctx.lineCap = options.lineCap;
			ctx.lineJoin = options.lineJoin;
			ctx.stroke();
		}
	},

	// Canvas obviously doesn't have mouse events for individual drawn objects,
	// so we emulate that by calculating what's under the mouse on mousemove/click manually

	_onClick: function (e) {
		var point = this._map.mouseEventToLayerPoint(e), layer, clickedLayer;

		for (var order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (layer.options.interactive && layer._containsPoint(point) && !this._map._draggableMoved(layer)) {
				clickedLayer = layer;
			}
		}
		if (clickedLayer)  {
			fakeStop(e);
			this._fireEvent([clickedLayer], e);
		}
	},

	_onMouseMove: function (e) {
		if (!this._map || this._map.dragging.moving() || this._map._animatingZoom) { return; }

		var point = this._map.mouseEventToLayerPoint(e);
		this._handleMouseHover(e, point);
	},


	_handleMouseOut: function (e) {
		var layer = this._hoveredLayer;
		if (layer) {
			// if we're leaving the layer, fire mouseout
			removeClass(this._container, 'leaflet-interactive');
			this._fireEvent([layer], e, 'mouseout');
			this._hoveredLayer = null;
		}
	},

	_handleMouseHover: function (e, point) {
		var layer, candidateHoveredLayer;

		for (var order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (layer.options.interactive && layer._containsPoint(point)) {
				candidateHoveredLayer = layer;
			}
		}

		if (candidateHoveredLayer !== this._hoveredLayer) {
			this._handleMouseOut(e);

			if (candidateHoveredLayer) {
				addClass(this._container, 'leaflet-interactive'); // change cursor
				this._fireEvent([candidateHoveredLayer], e, 'mouseover');
				this._hoveredLayer = candidateHoveredLayer;
			}
		}

		if (this._hoveredLayer) {
			this._fireEvent([this._hoveredLayer], e);
		}
	},

	_fireEvent: function (layers, e, type) {
		this._map._fireDOMEvent(e, type || e.type, layers);
	},

	_bringToFront: function (layer) {
		var order = layer._order;
		var next = order.next;
		var prev = order.prev;

		if (next) {
			next.prev = prev;
		} else {
			// Already last
			return;
		}
		if (prev) {
			prev.next = next;
		} else if (next) {
			// Update first entry unless this is the
			// single entry
			this._drawFirst = next;
		}

		order.prev = this._drawLast;
		this._drawLast.next = order;

		order.next = null;
		this._drawLast = order;

		this._requestRedraw(layer);
	},

	_bringToBack: function (layer) {
		var order = layer._order;
		var next = order.next;
		var prev = order.prev;

		if (prev) {
			prev.next = next;
		} else {
			// Already first
			return;
		}
		if (next) {
			next.prev = prev;
		} else if (prev) {
			// Update last entry unless this is the
			// single entry
			this._drawLast = prev;
		}

		order.prev = null;

		order.next = this._drawFirst;
		this._drawFirst.prev = order;
		this._drawFirst = order;

		this._requestRedraw(layer);
	}
});

// @factory L.canvas(options?: Renderer options)
// Creates a Canvas renderer with the given options.
function canvas$1(options) {
	return canvas ? new Canvas(options) : null;
}

/*
 * Thanks to Dmitry Baranovsky and his Raphael library for inspiration!
 */


var vmlCreate = (function () {
	try {
		document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
		return function (name) {
			return document.createElement('<lvml:' + name + ' class="lvml">');
		};
	} catch (e) {
		return function (name) {
			return document.createElement('<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
		};
	}
})();


/*
 * @class SVG
 *
 * Although SVG is not available on IE7 and IE8, these browsers support [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language), and the SVG renderer will fall back to VML in this case.
 *
 * VML was deprecated in 2012, which means VML functionality exists only for backwards compatibility
 * with old versions of Internet Explorer.
 */

// mixin to redefine some SVG methods to handle VML syntax which is similar but with some differences
var vmlMixin = {

	_initContainer: function () {
		this._container = create$1('div', 'leaflet-vml-container');
	},

	_update: function () {
		if (this._map._animatingZoom) { return; }
		Renderer.prototype._update.call(this);
		this.fire('update');
	},

	_initPath: function (layer) {
		var container = layer._container = vmlCreate('shape');

		addClass(container, 'leaflet-vml-shape ' + (this.options.className || ''));

		container.coordsize = '1 1';

		layer._path = vmlCreate('path');
		container.appendChild(layer._path);

		this._updateStyle(layer);
		this._layers[stamp(layer)] = layer;
	},

	_addPath: function (layer) {
		var container = layer._container;
		this._container.appendChild(container);

		if (layer.options.interactive) {
			layer.addInteractiveTarget(container);
		}
	},

	_removePath: function (layer) {
		var container = layer._container;
		remove(container);
		layer.removeInteractiveTarget(container);
		delete this._layers[stamp(layer)];
	},

	_updateStyle: function (layer) {
		var stroke = layer._stroke,
		    fill = layer._fill,
		    options = layer.options,
		    container = layer._container;

		container.stroked = !!options.stroke;
		container.filled = !!options.fill;

		if (options.stroke) {
			if (!stroke) {
				stroke = layer._stroke = vmlCreate('stroke');
			}
			container.appendChild(stroke);
			stroke.weight = options.weight + 'px';
			stroke.color = options.color;
			stroke.opacity = options.opacity;

			if (options.dashArray) {
				stroke.dashStyle = isArray(options.dashArray) ?
				    options.dashArray.join(' ') :
				    options.dashArray.replace(/( *, *)/g, ' ');
			} else {
				stroke.dashStyle = '';
			}
			stroke.endcap = options.lineCap.replace('butt', 'flat');
			stroke.joinstyle = options.lineJoin;

		} else if (stroke) {
			container.removeChild(stroke);
			layer._stroke = null;
		}

		if (options.fill) {
			if (!fill) {
				fill = layer._fill = vmlCreate('fill');
			}
			container.appendChild(fill);
			fill.color = options.fillColor || options.color;
			fill.opacity = options.fillOpacity;

		} else if (fill) {
			container.removeChild(fill);
			layer._fill = null;
		}
	},

	_updateCircle: function (layer) {
		var p = layer._point.round(),
		    r = Math.round(layer._radius),
		    r2 = Math.round(layer._radiusY || r);

		this._setPath(layer, layer._empty() ? 'M0 0' :
			'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r2 + ' 0,' + (65535 * 360));
	},

	_setPath: function (layer, path) {
		layer._path.v = path;
	},

	_bringToFront: function (layer) {
		toFront(layer._container);
	},

	_bringToBack: function (layer) {
		toBack(layer._container);
	}
};

var create$2 = vml ? vmlCreate : svgCreate;

/*
 * @class SVG
 * @inherits Renderer
 * @aka L.SVG
 *
 * Allows vector layers to be displayed with [SVG](https://developer.mozilla.org/docs/Web/SVG).
 * Inherits `Renderer`.
 *
 * Due to [technical limitations](http://caniuse.com/#search=svg), SVG is not
 * available in all web browsers, notably Android 2.x and 3.x.
 *
 * Although SVG is not available on IE7 and IE8, these browsers support
 * [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language)
 * (a now deprecated technology), and the SVG renderer will fall back to VML in
 * this case.
 *
 * @example
 *
 * Use SVG by default for all paths in the map:
 *
 * ```js
 * var map = L.map('map', {
 * 	renderer: L.svg()
 * });
 * ```
 *
 * Use a SVG renderer with extra padding for specific vector geometries:
 *
 * ```js
 * var map = L.map('map');
 * var myRenderer = L.svg({ padding: 0.5 });
 * var line = L.polyline( coordinates, { renderer: myRenderer } );
 * var circle = L.circle( center, { renderer: myRenderer } );
 * ```
 */

var SVG = Renderer.extend({

	getEvents: function () {
		var events = Renderer.prototype.getEvents.call(this);
		events.zoomstart = this._onZoomStart;
		return events;
	},

	_initContainer: function () {
		this._container = create$2('svg');

		// makes it possible to click through svg root; we'll reset it back in individual paths
		this._container.setAttribute('pointer-events', 'none');

		this._rootGroup = create$2('g');
		this._container.appendChild(this._rootGroup);
	},

	_destroyContainer: function () {
		remove(this._container);
		off(this._container);
		delete this._container;
		delete this._rootGroup;
		delete this._svgSize;
	},

	_onZoomStart: function () {
		// Drag-then-pinch interactions might mess up the center and zoom.
		// In this case, the easiest way to prevent this is re-do the renderer
		//   bounds and padding when the zooming starts.
		this._update();
	},

	_update: function () {
		if (this._map._animatingZoom && this._bounds) { return; }

		Renderer.prototype._update.call(this);

		var b = this._bounds,
		    size = b.getSize(),
		    container = this._container;

		// set size of svg-container if changed
		if (!this._svgSize || !this._svgSize.equals(size)) {
			this._svgSize = size;
			container.setAttribute('width', size.x);
			container.setAttribute('height', size.y);
		}

		// movement: update container viewBox so that we don't have to change coordinates of individual layers
		setPosition(container, b.min);
		container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));

		this.fire('update');
	},

	// methods below are called by vector layers implementations

	_initPath: function (layer) {
		var path = layer._path = create$2('path');

		// @namespace Path
		// @option className: String = null
		// Custom class name set on an element. Only for SVG renderer.
		if (layer.options.className) {
			addClass(path, layer.options.className);
		}

		if (layer.options.interactive) {
			addClass(path, 'leaflet-interactive');
		}

		this._updateStyle(layer);
		this._layers[stamp(layer)] = layer;
	},

	_addPath: function (layer) {
		if (!this._rootGroup) { this._initContainer(); }
		this._rootGroup.appendChild(layer._path);
		layer.addInteractiveTarget(layer._path);
	},

	_removePath: function (layer) {
		remove(layer._path);
		layer.removeInteractiveTarget(layer._path);
		delete this._layers[stamp(layer)];
	},

	_updatePath: function (layer) {
		layer._project();
		layer._update();
	},

	_updateStyle: function (layer) {
		var path = layer._path,
		    options = layer.options;

		if (!path) { return; }

		if (options.stroke) {
			path.setAttribute('stroke', options.color);
			path.setAttribute('stroke-opacity', options.opacity);
			path.setAttribute('stroke-width', options.weight);
			path.setAttribute('stroke-linecap', options.lineCap);
			path.setAttribute('stroke-linejoin', options.lineJoin);

			if (options.dashArray) {
				path.setAttribute('stroke-dasharray', options.dashArray);
			} else {
				path.removeAttribute('stroke-dasharray');
			}

			if (options.dashOffset) {
				path.setAttribute('stroke-dashoffset', options.dashOffset);
			} else {
				path.removeAttribute('stroke-dashoffset');
			}
		} else {
			path.setAttribute('stroke', 'none');
		}

		if (options.fill) {
			path.setAttribute('fill', options.fillColor || options.color);
			path.setAttribute('fill-opacity', options.fillOpacity);
			path.setAttribute('fill-rule', options.fillRule || 'evenodd');
		} else {
			path.setAttribute('fill', 'none');
		}
	},

	_updatePoly: function (layer, closed) {
		this._setPath(layer, pointsToPath(layer._parts, closed));
	},

	_updateCircle: function (layer) {
		var p = layer._point,
		    r = Math.max(Math.round(layer._radius), 1),
		    r2 = Math.max(Math.round(layer._radiusY), 1) || r,
		    arc = 'a' + r + ',' + r2 + ' 0 1,0 ';

		// drawing a circle with two half-arcs
		var d = layer._empty() ? 'M0 0' :
			'M' + (p.x - r) + ',' + p.y +
			arc + (r * 2) + ',0 ' +
			arc + (-r * 2) + ',0 ';

		this._setPath(layer, d);
	},

	_setPath: function (layer, path) {
		layer._path.setAttribute('d', path);
	},

	// SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
	_bringToFront: function (layer) {
		toFront(layer._path);
	},

	_bringToBack: function (layer) {
		toBack(layer._path);
	}
});

if (vml) {
	SVG.include(vmlMixin);
}

// @namespace SVG
// @factory L.svg(options?: Renderer options)
// Creates a SVG renderer with the given options.
function svg$1(options) {
	return svg || vml ? new SVG(options) : null;
}

Map.include({
	// @namespace Map; @method getRenderer(layer: Path): Renderer
	// Returns the instance of `Renderer` that should be used to render the given
	// `Path`. It will ensure that the `renderer` options of the map and paths
	// are respected, and that the renderers do exist on the map.
	getRenderer: function (layer) {
		// @namespace Path; @option renderer: Renderer
		// Use this specific instance of `Renderer` for this path. Takes
		// precedence over the map's [default renderer](#map-renderer).
		var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

		if (!renderer) {
			// @namespace Map; @option preferCanvas: Boolean = false
			// Whether `Path`s should be rendered on a `Canvas` renderer.
			// By default, all `Path`s are rendered in a `SVG` renderer.
			renderer = this._renderer = (this.options.preferCanvas && canvas$1()) || svg$1();
		}

		if (!this.hasLayer(renderer)) {
			this.addLayer(renderer);
		}
		return renderer;
	},

	_getPaneRenderer: function (name) {
		if (name === 'overlayPane' || name === undefined) {
			return false;
		}

		var renderer = this._paneRenderers[name];
		if (renderer === undefined) {
			renderer = (SVG && svg$1({pane: name})) || (Canvas && canvas$1({pane: name}));
			this._paneRenderers[name] = renderer;
		}
		return renderer;
	}
});

/*
 * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
 */

/*
 * @class Rectangle
 * @aka L.Rectangle
 * @inherits Polygon
 *
 * A class for drawing rectangle overlays on a map. Extends `Polygon`.
 *
 * @example
 *
 * ```js
 * // define rectangle geographical bounds
 * var bounds = [[54.559322, -5.767822], [56.1210604, -3.021240]];
 *
 * // create an orange rectangle
 * L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(map);
 *
 * // zoom the map to the rectangle bounds
 * map.fitBounds(bounds);
 * ```
 *
 */


var Rectangle = Polygon.extend({
	initialize: function (latLngBounds, options) {
		Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
	},

	// @method setBounds(latLngBounds: LatLngBounds): this
	// Redraws the rectangle with the passed bounds.
	setBounds: function (latLngBounds) {
		return this.setLatLngs(this._boundsToLatLngs(latLngBounds));
	},

	_boundsToLatLngs: function (latLngBounds) {
		latLngBounds = toLatLngBounds(latLngBounds);
		return [
			latLngBounds.getSouthWest(),
			latLngBounds.getNorthWest(),
			latLngBounds.getNorthEast(),
			latLngBounds.getSouthEast()
		];
	}
});


// @factory L.rectangle(latLngBounds: LatLngBounds, options?: Polyline options)
function rectangle(latLngBounds, options) {
	return new Rectangle(latLngBounds, options);
}

SVG.create = create$2;
SVG.pointsToPath = pointsToPath;

GeoJSON.geometryToLayer = geometryToLayer;
GeoJSON.coordsToLatLng = coordsToLatLng;
GeoJSON.coordsToLatLngs = coordsToLatLngs;
GeoJSON.latLngToCoords = latLngToCoords;
GeoJSON.latLngsToCoords = latLngsToCoords;
GeoJSON.getFeature = getFeature;
GeoJSON.asFeature = asFeature;

/*
 * L.Handler.BoxZoom is used to add shift-drag zoom interaction to the map
 * (zoom to a selected bounding box), enabled by default.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @option boxZoom: Boolean = true
	// Whether the map can be zoomed to a rectangular area specified by
	// dragging the mouse while pressing the shift key.
	boxZoom: true
});

var BoxZoom = Handler.extend({
	initialize: function (map) {
		this._map = map;
		this._container = map._container;
		this._pane = map._panes.overlayPane;
		this._resetStateTimeout = 0;
		map.on('unload', this._destroy, this);
	},

	addHooks: function () {
		on(this._container, 'mousedown', this._onMouseDown, this);
	},

	removeHooks: function () {
		off(this._container, 'mousedown', this._onMouseDown, this);
	},

	moved: function () {
		return this._moved;
	},

	_destroy: function () {
		remove(this._pane);
		delete this._pane;
	},

	_resetState: function () {
		this._resetStateTimeout = 0;
		this._moved = false;
	},

	_clearDeferredResetState: function () {
		if (this._resetStateTimeout !== 0) {
			clearTimeout(this._resetStateTimeout);
			this._resetStateTimeout = 0;
		}
	},

	_onMouseDown: function (e) {
		if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }

		// Clear the deferred resetState if it hasn't executed yet, otherwise it
		// will interrupt the interaction and orphan a box element in the container.
		this._clearDeferredResetState();
		this._resetState();

		disableTextSelection();
		disableImageDrag();

		this._startPoint = this._map.mouseEventToContainerPoint(e);

		on(document, {
			contextmenu: stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	},

	_onMouseMove: function (e) {
		if (!this._moved) {
			this._moved = true;

			this._box = create$1('div', 'leaflet-zoom-box', this._container);
			addClass(this._container, 'leaflet-crosshair');

			this._map.fire('boxzoomstart');
		}

		this._point = this._map.mouseEventToContainerPoint(e);

		var bounds = new Bounds(this._point, this._startPoint),
		    size = bounds.getSize();

		setPosition(this._box, bounds.min);

		this._box.style.width  = size.x + 'px';
		this._box.style.height = size.y + 'px';
	},

	_finish: function () {
		if (this._moved) {
			remove(this._box);
			removeClass(this._container, 'leaflet-crosshair');
		}

		enableTextSelection();
		enableImageDrag();

		off(document, {
			contextmenu: stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	},

	_onMouseUp: function (e) {
		if ((e.which !== 1) && (e.button !== 1)) { return; }

		this._finish();

		if (!this._moved) { return; }
		// Postpone to next JS tick so internal click event handling
		// still see it as "moved".
		this._clearDeferredResetState();
		this._resetStateTimeout = setTimeout(bind(this._resetState, this), 0);

		var bounds = new LatLngBounds(
		        this._map.containerPointToLatLng(this._startPoint),
		        this._map.containerPointToLatLng(this._point));

		this._map
			.fitBounds(bounds)
			.fire('boxzoomend', {boxZoomBounds: bounds});
	},

	_onKeyDown: function (e) {
		if (e.keyCode === 27) {
			this._finish();
		}
	}
});

// @section Handlers
// @property boxZoom: Handler
// Box (shift-drag with mouse) zoom handler.
Map.addInitHook('addHandler', 'boxZoom', BoxZoom);

/*
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */

// @namespace Map
// @section Interaction Options

Map.mergeOptions({
	// @option doubleClickZoom: Boolean|String = true
	// Whether the map can be zoomed in by double clicking on it and
	// zoomed out by double clicking while holding shift. If passed
	// `'center'`, double-click zoom will zoom to the center of the
	//  view regardless of where the mouse was.
	doubleClickZoom: true
});

var DoubleClickZoom = Handler.extend({
	addHooks: function () {
		this._map.on('dblclick', this._onDoubleClick, this);
	},

	removeHooks: function () {
		this._map.off('dblclick', this._onDoubleClick, this);
	},

	_onDoubleClick: function (e) {
		var map = this._map,
		    oldZoom = map.getZoom(),
		    delta = map.options.zoomDelta,
		    zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}
});

// @section Handlers
//
// Map properties include interaction handlers that allow you to control
// interaction behavior in runtime, enabling or disabling certain features such
// as dragging or touch zoom (see `Handler` methods). For example:
//
// ```js
// map.doubleClickZoom.disable();
// ```
//
// @property doubleClickZoom: Handler
// Double click zoom handler.
Map.addInitHook('addHandler', 'doubleClickZoom', DoubleClickZoom);

/*
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @option dragging: Boolean = true
	// Whether the map be draggable with mouse/touch or not.
	dragging: true,

	// @section Panning Inertia Options
	// @option inertia: Boolean = *
	// If enabled, panning of the map will have an inertia effect where
	// the map builds momentum while dragging and continues moving in
	// the same direction for some time. Feels especially nice on touch
	// devices. Enabled by default unless running on old Android devices.
	inertia: !android23,

	// @option inertiaDeceleration: Number = 3000
	// The rate with which the inertial movement slows down, in pixels/second².
	inertiaDeceleration: 3400, // px/s^2

	// @option inertiaMaxSpeed: Number = Infinity
	// Max speed of the inertial movement, in pixels/second.
	inertiaMaxSpeed: Infinity, // px/s

	// @option easeLinearity: Number = 0.2
	easeLinearity: 0.2,

	// TODO refactor, move to CRS
	// @option worldCopyJump: Boolean = false
	// With this option enabled, the map tracks when you pan to another "copy"
	// of the world and seamlessly jumps to the original one so that all overlays
	// like markers and vector layers are still visible.
	worldCopyJump: false,

	// @option maxBoundsViscosity: Number = 0.0
	// If `maxBounds` is set, this option will control how solid the bounds
	// are when dragging the map around. The default value of `0.0` allows the
	// user to drag outside the bounds at normal speed, higher values will
	// slow down map dragging outside bounds, and `1.0` makes the bounds fully
	// solid, preventing the user from dragging outside the bounds.
	maxBoundsViscosity: 0.0
});

var Drag = Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			var map = this._map;

			this._draggable = new Draggable(map._mapPane, map._container);

			this._draggable.on({
				dragstart: this._onDragStart,
				drag: this._onDrag,
				dragend: this._onDragEnd
			}, this);

			this._draggable.on('predrag', this._onPreDragLimit, this);
			if (map.options.worldCopyJump) {
				this._draggable.on('predrag', this._onPreDragWrap, this);
				map.on('zoomend', this._onZoomEnd, this);

				map.whenReady(this._onZoomEnd, this);
			}
		}
		addClass(this._map._container, 'leaflet-grab leaflet-touch-drag');
		this._draggable.enable();
		this._positions = [];
		this._times = [];
	},

	removeHooks: function () {
		removeClass(this._map._container, 'leaflet-grab');
		removeClass(this._map._container, 'leaflet-touch-drag');
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	moving: function () {
		return this._draggable && this._draggable._moving;
	},

	_onDragStart: function () {
		var map = this._map;

		map._stop();
		if (this._map.options.maxBounds && this._map.options.maxBoundsViscosity) {
			var bounds = toLatLngBounds(this._map.options.maxBounds);

			this._offsetLimit = toBounds(
				this._map.latLngToContainerPoint(bounds.getNorthWest()).multiplyBy(-1),
				this._map.latLngToContainerPoint(bounds.getSouthEast()).multiplyBy(-1)
					.add(this._map.getSize()));

			this._viscosity = Math.min(1.0, Math.max(0.0, this._map.options.maxBoundsViscosity));
		} else {
			this._offsetLimit = null;
		}

		map
		    .fire('movestart')
		    .fire('dragstart');

		if (map.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	},

	_onDrag: function (e) {
		if (this._map.options.inertia) {
			var time = this._lastTime = +new Date(),
			    pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			this._prunePositions(time);
		}

		this._map
		    .fire('move', e)
		    .fire('drag', e);
	},

	_prunePositions: function (time) {
		while (this._positions.length > 1 && time - this._times[0] > 50) {
			this._positions.shift();
			this._times.shift();
		}
	},

	_onZoomEnd: function () {
		var pxCenter = this._map.getSize().divideBy(2),
		    pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
		this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
	},

	_viscousLimit: function (value, threshold) {
		return value - (value - threshold) * this._viscosity;
	},

	_onPreDragLimit: function () {
		if (!this._viscosity || !this._offsetLimit) { return; }

		var offset = this._draggable._newPos.subtract(this._draggable._startPos);

		var limit = this._offsetLimit;
		if (offset.x < limit.min.x) { offset.x = this._viscousLimit(offset.x, limit.min.x); }
		if (offset.y < limit.min.y) { offset.y = this._viscousLimit(offset.y, limit.min.y); }
		if (offset.x > limit.max.x) { offset.x = this._viscousLimit(offset.x, limit.max.x); }
		if (offset.y > limit.max.y) { offset.y = this._viscousLimit(offset.y, limit.max.y); }

		this._draggable._newPos = this._draggable._startPos.add(offset);
	},

	_onPreDragWrap: function () {
		// TODO refactor to be able to adjust map pane position after zoom
		var worldWidth = this._worldWidth,
		    halfWidth = Math.round(worldWidth / 2),
		    dx = this._initialWorldOffset,
		    x = this._draggable._newPos.x,
		    newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
		    newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
		    newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._absPos = this._draggable._newPos.clone();
		this._draggable._newPos.x = newX;
	},

	_onDragEnd: function (e) {
		var map = this._map,
		    options = map.options,

		    noInertia = !options.inertia || this._times.length < 2;

		map.fire('dragend', e);

		if (noInertia) {
			map.fire('moveend');

		} else {
			this._prunePositions(+new Date());

			var direction = this._lastPos.subtract(this._positions[0]),
			    duration = (this._lastTime - this._times[0]) / 1000,
			    ease = options.easeLinearity,

			    speedVector = direction.multiplyBy(ease / duration),
			    speed = speedVector.distanceTo([0, 0]),

			    limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
			    limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

			    decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
			    offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			if (!offset.x && !offset.y) {
				map.fire('moveend');

			} else {
				offset = map._limitOffset(offset, map.options.maxBounds);

				requestAnimFrame(function () {
					map.panBy(offset, {
						duration: decelerationDuration,
						easeLinearity: ease,
						noMoveStart: true,
						animate: true
					});
				});
			}
		}
	}
});

// @section Handlers
// @property dragging: Handler
// Map dragging handler (by both mouse and touch).
Map.addInitHook('addHandler', 'dragging', Drag);

/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 */

// @namespace Map
// @section Keyboard Navigation Options
Map.mergeOptions({
	// @option keyboard: Boolean = true
	// Makes the map focusable and allows users to navigate the map with keyboard
	// arrows and `+`/`-` keys.
	keyboard: true,

	// @option keyboardPanDelta: Number = 80
	// Amount of pixels to pan when pressing an arrow key.
	keyboardPanDelta: 80
});

var Keyboard = Handler.extend({

	keyCodes: {
		left:    [37],
		right:   [39],
		down:    [40],
		up:      [38],
		zoomIn:  [187, 107, 61, 171],
		zoomOut: [189, 109, 54, 173]
	},

	initialize: function (map) {
		this._map = map;

		this._setPanDelta(map.options.keyboardPanDelta);
		this._setZoomDelta(map.options.zoomDelta);
	},

	addHooks: function () {
		var container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex <= 0) {
			container.tabIndex = '0';
		}

		on(container, {
			focus: this._onFocus,
			blur: this._onBlur,
			mousedown: this._onMouseDown
		}, this);

		this._map.on({
			focus: this._addHooks,
			blur: this._removeHooks
		}, this);
	},

	removeHooks: function () {
		this._removeHooks();

		off(this._map._container, {
			focus: this._onFocus,
			blur: this._onBlur,
			mousedown: this._onMouseDown
		}, this);

		this._map.off({
			focus: this._addHooks,
			blur: this._removeHooks
		}, this);
	},

	_onMouseDown: function () {
		if (this._focused) { return; }

		var body = document.body,
		    docEl = document.documentElement,
		    top = body.scrollTop || docEl.scrollTop,
		    left = body.scrollLeft || docEl.scrollLeft;

		this._map._container.focus();

		window.scrollTo(left, top);
	},

	_onFocus: function () {
		this._focused = true;
		this._map.fire('focus');
	},

	_onBlur: function () {
		this._focused = false;
		this._map.fire('blur');
	},

	_setPanDelta: function (panDelta) {
		var keys = this._panKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.left.length; i < len; i++) {
			keys[codes.left[i]] = [-1 * panDelta, 0];
		}
		for (i = 0, len = codes.right.length; i < len; i++) {
			keys[codes.right[i]] = [panDelta, 0];
		}
		for (i = 0, len = codes.down.length; i < len; i++) {
			keys[codes.down[i]] = [0, panDelta];
		}
		for (i = 0, len = codes.up.length; i < len; i++) {
			keys[codes.up[i]] = [0, -1 * panDelta];
		}
	},

	_setZoomDelta: function (zoomDelta) {
		var keys = this._zoomKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.zoomIn.length; i < len; i++) {
			keys[codes.zoomIn[i]] = zoomDelta;
		}
		for (i = 0, len = codes.zoomOut.length; i < len; i++) {
			keys[codes.zoomOut[i]] = -zoomDelta;
		}
	},

	_addHooks: function () {
		on(document, 'keydown', this._onKeyDown, this);
	},

	_removeHooks: function () {
		off(document, 'keydown', this._onKeyDown, this);
	},

	_onKeyDown: function (e) {
		if (e.altKey || e.ctrlKey || e.metaKey) { return; }

		var key = e.keyCode,
		    map = this._map,
		    offset;

		if (key in this._panKeys) {

			if (map._panAnim && map._panAnim._inProgress) { return; }

			offset = this._panKeys[key];
			if (e.shiftKey) {
				offset = toPoint(offset).multiplyBy(3);
			}

			map.panBy(offset);

			if (map.options.maxBounds) {
				map.panInsideBounds(map.options.maxBounds);
			}

		} else if (key in this._zoomKeys) {
			map.setZoom(map.getZoom() + (e.shiftKey ? 3 : 1) * this._zoomKeys[key]);

		} else if (key === 27 && map._popup && map._popup.options.closeOnEscapeKey) {
			map.closePopup();

		} else {
			return;
		}

		stop(e);
	}
});

// @section Handlers
// @section Handlers
// @property keyboard: Handler
// Keyboard navigation handler.
Map.addInitHook('addHandler', 'keyboard', Keyboard);

/*
 * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Mousewheel options
	// @option scrollWheelZoom: Boolean|String = true
	// Whether the map can be zoomed by using the mouse wheel. If passed `'center'`,
	// it will zoom to the center of the view regardless of where the mouse was.
	scrollWheelZoom: true,

	// @option wheelDebounceTime: Number = 40
	// Limits the rate at which a wheel can fire (in milliseconds). By default
	// user can't zoom via wheel more often than once per 40 ms.
	wheelDebounceTime: 40,

	// @option wheelPxPerZoomLevel: Number = 60
	// How many scroll pixels (as reported by [L.DomEvent.getWheelDelta](#domevent-getwheeldelta))
	// mean a change of one full zoom level. Smaller values will make wheel-zooming
	// faster (and vice versa).
	wheelPxPerZoomLevel: 60
});

var ScrollWheelZoom = Handler.extend({
	addHooks: function () {
		on(this._map._container, 'mousewheel', this._onWheelScroll, this);

		this._delta = 0;
	},

	removeHooks: function () {
		off(this._map._container, 'mousewheel', this._onWheelScroll, this);
	},

	_onWheelScroll: function (e) {
		var delta = getWheelDelta(e);

		var debounce = this._map.options.wheelDebounceTime;

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		var left = Math.max(debounce - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		this._timer = setTimeout(bind(this._performZoom, this), left);

		stop(e);
	},

	_performZoom: function () {
		var map = this._map,
		    zoom = map.getZoom(),
		    snap = this._map.options.zoomSnap || 0;

		map._stop(); // stop panning and fly animations if any

		// map the delta with a sigmoid function to -4..4 range leaning on -1..1
		var d2 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4),
		    d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2,
		    d4 = snap ? Math.ceil(d3 / snap) * snap : d3,
		    delta = map._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else {
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}
});

// @section Handlers
// @property scrollWheelZoom: Handler
// Scroll wheel zoom handler.
Map.addInitHook('addHandler', 'scrollWheelZoom', ScrollWheelZoom);

/*
 * L.Map.Tap is used to enable mobile hacks like quick taps and long hold.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Touch interaction options
	// @option tap: Boolean = true
	// Enables mobile hacks for supporting instant taps (fixing 200ms click
	// delay on iOS/Android) and touch holds (fired as `contextmenu` events).
	tap: true,

	// @option tapTolerance: Number = 15
	// The max number of pixels a user can shift his finger during touch
	// for it to be considered a valid tap.
	tapTolerance: 15
});

var Tap = Handler.extend({
	addHooks: function () {
		on(this._map._container, 'touchstart', this._onDown, this);
	},

	removeHooks: function () {
		off(this._map._container, 'touchstart', this._onDown, this);
	},

	_onDown: function (e) {
		if (!e.touches) { return; }

		preventDefault(e);

		this._fireClick = true;

		// don't simulate click or track longpress if more than 1 touch
		if (e.touches.length > 1) {
			this._fireClick = false;
			clearTimeout(this._holdTimeout);
			return;
		}

		var first = e.touches[0],
		    el = first.target;

		this._startPos = this._newPos = new Point(first.clientX, first.clientY);

		// if touching a link, highlight it
		if (el.tagName && el.tagName.toLowerCase() === 'a') {
			addClass(el, 'leaflet-active');
		}

		// simulate long hold but setting a timeout
		this._holdTimeout = setTimeout(bind(function () {
			if (this._isTapValid()) {
				this._fireClick = false;
				this._onUp();
				this._simulateEvent('contextmenu', first);
			}
		}, this), 1000);

		this._simulateEvent('mousedown', first);

		on(document, {
			touchmove: this._onMove,
			touchend: this._onUp
		}, this);
	},

	_onUp: function (e) {
		clearTimeout(this._holdTimeout);

		off(document, {
			touchmove: this._onMove,
			touchend: this._onUp
		}, this);

		if (this._fireClick && e && e.changedTouches) {

			var first = e.changedTouches[0],
			    el = first.target;

			if (el && el.tagName && el.tagName.toLowerCase() === 'a') {
				removeClass(el, 'leaflet-active');
			}

			this._simulateEvent('mouseup', first);

			// simulate click if the touch didn't move too much
			if (this._isTapValid()) {
				this._simulateEvent('click', first);
			}
		}
	},

	_isTapValid: function () {
		return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
	},

	_onMove: function (e) {
		var first = e.touches[0];
		this._newPos = new Point(first.clientX, first.clientY);
		this._simulateEvent('mousemove', first);
	},

	_simulateEvent: function (type, e) {
		var simulatedEvent = document.createEvent('MouseEvents');

		simulatedEvent._simulated = true;
		e.target._simulatedClick = true;

		simulatedEvent.initMouseEvent(
		        type, true, true, window, 1,
		        e.screenX, e.screenY,
		        e.clientX, e.clientY,
		        false, false, false, false, 0, null);

		e.target.dispatchEvent(simulatedEvent);
	}
});

// @section Handlers
// @property tap: Handler
// Mobile touch hacks (quick tap and touch hold) handler.
if (touch && !pointer) {
	Map.addInitHook('addHandler', 'tap', Tap);
}

/*
 * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Touch interaction options
	// @option touchZoom: Boolean|String = *
	// Whether the map can be zoomed by touch-dragging with two fingers. If
	// passed `'center'`, it will zoom to the center of the view regardless of
	// where the touch events (fingers) were. Enabled for touch-capable web
	// browsers except for old Androids.
	touchZoom: touch && !android23,

	// @option bounceAtZoomLimits: Boolean = true
	// Set it to false if you don't want the map to zoom beyond min/max zoom
	// and then bounce back when pinch-zooming.
	bounceAtZoomLimits: true
});

var TouchZoom = Handler.extend({
	addHooks: function () {
		addClass(this._map._container, 'leaflet-touch-zoom');
		on(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	removeHooks: function () {
		removeClass(this._map._container, 'leaflet-touch-zoom');
		off(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	_onTouchStart: function (e) {
		var map = this._map;
		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		var p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]);

		this._centerPoint = map.getSize()._divideBy(2);
		this._startLatLng = map.containerPointToLatLng(this._centerPoint);
		if (map.options.touchZoom !== 'center') {
			this._pinchStartLatLng = map.containerPointToLatLng(p1.add(p2)._divideBy(2));
		}

		this._startDist = p1.distanceTo(p2);
		this._startZoom = map.getZoom();

		this._moved = false;
		this._zooming = true;

		map._stop();

		on(document, 'touchmove', this._onTouchMove, this);
		on(document, 'touchend', this._onTouchEnd, this);

		preventDefault(e);
	},

	_onTouchMove: function (e) {
		if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

		var map = this._map,
		    p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]),
		    scale = p1.distanceTo(p2) / this._startDist;

		this._zoom = map.getScaleZoom(scale, this._startZoom);

		if (!map.options.bounceAtZoomLimits && (
			(this._zoom < map.getMinZoom() && scale < 1) ||
			(this._zoom > map.getMaxZoom() && scale > 1))) {
			this._zoom = map._limitZoom(this._zoom);
		}

		if (map.options.touchZoom === 'center') {
			this._center = this._startLatLng;
			if (scale === 1) { return; }
		} else {
			// Get delta from pinch to center, so centerLatLng is delta applied to initial pinchLatLng
			var delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint);
			if (scale === 1 && delta.x === 0 && delta.y === 0) { return; }
			this._center = map.unproject(map.project(this._pinchStartLatLng, this._zoom).subtract(delta), this._zoom);
		}

		if (!this._moved) {
			map._moveStart(true, false);
			this._moved = true;
		}

		cancelAnimFrame(this._animRequest);

		var moveFn = bind(map._move, map, this._center, this._zoom, {pinch: true, round: false});
		this._animRequest = requestAnimFrame(moveFn, this, true);

		preventDefault(e);
	},

	_onTouchEnd: function () {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		this._zooming = false;
		cancelAnimFrame(this._animRequest);

		off(document, 'touchmove', this._onTouchMove);
		off(document, 'touchend', this._onTouchEnd);

		// Pinch updates GridLayers' levels only when zoomSnap is off, so zoomSnap becomes noUpdate.
		if (this._map.options.zoomAnimation) {
			this._map._animateZoom(this._center, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap);
		} else {
			this._map._resetView(this._center, this._map._limitZoom(this._zoom));
		}
	}
});

// @section Handlers
// @property touchZoom: Handler
// Touch zoom handler.
Map.addInitHook('addHandler', 'touchZoom', TouchZoom);

Map.BoxZoom = BoxZoom;
Map.DoubleClickZoom = DoubleClickZoom;
Map.Drag = Drag;
Map.Keyboard = Keyboard;
Map.ScrollWheelZoom = ScrollWheelZoom;
Map.Tap = Tap;
Map.TouchZoom = TouchZoom;

// misc

var oldL = window.L;
function noConflict() {
	window.L = oldL;
	return this;
}

// Always export us to window global (see #2364)
window.L = exports;

Object.freeze = freeze;

exports.version = version;
exports.noConflict = noConflict;
exports.Control = Control;
exports.control = control;
exports.Browser = Browser;
exports.Evented = Evented;
exports.Mixin = Mixin;
exports.Util = Util;
exports.Class = Class;
exports.Handler = Handler;
exports.extend = extend;
exports.bind = bind;
exports.stamp = stamp;
exports.setOptions = setOptions;
exports.DomEvent = DomEvent;
exports.DomUtil = DomUtil;
exports.PosAnimation = PosAnimation;
exports.Draggable = Draggable;
exports.LineUtil = LineUtil;
exports.PolyUtil = PolyUtil;
exports.Point = Point;
exports.point = toPoint;
exports.Bounds = Bounds;
exports.bounds = toBounds;
exports.Transformation = Transformation;
exports.transformation = toTransformation;
exports.Projection = index;
exports.LatLng = LatLng;
exports.latLng = toLatLng;
exports.LatLngBounds = LatLngBounds;
exports.latLngBounds = toLatLngBounds;
exports.CRS = CRS;
exports.GeoJSON = GeoJSON;
exports.geoJSON = geoJSON;
exports.geoJson = geoJson;
exports.Layer = Layer;
exports.LayerGroup = LayerGroup;
exports.layerGroup = layerGroup;
exports.FeatureGroup = FeatureGroup;
exports.featureGroup = featureGroup;
exports.ImageOverlay = ImageOverlay;
exports.imageOverlay = imageOverlay;
exports.VideoOverlay = VideoOverlay;
exports.videoOverlay = videoOverlay;
exports.DivOverlay = DivOverlay;
exports.Popup = Popup;
exports.popup = popup;
exports.Tooltip = Tooltip;
exports.tooltip = tooltip;
exports.Icon = Icon;
exports.icon = icon;
exports.DivIcon = DivIcon;
exports.divIcon = divIcon;
exports.Marker = Marker;
exports.marker = marker;
exports.TileLayer = TileLayer;
exports.tileLayer = tileLayer;
exports.GridLayer = GridLayer;
exports.gridLayer = gridLayer;
exports.SVG = SVG;
exports.svg = svg$1;
exports.Renderer = Renderer;
exports.Canvas = Canvas;
exports.canvas = canvas$1;
exports.Path = Path;
exports.CircleMarker = CircleMarker;
exports.circleMarker = circleMarker;
exports.Circle = Circle;
exports.circle = circle;
exports.Polyline = Polyline;
exports.polyline = polyline;
exports.Polygon = Polygon;
exports.polygon = polygon;
exports.Rectangle = Rectangle;
exports.rectangle = rectangle;
exports.Map = Map;
exports.map = createMap;

})));
//# sourceMappingURL=leaflet-src.js.map


/*
 Leaflet-GeoMixer, Leaflet plugin for visualization data from GeoMixer server
 (c) 2013-2016, RDC ScanEx
*/
(function () {
"use strict";
var L;
if (typeof module !== 'undefined' && module.exports) {
    L = require('leaflet');
    L.gmx = {};
    module.exports = L.gmx;
} else {
    L = window.L;
}


/*
   Single-pass recursive descent PEG parser library:
      http://en.wikipedia.org/wiki/Parsing_expression_grammar
   Inspired by Chris Double's parser combinator library in JavaScript:
      http://www.bluishcoder.co.nz/2007/10/javascript-packrat-parser.html
	+ Добавлены функции: Math.floor
*/
(function() {
    var regexExpression = /\[(.+?)\]/g,
        regexMath = /(floor\()/g;
	var Parsers = {						// Парсеры
        functionFromExpression: function(s) {
/*eslint-disable no-new-func*/
            return new Function(
/*eslint-enable */
                'props',
                'indexes',
                'return ' +
                    s
                     .replace(regexExpression, 'props[indexes["$1"]]')
                     .replace(regexMath, 'Math.$1')
                    + ';'
            );
        }
    };

	var makePair = function(t1, t2) {
		return {head: t1, tail: t2};
	};

// C-style linked list via recursive typedef.
//   Used purely functionally to get shareable sublists.
//typedef LinkedList = Pair<Dynamic, LinkedList>;
	var LinkedList = function(t1, t2) {
		return makePair(t1, t2);
	};

// Parser state contains position in string and some accumulated data.
//typedef ParserState = Pair<Int, LinkedList>;
	var ParserState = function(t1, t2) {
		return makePair(t1, t2);
	};

// Parser accepts string and state, returns another state.
//typedef Parser = String->ParserState->ParserState;

	// A parser state that indicates failure.
	var fail = new ParserState(-1, null);

	// Check for failure.
	var failed = function(state) {
		return (state.head === -1);
	};

	// Advance a parser state by n characters.
	var advance = function(state, n) {
		return new ParserState(state.head + n, state.tail);
	};

	// Match a specified string.
	var token = function(tok) {
		var len = tok.length;
		return function(s, state) {
			return (s.substr(state.head, len) === tok) ? advance(state, len) : fail;
		};
	};

	// Match a string without regard to case.
	var caseInsensitiveToken = function(tok) {
		var len = tok.length;
		tok = tok.toLowerCase();
		return function(s, state) {
			return (s.substr(state.head, len).toLowerCase() === tok) ? advance(state, len) : fail;
		};
	};

	// Match a single character in a specified range.
	var range = function(startChar, endChar) {
		var startCode = startChar.charCodeAt(0);
		var endCode = endChar.charCodeAt(0);
		return function(s, state) {
			var code = s.charCodeAt(state.head);
			return ((code >= startCode) && (code <= endCode)) ? advance(state, 1) : fail;
		};
	};

	// Match any character outside a certain set.
	//   This combinator is intended only for single character parsers.
	var anythingExcept = function(parser) {
		return function(s, state) {
			return ((s.length > state.head) && failed(parser(s, state))) ? advance(state, 1) : fail;
		};
	};

	// Match thing1, then thing2, ..., then thingN.
	var sequence = function(parsers) {
		return function(s, state) {
			for (var i = 0; i < parsers.length; i++) {
				state = parsers[i](s, state);
				if (failed(state)) {
					return fail;
                }
			}
			return state;
		};
	};

	// Match thing1, or thing2, ..., or thingN.
	var choice = function(parsers) {
		return function(s, state) {
			for (var i = 0; i < parsers.length; i++) {
				var newState = parsers[i](s, state);
				if (!failed(newState)) {
					return newState;
                }
			}
			return fail;
		};
	};

	// Match immediately, without regard to what's in the string.
	var nothing = function(s, state) {
		return state;
	};

	// Match this thing or nothing.
	var maybe = function(parser) {
		return choice([parser, nothing]);
	};

	// Match minCount or more repetitions of this thing.
	var repeat = function(minCount, parser) {
		return function(s, state) {
			var count = 0;
			while (true) {
				var newState = parser(s, state);
				if (failed(newState)) {
					return (count >= minCount) ? state : fail;
				} else {
					count += 1;
					state = newState;
				}
			}
			// return fail;
		};
	};

	// Match a list of minCount or more instances of thing1, separated by thing2.
	var separatedList = function(minCount, parser, separator) {
		var parser1 = sequence([parser, repeat(minCount - 1, sequence([separator, parser]))]);
		return (minCount > 0) ? parser1 : choice([parser1, nothing]);
	};

	var whitespace = repeat(0, choice([
		token(' '),
		token('\t'),
		token('\n')
	]));

	// Same as separatedList, but can have whitespace between items and separators.
	var whitespaceSeparatedList = function(minCount, parser, separator) {
		return separatedList(minCount, parser, sequence([whitespace, separator, whitespace]));
	};

	// Same as sequence, but can have whitespace between items.
	var whitespaceSeparatedSequence = function(parsers) {
		var newParsers = [];
		for (var i = 0; i < parsers.length; i++) {
			if (newParsers.length > 0) { newParsers.push(whitespace); }
			newParsers.push(parsers[i]);
		}
		return sequence(newParsers);
	};

	// This combinator captures the string that the parser matched
	//   and adds it to the current parser state, consing a new state.
	var capture = function(parser) {
		return function(s, state) {
			var newState = parser(s, state);
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(s.substr(state.head, newState.head - state.head), newState.tail));
		};
	};

	// This combinator passes the accumulated parser state to a given
	//  function for processing. The result goes into the new state.
	var action = function(parser, func) {
		return function(s, state) {
			var oldState = state;
			var newState = parser(s, new ParserState(oldState.head, null));
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(func(newState.tail), oldState.tail));
		};
	};

	// Define a syntactic subset of SQL WHERE clauses.
	var fieldName = capture(repeat(1, choice([
		range('a', 'z'),
		range('A', 'Z'),
		range('а', 'я'),
		range('А', 'Я'),
		range('0', '9'),
		token('_')
	])));

	var fieldNameWithSpaces = capture(repeat(1, choice([
		range('a', 'z'),
		range('A', 'Z'),
		range('а', 'я'),
		range('А', 'Я'),
		range('0', '9'),
		token('_'),
		token(' ')
	])));

	var quotedFieldName = choice([
		fieldName,
		sequence([token('"'), fieldNameWithSpaces, token('"')]),
		sequence([token('`'), fieldNameWithSpaces, token('`')])
	]);

	var stringLiteral = sequence([
		token('\''),
		capture(repeat(0, anythingExcept(token('\'')))),
		token('\'')
	]);

	var digits = repeat(1, range('0', '9'));

	var numberLiteral = capture(sequence([
		maybe(token('-')),
		digits,
		maybe(sequence([token('.'), digits]))
	]));

	var literal = choice([numberLiteral, stringLiteral]);

	var applyParser = function(s, parser) {
		return parser(s, new ParserState(0, null));
	};

	// Order is important here: longer ops should be tried first.
	var opTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			capture(choice([
				token('=='),
				token('!='),
				token('<>'),
				token('<='),
				token('>='),
				token('='),
				token('<'),
				token('>'),
				caseInsensitiveToken('LIKE')
			])),
            choice([literal, quotedFieldName])
		]),
		function(state) {
			// Linked list contains fieldname, operation, value
			// (in reverse order).

			var fieldName = state.tail.tail.head;
			var op = state.tail.head;
			var referenceValue = state.head;

			var matchPattern = null;
			if (op.toUpperCase() === 'LIKE') {
				matchPattern = function(fieldValue) {
					var matchFrom = null;
					matchFrom = function(referenceIdx, fieldIdx) {
						var referenceChar = referenceValue.charAt(referenceIdx);
						var fieldChar = fieldValue.charAt(fieldIdx);
						if (referenceChar === '') {
							return (fieldChar === '');
						} else if (referenceChar === '%') {
							return matchFrom(referenceIdx + 1, fieldIdx) || ((fieldChar !== '') && matchFrom(referenceIdx, fieldIdx + 1));
						} else {
							return (referenceChar === fieldChar) && matchFrom(referenceIdx + 1, fieldIdx + 1);
                        }
					};
					return matchFrom(0, 0);
				};
			}

			return function(props, indexes, types) {
				var fieldValue = props[indexes[fieldName]],
                    rValue = referenceValue;
                if (referenceValue in indexes) { rValue = props[indexes[rValue]]; }
                if ((types[fieldName] === 'date' || types[fieldName] === 'datetime') && typeof rValue === 'string') { rValue = L.gmxUtil.getUnixTimeFromStr(rValue); }
                if (typeof fieldValue === 'boolean' && typeof rValue === 'string') {
                    fieldValue = fieldValue ? 'True' : 'False';
                }
				if (fieldValue === null) { return false; }
				if (matchPattern !== null) { return matchPattern(fieldValue);
/*eslint-disable eqeqeq */
                } else if ((op === '=') || (op === '==')) { return (fieldValue == rValue);
				} else if ((op === '!=') || (op === '<>')) { return (fieldValue != rValue);
/*eslint-enable */
                } else {
                    var f1, f2;
					if (!(referenceValue in indexes) && typeof rValue === 'string' && applyParser(rValue, numberLiteral).head === rValue.length) {
						f1 = parseFloat(fieldValue);
						f2 = parseFloat(rValue);
						if (op === '<') { return (f1 < f2);
						} else if (op === '>') { return (f1 > f2);
						} else if (op === '<=') { return (f1 <= f2);
						} else if (op === '>=') { return (f1 >= f2);
						} else { return false;
                        }
					} else {
						f1 = fieldValue;
						f2 = rValue;
						if (op === '<') { return (f1 < f2);
						} else if (op === '>') { return (f1 > f2);
						} else if (op === '<=') { return (f1 <= f2);
						} else if (op === '>=') { return (f1 >= f2);
						} else { return false;
                        }
					}
				}
			};
		}
	);

	var inTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			caseInsensitiveToken('IN'),
			token('('),
			whitespaceSeparatedList(0, literal, token(',')),
			token(')')
		]),
		function(state) {
			// Linked list contains fieldname and multiple values
			//   (in reverse order).

			var node = state;
			while (node.tail != null) {
				node = node.tail;
			}
            var fieldName = node.head;

			return function(props, indexes) {
				var value = props[indexes[fieldName]];
				if (value == null) { return false; }
				var node = state;
				while (node.tail !== null) {
					if (node.head === value) { return true; }
					node = node.tail;
				}
				return false;
			};
		}
	);

	// Forward declarations to allow mutually recursive grammar definitions.
	var term = function(s, state) { return term(s, state); };
	var expression = function(s, state) { return expression(s, state); };

	var notTerm = action(
		whitespaceSeparatedSequence([caseInsensitiveToken('NOT'), term]),
		function(state) {
			// Linked list contains only processed inner term.
			var innerTerm = state.head;
			return function(props, indexes, types) {
				return !innerTerm(props, indexes, types);
			};
		}
	);

	term = choice([
		notTerm,
		opTerm,
		inTerm,
		whitespaceSeparatedSequence([token('('), expression, token(')')])
	]);

	// AND and OR expressions must have at least 2 terms,
	//   to disambiguate them from a single term.

	var andExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken('AND')),
		function(state) {
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props, indexes, types) {
				var flag = true;
				var node = state;
				while (node != null) {
					flag = flag && node.head(props, indexes, types);
					node = node.tail;
				}
				return flag;
			};
		}
	);

	var orExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken('OR')),
		function(state) {
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props, indexes, types) {
				var flag = false;
				var node = state;
				while (node != null) {
					flag = flag || node.head(props, indexes, types);
					node = node.tail;
				}
				return flag;
			};
		}
	);

	// Order is important here: term should be tried last,
	//   because andExpression and orExpression start with it.
	expression = choice([
		andExpression,
		orExpression,
		term
	]);

	var whereClause = sequence([whitespace, expression, whitespace]);

	Parsers.parseSQL = function(str) {
		var result = applyParser(str, whereClause);
		return result.head === str.length ?
			result.tail.head :
            (applyParser(str, whitespace).head === str.length) ?
				function(/*props*/) { return true; } :
				null;
	};

	var additiveExpression = function(s, state) { return additiveExpression(s, state); };
	var multiplicativeExpression = function(s, state) { return multiplicativeExpression(s, state); };
	additiveExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeExpression,
			capture(choice([token('+'), token('-')]))
		),
		function(state)
		{
			return function(props, indexes, types)
			{
				var pos = state;
				var term = 0.0;
				while (pos !== null) {
					term += pos.head(props, indexes, types);
					if (pos.tail === null) {
						return term;
					} else {
						if (pos.tail.head === '-') { term = -term; }
						pos = pos.tail.tail;
					}
				}
				return term;
			};
		}
	);

	var multiplicativeTerm = choice([
		action(
			numberLiteral,
			function(state) {
				return function(/*props, indexes, types*/) {
					return parseFloat(state.head);
				};
			}
		),
		action(
			sequence([token('floor('), additiveExpression, token(')')]),
			function(state) {
				return function(props, indexes, types) {
					var res = state.head(props, indexes, types);
					return Math.floor(res);
				};
			}
		),
		action(
			sequence([token('['), fieldName, token(']')]),
			function(state) {
				return function(props, indexes) {
					return parseFloat(props[indexes[state.head]]);
				};
			}
		),
		whitespaceSeparatedSequence([
			token('('),
			additiveExpression,
			token(')')
		])
	]);
	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token('-'), multiplicativeTerm]),
			function(state) {
				return function(props, indexes, types) {
					return -state.head(props, indexes, types);
				};
			}
		)
	]);
	multiplicativeExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeTerm,
			capture(choice([token('*'), token('/')]))
		),
		function(state)
		{
			return function(props, indexes, types) {
				var pos = state;
				var term = 1.0;
				while (pos !== null) {
					term *= pos.head(props, indexes, types);
					if (pos.tail === null) {
						return term;
					} else {
						if (pos.tail.head === '/') { term = 1.0 / term; }
						pos = pos.tail.tail;
					}
				}
				return term;
			};
		}
	);

	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token('-'), multiplicativeTerm]),
			function(state) {
				return function(props, indexes, types) {
					return -state.head(props, indexes, types);
				};
			}
		)
	]);

	var arithmeticExpression = sequence([whitespace, additiveExpression, whitespace]);
	Parsers.parseExpression = function(s) {
		var result = applyParser(s, arithmeticExpression);
        return result.head === s.length ? result.tail.head : null;
        // return result.head === s.length ? Parsers.functionFromExpression(s) : null;
	};

	var svgPath = action(
		repeat(0, choice([
			numberLiteral,
			token(','),
			token('M'),
			token('C'),
			repeat(1, choice([
				token(' '),
				token('\t'),
				token('\r'),
				token('\n')
			]))
		])),
		function(state) {
			var coords = [];
			while (state !== null) {
				coords.push(parseFloat(state.head));
				state = state.tail;
			}
			coords.reverse();
			return coords;
		}
	);

	Parsers.parseSVGPath = function(s) {
		var result = applyParser(s, svgPath);
		if (result.head === s.length) {
			return result.tail.head;
		} else {
			return [];
        }
	};

	//extend L.gmx namespace
    L.gmx = L.gmx || {};
	L.gmx.Parsers = Parsers;
})();


//all the methods can be called without instance itself
//For example:
//
// var def = new Deferred();
// doSomething(def.resolve) (instead of doSomething(def.resolve.bind(def))
var Deferred = function(cancelFunc) {
    var resolveCallbacks = [],
        rejectCallbacks = [],
        isFulfilled = false,
        isResolved = false,
        fulfilledData,
        onceAdded = false,
        isCancelled = false;

    var fulfill = this._fulfill = function(resolved /*, data*/) {
        if (isFulfilled) {
            return;
        }
        var callbacks = resolved ? resolveCallbacks : rejectCallbacks;
        fulfilledData = [].slice.call(arguments, 1);
        isFulfilled = true;
        isResolved = resolved;

        callbacks.forEach(function(callback) { callback.apply(null, fulfilledData); });
        resolveCallbacks = rejectCallbacks = [];
    };

    this.resolve = function(/*data*/) {
        isCancelled || fulfill.apply(null, [true].concat([].slice.call(arguments)));
    };

    this.reject = function(/*data*/) {
        isCancelled || fulfill.apply(null, [false].concat([].slice.call(arguments)));
    };

    var cancel = this.cancel = function() {
        if (!isCancelled && !isFulfilled) {
            isCancelled = true;
            cancelFunc && cancelFunc();
        }
    };

    var then = this.then = function(resolveCallback, rejectCallback) {
        if (isCancelled) {
            return null;
        }

        var userFuncDef = null;
        var def = new Deferred(function() {
            cancel();
            userFuncDef && userFuncDef.cancel();
        });

        var fulfillFunc = function(func, resolved) {
            return function(/*data*/) {
                if (!func) {
                    def._fulfill.apply(null, [resolved].concat([].slice.call(arguments)));
                } else {
                    var res = func.apply(null, arguments);
                    if (res instanceof Deferred) {
                        userFuncDef = res;
                        res.then(def.resolve, def.reject);
                    } else {
                        def.resolve(res);
                    }
                }
            };
        };

        if (isFulfilled) {
            fulfillFunc(isResolved ? resolveCallback : rejectCallback, isResolved).apply(null, fulfilledData);
        } else {
            resolveCallbacks.push(fulfillFunc(resolveCallback, true));
            rejectCallbacks.push(fulfillFunc(rejectCallback, false));
        }
        return def;
    };

    this.once = function(onceResolveCallback) {
        if (!onceAdded) {
            onceAdded = true;
            then(onceResolveCallback);
        }
    };

    this.always = function(callback) {
        then(callback, callback);
    };

    this.getFulfilledData = function() {
        return fulfilledData;
    };
};

Deferred.all = function() {
    var defArray = [].slice.apply(arguments);
    var resdef = new Deferred();
    var left = defArray.length;
    var results = new Array(defArray.length);

    if (left) {
        defArray.forEach(function(def, i) {
            def.then(function(res) {
                results[i] = res;
                left--;
                if (left === 0) {
                    resdef.resolve.apply(resdef, results);
                }
            }, function() {
                resdef.reject();
            });
        });
    } else {
        resdef.resolve();
    }

    return resdef;
};

L.gmx = L.gmx || {};
L.gmx.Deferred = Deferred;


(function() {
'use strict';

	var worker;
	if ('createImageBitmap' in window && 'Worker' in window) {
		worker = new Worker(location.href.replace(/[^/]*$/, 'ImageBitmapLoader-worker.js'));
	}
	if (!worker) {
		return;
	}

	var ImageBitmapLoader = function() {
		this.jobs = {};
		this.worker = worker;
		this.worker.onmessage = this.chkMessage.bind(this);
	}

	ImageBitmapLoader.prototype = {
		chkMessage: function(evt) {
			var message = evt.data,
				url = message.url;
// console.log('ImageBitmapLoader ', message, evt);

			for (var i = 0, it, arr = this.jobs[url] || [], len = arr.length; i < len; i++) {
				it = arr[i];
				if (message.imageBitmap) { it.resolve(message); }
				else { it.reject(message); }
			}
			this.jobs[url].length = 0;
			L.gmxUtil.loaderStatus(url, true);
		},

		push: function(url, options) {	// добавить запрос в worker
			var attr = {
					options: options
				},
				src = url;		// Ensure the URL is absolute.
			if (typeof this.jobs[src] === 'undefined') { this.jobs[src] = []; }

			this.jobs[src].push(attr);
			this.worker.postMessage({src: src, options: options});
			L.gmxUtil.loaderStatus(src);
			return new Promise(function(resolve, reject) {
				attr.resolve = resolve;
				attr.reject = reject;
			});
		}
	};

	var imageBitmapLoader = new ImageBitmapLoader();
	L.gmx.getBitmap = imageBitmapLoader.push.bind(imageBitmapLoader);
	worker.onerror = function(ev) {
		console.warn('Error: Worker init: ImageBitmapLoader-worker.js', ev);
		ev.target.terminate();
		delete L.gmx.getBitmap;
	};
})();


(function() {

var ImageRequest = function(id, url, options) {
    this._id = id;
    this.def = new L.gmx.Deferred(L.gmx.imageLoader._cancelRequest.bind(L.gmx.imageLoader, this));
    this.remove = L.gmx.imageLoader._removeRequestFromCache.bind(L.gmx.imageLoader, this);
    this.url = url;
    this.options = options || {};
};

var GmxImageLoader = L.Class.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
    statics: {
        MAX_COUNT: 20 // max number of parallel requests
    },

    initialize: function() {
        this.curCount = 0;        // number of currently processing requests (number of items in "inProgress")
        this.requests = [];       // not yet processed image requests
        this.inProgress = {};     // hash of in progress image loadings
        this.requestsCache = {};  // for requests cache by uniqueID
        this.uniqueID = 0;
    },

    _checkIE11bugFix: function(def, image) {
		if (!this.divIE11bugFix) {
			var div = document.createElement('div');
			this.divIE11bugFix = div;
			div.style.visibility = 'hidden';
			div.style.position = 'absolute';
			document.body.insertBefore(div, document.body.childNodes[0]);
		}
		var ieResolve = function() {
			def.resolve(image);
			// if (image.parentNode) {
				// image.parentNode.removeChild(image);
			// }
		};
		this.divIE11bugFix.appendChild(image);
		setTimeout(ieResolve, 0);
    },

    _resolveRequest: function(request, image, canceled) {
        var def = request.def;
        if (image) {
            if (!canceled && request.options.cache) {
                var url = request.url,
                    cacheItem = this.requestsCache[url],
                    cacheKey = request._id;
                if (!cacheItem) { cacheItem = this.requestsCache[url] = {image: image, requests:{}}; }
                if (!cacheItem.requests[cacheKey]) { cacheItem.requests[cacheKey] = request; }
            }
			if (L.gmxUtil.isIE11 && /\.svg/.test(request.url)) {   // skip bug in IE11
				this._checkIE11bugFix(def, image);
			} else {
				def.resolve(image);
			}
        } else if (!canceled) {
            def.reject();
        }
        this.fire('requestdone', {request: request});
    },

    _imageLoaded: function(url, image, canceled) {
        if (url in this.inProgress) {
            var resolveRequest = function(it) {
                this._resolveRequest(it, image, canceled);
            };
            this.inProgress[url].requests.forEach(resolveRequest.bind(this));
            --this.curCount;
            delete this.inProgress[url];
        }
        L.gmxUtil.loaderStatus(url, true);
        this.fire('imageloaded', {url: url});
        this._nextLoad();
    },

    _nextLoad: function() {  // загрузка следующего
        if (this.curCount >= GmxImageLoader.MAX_COUNT || !this.requests.length) {
            return;
        }

        var request = this.requests.shift(),
            url = request.url;

        if (url in this.inProgress) {
            this.inProgress[url].requests.push(request);
        } else {
            var requests = [request];
            this.inProgress[url] = {requests: requests};
            ++this.curCount;

            for (var k = this.requests.length - 1; k >= 0; k--) {
                if (this.requests[k].url === url) {
                    requests.push(this.requests[k]);
                    this.requests.splice(k, 1);
                }
            }

            var image = this._loadImage(request);
            if (!image.width) {
                L.gmxUtil.loaderStatus(url);
            }

            //theoretically image loading can be synchronous operation
            if (this.inProgress[url]) {
                this.inProgress[url].image = image;
            }
        }
    },

    _loadImage: function(request) {
        var imageObj = new Image(),
            url = request.url,
            _this = this;

        if (request.options.crossOrigin) {
            imageObj.crossOrigin = request.options.crossOrigin;
        }

        imageObj.onload = this._imageLoaded.bind(this, url, imageObj, false);
        imageObj.onerror = function() {
            _this._imageLoaded(url);
        };
		if (L.gmxUtil.isIEOrEdge) {
			setTimeout(function() { imageObj.src = url; }, 0);
		} else {
            imageObj.src = url;
		}

        this.fire('imageloadstart', {url: url});

        return imageObj;
    },

    _cancelRequest: function(request) {
        var id = request._id,
            url = request.url,
            i = 0, len;
        if (url in this.inProgress) {
            var loadingImg = this.inProgress[url],
                requests = loadingImg.requests;

            len = requests.length;
            if (len === 1 && requests[0]._id === id) {
                loadingImg.image.onload = L.Util.falseFn;
                loadingImg.image.onerror = L.Util.falseFn;
                loadingImg.image.src = L.Util.emptyImageUrl;
                this._imageLoaded(url, null, true);
            } else {
                for (i = 0; i < len; i++) {
                    if (requests[i]._id === id) {
                        requests.splice(i, 1);
                        break;
                    }
                }
            }
        } else {
            for (i = 0, len = this.requests.length; i < len; i++) {
                if (this.requests[i]._id === id) {
                    this.requests.splice(i, 1);
                    break;
                }
            }
        }

        this.fire('requestdone', {request: request});
    },

    _removeRequestFromCache: function(request) {    // remove request from cache
        this._cancelRequest(request);
        this._clearCacheItem(request.url, request._id);
    },

    _clearCacheItem: function(url, cacheKey) {    // remove cache item
        if (this.requestsCache[url]) {
            var cacheItem = this.requestsCache[url];
            delete cacheItem.requests[cacheKey];
            if (Object.keys(cacheItem.requests).length === 0) {
                delete this.requestsCache[url];
            }
        }
    },
    _add: function(atBegin, url, options) {
		url = url.replace(/^http:/, L.gmxUtil.protocol);

		var id = 'id' + (++this.uniqueID),
            request = new ImageRequest(id, url, options);

        if (url in this.inProgress) {
            this.inProgress[url].requests.push(request);
        } else {
            atBegin ? this.requests.unshift(request) : this.requests.push(request);
            this._nextLoad();
        }

        this.fire('request', {request: request});

        return request;
    },

    push: function(url, options) {  // добавить запрос в конец очереди
        return this._add(false, url, options);
    },

    unshift: function(url, options) {   // добавить запрос в начало очереди
        return this._add(true, url, options);
    }
});

L.gmx.imageLoader = new GmxImageLoader();

})();


/**
* @name L.gmxUtil
* @namespace
*/
var gmxAPIutils = {
    lastMapId: 0,
	fromWebMercY: function(y) {
		return 90 * (4 * Math.atan(Math.exp(y / gmxAPIutils.rMajor)) / Math.PI - 1);
	},

    newId: function()
    {
        gmxAPIutils.lastMapId += 1;
        return '_' + gmxAPIutils.lastMapId;
    },

    uniqueGlobalName: function(thing)
    {
        var id = gmxAPIutils.newId();
        window[id] = thing;
        return id;
    },

    isPageHidden: function()	{		// Видимость окна браузера
        return document.hidden || document.msHidden || document.webkitHidden || document.mozHidden || false;
    },

    normalizeHostname: function(hostName) {
        var parsedHost = L.gmxUtil.parseUri((hostName.substr(0, 4) !== 'http' ? L.gmxUtil.protocol + '//' : '') + hostName); // Bug in gmxAPIutils.parseUri for 'localhost:8000'

        hostName = parsedHost.host + parsedHost.directory;

        if (hostName[hostName.length - 1] === '/') {
            hostName = hostName.substring(0, hostName.length - 1);
        }

        return hostName;
    },

	getLayerItemFromServer: function(options) {
        var query = options.query ? options.query : '[' + options.field + ']=' + options.value,
			kosmosnimkiURL = L.gmxUtil.protocol + '//maps.kosmosnimki.ru/',
            req = {
                WrapStyle: 'func',
                geometry: true,
                layer: options.layerID,
                query: query
            };
        if (options.border) { req.border = options.border; }
        return gmxAPIutils.requestJSONP(
            options.url || (window.serverBase || kosmosnimkiURL) + 'VectorLayer/Search.ashx',
            req,
            options
        );
    },

	getCadastreFeatures: function(options) {
		// example: L.gmxUtil.getCadastreFeatures({latlng: L.latLng(48.350039, 45.152757), callbackParamName: 'callback'});
        if (options.latlng) {
			var latlng = options.latlng,
				req = {
					WrapStyle: 'func',
					text: (latlng.lat + ' ' + latlng.lng).replace(/\./g, ','),
					tolerance: options.tolerance || 0
				};
			return gmxAPIutils.requestJSONP(
				options.url || 'http://pkk5.rosreestr.ru/api/features/',
				req,
				options
			);
		} else {
			return null;
		}
    },

	getFormData: function(json) {
		var arr = [];
		for (var key in json) {
			var val = json[key];
			arr.push(key + '=' + (typeof val === 'object' ? JSON.stringify(val) : val));
		}
		return arr.join('&');
    },

	requestLink: function(url, params, options) {
        options = options || {};
		return new Promise(function(resolve, reject) {
			var script = null;
			if (url.indexOf('.css') === -1) {
				script = document.createElement('script');
				script.setAttribute('charset', 'UTF-8');
				var urlParams = L.extend({}, params, L.gmx.gmxMapManager.syncParams),
					paramsStringItems = [];

				for (var p in urlParams) {
					paramsStringItems.push(p + '=' + encodeURIComponent(urlParams[p]));
				}
				var src = url + (url.indexOf('?') === -1 ? '?' : '&') + paramsStringItems.join('&'),
					clearTag = function(err) {
						L.gmxUtil.loaderStatus(src, true);
						script.parentNode.removeChild(script);
						if (err) {
							reject(url);
							console.warn('Not found script:', url);
						} else {
							resolve(url, params, options);
						}
					};

				script.onerror = clearTag;
				script.onload = function() {
					clearTag();
				};
				L.gmxUtil.loaderStatus(src, null, 'vector');
				script.setAttribute('src', src);
			} else {
				script = document.createElement('link');

				script.rel   = 'stylesheet';
				script.type  = 'text/css';
				//link.media = options.media || 'screen';
				script.href  = url;
				resolve(url, params, options);
			}
			document.getElementsByTagName('head').item(0).appendChild(script);
		});
    },

    /** Sends JSONP requests
     * @memberof L.gmxUtil
     * @param {String} url - request URL
     * @param {Object} params - request params
     * @param {Object} [options] - additional request options
     * @param {String} [options.callbackParamName=CallbackName] - Name of param, that will be used for callback id.
       If callbackParamName is set to null, no params will be added (StaticJSONP)
     * @return {Deferred} Promise with server JSON response or with error status
    */
	requestJSONP: function(url, params, options) {
        options = options || {};
        var def = new L.gmx.Deferred();

        var script = document.createElement('script');
        script.setAttribute('charset', 'UTF-8');
        var callbackParamName = 'callbackParamName' in options ? options.callbackParamName : 'CallbackName';
        var urlParams = L.extend({}, params, L.gmx.gmxMapManager.syncParams);

        if (callbackParamName) {
            var callbackName = gmxAPIutils.uniqueGlobalName(function(obj) {
                delete window[callbackName];
                def.resolve(obj, options);
            });

            urlParams[callbackParamName] = callbackName;
        }

        var paramsStringItems = [];

        for (var p in urlParams) {
            paramsStringItems.push(p + '=' + encodeURIComponent(urlParams[p]));
        }

        var src = url + (url.indexOf('?') === -1 ? '?' : '&') + paramsStringItems.join('&');

        script.onerror = function(e) {
            def.reject(e);
            L.gmxUtil.loaderStatus(src, true);
            script.parentNode.removeChild(script);
        };
        script.onload = function() {
            L.gmxUtil.loaderStatus(src, true);
            script.parentNode.removeChild(script);
        };
        L.gmxUtil.loaderStatus(src, null, 'vector');
        script.setAttribute('src', src);

        document.getElementsByTagName('head').item(0).appendChild(script);
        return def;
    },
    getXmlHttp: function() {
        var xmlhttp;
        if (typeof XMLHttpRequest !== 'undefined') {
            xmlhttp = new XMLHttpRequest();
        } else {
          try {
            xmlhttp = new ActiveXObject('Msxml2.XMLHTTP');
          } catch (e) {
            try {
              xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');
            } catch (E) {
              xmlhttp = false;
            }
          }
        }
        return xmlhttp;
    },
    request: function(ph) { // {'type': 'GET|POST', 'url': 'string', 'callback': 'func'}
        var xhr = gmxAPIutils.getXmlHttp();
        if (xhr) {
            xhr.open((ph.type ? ph.type : 'GET'), ph.url, ph.async || false);
            if (ph.headers) {
                for (var key in ph.headers) {
                    xhr.setRequestHeader(key, ph.headers[key]);
                }
            }
            var reqId = L.gmxUtil.loaderStatus(ph.url);
            if (ph.async) {
                if (ph.withCredentials) {
                    xhr.withCredentials = true;
                }
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        L.gmxUtil.loaderStatus(reqId, true);
                        if (xhr.status === 200) {
                            ph.callback(xhr.responseText);
                            xhr = null;
                        } else if (ph.onError) {
                            ph.onError(xhr);
                        }
                    }
                };
            }
			var params = null;
			if (ph.params) {
				params = ph.params;
				var syncParams = L.gmx.gmxMapManager.getSyncParams(true);
				if (syncParams) {
					params += '&' + syncParams;
				}
			}
            xhr.send(params);
            if (!ph.async && xhr.status === 200) {
                ph.callback(xhr.responseText);
                L.gmxUtil.loaderStatus(reqId, true);
                return xhr.status;
            }
            return true;
        }
        if (ph.onError) {
            ph.onError({Error: 'bad XMLHttpRequest!'});
        }
        return false;
    },

    tileSizes: [], // Размеры тайла по zoom
    getTileNumFromLeaflet: function (tilePoint, zoom) {
        if ('z' in tilePoint) {
            zoom = tilePoint.z;
        }
        var pz = Math.pow(2, zoom),
            tx = tilePoint.x % pz + (tilePoint.x < 0 ? pz : 0),
            ty = tilePoint.y % pz + (tilePoint.y < 0 ? pz : 0);
        return {
            z: zoom,
            x: tx % pz - pz / 2,
            y: pz / 2 - 1 - ty % pz
        };
    },

	getTilePosZoomDelta: function(tilePoint, zoomFrom, zoomTo) {		// получить смещение тайла на меньшем zoom
        var dz = Math.pow(2, zoomFrom - zoomTo),
            size = 256 / dz,
            dx = tilePoint.x % dz,
            dy = tilePoint.y % dz;
		return {
			size: size,
			zDelta: dz,
			x: size * dx,
			y: size * dy
		};
    },

    isItemIntersectBounds: function(geo, bounds) {
        var type = geo.type,
            coords = geo.coordinates;
        if (type === 'POLYGON' || type === 'Polygon') {
			coords = [coords];
		}

		for (var j = 0, len1 = coords.length; j < len1; j++) {
			for (var i = 0, len = coords[j].length; i < len; i++) {
				if (bounds.clipPolygon(coords[j][i]).length) {
					return true;
				}
			}
		}
		return false;
    },

    geoItemBounds: function(geo) {  // get item bounds array by geometry
        if (!geo) {
            return {
                bounds: null,
                boundsArr: []
            };
        }
        var type = geo.type,
            coords = geo.coordinates,
            b = null,
            i = 0,
            len = 0,
            bounds = null,
            boundsArr = [];
        if (type === 'MULTIPOLYGON' || type === 'MultiPolygon') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                var arr1 = [];
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    b = gmxAPIutils.bounds(coords[i][j]);
                    arr1.push(b);
                    if (j === 0) { bounds.extendBounds(b); }
                }
                boundsArr.push(arr1);
            }
        } else if (type === 'POLYGON' || type === 'Polygon') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds(coords[i]);
                boundsArr.push(b);
                if (i === 0) { bounds.extendBounds(b); }
            }
        } else if (type === 'POINT' || type === 'Point') {
            bounds = gmxAPIutils.bounds([coords]);
        } else if (type === 'MULTIPOINT' || type === 'MultiPoint') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds([coords[i]]);
                bounds.extendBounds(b);
            }
        } else if (type === 'LINESTRING' || type === 'LineString') {
            bounds = gmxAPIutils.bounds(coords);
            //boundsArr.push(bounds);
        } else if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds(coords[i]);
                bounds.extendBounds(b);
                //boundsArr.push(b);
            }
        }
        return {
            bounds: bounds,
            boundsArr: boundsArr
        };
    },

    getUnFlattenGeo: function(geo) {  // get unFlatten geometry
        var type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            coords = geo.coordinates,
            coordsOut = coords;

        if (isLikePolygon) {
            coordsOut = [];
            var isPolygon = type === 'POLYGON' || type === 'Polygon';
            if (isPolygon) { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                var ring = [];
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    ring[j] = gmxAPIutils.unFlattenRing(coords[i][j]);
                }
                coordsOut.push(ring);
            }
            if (isPolygon) { coordsOut = coordsOut[0]; }
        }
        return {type: type, coordinates: coordsOut};
    },

    unFlattenRing: function(arr) {
        if (typeof arr[0] !== 'number') {
            return arr;
        }
        var len = arr.length,
            cnt = 0,
            res = new Array(len / 2);

        for (var i = 0; i < len; i += 2) {
            res[cnt++] = [arr[i], arr[i + 1]];
        }
        return res;
    },

    geoFlatten: function(geo) {  // get flatten geometry
        var type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            isPolygon = type === 'POLYGON' || type === 'Polygon',
            coords = geo.coordinates;

        if (isLikePolygon) {
            if (isPolygon) { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    coords[i][j] = gmxAPIutils.flattenRing(coords[i][j]);
                }
            }
        }
    },

    flattenRing: function(arr) {
        var len = arr.length,
            cnt = 0,
            CurArray = typeof Float64Array === 'function' ? Float64Array : Array,
            res = new CurArray(2 * len);

        for (var i = 0; i < len; i++) {
            res[cnt++] = arr[i][0];
            res[cnt++] = arr[i][1];
        }
        return res;
    },

    /** Check rectangle type by coordinates
     * @memberof L.gmxUtil
     * @param {coordinates} coordinates - geoJSON coordinates data format
     * @return {Boolean}
    */
    isRectangle: function(coords) {
        return (coords && coords[0] && (coords[0].length === 5 || coords[0].length === 4)
            && ((coords[0][0][0] === coords[0][1][0]) || (coords[0][0][1] === coords[0][1][1]))
            && ((coords[0][1][0] === coords[0][2][0]) || (coords[0][1][1] === coords[0][2][1]))
            && ((coords[0][2][0] === coords[0][3][0]) || (coords[0][2][1] === coords[0][3][1]))
            && ((coords[0][3][0] === coords[0][0][0]) || (coords[0][3][1] === coords[0][0][1]))
        );
    },

    /** Get bounds from geometry
     * @memberof L.gmxUtil
     * @param {geometry} geometry - Geomixer or geoJSON data format
     * @return {Object} bounds
    */
    getGeometryBounds: function(geo) {
        var pt = gmxAPIutils.geoItemBounds(geo);
        return pt.bounds;
    },

    getMarkerPolygon: function(bounds, dx, dy) {
        var x = (bounds.min.x + bounds.max.x) / 2,
            y = (bounds.min.y + bounds.max.y) / 2;
        return [
            [x - dx, y - dy],
            [x - dx, y + dy],
            [x + dx, y + dy],
            [x + dx, y - dy],
            [x - dx, y - dy]
        ];
    },

    getQuicklookPointsFromProperties: function(pArr, gmx) {
        var indexes = gmx.tileAttributeIndexes;
        var points = {
                x1: gmxAPIutils.getPropItem(gmx.quicklookX1 || ('x1' in indexes ? 'x1' : 'X1'), pArr, indexes) || 0,
                y1: gmxAPIutils.getPropItem(gmx.quicklookY1 || ('y1' in indexes ? 'y1' : 'Y1'), pArr, indexes) || 0,
                x2: gmxAPIutils.getPropItem(gmx.quicklookX2 || ('x2' in indexes ? 'x2' : 'X2'), pArr, indexes) || 0,
                y2: gmxAPIutils.getPropItem(gmx.quicklookY2 || ('y2' in indexes ? 'y2' : 'Y2'), pArr, indexes) || 0,
                x3: gmxAPIutils.getPropItem(gmx.quicklookX3 || ('x3' in indexes ? 'x3' : 'X3'), pArr, indexes) || 0,
                y3: gmxAPIutils.getPropItem(gmx.quicklookY3 || ('y3' in indexes ? 'y3' : 'Y3'), pArr, indexes) || 0,
                x4: gmxAPIutils.getPropItem(gmx.quicklookX4 || ('x4' in indexes ? 'x4' : 'X4'), pArr, indexes) || 0,
                y4: gmxAPIutils.getPropItem(gmx.quicklookY4 || ('y4' in indexes ? 'y4' : 'Y4'), pArr, indexes) || 0
            },
            bounds = gmxAPIutils.bounds([
                [points.x1, points.y1],
                [points.x2, points.y2],
                [points.x3, points.y3],
                [points.x4, points.y4]
            ]);

        if (bounds.max.x === bounds.min.x || bounds.max.y === bounds.min.y) {
            return null;
        }

        if (!gmx.quicklookPlatform) {
			var crs = gmx.srs == 3857 ? L.CRS.EPSG3857 : L.Projection.Mercator;
            var merc = crs.project(L.latLng(points.y1, points.x1));
            points.x1 = merc.x; points.y1 = merc.y;
            merc = crs.project(L.latLng(points.y2, points.x2));
            points.x2 = merc.x; points.y2 = merc.y;
            merc = crs.project(L.latLng(points.y3, points.x3));
            points.x3 = merc.x; points.y3 = merc.y;
            merc = crs.project(L.latLng(points.y4, points.x4));
            points.x4 = merc.x; points.y4 = merc.y;
        }

        return points;
    },

    /** Get hash properties from array properties
     * @memberof L.gmxUtil
     * @param {Array} properties in Array format
     * @param {Object} keys indexes
     * @return {Object} properties in Hash format
    */
    getPropertiesHash: function(arr, indexes) {
        var properties = {};
        for (var key in indexes) {
            properties[key] = arr[indexes[key]];
        }
        return properties;
    },

    getPropItem: function(key, arr, indexes) {
        return key in indexes ? arr[indexes[key]] : '';
    },

    dec2rgba: function(i, a)	{				// convert decimal to rgb
        var r = (i >> 16) & 255,
            g = (i >> 8) & 255,
            b = i & 255;
		return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
	},

    dec2hex: function(i) {					// convert decimal to hex
        return (i + 0x1000000).toString(16).substr(-6);
    },

    dec2color: function(i, a)   {   // convert decimal to canvas color
        return a < 1 ? this.dec2rgba(i, a) : '#' + this.dec2hex(i);
    },

    oneDay: 60 * 60 * 24,			// один день

    isTileKeysIntersects: function(tk1, tk2) { // пересечение по номерам двух тайлов
        if (tk1.z < tk2.z) {
            var t = tk1; tk1 = tk2; tk2 = t;
        }

        var dz = tk1.z - tk2.z;
        return tk1.x >> dz === tk2.x && tk1.y >> dz === tk2.y;
	},

    rotatePoints: function(arr, angle, iconScale, center) {			// rotate - массива точек
        var out = [];
        angle *= Math.PI / 180.0;
        var sin = Math.sin(angle);
        var cos = Math.cos(angle);
        if (!iconScale) { iconScale = 1; }
        for (var i = 0; i < arr.length; i++) {
            var x = iconScale * arr[i].x - center.x;
            var y = iconScale * arr[i].y - center.y;
            out.push({
                'x': cos * x - sin * y + center.x,
                'y': sin * x + cos * y + center.y
            });
        }
        return out;
    },
    getPatternIcon: function(item, style, indexes) { // получить bitmap стиля pattern
        if (!style.fillPattern) { return null; }

        var notFunc = true,
            pattern = style.fillPattern,
            prop = item ? item.properties : null,
            step = pattern.step > 0 ? pattern.step : 0,
            patternDefaults = {
                minWidth: 1,
                maxWidth: 1000,
                minStep: 0,
                maxStep: 1000
            };
        if (pattern.patternStepFunction && prop !== null) {
            step = pattern.patternStepFunction(prop, indexes);
            notFunc = false;
        }
        if (step > patternDefaults.maxStep) {
            step = patternDefaults.maxStep;
        }
        else if (step < patternDefaults.minStep) {
            step = patternDefaults.minStep;
        }

        var size = pattern.width > 0 ? pattern.width : 8;
        if (pattern.patternWidthFunction && prop !== null) {
            size = pattern.patternWidthFunction(prop, indexes);
            notFunc = false;
        }
        if (size > patternDefaults.maxWidth) {
            size = patternDefaults.maxWidth;
        } else if (size < patternDefaults.minWidth) {
            size = patternDefaults.minWidth;
        }

        var op = style.fillOpacity;
        if (style.opacityFunction && prop !== null) {
            op = style.opacityFunction(prop, indexes) / 100;
            notFunc = false;
        }

        var rgb = [0xff0000, 0x00ff00, 0x0000ff],
            arr = (pattern.colors != null ? pattern.colors : rgb),
            count = arr.length,
            resColors = [],
            i = 0;

        for (i = 0; i < count; i++) {
            var col = arr[i];
            if (pattern.patternColorsFunction && pattern.patternColorsFunction[i] !== null) {
                col = (prop !== null ? pattern.patternColorsFunction[i](prop, indexes) : rgb[i % 3]);
                notFunc = false;
            }
            resColors.push(col);
        }
        if (count === 0) { resColors = [0]; op = 0; count = 1; }   // pattern without colors

        var delta = size + step,
            allSize = delta * count,
            center = 0,
            //radius,
            rad = 0,
            hh = allSize,				// высота битмапа
            ww = allSize,				// ширина битмапа
            type = pattern.style || 'horizontal',
            flagRotate = false;

        if (type === 'diagonal1' || type === 'diagonal2' || type === 'cross' || type === 'cross1') {
            flagRotate = true;
        } else if (type === 'circle') {
            ww = hh = 2 * delta;
            center = Math.floor(ww / 2);	// центр круга
            //radius = Math.floor(size / 2);	// радиус
            rad = 2 * Math.PI / count;		// угол в рад.
        } else if (type === 'vertical') {
            hh = 1;
        } else if (type === 'horizontal') {
            ww = 1;
        }
        if (ww * hh > patternDefaults.maxWidth) {
            console.log({'func': 'getPatternIcon', 'Error': 'MAX_PATTERN_SIZE', 'alert': 'Bitmap from pattern is too big'});
            return null;
        }

        var canvas = document.createElement('canvas');
        canvas.width = ww; canvas.height = hh;
        var ptx = canvas.getContext('2d');
        ptx.clearRect(0, 0, canvas.width, canvas.height);
        if (type === 'diagonal2' || type === 'vertical') {
            ptx.translate(ww, 0);
            ptx.rotate(Math.PI / 2);
        }

        for (i = 0; i < count; i++) {
            ptx.beginPath();
            var fillStyle = gmxAPIutils.dec2color(resColors[i], op);
            ptx.fillStyle = fillStyle;

            if (flagRotate) {
                var x1 = i * delta; var xx1 = x1 + size;
                ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);

                x1 += allSize; xx1 = x1 + size;
                ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);
                if (type === 'cross' || type === 'cross1') {
                    x1 = i * delta; xx1 = x1 + size;
                    ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);

                    x1 += allSize; xx1 = x1 + size;
                    ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);
                }
            } else if (type === 'circle') {
                ptx.arc(center, center, size, i * rad, (i + 1) * rad);
                ptx.lineTo(center, center);
            } else {
                ptx.fillRect(0, i * delta, ww, size);
            }
            ptx.closePath();
            ptx.fill();
        }
        var canvas1 = document.createElement('canvas');
        canvas1.width = ww;
        canvas1.height = hh;
        var ptx1 = canvas1.getContext('2d');
        ptx1.drawImage(canvas, 0, 0, ww, hh);
        return {'notFunc': notFunc, 'canvas': canvas1};
    },

    getSVGIcon: function (options) {
        var svg = '<svg xmlns="' + L.Path.SVG_NS + '" xmlns:xlink="http://www.w3.org/1999/xlink"',
            type = options.type,
            fill = options.fillStyle || 'rgba(255, 255, 255, 0.5)',
            stroke = options.strokeStyle || '#0000ff',
            strokeWidth = options.lineWidth || 2,
            iconOptions = {
                className: 'gmx-svg-icon'
            };

        if (options.className) {
            iconOptions.className = options.className;
        }
        var size = options.iconSize;
        iconOptions.iconSize = [size, size];
        svg += ' height = "' + size + 'px"  width = "' + size + 'px">';

        if (type === 'circle') {
            if (options.fillRadialGradient) {
                svg += '<defs><radialGradient id="myRadialGradient4" spreadMethod="pad">';
                var stopColor = options.fillRadialGradient.colorStop || options.fillRadialGradient.addColorStop
                    || [     // [%, color, opacity]
                        [0, '#ffff00', 0.8],
                        [1, '#ff0000', 0.8]
                    ];

                for (var i = 0, len = stopColor.length; i < len; i++) {
                    var it = stopColor[i];
                    svg += '<stop offset="' + (100 * it[0]) + '%"   stop-color="' + it[1] + '" stop-opacity="' + it[2] + '"/>';
                }
                svg += '</radialGradient></defs>';
                fill = 'url(#myRadialGradient4)';
                stroke = strokeWidth = null;
            }
            size /= 2;
            svg += '<g><circle cx="' + size + '" cy="' + size + '" r="' + size + '" style="';
            if (fill) { svg += ' fill:' + fill + ';'; }
            if (stroke) { svg += ' stroke:"' + stroke + ';'; }
            if (strokeWidth) { svg += ' stroke-width:"' + strokeWidth + ';'; }
            svg += ';" />';
        } else if (type === 'square') {
            svg += '<g><rect width="' + size + '" height="' + size + '" style="';
            if (fill) { svg += ' fill:' + fill + ';'; }
            if (stroke) { svg += ' stroke:' + stroke + ';'; }
            if (strokeWidth) { svg += ' stroke-width:' + 2 * strokeWidth + ';'; }
            svg += '" />';
        }
        if (options.text) {
            var text = options.text;
            svg += '<text x="50%" y="50%" dy="0.4em"';
            for (var key in text) {
                if (key !== 'count') { svg += ' ' + key + '="' + text[key] + '"'; }
            }
            svg += '>' + text.count + '</text>';
        }
        svg += '</g></svg>';
        iconOptions.html = svg;

        return new L.DivIcon(iconOptions);
    },

    toPixels: function(p, tpx, tpy, mInPixel) { // get pixel point	, topLeft
        var px1 = p[0] * mInPixel; 	px1 = (0.5 + px1) << 0;
        var py1 = p[1] * mInPixel;	py1 = (0.5 + py1) << 0;
        return [px1 - tpx, tpy - py1].concat(p.slice(2));
    },

    getPixelPoint: function(attr, coords) {
        var topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys || {},
            style = attr.style || {},
            iconScale = currentStyle.iconScale || 1,
            iconCenter = currentStyle.iconCenter || false,
            sx = currentStyle.sx || style.sx || 4,
            sy = currentStyle.sy || style.sy || 4,
            weight = currentStyle.weight || style.weight || 0,
            iconAnchor = currentStyle.iconAnchor || style.iconAnchor || null,
			px = attr.tpx,
            py = attr.tpy;

        if (!iconCenter && iconAnchor) {
            px1 -= iconAnchor[0];
            py1 -= iconAnchor[1];
        }
        sx *= iconScale;
        sy *= iconScale;
        sx += weight;
        sy += weight;

        var py1 = py - coords[1] * mInPixel,
			px1 = coords[0] * mInPixel - px;

		if (px1 - sx > 256) {
			px1 = (coords[0] - 2 * gmxAPIutils.worldWidthMerc) * mInPixel - px;
		} else if (px1 < -sx) {
			px1 = (coords[0] + 2 * gmxAPIutils.worldWidthMerc) * mInPixel - px;
		}

        return py1 - sy > 256 || px1 - sx > 256 || px1 + sx < 0 || py1 + sy < 0
			? null :
            {
                sx: sx,
                sy: sy,
                px1: (0.5 + px1) << 0,
                py1: (0.5 + py1) << 0
            }
        ;
    },
    getImageData: function(img) {
        if (L.gmxUtil.isIE9 || L.gmxUtil.isIE10) { return null; }
        var canvas = document.createElement('canvas'),
            ww = img.width,
            hh = img.height;

        canvas.width = ww; canvas.height = hh;
        var ptx = canvas.getContext('2d');
        ptx.drawImage(img, 0, 0);
        return ptx.getImageData(0, 0, ww, hh).data;
    },
    DEFAULT_REPLACEMENT_COLOR: 0xff00ff,
    isIE: function(v) {
        return v === gmxAPIutils.getIEversion();
    },
    gtIE: function(v) {
        return v < gmxAPIutils.getIEversion();
    },

    getIEversion: function() {
        var ua = navigator.userAgent || '',
            msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return -1;
    },

    replaceColor: function(img, color, fromData) {
        if (L.gmxUtil.isIE9 || L.gmxUtil.isIE10) { return img; }
        var canvas = document.createElement('canvas'),
            ww = img.width,
            hh = img.height;

        canvas.width = ww; canvas.height = hh;
        var flag = false,
            imageData,
            ptx = canvas.getContext('2d');

        if (typeof color === 'string') {
            color = parseInt('0x' + color.replace(/#/, ''));
        }
        if (color !== this.DEFAULT_REPLACEMENT_COLOR) {
            var r = (color >> 16) & 255,
                g = (color >> 8) & 255,
                b = color & 255;

            if (fromData) {
                imageData = ptx.createImageData(ww, hh);
            } else {
                ptx.drawImage(img, 0, 0);
                imageData = ptx.getImageData(0, 0, ww, hh);
                fromData = imageData.data;
            }
            var toData = imageData.data;
            for (var i = 0, len = fromData.length; i < len; i += 4) {
                if ((fromData[i] === 0xff || fromData[i] === 238)
                    && fromData[i + 1] === 0
                    && fromData[i + 2] === 0xff
                    ) {
                    toData[i] = r;
                    toData[i + 1] = g;
                    toData[i + 2] = b;
                    toData[i + 3] = fromData[i + 3];
                    flag = true;
                }
            }
        }
        if (flag) {
            ptx.putImageData(imageData, 0, 0);
        } else {
            ptx.drawImage(img, 0, 0);
        }
        return canvas;
    },

    drawIconPath: function(path, attr) { // draw iconPath in canvas
        if (!L.Util.isArray(path) || path.length < 3 || !attr.ctx) { return; }
        var trFlag = false,
            ctx = attr.ctx,
            rad = attr.radian;

        if (attr.px || attr.py) { ctx.translate(attr.px || 0, attr.py || 0); trFlag = true; }
        if (!rad && attr.rotateRes) { rad = Math.PI + gmxAPIutils.degRad(attr.rotateRes); }
        if (rad) { ctx.rotate(rad); trFlag = true; }
        ctx.moveTo(path[0], path[1]);
        for (var i = 2, len = path.length; i < len; i += 2) {
            ctx.lineTo(path[i], path[i + 1]);
        }
        if (trFlag) { ctx.setTransform(1, 0, 0, 1, 0, 0); }
    },

    pointToCanvas: function(attr) { // Точку в canvas
        var gmx = attr.gmx,
			topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            pointAttr = attr.pointAttr,
            style = attr.style || {},
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            iconScale = currentStyle.iconScale || 1,
            image = currentStyle.image,
            sx = pointAttr.sx,
            sy = pointAttr.sy,
            px1 = pointAttr.px1,
            py1 = pointAttr.py1,
            px1sx = px1,
            py1sy = py1,
            ctx = attr.ctx;

        if (currentStyle.type === 'image') {
            sx = style.sx;
            sy = style.sy;
            image = style.image;
        }
        if (currentStyle.iconCenter) {
            px1sx -= sx / 2;
            py1sy -= sy / 2;
        } else if (style.type === 'circle') {
            px1 += sx / 2;
            py1 += sy / 2;
        }
        if (currentStyle.iconPath) {
            attr.px = px1;
            attr.py = py1;
            attr.rotateRes = currentStyle.rotate || 0;
        }
        if (image) {
            if ('iconColor' in currentStyle && !L.gmxUtil.isIE11) {
                image = this.replaceColor(image, currentStyle.iconColor, attr.imageData);
            }
            style.rotateRes = currentStyle.rotate || 0;
            if ('opacity' in style) { ctx.globalAlpha = currentStyle.opacity || style.opacity; }
            if (gmx.transformFlag) {
//						topLeft = attr.topLeft,
				ctx.setTransform(mInPixel, 0, 0, mInPixel, -attr.tpx, attr.tpy);
                ctx.drawImage(image, px1, -py1, sx, sy);
                ctx.setTransform(mInPixel, 0, 0, -mInPixel, -attr.tpx, attr.tpy);
            } else {
				if (iconScale !== 1) {
					sx *= iconScale;
					sy *= iconScale;
					px1 = pointAttr.px1;
					py1 = pointAttr.py1;
					px1sx = px1;
					py1sy = py1;
					if (currentStyle.iconCenter) {
						px1sx -= sx / 2;
						py1sy -= sy / 2;
					}
				}
				if (style.rotateRes) {
					ctx.translate(px1, py1);
					ctx.rotate(gmxAPIutils.degRad(style.rotateRes));
					ctx.translate(-px1, -py1);
					ctx.drawImage(image, px1sx, py1sy, sx, sy);
					ctx.setTransform(1, 0, 0, 1, 0, 0);
				} else {
					ctx.drawImage(image, px1sx, py1sy, sx, sy);
				}
            }
            if ('opacity' in style) { ctx.globalAlpha = 1; }
        } else if (style.fillColor || currentStyle.fillRadialGradient) {
            ctx.beginPath();
            if (currentStyle.iconPath) {
                gmxAPIutils.drawIconPath(currentStyle.iconPath, attr);
            } else if (style.type === 'circle' || currentStyle.fillRadialGradient) {
                var circle = style.iconSize / 2;
                if (currentStyle.fillRadialGradient) {
                    var rgr = currentStyle.fillRadialGradient;
                    circle = rgr.r2 * iconScale;
                    var radgrad = ctx.createRadialGradient(px1 + rgr.x1, py1 + rgr.y1, rgr.r1 * iconScale, px1 + rgr.x2, py1 + rgr.y2, circle);
                    for (var i = 0, len = rgr.addColorStop.length; i < len; i++) {
                        var arr = rgr.addColorStop[i];
                        radgrad.addColorStop(arr[0], arr[1]);
                    }
                    ctx.fillStyle = radgrad;
                }
                ctx.arc(px1, py1, circle, 0, 2 * Math.PI);
            } else {
                ctx.fillRect(px1sx, py1sy, sx, sy);
            }
            ctx.fill();
        }
        if (currentStyle.strokeStyle) {
            ctx.beginPath();
            if (currentStyle.iconPath) {
                gmxAPIutils.drawIconPath(currentStyle.iconPath, attr);
            } else if (style.type === 'circle') {
                ctx.arc(px1, py1, style.iconSize / 2, 0, 2 * Math.PI);
            } else {
                ctx.strokeRect(px1sx, py1sy, sx, sy);
            }
            ctx.stroke();
        }
    },
    lineToCanvasAsIcon: function(pixels, attr) {  // add line(as icon) to canvas
        var len = pixels.length,
            ctx = attr.ctx,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            iconPath = currentStyle.iconPath;

        if (len > 0) {
            if ('getLineDash' in ctx && ctx.getLineDash().length > 0) {
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            for (var i = 0, p; i < len; i++) {
                p = pixels[i];
                gmxAPIutils.drawIconPath(iconPath, {ctx: ctx, px: p.x, py: p.y, radian: p.radian});
            }
            if (currentStyle.strokeStyle) {
                ctx.stroke();
            }
            if (currentStyle.fillStyle) {
                ctx.fill();
            }
        }
    },
    lineToCanvas: function(attr) {  // Lines in canvas
        var topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            coords = attr.coords,
            ctx = attr.ctx,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            pixels = currentStyle.iconPath ? [] : null;

        var lastX = null, lastY = null;
        ctx.beginPath();
        for (var i = 0, len = coords.length; i < len; i++) {
            var p = gmxAPIutils.toPixels(coords[i], attr.tpx, attr.tpy, mInPixel, attr.topLeft),
                x = p[0],
                y = p[1];
            if (lastX !== x || lastY !== y) {
                if (pixels) { pixels.push({x: x, y: y, radian: p[2]}); }
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                lastX = x; lastY = y;
            }
        }
        ctx.stroke();
        return pixels;
    },

    getCoordsPixels: function(attr) {
        var gmx = attr.gmx,
            coords = attr.coords,
            hiddenLines = attr.hiddenLines || [],
            pixels = [],
            hidden = [],
            hiddenFlag = false,
            hash = {
                gmx: gmx,
				topLeft: attr.topLeft,
                tpx: attr.tpx,
                tpy: attr.tpy,
                coords: null,
                hiddenLines: null
            };
        for (var j = 0, len = coords.length; j < len; j++) {
            var coords1 = coords[j],
                hiddenLines1 = hiddenLines[j] || [],
                pixels1 = [], hidden1 = [];
            for (var j1 = 0, len1 = coords1.length; j1 < len1; j1++) {
                hash.coords = coords1[j1];
                hash.hiddenLines = hiddenLines1[j1] || [];
                var res = gmxAPIutils.getRingPixels(hash);
                pixels1.push(res.coords);
                hidden1.push(res.hidden);
                if (res.hidden) {
                    hiddenFlag = true;
                }
            }
            pixels.push(pixels1);
            hidden.push(hidden1);
        }
        return {coords: pixels, hidden: hiddenFlag ? hidden : null, z: attr.topLeft.tilePoint.z};
    },

    getRingPixels: function(attr) {
        if (attr.coords.length === 0) { return null; }
        var topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            coords = attr.coords,
            hiddenLines = attr.hiddenLines || null,
			// topLeft = attr.topLeft,
            px = attr.tpx,
            py = attr.tpy,
            cnt = 0, cntHide = 0,
            lastX = null, lastY = null,
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            pixels = [], hidden = [];
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var lineIsOnEdge = false;
            if (hiddenLines && i === hiddenLines[cntHide]) {
                lineIsOnEdge = true;
                cntHide++;
            }
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                x1 = Math.round(c[0] * mInPixel), y1 = Math.round(c[1] * mInPixel),
                x2 = Math.round(x1 - px), y2 = Math.round(py - y1);

            if (lastX !== x2 || lastY !== y2) {
                lastX = x2; lastY = y2;
                if (lineIsOnEdge) {
                    hidden.push(cnt);
                }
                pixels[cnt++] = x1;
                pixels[cnt++] = y1;
            }
        }
        return {coords: pixels, hidden: hidden.length ? hidden : null};
    },

    polygonToCanvas: function(attr) {       // Polygons in canvas
        if (attr.coords.length === 0) { return null; }
        var hiddenLines = attr.hiddenLines || null,
            coords = attr.coords,
            ctx = attr.ctx,
			// topLeft = attr.topLeft,
            px = attr.tpx,
            py = attr.tpy,
            cnt = 0, cntHide = 0,
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            lastX = null, lastY = null;

        ctx.beginPath();
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                x = Math.round(c[0] - px),
                y = Math.round(py - c[1]),
                lineIsOnEdge = false,
				lineCap = 'round';
// console.log('px', x, y, px, py, attr);
            if (hiddenLines && i === hiddenLines[cntHide]) {
                lineIsOnEdge = true;
				lineCap = 'butt';
                cntHide++;
            }
			if (ctx.lineCap !== lineCap) { ctx.lineCap = lineCap; }

            if (lastX !== x || lastY !== y) {
                ctx[(lineIsOnEdge ? 'moveTo' : 'lineTo')](x, y);
                lastX = x; lastY = y;
                cnt++;
            }
        }
        if (cnt === 1) { ctx.lineTo(lastX + 1, lastY); }
        ctx.stroke();
    },

    polygonToCanvasFill: function(attr) {     // Polygon fill
        if (attr.coords.length < 3) { return; }
        var coords = attr.coords,
			// topLeft = attr.topLeft,
            px = attr.tpx,
            py = attr.tpy,
            vectorSize = 1,
            ctx = attr.ctx;

        ctx.lineWidth = 0;
        if (typeof coords[0] === 'number') {
            vectorSize = 2;
            ctx.moveTo(Math.round(coords[0] - px), Math.round(py - coords[1]));
        } else {
            ctx.moveTo(Math.round(coords[0][0] - px), Math.round(py - coords[0][1]));
        }
        for (var i = vectorSize, len = coords.length; i < len; i += vectorSize) {
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]];
            ctx.lineTo(Math.round(c[0] - px), Math.round(py - c[1]));
        }
    },

    isPatternNode: function(it) {
        return it instanceof HTMLCanvasElement || it instanceof HTMLImageElement;
    },
    labelCanvasContext: null,    // 2dContext canvas for Label size
    getLabelWidth: function(txt, style) {   // Get label size Label
        if (style) {
            if (!gmxAPIutils.labelCanvasContext) {
                var canvas = document.createElement('canvas');
                canvas.width = canvas.height = 512;
                gmxAPIutils.labelCanvasContext = canvas.getContext('2d');
            }
            var ptx = gmxAPIutils.labelCanvasContext;
            ptx.clearRect(0, 0, 512, 512);

            if (ptx.font !== style.font) { ptx.font = style.font; }
            //if (ptx.strokeStyle !== style.strokeStyle) { ptx.strokeStyle = style.strokeStyle; }
            if (ptx.fillStyle !== style.fillStyle) { ptx.fillStyle = style.fillStyle; }
			var arr = txt.split('\n');
            return arr.map(function(it) {
				ptx.fillText(it, 0, 0);
				return [it, ptx.measureText(it).width];
			});
        }
        return 0;
    },
    setLabel: function(ctx, txt, coord, style) {
        var x = coord[0],
            y = coord[1];

        if (ctx.shadowColor !== style.strokeStyle) { ctx.shadowColor = style.strokeStyle; }
        if (ctx.shadowBlur !== style.shadowBlur) { ctx.shadowBlur = style.shadowBlur; }
        if (ctx.font !== style.font) { ctx.font = style.font; }
		if (L.Browser.gecko) {	// Bug with perfomance in FireFox
			if (ctx.strokeStyle !== style.fillStyle) { ctx.strokeStyle = style.fillStyle; }
		} else {
			if (ctx.strokeStyle !== style.strokeStyle) { ctx.strokeStyle = style.strokeStyle; }
			if (ctx.fillStyle !== style.fillStyle) { ctx.fillStyle = style.fillStyle; }
		}
        ctx.strokeText(txt, x, y);
		if (!L.Browser.gecko) {
			ctx.fillText(txt, x, y);
		}
    },
    worldWidthFull: 40075016.685578496,
    // worldWidthMerc: gmxAPIutils.worldWidthFull / 2,
    rMajor: 6378137.000,
    degRad: function(ang) {
        return ang * (Math.PI / 180.0);
    },

    distVincenty: function(lon1, lat1, lon2, lat2) {
        var p1 = {
            lon: gmxAPIutils.degRad(lon1),
            lat: gmxAPIutils.degRad(lat1)
        },
            p2 = {
            lon: gmxAPIutils.degRad(lon2),
            lat: gmxAPIutils.degRad(lat2)
        },
            a = gmxAPIutils.rMajor,
            b = 6356752.3142,
            f = 1 / 298.257223563;  // WGS-84 ellipsiod

        var L1 = p2.lon - p1.lon,
            U1 = Math.atan((1 - f) * Math.tan(p1.lat)),
            U2 = Math.atan((1 - f) * Math.tan(p2.lat)),
            sinU1 = Math.sin(U1), cosU1 = Math.cos(U1),
            sinU2 = Math.sin(U2), cosU2 = Math.cos(U2),
            lambda = L1,
            lambdaP = 2 * Math.PI,
            iterLimit = 20;
        while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
                var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda),
                    sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
                    (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
                if (sinSigma === 0) { return 0; }
                var cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda,
                    sigma = Math.atan2(sinSigma, cosSigma),
                    sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma,
                    cosSqAlpha = 1 - sinAlpha * sinAlpha,
                    cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
                if (isNaN(cos2SigmaM)) { cos2SigmaM = 0; }
                var C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
                lambdaP = lambda;
                lambda = L1 + (1 - C) * f * sinAlpha *
                    (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
        }
        if (iterLimit === 0) { return NaN; }

        var uSq = cosSqAlpha * ((a * a) / (b * b) - 1),
        //var uSq = cosSqAlpha * (a * a - b * b) / (b*b),
            A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq))),
            B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq))),
            deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
                B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM))),
            s = b * A * (sigma - deltaSigma);

        //s = s.toFixed(3);
        return s;
    },

    _vfi: function(fi, a, b) {
        return [
            -Math.cos(fi) * Math.sin(a) + Math.sin(fi) * Math.sin(b) * Math.cos(a),
            Math.cos(fi) * Math.cos(a) + Math.sin(fi) * Math.sin(b) * Math.sin(a),
            -Math.sin(fi) * Math.cos(b)
        ];
    },

    getCircleLatLngs: function(latlng, r) {   // Get latlngs for circle
        var x = 0, y = 0;
        if (latlng instanceof L.LatLng) {
            x = latlng.lng;
            y = latlng.lat;
        } else if (L.Util.isArray(latlng)) {
            x = latlng[1];
            y = latlng[0];
        } else {
            return null;
        }

        var rad = Math.PI / 180,
            a = x * rad,  //долгота центра окружности в радианах
            b = y * rad,  //широта центра окружности в радианах
            R = gmxAPIutils.rMajor,
            d = R * Math.sin(r / R),
            Rd = R * Math.cos(r / R),
            VR = [
                Rd * Math.cos(b) * Math.cos(a),
                Rd * Math.cos(b) * Math.sin(a),
                Rd * Math.sin(b)
            ],
            latlngs = [];

        for (var fi = 0, limit = 2 * Math.PI + 0.000001; fi < limit; fi += rad) {
            var v = gmxAPIutils._vfi(fi, a, b),
                circle = [];
            for (var i = 0; i < 3; i++) { circle[i] = VR[i] + d * v[i]; }

            var t2 = Math.acos(circle[0] / Math.sqrt(circle[0] * circle[0] + circle[1] * circle[1])) / rad;
            if (circle[1] < 0) { t2 = -t2; }

            if (t2 < x - 180) {
                t2 += 360;
            } else if (t2 > x + 180) {
                t2 -= 360;
            }
            latlngs.push([Math.asin(circle[2] / R) / rad, t2]);
        }
        return latlngs;
    },

    /** Get point coordinates from string
     * @memberof L.gmxUtil
     * @param {String} text - point coordinates in following formats:
         <br/><i>55.74312, 37.61558</i>
         <br/><i>55°44'35" N, 37°36'56" E</i>
         <br/><i>4187347, 7472103</i>
         <br/><i>4219783, 7407468 (EPSG:3395)</i>
         <br/><i>4219783, 7442673 (EPSG:3857)</i>
     * @return {Array} [lat, lng] or null
    */
    parseCoordinates: function(text) {
        var crs = null,
            regex = /\(EPSG:(\d+)\)/g,
            t = regex.exec(text);

        if (t) {
            crs = t[1];
            text = text.replace(regex, '');
        }

        if (text.match(/[йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮqrtyuiopadfghjklzxcvbmQRTYUIOPADFGHJKLZXCVBM_:]/)) {
            return null;
        }

        //there should be a separator in the string (exclude strings like "11E11")
        if (text.indexOf(' ') === -1 && text.indexOf(',') === -1) {
            return null;
        }

        if (text.indexOf(' ') !== -1) {
            text = text.replace(/,/g, '.');
        }
        var results = [];
/*eslint-disable no-useless-escape */
        regex = /(-?\d+(\.\d+)?)([^\d\-]*)/g;
/*eslint-enable */
        t = regex.exec(text);
        while (t) {
            results.push(t[1]);
            t = regex.exec(text);
        }
        if (results.length < 2) {
            return null;
        }
        var ii = Math.floor(results.length / 2),
            y = 0,
            mul = 1,
            i;
        for (i = 0; i < ii; i++) {
            y += parseFloat(results[i]) * mul;
            mul /= 60;
        }
        var x = 0;
        mul = 1;
        for (i = ii; i < results.length; i++) {
            x += parseFloat(results[i]) * mul;
            mul /= 60;
        }

        if (Math.max(text.indexOf('N'), text.indexOf('S')) > Math.max(text.indexOf('E'), text.indexOf('W'))) {
            t = x;
            x = y;
            y = t;
        }

        var pos;
        if (crs == 3857) {
            pos = L.CRS.Simple.unproject(new L.Point(x, y));
            x = pos.lng;
            y = pos.lat;
        }
        if (Math.abs(x) > 180 || Math.abs(y) > 180) {
            pos = L.Projection.Mercator.unproject(new L.Point(y, x));
            x = pos.lng;
            y = pos.lat;
        }

        if (text.indexOf('W') !== -1) {
            x = -x;
        }

        if (text.indexOf('S') !== -1) {
            y = -y;
        }
        return [y, x];
    },

	pad2: function(t) {
		return (t >= 0 && t < 10) ? ('0' + t) : ('' + t);
	},

	trunc: function(x) {
		return ('' + (Math.round(10000000 * x) / 10000000 + 0.00000001)).substring(0, 9);
	},

	formatDegrees: function(angle, format) {
		angle = Math.round(10000000 * angle) / 10000000 + 0.00000001;
		var a1 = Math.floor(angle),
			a2 = Math.floor(60 * (angle - a1)),
			a3 = gmxAPIutils.toPrecision(3600 * (angle - a1 - a2 / 60), 2),
			st = gmxAPIutils.pad2(a1) + '°';

		if (format ===  undefined ) { format = 2; }
		if (format > 0) {
			st += gmxAPIutils.pad2(a2) + '\'';
		}
		if (format > 1) {
			st += gmxAPIutils.pad2(a3) + '"';
		}
		return st;
	},

    /** Get point coordinates in string format with degrees
     * @memberof L.gmxUtil
     * @param {Number} lng - point longitude
     * @param {Number} lat - point latitude
     * @return {String} point coordinates in string format with degrees
    */
	latLonFormatCoordinates: function(x, y) {
        x %= 360;
        if (x > 180) { x -= 360; }
        else if (x < -180) { x += 360; }
		return  gmxAPIutils.formatDegrees(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
			gmxAPIutils.formatDegrees(Math.abs(x)) + (x > 0 ? ' E' : ' W');
	},
	latLonToString: function(x, y, prec) {
        x %= 360;
        if (x > 180) { x -= 360; }
        else if (x < -180) { x += 360; }
		if (prec) {
			x = gmxAPIutils.toPrecision(x, prec);
			y = gmxAPIutils.toPrecision(y, prec);
		}
		return  y + (y > 0 ? ' N, ' : ' S, ') +
			x + (x > 0 ? ' E' : ' W');
	},

	formatCoordinates: function(x, y) {
		return  gmxAPIutils.latLonFormatCoordinates(x, y);
	},

    /** Get point coordinates in string format
     * @memberof L.gmxUtil
     * @param {Number} lng - point longitude
     * @param {Number} lat - point latitude
     * @return {String} point coordinates in string format
    */
	latLonFormatCoordinates2: function(x, y) {
		return  gmxAPIutils.trunc(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
			gmxAPIutils.trunc(Math.abs(x)) + (x > 0 ? ' E' : ' W');
	},
	formatCoordinates2: function(x, y) {
		return  gmxAPIutils.latLonFormatCoordinates2(x, y);
	},

    getPixelScale: function(zoom) {
        return 256 / gmxAPIutils.tileSizes[zoom];
    },

    forEachPoint: function(coords, callback) {
        if (!coords || coords.length === 0) { return []; }
        var i, len, ret = [];
        if (!coords[0].length) {
            if (coords.length === 2) {
                return callback(coords);
            } else {
                for (i = 0, len = coords.length / 2; i < len; i++) {
                    ret.push(callback([coords[i * 2], coords[i * 2 + 1]]));
                }
            }
        } else {
            for (i = 0, len = coords.length; i < len; i++) {
                if (typeof coords[i] !== 'string') {
                    ret.push(gmxAPIutils.forEachPoint(coords[i], callback));
                }
            }
        }
        return ret;
    },
/*
	getQuicklookPoints: function(coord) { // получить 4 точки привязки снимка
		var d1 = Number.MAX_VALUE;
		var d2 = Number.MAX_VALUE;
		var d3 = Number.MAX_VALUE;
		var d4 = Number.MAX_VALUE;
		var x1, y1, x2, y2, x3, y3, x4, y4;
		this.forEachPoint(coord, function(p) {
			var x = p[0];
			var y = p[1];
			if ((x - y) < d1) {
				d1 = x - y;
				x1 = p[0];
				y1 = p[1];
			}
			if ((-x - y) < d2) {
				d2 = -x - y;
				x2 = p[0];
				y2 = p[1];
			}
			if ((-x + y) < d3) {
				d3 = -x + y;
				x3 = p[0];
				y3 = p[1];
			}
			if ((x + y) < d4) {
				d4 = x + y;
				x4 = p[0];
				y4 = p[1];
			}
		});
		return {x1: x1, y1: y1, x2: x2, y2: y2, x3: x3, y3: y3, x4: x4, y4: y4};
	},
*/
    getItemCenter: function(item, geoItems) {
        var bounds = item.bounds,
            min = bounds.min, max = bounds.max,
            type = item.type,
            isPoint = type === 'POINT' || type === 'MULTIPOINT',
            center = isPoint ? [min.x, min.y] : [(min.x + max.x) / 2, (min.y + max.y) / 2];

        if (type === 'MULTIPOLYGON') {
			return center;
		} else if (type === 'POLYGON') {
            for (var i = 0, len = geoItems.length; i < len; i++) {
                var it = geoItems[i],
                    geom = it.geo,
                    coords = geom.coordinates,
                    dataOption = it.dataOption,
                    bbox = dataOption.bounds;

                if (bbox.contains(center)) {
                    if (geom.type === 'POLYGON') { coords = [coords]; }
                    for (var j = 0, len1 = coords.length; j < len1; j++) {
                        for (var j1 = 0, coords1 = coords[j], len2 = coords1.length; j1 < len2; j1++) {
                            var pt = gmxAPIutils.getHSegmentsInPolygon(center[1], coords1[j1]);
                            if (pt) {
                                return pt.max.center;
                            }
                        }
                    }
                }
            }
        } else if (type === 'POINT' || type === 'MULTIPOINT') {
            return center;
        } else if (type === 'LINESTRING' || type === 'MULTILINESTRING') {
            return center;
        }
        return null;
    },

    getHSegmentsInPolygon: function(y, poly) {
        var s = [], i, len, out,
            vectorSize = 1,
            p1 = poly[0];

        if (typeof poly[0] === 'number') {
            vectorSize = 2;
            p1 = [poly[0], poly[1]];
        }
        var isGt1 = y > p1[1];
        for (i = vectorSize, len = poly.length; i < len; i += vectorSize) {
            var p2 = vectorSize === 1 ? poly[i] : [poly[i], poly[i + 1]],
                isGt2 = y > p2[1];
            if (isGt1 !== isGt2) {
                s.push(p1[0] - (p1[0] - p2[0]) * (p1[1] - y) / (p1[1] - p2[1]));
            }
            p1 = p2;
            isGt1 = isGt2;
        }
        len = s.length;
        if (len) {
            s = s.sort();
            var max = 0,
                index = -1;
            for (i = 1; i < len; i += 2) {
                var j = i - 1,
                    d = Math.abs(s[i] - s[j]);
                if (d > max) {
                    max = d;
                    index = j;
                }
            }
            out = {
                y: y,
                segArr: s,
                max: {
                    width: max,
                    center: [(s[index] + s[index + 1]) / 2, y]
                }
            };
        }
        return out;
    },

    isPointInPolygonArr: function(chkPoint, coords) { // Проверка точки на принадлежность полигону в виде массива
        var isIn = false,
            x = chkPoint[0],
            y = chkPoint[1],
            vectorSize = 1,
            p1 = coords[0];

        if (typeof coords[0] === 'number') {
            vectorSize = 2;
            p1 = [coords[0], coords[1]];
        }

        for (var i = vectorSize, len = coords.length; i < len; i += vectorSize) {
            var p2 = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                xmin = Math.min(p1[0], p2[0]),
                xmax = Math.max(p1[0], p2[0]),
                ymax = Math.max(p1[1], p2[1]);
            if (x > xmin && x <= xmax && y <= ymax && p1[0] !== p2[0]) {
                var xinters = (x - p1[0]) * (p2[1] - p1[1]) / (p2[0] - p1[0]) + p1[1];
                if (p1[1] === p2[1] || y <= xinters) { isIn = !isIn; }
            }
            p1 = p2;
        }
        return isIn;
    },

    /** Is point in polygon with holes
     * @memberof L.gmxUtil
     * @param {chkPoint} chkPoint - point in [x, y] format
     * @param {coords} coords - polygon from geoJSON coordinates data format
     * @return {Boolean} true if polygon contain chkPoint
    */
    isPointInPolygonWithHoles: function(chkPoint, coords) {
        if (!gmxAPIutils.isPointInPolygonArr(chkPoint, coords[0])) { return false; }
        for (var j = 1, len = coords.length; j < len; j++) {
            if (gmxAPIutils.isPointInPolygonArr(chkPoint, coords[j])) { return false; }
        }
        return true;
    },

    /** Is polygon clockwise
     * @memberof L.gmxUtil
     * @param {ring} ring - ring from geoJSON coordinates data format
     * @return {Boolean} true if ring is clockwise
    */
    isClockwise: function(ring) {
        var area = 0;
        for (var i = 0, j, len = ring.length; i < len; i++) {
            j = (i + 1) % len;
            area += ring[i][0] * ring[j][1];
            area -= ring[j][0] * ring[i][1];
        }
        return (area < 0);
    },

    isPointInPolyLine: function(chkPoint, lineHeight, coords, hiddenLines) {
        // Проверка точки(с учетом размеров) на принадлежность линии
        var dx = chkPoint[0], dy = chkPoint[1],
            nullPoint = {x: dx, y: dy},
            minx = dx - lineHeight, maxx = dx + lineHeight,
            miny = dy - lineHeight, maxy = dy + lineHeight,
            cntHide = 0;

        lineHeight *= lineHeight;
        for (var i = 1, len = coords.length; i < len; i++) {
            if (hiddenLines && i === hiddenLines[cntHide]) {
                cntHide++;
            } else {
                var p1 = coords[i - 1], p2 = coords[i],
                    x1 = p1[0], y1 = p1[1],
                    x2 = p2[0], y2 = p2[1];

                if (!(Math.max(x1, x2) < minx
                    || Math.min(x1, x2) > maxx
                    || Math.max(y1, y2) < miny
                    || Math.min(y1, y2) > maxy)) {
                    var sqDist = L.LineUtil._sqClosestPointOnSegment(nullPoint, {x: x1, y: y1}, {x: x2, y: y2}, true);
                    if (sqDist < lineHeight) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    isPointInLines: function (attr) {
        var arr = attr.coords,
            point = attr.point,
            delta = attr.delta,
            boundsArr = attr.boundsArr,
            hidden = attr.hidden;
        for (var j = 0, len = arr.length, flag = false; j < len; j++) {
            flag = boundsArr[j] ? boundsArr[j].contains(point) : true;
            if (flag
                && gmxAPIutils.isPointInPolyLine(point, delta, arr[j], hidden ? hidden[j] : null)
            ) {
               return true;
            }
        }
        return false;
    },

    /** Get length
     * @memberof L.gmxUtil
     * @param {Array} latlngs array
     * @param {Boolean} isMerc - true if coordinates in Mercator
     * @param {Boolean} isWebMerc - true if coordinates in WebMercator	- TODO
     * @return {Number} length
    */
    getLength: function(latlngs, isMerc) {
        var length = 0;
        if (latlngs && latlngs.length) {
            var lng = false,
                lat = false;

            isMerc = isMerc === undefined || isMerc;
            latlngs.forEach(function(latlng) {
                if (L.Util.isArray(latlng)) {
                    if (L.Util.isArray(latlng[0])) {
                        length += gmxAPIutils.getLength(latlng, isMerc);
                        return length;
                    } else if (isMerc) {   // From Mercator array
                        latlng = L.Projection.Mercator.unproject({x: latlng[0], y: latlng[1]});
                    }
                }
                if (lng !== false && lat !== false) {
                    length += parseFloat(gmxAPIutils.distVincenty(lng, lat, latlng.lng, latlng.lat));
                }
                lng = latlng.lng;
                lat = latlng.lat;
            });
        }
        return length;
    },

    /** Get prettify length
     * @memberof L.gmxUtil
     * @param {Number} area
     * @param {String} type: ('km', 'm', 'nm')
     * @return {String} prettify length
    */
    prettifyDistance: function(length, type) {
        var km = ' ' + L.gmxLocale.getText('units.km');
        if (type === 'nm') {
            return (Math.round(0.539956803 * length) / 1000) + ' ' + L.gmxLocale.getText('units.nm');
        } else if (type === 'km') {
            return (Math.round(length) / 1000) + km;
        } else if (length < 2000 || type === 'm') {
            return Math.round(length) + ' ' + L.gmxLocale.getText('units.m');
        } else if (length < 200000) {
            return (Math.round(length / 10) / 100) + km;
        }
        return Math.round(length / 1000) + km;
    },

    /** Get geoJSON length
     * @memberof L.gmxUtil
     * @param {Object} geoJSON - object in <a href="http://geojson.org/geojson-spec.html">GeoJSON format</a>
     * @return {Number} length
    */
    geoJSONGetLength: function(geoJSON) {
        var out = 0,
            i, j, len, len1, coords;

        if (geoJSON.type === 'GeometryCollection') {
            out += geoJSON.geometries.forEach(gmxAPIutils.geoJSONGetLength);
        } else if (geoJSON.type === 'Feature') {
            out += gmxAPIutils.geoJSONGetLength(geoJSON.geometry);
        } else if (geoJSON.type === 'FeatureCollection') {
            out += geoJSON.features.forEach(gmxAPIutils.geoJSONGetLength);
        } if (geoJSON.type === 'LineString' || geoJSON.type === 'MultiLineString') {
            coords = geoJSON.coordinates;
            if (geoJSON.type === 'LineString') { coords = [coords]; }
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.getRingLength(coords[i]);
            }
        } if (geoJSON.type === 'Polygon' || geoJSON.type === 'MultiPolygon') {
            coords = geoJSON.coordinates;
            if (geoJSON.type === 'Polygon') { coords = [coords]; }
            for (i = 0, len = coords.length; i < len; i++) {
                for (j = 0, len1 = coords[i].length; j < len1; j++) {
                    out += gmxAPIutils.getRingLength(coords[i][j]);
                }
            }
        }
        return out;
    },

    getRingLength: function(coords) {
        var length = 0;
        if (coords && coords.length) {
            var lng = false, lat = false;
            coords.forEach(function(lnglat) {
                if (L.Util.isArray(lnglat)) {
                    if (lnglat.length > 2) {
                        length += gmxAPIutils.getRingLength(lnglat);
                        return length;
                    }
                }
                if (lng !== false && lat !== false) {
                    length += parseFloat(gmxAPIutils.distVincenty(lng, lat, lnglat[0], lnglat[1]));
                }
                lng = lnglat[0];
                lat = lnglat[1];
            });
        }
        return length;
    },

    /** Get geoJSON area
     * @memberof L.gmxUtil
     * @param {Object} geojson - object in <a href="http://geojson.org/geojson-spec.html">GeoJSON format</a>
     * @return {Number} area in square meters
    */
    geoJSONGetArea: function(geoJSON) {
        var out = 0;

        if (geoJSON.type === 'GeometryCollection') {
            out += geoJSON.geometries.forEach(gmxAPIutils.geoJSONGetArea);
        } else if (geoJSON.type === 'Feature') {
            out += gmxAPIutils.geoJSONGetArea(geoJSON.geometry);
        } else if (geoJSON.type === 'FeatureCollection') {
            out += geoJSON.features.forEach(gmxAPIutils.geoJSONGetArea);
        } if (geoJSON.type === 'Polygon' || geoJSON.type === 'MultiPolygon') {
            var coords = geoJSON.coordinates;
            if (geoJSON.type === 'Polygon') { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.getRingArea(coords[i][0]);
                for (var j = 1, len1 = coords[i].length; j < len1; j++) {
                    out -= gmxAPIutils.getRingArea(coords[i][j]);
                }
            }
        }
        return out;
    },

    geoJSONGetLatLng: function(geoJSON) {
        if (geoJSON.type === 'Feature') {
            return gmxAPIutils.geoJSONGetLatLng(geoJSON.geometry);
        } else if (geoJSON.type === 'Point') {
            return L.latLng(geoJSON.coordinates[1], geoJSON.coordinates[0]);
        } else {
            throw new Error('cannot get ' + geoJSON.type + ' latLng');
        }
    },

    getRingArea: function(coords) {
        var area = 0;
        for (var i = 0, len = coords.length; i < len; i++) {
            var ipp = (i === (len - 1) ? 0 : i + 1),
                p1 = coords[i], p2 = coords[ipp];
            area += p1[0] * Math.sin(gmxAPIutils.degRad(p2[1])) - p2[0] * Math.sin(gmxAPIutils.degRad(p1[1]));
        }
        var out = Math.abs(area * gmxAPIutils.lambertCoefX * gmxAPIutils.lambertCoefY / 2);
        return out;
    },

    /** Get area
     * @memberof L.gmxUtil
     * @param {Array} L.latLng array
     * @return {Number} area in square meters
    */
    getArea: function(arr) {
        var area = 0;
        for (var i = 0, len = arr.length; i < len; i++) {
            var ipp = (i === (len - 1) ? 0 : i + 1),
                p1 = arr[i], p2 = arr[ipp];
            area += p1.lng * Math.sin(gmxAPIutils.degRad(p2.lat)) - p2.lng * Math.sin(gmxAPIutils.degRad(p1.lat));
        }
        return Math.abs(area * gmxAPIutils.lambertCoefX * gmxAPIutils.lambertCoefY / 2);
    },

    /** Get prettified size of area
     * @memberof L.gmxUtil
     * @param {Number} area in square meters
     * @param {String} type: ('km2', 'ha', 'm2')
     * @return {String} prettified area
    */
    prettifyArea: function(area, type) {
        var km2 = ' ' + L.gmxLocale.getText('units.km2');

        if (type === 'km2') {
            return ('' + (Math.round(area / 100) / 10000)) + km2;
        } else if (type === 'ha') {
            return ('' + (Math.round(area / 100) / 100)) + ' ' + L.gmxLocale.getText('units.ha');
        } else if (area < 100000 || type === 'm2') {
            return Math.round(area) + ' ' + L.gmxLocale.getText('units.m2');
        } else if (area < 3000000) {
            return ('' + (Math.round(area / 1000) / 1000)).replace('.', ',') + km2;
        } else if (area < 30000000) {
            return ('' + (Math.round(area / 10000) / 100)).replace('.', ',') + km2;
        } else if (area < 300000000) {
            return ('' + (Math.round(area / 100000) / 10)).replace('.', ',') + km2;
        }
        return (Math.round(area / 1000000)) + km2;
    },

    geoLength: function(geom) {
        var ret = 0,
            type = geom.type;
        if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            for (var i = 0, len = geom.coordinates.length; i < len; i++) {
                ret += gmxAPIutils.geoLength({type: 'LINESTRING', coordinates: geom.coordinates[i]});
            }
            return ret;
        } else if (type === 'LINESTRING' || type === 'LineString') {
            ret = gmxAPIutils.getLength(geom.coordinates);
        }
        return ret;
    },

    /** Converts Geomixer geometry to geoJSON geometry
     * @memberof L.gmxUtil
     * @param {Object} geometry - Geomixer geometry
     * @param {Boolean} mercFlag - true if coordinates in Mercator
     * @param {Boolean} webmercFlag - true if coordinates in WebMercator
     * @return {Object} geoJSON geometry
    */
    geometryToGeoJSON: function (geom, mercFlag, webmercFlag) {
        if (!geom) {
            return null;
        }

        var type = geom.type === 'MULTIPOLYGON' ? 'MultiPolygon'
                : geom.type === 'POLYGON' ? 'Polygon'
                : geom.type === 'MULTILINESTRING' ? 'MultiLineString'
                : geom.type === 'LINESTRING' ? 'LineString'
                : geom.type === 'MULTIPOINT' ? 'MultiPoint'
                : geom.type === 'POINT' ? 'Point'
                : geom.type,
            coords = geom.coordinates;
        if (mercFlag) {
            coords = gmxAPIutils.coordsFromMercator(type, coords, webmercFlag);
        }
        return {
            type: type,
            coordinates: coords
        };
    },

    convertGeometry: function (geom, fromMerc, webmercFlag) {
        var type = geom.type === 'MULTIPOLYGON' ? 'MultiPolygon'
                : geom.type === 'POLYGON' ? 'Polygon'
                : geom.type === 'MULTILINESTRING' ? 'MultiLineString'
                : geom.type === 'LINESTRING' ? 'LineString'
                : geom.type === 'MULTIPOINT' ? 'MultiPoint'
                : geom.type === 'POINT' ? 'Point'
                : geom.type,
            coords = geom.coordinates;
        if (fromMerc) {
            coords = gmxAPIutils.coordsFromMercator(type, coords, webmercFlag);
        } else {
            coords = gmxAPIutils.coordsToMercator(type, coords, webmercFlag);
        }
        return {
            type: geom.type,
            coordinates: coords
        };
    },

    /** Converts GeoJSON object into GeoMixer format
     * @memberof L.gmxUtil
     * @param {Object} geometry - GeoJSON object
     * @param {Boolean} mercFlag - true if resulting Geomixer object should has coordinates in Mercator projection
     * @return {Object} Geometry in GeoMixer format
    */
    geoJSONtoGeometry: function (geoJSON, mercFlag) {
        if (geoJSON.type === 'FeatureCollection') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.features[0], mercFlag);
        } else if (geoJSON.type === 'Feature') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.geometry, mercFlag);
        } else if (geoJSON.type === 'FeatureCollection') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.features[0], mercFlag);
        }

        var type = geoJSON.type === 'MultiPolygon' ? 'MULTIPOLYGON'
                : geoJSON.type === 'Polygon' ? 'POLYGON'
                : geoJSON.type === 'MultiLineString' ? 'MULTILINESTRING'
                : geoJSON.type === 'LineString' ? 'LINESTRING'
                : geoJSON.type === 'MultiPoint' ? 'MULTIPOINT'
                : geoJSON.type === 'Point' ? 'POINT'
                : geoJSON.type,
            coords = geoJSON.coordinates;
        if (mercFlag) {
            coords = gmxAPIutils.coordsToMercator(geoJSON.type, coords);
        }
        return {
            type: type,
            coordinates: coords
        };
    },

    _coordsConvert: function(type, coords, toMerc, webmercFlag) {
        var i, len, p,
            resCoords = [];
        if (type === 'Point') {
            if (toMerc) {
                p = (webmercFlag ? L.CRS.EPSG3857 : L.Projection.Mercator).project({lat: coords[1], lng: coords[0]});
                resCoords = [p.x, p.y];
            } else {
                p = L.Projection.Mercator.unproject({y: coords[1], x: coords[0]});
                resCoords = [p.lng, p.lat];
				if (webmercFlag) {
					resCoords[1] = gmxAPIutils.fromWebMercY(coords[1]);
				}
            }
        } else if (type === 'LineString' || type === 'MultiPoint') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('Point', coords[i], toMerc, webmercFlag));
            }
        } else if (type === 'Polygon' || type === 'MultiLineString') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('MultiPoint', coords[i], toMerc, webmercFlag));
            }
        } else if (type === 'MultiPolygon') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('Polygon', coords[i], toMerc, webmercFlag));
            }
        }
        return resCoords;
    },

    coordsFromMercator: function(type, coords, webmercFlag) {
        return gmxAPIutils._coordsConvert(type, coords, false, webmercFlag);
    },

    coordsToMercator: function(type, coords, webmercFlag) {
        return gmxAPIutils._coordsConvert(type, coords, true, webmercFlag);
    },

    transformGeometry: function(geom, callback) {
        return !geom ? geom : {
            type: geom.type,
            coordinates: gmxAPIutils.forEachPoint(geom.coordinates, function(p) {
                return callback(p);
            })
        };
    },

    /** Get area for geometry
     * @memberof L.gmxUtil
     * @param {Object} geometry
     * @param {Boolean} [isMerc=true] - true if coordinates in Mercator
     * @param {Boolean} isWebMerc - true if coordinates in WebMercator	- TODO
     * @return {Number} area in square meters
    */
    geoArea: function(geom, isMerc) {
        var i, len, ret = 0,
            type = geom.type || '';
        isMerc = isMerc === undefined || isMerc;
        if (type === 'MULTIPOLYGON' || type === 'MultiPolygon') {
            for (i = 0, len = geom.coordinates.length; i < len; i++) {
                ret += gmxAPIutils.geoArea({type: 'POLYGON', coordinates: geom.coordinates[i]}, isMerc);
            }
            return ret;
        } else if (type === 'POLYGON' || type === 'Polygon') {
            ret = gmxAPIutils.geoArea(geom.coordinates[0], isMerc);
            for (i = 1, len = geom.coordinates.length; i < len; i++) {
                ret -= gmxAPIutils.geoArea(geom.coordinates[i], isMerc);
            }
            return ret;
        } else if (geom.length) {
            var latlngs = [],
                vectorSize = typeof geom[0] === 'number' ? 2 : 1;

            for (i = 0, len = geom.length; i < len; i += vectorSize) {
                var p = vectorSize === 1 ? geom[i] : [geom[i], geom[i + 1]];
                latlngs.push(
                    isMerc ?
                    L.Projection.Mercator.unproject({y: p[1], x: p[0]}) :
                    {lat: p[1], lng: p[0]}
                );
            }
            return gmxAPIutils.getArea(latlngs);
        }
        return 0;
    },

    /** Get summary for geoJSON geometry
     * @memberof L.gmxUtil
     * @param {Object} geoJSON geometry
     * @param {Object} unitOptions {
     *                  distanceUnit: '',   // m - meters, km - kilometers, nm - nautilus miles, auto - default
     *                  squareUnit: ''      // m2 - square meters, km2 - square kilometers, ha - hectares, auto - default
     *               }
     * @return {String} Summary string for geometry
    */
    getGeoJSONSummary: function(geom, unitOptions) {
        var type = geom.type,
            units = unitOptions || {},
            out = 0,
            i, len, coords;
        if (type === 'Point') {
            coords = geom.coordinates;
            out = gmxAPIutils.formatCoordinates(coords[0], coords[1]);
        } else if (type === 'Polygon') {
            out = gmxAPIutils.prettifyArea(gmxAPIutils.geoArea(geom, false), units.squareUnit);
        } else if (type === 'MultiPolygon') {
            coords = geom.coordinates;
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.geoArea({type: 'Polygon', coordinates: coords[i]}, false);
            }
            out = gmxAPIutils.prettifyArea(out, units.squareUnit);
        } else if (type === 'LineString') {
            out = gmxAPIutils.prettifyDistance(gmxAPIutils.geoJSONGetLength(geom), units.distanceUnit);
        } else if (type === 'MultiLineString') {
            coords = geom.coordinates;
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.geoJSONGetLength({type: 'LineString', coordinates: coords[i]});
            }
            out = gmxAPIutils.prettifyDistance(out, units.distanceUnit);
        }
        return out;
    },

    /** Get summary for point
     * @memberof L.gmxUtil
     * @param {latlng} point
     * @param {num} format number:
     *         0: 62°52'30.68" N, 22°48'27.42" E
     *         1: 62.875188 N, 22.807617 E
     *         2: 2538932, 9031643 (EPSG:3395)
     *         3: 2538932, 9069712 (EPSG:3857)
     * @return {String} Summary string for LatLng point
    */
    getCoordinatesString: function(latlng, num) {
        var x = latlng.lng,
            y = latlng.lat,
            formats = [
                '',
                '',
                ' (EPSG:3395)',
                ' (EPSG:3857)'
            ],
            len = formats.length,
            merc,
            out = '';
        num = num || 0;
        if (x > 180) { x -= 360; }
        if (x < -180) { x += 360; }
        if (num % len === 0) {
            out = gmxAPIutils.formatCoordinates2(x, y);
        } else if (num % len === 1) {
            out = gmxAPIutils.formatCoordinates(x, y);
        } else if (num % len === 2) {
            merc = L.Projection.Mercator.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[2];
        } else {
            merc = L.CRS.EPSG3857.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[3];
        }
        return out;
    },

    /** Get summary for geometries array
     * @memberof L.gmxUtil
     * @param {Array} geometries array in Geomixer format
     * @param {Object} units Options for length and area
     * @return {String} Summary string for geometries array
    */
    getGeometriesSummary: function(arr, unitOptions) {
        var out = '',
            type = '',
            res = 0;
        if (!unitOptions) { unitOptions = {}; }
        if (arr) {
            arr.forEach(function(geom) {
                if (geom) {
                    type = geom.type.toUpperCase();
					var latLngGeometry = L.gmxUtil.geometryToGeoJSON(geom, true, unitOptions.srs == 3857);
                    if (type.indexOf('POINT') !== -1) {
                        var latlng = L.latLng(latLngGeometry.coordinates.reverse());
                        out = '<b>' + L.gmxLocale.getText('Coordinates') + '</b>: '
                            + gmxAPIutils.getCoordinatesString(latlng, unitOptions.coordinatesFormat);
                    } else if (type.indexOf('LINESTRING') !== -1) {
                        res += gmxAPIutils.geoJSONGetLength(latLngGeometry);
                    } else if (type.indexOf('POLYGON') !== -1) {
                        res += gmxAPIutils.geoJSONGetArea(latLngGeometry);
                    }
                }
            });
        }
        if (!out) {
            if (type.indexOf('LINESTRING') !== -1) {
                out = '<b>' + L.gmxLocale.getText('Length') + '</b>: '
                    + gmxAPIutils.prettifyDistance(res, unitOptions.distanceUnit);
            } else if (type.indexOf('POLYGON') !== -1) {
                out = '<b>' + L.gmxLocale.getText('Area') + '</b>: '
                    + gmxAPIutils.prettifyArea(res, unitOptions.squareUnit);
            }
        }
        return out;
    },

    getGeometrySummary: function(geom, unitOptions) {
        return gmxAPIutils.getGeometriesSummary([geom], unitOptions || {});
    },

    chkOnEdge: function(p1, p2, ext) { // отрезок на границе
        if ((p1[0] < ext.min.x && p2[0] < ext.min.x) || (p1[0] > ext.max.x && p2[0] > ext.max.x)) { return true; }
        if ((p1[1] < ext.min.y && p2[1] < ext.min.y) || (p1[1] > ext.max.y && p2[1] > ext.max.y)) { return true; }
        return false;
    },

    getHidden: function(coords, tb) {  // массив точек на границах тайлов
        var hiddenLines = [],
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            prev = null;
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var p = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]];
            if (prev && gmxAPIutils.chkOnEdge(p, prev, tb)) {
                hiddenLines.push(i);
            }
            prev = p;
        }
        return hiddenLines;
    },

    getNormalizeBounds: function (screenBounds, mercDeltaY) { // get bounds array from -180 180 lng
        var northWest = screenBounds.getNorthWest(),
            southEast = screenBounds.getSouthEast(),
            minX = northWest.lng,
            maxX = southEast.lng,
            w = (maxX - minX) / 2,
            minX1 = null,
            maxX1 = null,
            out = [];

        if (w >= 180) {
            minX = -180; maxX = 180;
        } else if (maxX > 180 || minX < -180) {
            var center = ((maxX + minX) / 2) % 360;
            if (center > 180) { center -= 360; }
            else if (center < -180) { center += 360; }
            minX = center - w; maxX = center + w;
            if (minX < -180) {
                minX1 = minX + 360; maxX1 = 180; minX = -180;
            } else if (maxX > 180) {
                minX1 = -180; maxX1 = maxX - 360; maxX = 180;
            }
        }
        var m1 = {x: minX, y: southEast.lat},
            m2 = {x: maxX, y: northWest.lat};

        if (mercDeltaY !== undefined) {
            m1 = L.Projection.Mercator.project(new L.LatLng([southEast.lat, minX]));
            m2 = L.Projection.Mercator.project(new L.LatLng([northWest.lat, maxX]));
            m1.y -= mercDeltaY;
            m2.y -= mercDeltaY;
        }
        out.push(gmxAPIutils.bounds([[m1.x, m1.y], [m2.x, m2.y]]));

        if (minX1) {
            var m11 = {x: minX1, y: southEast.lat},
                m12 = {x: maxX1, y: northWest.lat};
            if (mercDeltaY !== undefined) {
                m11 = L.Projection.Mercator.project(new L.LatLng([southEast.lat, minX1]));
                m12 = L.Projection.Mercator.project(new L.LatLng([northWest.lat, maxX1]));
                m11.y -= mercDeltaY;
                m12.y -= mercDeltaY;
            }
            out.push(gmxAPIutils.bounds([[m11.x, m11.y], [m12.x, m12.y]]));
        }
        return out;
    },

    toPrecision: function(x, prec) {
        var zn = Math.pow(10, prec ? prec : 4);
        return Math.round(zn * x) / zn;
    },
	getBoundsByTilePoint: function(tPoint) {  //tPoint - OSM tile point
        var tileSize = gmxAPIutils.tileSizes[tPoint.z],
            minx = tPoint.x * tileSize - gmxAPIutils.worldWidthMerc,
            maxy = gmxAPIutils.worldWidthMerc - tPoint.y * tileSize;
		return gmxAPIutils.bounds([
			[minx, maxy - tileSize],
			[minx + tileSize, maxy]
		]);
	},
    getTileBounds: function(x, y, z) {  //x, y, z - GeoMixer tile coordinates
        var tileSize = gmxAPIutils.tileSizes[z],
            minx = x * tileSize,
            miny = y * tileSize;
        return gmxAPIutils.bounds([[minx, miny], [minx + tileSize, miny + tileSize]]);
    },

    parseTemplate: function(str, properties) {
        var matches = str.match(/\[([^\]]+)\]/ig);
        if (matches) {
            for (var i = 0, len = matches.length; i < len; i++) {
                var key1 = matches[i],
                    key = key1.substr(1, key1.length - 2),
                    res = key in properties ? properties[key] : '';

                str = str.replace(key1, res);
            }
        }
        return str;
    },

    getDefaultBalloonTemplate: function(properties, tileAttributeTypes) {
        var str = '';
        for (var key in properties) {
            if (!tileAttributeTypes || (key in tileAttributeTypes)) {
				str += '<b>' + key + ':</b> [' +  key + ']<br />';
			}
        }
        str += '<br />[SUMMARY]<br />';
        return str;
    },

    parseBalloonTemplate: function(str, options) {
        var properties = options.properties;

        if (!str) {
            str = gmxAPIutils.getDefaultBalloonTemplate(properties, options.tileAttributeTypes);
        }
        var matches = str.match(/\[([^\]]+)\]/ig);
        if (matches) {
            var tileAttributeTypes = options.tileAttributeTypes,
                unitOptions = options.unitOptions,
                geometries = options.geometries;
            for (var i = 0, len = matches.length; i < len; i++) {
                var key1 = matches[i],
                    key = key1.substr(1, key1.length - 2),
                    res = '';

                if (key in properties) {
                    res = L.gmxUtil.attrToString(tileAttributeTypes[key], properties[key]);
                } else if (key === 'SUMMARY') {
                    res = options.summary || L.gmxUtil.getGeometriesSummary(geometries, unitOptions);
                }
                str = str.replace(key1, res);
            }
        }
        return str;
    },

    styleKeys: {
        marker: {
            server: ['image',   'angle',     'scale',     'minScale',     'maxScale',     'size',         'circle',     'center',     'color'],
            client: ['iconUrl', 'iconAngle', 'iconScale', 'iconMinScale', 'iconMaxScale', 'iconSize', 'iconCircle', 'iconCenter', 'iconColor']
        },
        outline: {
            server: ['color',  'opacity',   'thickness', 'dashes'],
            client: ['color',  'opacity',   'weight',    'dashArray']
        },
        fill: {
            server: ['color',     'opacity',   'image',       'pattern',     'radialGradient',     'linearGradient'],
            client: ['fillColor', 'fillOpacity', 'fillIconUrl', 'fillPattern', 'fillRadialGradient', 'fillLinearGradient']
        },
        label: {
            server: ['text',      'field',      'template',      'color',      'haloColor',      'size',          'spacing',      'align'],
            client: ['labelText', 'labelField', 'labelTemplate', 'labelColor', 'labelHaloColor', 'labelFontSize', 'labelSpacing', 'labelAlign']
        }
    },
    styleFuncKeys: {
        iconSize: 'iconSizeFunction',
        iconAngle: 'rotateFunction',
        iconScale: 'scaleFunction',
        iconColor: 'iconColorFunction',
        opacity: 'opacityFunction',
        fillOpacity: 'fillOpacityFunction',
        color: 'colorFunction',
        fillColor: 'fillColorFunction'
    },
    styleFuncError: {
        iconSize: function() { return 8; },
        iconAngle: function() { return 0; },
        iconScale: function() { return 1; },
        iconColor: function() { return 0xFF; },
        opacity: function() { return 1; },
        fillOpacity: function() { return 0.5; },
        color: function() { return 0xFF; },
        fillColor: function() { return 0xFF; }
    },
    defaultStyles: {
       MinZoom: 1,
       MaxZoom: 21,
       Filter: '',
       Balloon: '',
       DisableBalloonOnMouseMove: true,
       DisableBalloonOnClick: false,
       RenderStyle: {
            point: {    // old = {outline: {color: 255, thickness: 1}, marker:{size: 8}},
                color: 0xFF,
                weight: 1,
                iconSize: 8
            },
            linestring: {    // old = {outline: {color: 255, thickness: 1}},
                color: 0xFF,
                weight: 1
            },
            polygon: {    // old = {outline: {color: 255, thickness: 1}},
                color: 0xFF,
                weight: 1
            }
        }
    },

    getDefaultStyle: function(type) {
        var from = gmxAPIutils.defaultStyles,
            out = L.extend({}, from);
        out.RenderStyle = from.RenderStyle[type];
        return out;
    },

    toServerStyle: function(style) {   // Style leaflet->Scanex
        var out = {};

        for (var key in gmxAPIutils.styleKeys) {
            var keys = gmxAPIutils.styleKeys[key];
            for (var i = 0, len = keys.client.length; i < len; i++) {
                var key1 = keys.client[i];
                if (key1 in style) {
                    if (!out[key]) { out[key] = {}; }
                    var zn = style[key1];
                    if (key1 === 'opacity' || key1 === 'fillOpacity') {
                        zn *= 100;
                    }
                    out[key][keys.server[i]] = zn;
                }
            }
        }
        if ('iconAnchor' in style) {
            if (!out.marker) { out.marker = {}; }
            out.marker.dx = -style.iconAnchor[0];
            out.marker.dy = -style.iconAnchor[1];
        }
        return out;
    },

    fromServerStyle: function(style) {   // Style Scanex->leaflet
        var st, i, len, key, key1,
            out = {
                type: ''    // 'polygon', 'line', 'circle', 'square', 'image'
            };

        for (key in gmxAPIutils.styleKeys) {
            var keys = gmxAPIutils.styleKeys[key];
            for (i = 0, len = keys.client.length; i < len; i++) {
                key1 = keys.client[i];
                if (key1 in style) {
                    out[key1] = style[key1];
                }
            }
            st = style[key];
            if (st && typeof (st) === 'object') {
                for (i = 0, len = keys.server.length; i < len; i++) {
                    key1 = keys.server[i];
                    if (key1 in st) {
                        var newKey = keys.client[i],
                            zn = st[key1];
                        if (typeof (zn) === 'string') {
                            if (gmxAPIutils.styleFuncKeys[newKey]) {
/*eslint-disable no-useless-escape */
                                if (zn.match(/[^\d\.]/) === null) {
/*eslint-enable */
                                    zn = Number(zn);
                                } else {
                                    var func = L.gmx.Parsers.parseExpression(zn);
                                    if (func === null) {
                                        zn = gmxAPIutils.styleFuncError[newKey]();
                                    } else {
                                        out[gmxAPIutils.styleFuncKeys[newKey]] = func;
                                    }
                                }
                            }
                        } else if (key1 === 'opacity') {
                            zn /= 100;
                        }
                        out[newKey] = zn;
                    }
                }
            }
        }
        if (style.marker) {
            st = style.marker;
            if ('dx' in st || 'dy' in st) {
                var dx = st.dx || 0,
                    dy = st.dy || 0;
                out.iconAnchor = [-dx, -dy];    // For leaflet type iconAnchor
            }
        }
        for (key in style) {
			if (!gmxAPIutils.styleKeys[key]) {
				out[key] = style[key];
			}
        }
        return out;
    },

    getUnixTimeFromStr: function(st) {
		var arr1 = L.Util.trim(st).split(' '),
			arr = arr1[0].split('.'),
			tm = arr1[1] ? arr1[1].split(':') : [0, 0, 0];

        if (arr[2].length === 4) {
			arr = arr.reverse();
		}
		return Date.UTC(arr[0], arr[1] - 1, arr[2], tm[0] || 0, tm[1] || 0, tm[2] || 0) / 1000;
    },

    getDateFromStr: function(st) {
		var arr = L.Util.trim(st).split(' ');
		arr = arr[0].split('.');

        if (arr[2].length === 4) {
			arr = arr.reverse();
		}
		var dt = new Date(arr[0], arr[1] - 1, arr[2]);
        return dt;
    },

    getUTCdate: function(utime) {
        var dt = new Date(utime * 1000);

        return [
            dt.getUTCFullYear(),
            gmxAPIutils.pad2(dt.getUTCMonth() + 1),
            gmxAPIutils.pad2(dt.getUTCDate())
        ].join('.');
    },

    getUTCtime: function(utime) {
        var h = Math.floor(utime / 3600),
            m = Math.floor((utime - h * 3600) / 60),
            s = Math.floor(utime - h * 3600 - m * 60);

        return [
            //gmxAPIutils.pad2(h - new Date().getTimezoneOffset() / 60),
            gmxAPIutils.pad2(h),
            gmxAPIutils.pad2(m),
            gmxAPIutils.pad2(s)
        ].join(':');
    },

    getUTCdateTime: function(utime) {
        var time = utime % (3600 * 24);

        if (time) {
            return [
                gmxAPIutils.getUTCdate(utime),
                gmxAPIutils.getUTCtime(utime % (3600 * 24))
            ].join(' ');
        } else {
            return gmxAPIutils.getUTCdate(utime);
        }
    },

    attrToString: function(type, value) {
        if (type === 'date') {
            return value ? L.gmxUtil.getUTCdate(value) : value;
        } else if (type === 'time') {
            return value ? L.gmxUtil.getUTCtime(value) : value;
        } else if (type === 'datetime') {
            return value ? L.gmxUtil.getUTCdateTime(value) : value;
        } else {
            return value;
        }
    },

    getTileAttributes: function(prop) {
        var tileAttributeIndexes = {},
            tileAttributeTypes = {};
        if (prop.attributes) {
            var attrs = prop.attributes,
                attrTypes = prop.attrTypes || null;
            if (prop.identityField) { tileAttributeIndexes[prop.identityField] = 0; }
            for (var a = 0; a < attrs.length; a++) {
                var key = attrs[a];
                tileAttributeIndexes[key] = a + 1;
                tileAttributeTypes[key] = attrTypes ? attrTypes[a] : 'string';
            }
        }
        return {
            tileAttributeTypes: tileAttributeTypes,
            tileAttributeIndexes: tileAttributeIndexes
        };
    }
};

gmxAPIutils.lambertCoefX = 100 * gmxAPIutils.distVincenty(0, 0, 0.01, 0);				// 111319.5;
gmxAPIutils.lambertCoefY = 100 * gmxAPIutils.distVincenty(0, 0, 0, 0.01) * 180 / Math.PI;	// 6335440.712613423;

(function() {
    //pre-calculate tile sizes
    for (var z = 0; z < 30; z++) {
        gmxAPIutils.tileSizes[z] = gmxAPIutils.worldWidthFull / Math.pow(2, z);
    }
})();
gmxAPIutils.worldWidthMerc = gmxAPIutils.worldWidthFull / 2;

gmxAPIutils.Bounds = function(arr) {
    this.min = {
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE
    };
    this.max = {
        x: -Number.MAX_VALUE,
        y: -Number.MAX_VALUE
    };
    this.extendArray(arr);
};
gmxAPIutils.Bounds.prototype = {
    extend: function(x, y) {
        if (x < this.min.x) { this.min.x = x; }
        if (x > this.max.x) { this.max.x = x; }
        if (y < this.min.y) { this.min.y = y; }
        if (y > this.max.y) { this.max.y = y; }
        return this;
    },
    extendBounds: function(bounds) {
        return this.extendArray([[bounds.min.x, bounds.min.y], [bounds.max.x, bounds.max.y]]);
    },
    extendArray: function(arr) {
        if (!arr || !arr.length) { return this; }
        var i, len;
        if (typeof arr[0] === 'number') {
            for (i = 0, len = arr.length; i < len; i += 2) {
                this.extend(arr[i], arr[i + 1]);
            }
        } else {
            for (i = 0, len = arr.length; i < len; i++) {
                this.extend(arr[i][0], arr[i][1]);
            }
        }
        return this;
    },
    addBuffer: function(dxmin, dymin, dxmax, dymax) {
        this.min.x -= dxmin;
        this.min.y -= dymin || dxmin;
        this.max.x += dxmax || dxmin;
        this.max.y += dymax || dymin || dxmin;
        return this;
    },
    contains: function (point) { // ([x, y]) -> Boolean
        var min = this.min, max = this.max,
            x = point[0], y = point[1];
        return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
    },
    getCenter: function () {
        var min = this.min, max = this.max;
        return [(min.x + max.x) / 2, (min.y + max.y) / 2];
    },
    addOffset: function (offset) {
        this.min.x += offset[0]; this.max.x += offset[0];
        this.min.y += offset[1]; this.max.y += offset[1];
        return this;
    },
    intersects: function (bounds) { // (Bounds) -> Boolean
        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x > min.x && min2.x < max.x && max2.y > min.y && min2.y < max.y;
    },
    intersectsWithDelta: function (bounds, dx, dy) { // (Bounds, dx, dy) -> Boolean
        var min = this.min,
            max = this.max,
            x = dx || 0,
            y = dy || 0,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x + x > min.x && min2.x - x < max.x && max2.y + y > min.y && min2.y - y < max.y;
    },
    isEqual: function (bounds) { // (Bounds) -> Boolean
        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x === max.x && min2.x === min.x && max2.y === max.y && min2.y === min.y;
    },
    isNodeIntersect: function (coords) {
        for (var i = 0, len = coords.length; i < len; i++) {
            if (this.contains(coords[i])) {
                return {
                    num: i,
                    point: coords[i]
                };
            }
        }
        return null;
    },

	clipPolygon: function (points, round) {
		if (points.length) {
			var clippedPoints,
				edges = [1, 4, 2, 8],
				i, j, k,
				a, b,
				len, edge, p;

			if (L.LineUtil.isFlat(points)) {
				var coords = points;
				points = coords.map(function(it) {
					return new L.Point(it[0], it[1], round);
				});
			}
			for (i = 0, len = points.length; i < len; i++) {
				points[i]._code = this._getBitCode(points[i]);
			}

			// for each edge (left, bottom, right, top)
			for (k = 0; k < 4; k++) {
				edge = edges[k];
				clippedPoints = [];

				for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
					a = points[i];
					b = points[j];

					// if a is inside the clip window
					if (!(a._code & edge)) {
						// if b is outside the clip window (a->b goes out of screen)
						if (b._code & edge) {
							p = this._getEdgeIntersection(b, a, edge, round);
							p._code = this._getBitCode(p);
							clippedPoints.push(p);
						}
						clippedPoints.push(a);

					// else if b is inside the clip window (a->b enters the screen)
					} else if (!(b._code & edge)) {
						p = this._getEdgeIntersection(b, a, edge, round);
						p._code = this._getBitCode(p);
						clippedPoints.push(p);
					}
				}
				points = clippedPoints;
			}
		}

		return points.map(function(it) {
			return [it.x, it.y];
		});
	},

	_getBitCode: function (p) {
		var code = 0;

		if (p.x < this.min.x) { // left
			code |= 1;
		} else if (p.x > this.max.x) { // right
			code |= 2;
		}

		if (p.y < this.min.y) { // bottom
			code |= 4;
		} else if (p.y > this.max.y) { // top
			code |= 8;
		}

		return code;
	},

	_getEdgeIntersection: function (a, b, code, round) {
		var dx = b.x - a.x,
			dy = b.y - a.y,
			min = this.min,
			max = this.max,
			x, y;

		if (code & 8) { // top
			x = a.x + dx * (max.y - a.y) / dy;
			y = max.y;

		} else if (code & 4) { // bottom
			x = a.x + dx * (min.y - a.y) / dy;
			y = min.y;

		} else if (code & 2) { // right
			x = max.x;
			y = a.y + dy * (max.x - a.x) / dx;

		} else if (code & 1) { // left
			x = min.x;
			y = a.y + dy * (min.x - a.x) / dx;
		}

		return new L.Point(x, y, round);
	},

    clipPolyLine: function (coords, angleFlag, delta) { // (coords) -> clip coords
        delta = delta || 0;
        var min = this.min,
            max = this.max,
            bbox = [min.x - delta, min.y - delta, max.x + delta, max.y + delta],
            bitCode = function (p) {
                var code = 0;

                if (p[0] < bbox[0]) code |= 1; // left
                else if (p[0] > bbox[2]) code |= 2; // right

                if (p[1] < bbox[1]) code |= 4; // bottom
                else if (p[1] > bbox[3]) code |= 8; // top

                return code;
            },
            getAngle = function (a, b) {
                return Math.PI / 2 + Math.atan2(b[1] - a[1], a[0] - b[0]);
            },
            intersect = function (a, b, edge) {
                return edge & 8 ? [a[0] + (b[0] - a[0]) * (bbox[3] - a[1]) / (b[1] - a[1]), bbox[3]] : // top
                       edge & 4 ? [a[0] + (b[0] - a[0]) * (bbox[1] - a[1]) / (b[1] - a[1]), bbox[1]] : // bottom
                       edge & 2 ? [bbox[2], a[1] + (b[1] - a[1]) * (bbox[2] - a[0]) / (b[0] - a[0])] : // right
                       edge & 1 ? [bbox[0], a[1] + (b[1] - a[1]) * (bbox[0] - a[0]) / (b[0] - a[0])] : // left
                       null;
            },
            result = [],
            len = coords.length,
            codeA = bitCode(coords[0], bbox),
            part = [],
            i, a, b, c, codeB, lastCode;

        for (i = 1; i < len; i++) {
            a = coords[i - 1];
            b = coords[i];
            if (a[0] === b[0] && a[1] === b[1]) { continue; }
            codeB = lastCode = bitCode(b, bbox);

            while (true) {

                if (!(codeA | codeB)) { // accept
                    if (angleFlag) {
                        a[2] = getAngle(a, b);
                        c = coords[i + 1];
                        b[2] = c ? getAngle(b, c) : a[2];
                    }
                    part.push(a);

                    if (codeB !== lastCode) { // segment went outside
                        part.push(b);

                        if (i < len - 1) { // start a new line
                            result.push(part);
                            part = [];
                        }
                    } else if (i === len - 1) {
                        part.push(b);
                    }
                    break;

                } else if (codeA & codeB) { // trivial reject
                    break;

                } else if (codeA) { // a outside, intersect with clip edge
                    a = intersect(a, b, codeA, bbox);
                    codeA = bitCode(a, bbox);

                } else { // b outside
                    b = intersect(a, b, codeB, bbox);
                    codeB = bitCode(b, bbox);
                }
            }

            codeA = lastCode;
        }

        if (part.length) result.push(part);

        return result;
    },
    toLatLngBounds: function(isWebMerc) {
		var proj = L.Projection.Mercator,
			min = proj.unproject(this.min),
			max = proj.unproject(this.max),
			arr = [[min.lat, min.lng], [max.lat, max.lng]];

		if (isWebMerc) {
			arr[0][0] = gmxAPIutils.fromWebMercY(this.min.y);
			arr[1][0] = gmxAPIutils.fromWebMercY(this.max.y);
		}
		return L.latLngBounds(arr);
    }
};

gmxAPIutils.bounds = function(arr) {
    return new gmxAPIutils.Bounds(arr);
};

//скопирована из API для обеспечения независимости от него
gmxAPIutils.parseUri = function (str) {
    var	o   = gmxAPIutils.parseUri.options,
        m   = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str),
        uri = {},
        i   = 14;

    while (i--) {
        uri[o.key[i]] = m[i] || '';
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) { uri[o.q.name][$1] = $2; }
    });

    uri.hostOnly = uri.host;
    uri.host = uri.authority; // HACK

    return uri;
};

gmxAPIutils.parseUri.options = {
    strictMode: false,
    key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
    q:   {
        name:   'queryKey',
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
/*eslint-disable no-useless-escape */
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
/*eslint-enable */
};

if (!L.gmxUtil) { L.gmxUtil = {}; }

//public interface
L.extend(L.gmxUtil, {
    newId: gmxAPIutils.newId,
	isPageHidden: gmxAPIutils.isPageHidden,
    protocol: location.protocol !== 'https:' ? 'http:' : location.protocol,
    loaderStatus: function () {},
    isIE9: gmxAPIutils.isIE(9),
    isIE10: gmxAPIutils.isIE(10),
    isIE11: gmxAPIutils.isIE(11),
    gtIE11: gmxAPIutils.gtIE(11),
    getFormData: gmxAPIutils.getFormData,
    requestJSONP: gmxAPIutils.requestJSONP,
    requestLink: gmxAPIutils.requestLink,
    getCadastreFeatures: gmxAPIutils.getCadastreFeatures,
    request: gmxAPIutils.request,
    getLayerItemFromServer: gmxAPIutils.getLayerItemFromServer,
    fromServerStyle: gmxAPIutils.fromServerStyle,
    toServerStyle: gmxAPIutils.toServerStyle,
    getDefaultStyle: gmxAPIutils.getDefaultStyle,
    bounds: gmxAPIutils.bounds,
    getNormalizeBounds: gmxAPIutils.getNormalizeBounds,
    getGeometryBounds: gmxAPIutils.getGeometryBounds,
    tileSizes: gmxAPIutils.tileSizes,
    getDateFromStr: gmxAPIutils.getDateFromStr,
    getUnixTimeFromStr: gmxAPIutils.getUnixTimeFromStr,
    getUTCdate: gmxAPIutils.getUTCdate,
    getUTCtime: gmxAPIutils.getUTCtime,
    getUTCdateTime: gmxAPIutils.getUTCdateTime,
    attrToString: gmxAPIutils.attrToString,
    getTileAttributes: gmxAPIutils.getTileAttributes,
    formatCoordinates: function (latlng, type) {
        return gmxAPIutils['formatCoordinates' + (type ? '2' : '')](latlng.lng, latlng.lat);
    },
    formatDegrees: gmxAPIutils.formatDegrees,
    pad2: gmxAPIutils.pad2,
    dec2hex: gmxAPIutils.dec2hex,
	dec2rgba: gmxAPIutils.dec2rgba,
    trunc: gmxAPIutils.trunc,
    latLonFormatCoordinates: gmxAPIutils.latLonFormatCoordinates,
    latLonFormatCoordinates2: gmxAPIutils.latLonFormatCoordinates2,
    latLonToString: gmxAPIutils.latLonToString,
    toPrecision: gmxAPIutils.toPrecision,
    getLength: gmxAPIutils.getLength,
    geoLength: gmxAPIutils.geoLength,
    prettifyDistance: gmxAPIutils.prettifyDistance,
    getArea: gmxAPIutils.getArea,
    prettifyArea: gmxAPIutils.prettifyArea,
    geoArea: gmxAPIutils.geoArea,
    parseBalloonTemplate: gmxAPIutils.parseBalloonTemplate,
    getSVGIcon: gmxAPIutils.getSVGIcon,
    getCoordinatesString: gmxAPIutils.getCoordinatesString,
    getGeometriesSummary: gmxAPIutils.getGeometriesSummary,
    getGeometrySummary: gmxAPIutils.getGeometrySummary,
    getGeoJSONSummary: gmxAPIutils.getGeoJSONSummary,
    getPropertiesHash: gmxAPIutils.getPropertiesHash,
    distVincenty: gmxAPIutils.distVincenty,
    parseCoordinates: gmxAPIutils.parseCoordinates,
    geometryToGeoJSON: gmxAPIutils.geometryToGeoJSON,
    coordsFromMercator: gmxAPIutils.coordsFromMercator,
    convertGeometry: gmxAPIutils.convertGeometry,
    transformGeometry: gmxAPIutils.transformGeometry,
    geoJSONtoGeometry: gmxAPIutils.geoJSONtoGeometry,
    geoJSONGetArea: gmxAPIutils.geoJSONGetArea,
    geoJSONGetLength: gmxAPIutils.geoJSONGetLength,
    geoJSONGetLatLng: gmxAPIutils.geoJSONGetLatLng,
	fromWebMercY: gmxAPIutils.fromWebMercY,
    parseUri: gmxAPIutils.parseUri,
    isRectangle: gmxAPIutils.isRectangle,
    isClockwise: gmxAPIutils.isClockwise,
    isPointInPolygonWithHoles: gmxAPIutils.isPointInPolygonWithHoles,
    getPatternIcon: gmxAPIutils.getPatternIcon,
    getCircleLatLngs: gmxAPIutils.getCircleLatLngs,
    normalizeHostname: gmxAPIutils.normalizeHostname,
    getTileBounds: gmxAPIutils.getTileBounds,
	getBoundsByTilePoint: gmxAPIutils.getBoundsByTilePoint,
    parseTemplate: gmxAPIutils.parseTemplate
});

L.gmxUtil.isIEOrEdge = L.gmxUtil.gtIE11 || L.gmxUtil.isIE11 || L.gmxUtil.isIE10 || L.gmxUtil.isIE9;
if (!('requestIdleCallback' in window)) {
	window.requestIdleCallback = function(func, opt) {
		var timeout = opt ? opt.timeout : 0;
		return window.setTimeout(func, timeout);
	}
	window.cancelIdleCallback = window.clearTimeout;
}

(function() {
    var requests = {};
    var lastRequestId = 0;

    var processMessage = function(e) {

        if (!(e.origin in requests)) {
            return;
        }

        var dataStr = decodeURIComponent(e.data.replace(/\n/g, '\n\\'));
        try {
            var dataObj = JSON.parse(dataStr);
        } catch (ev) {
            console.log({Status:'error', ErrorInfo: {ErrorMessage: 'JSON.parse exeption', ExceptionType: 'JSON.parse', StackTrace: dataStr}});
        }
        var request = requests[e.origin][dataObj.CallbackName];
        if (!request) {
            return;    // message от других запросов
        }

        delete requests[e.origin][dataObj.CallbackName];
        delete dataObj.CallbackName;

        if (request.iframe.parentNode) {
            request.iframe.parentNode.removeChild(request.iframe);
        }
        if ('callback' in request) { request.callback(dataObj); }
    };

    L.DomEvent.on(window, 'message', processMessage);

    function createPostIframe2(id, callback, url) {
        var uniqueId = 'gmxAPIutils_id' + (lastRequestId++),
            iframe = L.DomUtil.create('iframe');

        iframe.style.display = 'none';
        iframe.setAttribute('id', id);
        iframe.setAttribute('name', id);    /*eslint-disable no-script-url */
        iframe.src = 'javascript:true';     /*eslint-enable */
        iframe.callbackName = uniqueId;

        var parsedURL = gmxAPIutils.parseUri(url);
        var origin = (parsedURL.protocol ? (parsedURL.protocol + ':') : L.gmxUtil.protocol) + '//' + (parsedURL.host || window.location.host);

        requests[origin] = requests[origin] || {};
        requests[origin][uniqueId] = {callback: callback, iframe: iframe};

        return iframe;
    }

	//расширяем namespace
    gmxAPIutils.createPostIframe2 = createPostIframe2;

})();

// кроссдоменный POST запрос
(function()
{
	/** Посылает кроссдоменный POST запрос
	* @namespace L.gmxUtil
    * @ignore
	* @function
	*
	* @param url {string} - URL запроса
	* @param params {object} - хэш параметров-запросов
	* @param callback {function} - callback, который вызывается при приходе ответа с сервера. Единственный параметр ф-ции - собственно данные
	* @param baseForm {DOMElement} - базовая форма запроса. Используется, когда нужно отправить на сервер файл.
	*                                В функции эта форма будет модифицироваться, но после отправления запроса будет приведена к исходному виду.
	*/
	function sendCrossDomainPostRequest(url, params, callback, baseForm) {
        var form,
            id = '$$iframe_' + gmxAPIutils.newId();

        var iframe = gmxAPIutils.createPostIframe2(id, callback, url),
            originalFormAction;

        if (baseForm) {
            form = baseForm;
            originalFormAction = form.getAttribute('action');
            form.setAttribute('action', url);
            form.target = id;
        } else if (L.Browser.ielt9) {
            var str = '<form id=' + id + '" enctype="multipart/form-data" style="display:none" target="' + id + '" action="' + url + '" method="post"></form>';
            form = document.createElement(str);
        } else {
            form = document.createElement('form');
            form.style.display = 'none';
            form.setAttribute('enctype', 'multipart/form-data');
            form.target = id;
            form.setAttribute('method', 'POST');
            form.setAttribute('action', url);
            form.id = id;
        }

        var hiddenParamsDiv = document.createElement('div');
        hiddenParamsDiv.style.display = 'none';

        if (params.WrapStyle === 'window') {
            params.WrapStyle = 'message';
        }

        if (params.WrapStyle === 'message') {
            params.CallbackName = iframe.callbackName;
        }

        for (var paramName in params) {
            var input = document.createElement('input');
            var value = typeof params[paramName] !== 'undefined' ? params[paramName] : '';
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', paramName);
            input.setAttribute('value', value);
            hiddenParamsDiv.appendChild(input);
        }

        form.appendChild(hiddenParamsDiv);

        if (!baseForm) {
            document.body.appendChild(form);
        }
        document.body.appendChild(iframe);

        form.submit();

        if (baseForm) {
            form.removeChild(hiddenParamsDiv);
            if (originalFormAction !== null) {
                form.setAttribute('action', originalFormAction);
            } else {
                form.removeAttribute('action');
            }
        } else {
            form.parentNode.removeChild(form);
        }
    }
    //расширяем namespace
    L.gmxUtil.sendCrossDomainPostRequest = gmxAPIutils.sendCrossDomainPostRequest = sendCrossDomainPostRequest;
})();


var styleCanvasKeys = ['strokeStyle', 'fillStyle', 'lineWidth'],
    styleCanvasKeysLen = styleCanvasKeys.length,
    utils = gmxAPIutils;

var setCanvasStyle = function(prop, indexes, ctx, style) {
    for (var i = 0; i < styleCanvasKeysLen; i++) {
        var key = styleCanvasKeys[i],
            valKey = style[key];
        if (valKey !== ctx[key]) {
            ctx[key] = valKey;
        }
    }
    if (style.dashArray) {
        var dashes = style.dashArray,
            dashOffset = style.dashOffset || 0;
        if ('setLineDash' in ctx) {
            ctx.setLineDash(dashes);
            if (ctx.lineDashOffset !== dashOffset) {
                ctx.lineDashOffset = dashOffset;
            }
        }
    } else if ('getLineDash' in ctx && ctx.getLineDash().length > 0) {
        ctx.setLineDash([]);
    }
    if (ctx.lineCap !== 'round') { ctx.lineCap = 'round'; }
    if (ctx.lineJoin !== 'round') { ctx.lineJoin = 'round'; }

    if (style.canvasPattern) {
        ctx.fillStyle = ctx.createPattern(style.canvasPattern.canvas, 'repeat');
    } else if (style.fillLinearGradient) {
        var rgr = style.fillLinearGradient,
            x1 = rgr.x1Function ? rgr.x1Function(prop, indexes) : rgr.x1,
            y1 = rgr.y1Function ? rgr.y1Function(prop, indexes) : rgr.y1,
            x2 = rgr.x2Function ? rgr.x2Function(prop, indexes) : rgr.x2,
            y2 = rgr.y2Function ? rgr.y2Function(prop, indexes) : rgr.y2,
            lineargrad = ctx.createLinearGradient(x1, y1, x2, y2);
        for (var j = 0, len = rgr.addColorStop.length; j < len; j++) {
            var arr1 = rgr.addColorStop[j],
                arrFunc = rgr.addColorStopFunctions[j],
                p0 = (arrFunc[0] ? arrFunc[0](prop, indexes) : arr1[0]),
                p2 = (arr1.length < 3 ? 100 : (arrFunc[2] ? arrFunc[2](prop, indexes) : arr1[2])),
                p1 = utils.dec2color(arrFunc[1] ? arrFunc[1](prop, indexes) : arr1[1], p2 > 1 ? p2 / 100 : p2);
            lineargrad.addColorStop(p0, p1);
        }
        ctx.fillStyle = style.fillStyle = lineargrad;
    }
};

/*
geoItem
     properties: объект (в формате векторного тайла)
     dataOption: дополнительные свойства объекта
item
     skipRasters: скрыть растр
     currentStyle: текущий canvas стиль объекта
     parsedStyleKeys: стиль прошедший парсинг
options
     ctx: canvas context
     tbounds: tile bounds
     tpx: X смещение тайла
     tpy: Y смещение тайла
     gmx: ссылка на layer._gmx
        //gmx.currentZoom
        gmx.lastHover
        gmx.tileAttributeIndexes
     bgImage: растр для background
     rasters: растры по объектам для background
currentStyle
    текущий стиль
style
    стиль в новом формате
    style.image - для type='image' (`<HTMLCanvasElement || HTMLImageElement>`)
*/
L.gmxUtil.drawGeoItem = function(geoItem, item, options, currentStyle, style) {
    var propsArr = geoItem.properties,
        idr = propsArr[0],
        i, len, j, len1,
        gmx = options.gmx,
        ctx = options.ctx,
        geom = propsArr[propsArr.length - 1],
        coords = null,
        dataOption = geoItem.dataOption,
        rasters = options.rasters || {},
        tbounds = options.tbounds;

    item.currentStyle = L.extend({}, currentStyle);
    if (style) {
        if (gmx.styleHook) {
            if (!geoItem.styleExtend) {
                geoItem.styleExtend = gmx.styleHook(item, gmx.lastHover && idr === gmx.lastHover.id);
            }
            if (geoItem.styleExtend) {
				if (typeof(geoItem.styleExtend.strokeStyle) === 'number') {
					geoItem.styleExtend.strokeStyle = gmxAPIutils.dec2color(geoItem.styleExtend.strokeStyle, 1);
				}
				if (typeof(geoItem.styleExtend.fillStyle) === 'number') {
					geoItem.styleExtend.fillStyle = gmxAPIutils.dec2color(geoItem.styleExtend.fillStyle, 1);
				}
                item.currentStyle = L.extend(item.currentStyle, geoItem.styleExtend);
            } else {
                return false;
            }
        }
        setCanvasStyle(propsArr, gmx.tileAttributeIndexes, ctx, item.currentStyle);
    } else {
        style = {};
    }

    var geoType = geom.type.toUpperCase(),
        dattr = {
            gmx: gmx,
            item: item,
            style: style,
            styleExtend: geoItem.styleExtend || {},
            ctx: ctx,
			topLeft: options.topLeft,
            tpx: options.tpx,
            tpy: options.tpy
        };

    if (geoType === 'POINT') {
        dattr.pointAttr = utils.getPixelPoint(dattr, geom.coordinates);
        if (!dattr.pointAttr) { return false; }   // point not in canvas tile
    }
    if (geoType === 'POINT' || geoType === 'MULTIPOINT') { // Отрисовка геометрии точек
        coords = geom.coordinates;
        if ('iconColor' in style && style.image && !L.gmxUtil.isIE11) {
            if (style.lastImage !== style.image) {
                style.lastImage = style.image;
                style.lastImageData = utils.getImageData(style.image);
            }
            dattr.imageData = style.lastImageData;
        }

        if (geoType === 'MULTIPOINT') {
            for (i = 0, len = coords.length; i < len; i++) {
                dattr.coords = coords[i];
                utils.pointToCanvas(dattr);
            }
        } else {
            dattr.coords = coords;
            utils.pointToCanvas(dattr);
        }
    } else if (geoType === 'POLYGON' || geoType === 'MULTIPOLYGON') {
        if (style.image) { // set MULTIPOLYGON as marker
            dattr.coords = [(dataOption.bounds.min.x + dataOption.bounds.max.x) / 2, (dataOption.bounds.min.y + dataOption.bounds.max.y) / 2];
            dattr.pointAttr = utils.getPixelPoint(dattr, dattr.coords);
            if (dattr.pointAttr) {
                utils.pointToCanvas(dattr);
            }
        } else {
            coords = geom.coordinates;
            if (geoType === 'POLYGON') { coords = [coords]; }

            var hiddenLines = dataOption.hiddenLines || [],
                pixelsMap = dataOption.pixels,
                flagPixels = true;

// console.log('pixelsMap', gmx.currentZoom, pixelsMap);
            if (!pixelsMap || pixelsMap.z !== options.topLeft.tilePoint.z) {
                pixelsMap = dataOption.pixels = utils.getCoordsPixels({
                    gmx: gmx,
                    coords: coords,
					topLeft: options.topLeft,
                    tpx: options.tpx,
                    tpy: options.tpy,
                    hiddenLines: hiddenLines
                });
            }

            var coordsToCanvas = function(func, flagFill) {
                coords = pixelsMap.coords;
                hiddenLines = pixelsMap.hidden || [];
                dattr.flagPixels = flagPixels;
                for (i = 0, len = coords.length; i < len; i++) {
                    var coords1 = coords[i];
                    var hiddenLines1 = hiddenLines[i] || [];
                    ctx.beginPath();
                    for (j = 0, len1 = coords1.length; j < len1; j++) {
                        dattr.coords = coords1[j];
                        dattr.hiddenLines = hiddenLines1[j] || [];
                        func(dattr);
                    }
                    ctx.closePath();
                    if (flagFill) { ctx.fill(); }
                }
            };
            var strokeStyle = item.currentStyle.strokeStyle || style.strokeStyle,
                lineWidth = item.currentStyle.lineWidth || style.lineWidth;
            if (strokeStyle && lineWidth) {
                coordsToCanvas(utils.polygonToCanvas);
            }
            if (options.bgImage) {
                dattr.bgImage = options.bgImage;
            } else if (rasters[idr]) {
                dattr.bgImage = rasters[idr];
            }
            if (dattr.styleExtend.skipRasters || item.skipRasters) {
                delete dattr.bgImage;
            }
            if (style.imagePattern) {
                item.currentStyle.fillStyle = ctx.createPattern(style.imagePattern, 'repeat');
            } else if (dattr.bgImage && tbounds.intersectsWithDelta(dataOption.bounds, -1, -1)) {
                if (utils.isPatternNode(dattr.bgImage)) {
                    if ('rasterOpacity' in gmx) { ctx.globalAlpha = gmx.rasterOpacity; }
                    ctx.fillStyle = ctx.createPattern(dattr.bgImage, 'no-repeat');
                    style.bgImage = true;
                }
                coordsToCanvas(utils.polygonToCanvasFill, true);
                ctx.globalAlpha = 1;
            }
            if (item.currentStyle.fillStyle || item.currentStyle.canvasPattern) {
                ctx.fillStyle = item.currentStyle.canvasPattern || item.currentStyle.fillStyle;
                coordsToCanvas(utils.polygonToCanvasFill, true);
            }
        }
    } else if (geoType === 'LINESTRING' || geoType === 'MULTILINESTRING') {
        coords = geom.coordinates;
        if (geoType === 'LINESTRING') { coords = [coords]; }
        var st = item.currentStyle || item.parsedStyleKeys;
        var isIconPath = st.iconPath || st.iconPath;
        var size = (item.currentStyle.maxSize || item.currentStyle.lineWidth) / options.topLeft.mInPixel;
        for (i = 0, len = coords.length; i < len; i++) {
			if (isIconPath) {
				var arr = tbounds.clipPolyLine(coords[i], true, size);
				for (j = 0, len1 = arr.length; j < len1; j++) {
					dattr.coords = arr[j];
					var pixels = utils.lineToCanvas(dattr);
					if (pixels) {
						ctx.save();
						utils.lineToCanvasAsIcon(pixels, dattr);
						ctx.restore();
					}
				}
			} else {
				dattr.coords = coords[i];
				utils.lineToCanvas(dattr);
			}
        }
    }
    return true;
};


/** Asynchronously request session keys from GeoMixer servers (given apiKey and server host)
*/
var gmxSessionManager = {
    APIKEY_PARAM: 'key',
    SCRIPT_REGEXP: [
		/\bleaflet-geomixer(-\w*)?\.js\b/,
		/\bgeomixer(-\w*)?\.js\b/
	],
    _scriptSearched: false,
    _scriptAPIKey: null,
    _searchScriptAPIKey: function() {
        var _this = this;
        if (this._scriptSearched) {
            return this._scriptAPIKey;
        }

        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src'),
				arr = this.SCRIPT_REGEXP;
			for (var j = 0, len = arr.length; j < len; j++) {
				if (arr[j].exec(src)) {
					var query = src.split('?')[1];

					if (query) {
						var params = query.split('&');
						for (var p = 0; p < params.length; p++) {
							var parsedParam = params[p].split('=');
							if (parsedParam[0] === _this.APIKEY_PARAM) {
								_this._scriptAPIKey = parsedParam[1];
								break;
							}
						}
					}
					break;
				}
            }
			if (_this._scriptAPIKey) {
				break;
			}
        }
        this._scriptSearched = true;
        return this._scriptAPIKey;
    },

    //we will search apiKey in script tags iff apiKey parameter is undefined.
    //if it is defined as falsy (null, '', etc), we won't send any requests to server
    requestSessionKey: function(serverHost, apiKey) {
        var keys = this._sessionKeys;

        if (!(serverHost in keys)) {
            apiKey = typeof apiKey === 'undefined' ? this._searchScriptAPIKey() : apiKey;
            keys[serverHost] = new Promise(function(resolve, reject) {
				if (apiKey) {
					gmxAPIutils.requestJSONP(L.gmxUtil.protocol + '//' + serverHost + '/ApiKey.ashx',
						{
							WrapStyle: 'func',
							Key: apiKey
						}
					).then(function(response) {
						if (response && response.Status === 'ok') {
							resolve(response.Result.Key);
						} else {
							reject();
						}
					}, reject);
				} else {
					resolve('');
				}
			});
        }
        return keys[serverHost];
    },

    //get already received session key
    getSessionKey: function(serverHost) {
		return this._sessionKeys[serverHost];
    },
    _sessionKeys: {} //deferred for each host
};
L.gmx = L.gmx || {};
L.gmx.gmxSessionManager = gmxSessionManager;


/** Asynchronously request information about map given server host and map name
*/
var gmxMapManager = {
    //serverHost should be host only string like 'maps.kosmosnimki.ru' without any slashes or 'http://' prefixes
    getMap: function(serverHost, apiKey, mapName, skipTiles, srs) {
		return gmxMapManager.loadMapProperties({
			srs: srs,
			hostName: serverHost,
			apiKey: apiKey,
			mapName: mapName,
			skipTiles: skipTiles
		});
    },

	loadMapProperties: function(options) {
        var maps = this._maps,
			serverHost = options.hostName || options.serverHost,
			mapName = options.mapName;

        if (!maps[serverHost] || !maps[serverHost][mapName]) {
			var opt = {
				WrapStyle: 'func',
				skipTiles: options.skipTiles || 'None', // All, NotVisible, None
				MapName: mapName,
				srs: options.srs || 3857,
				ftc: options.ftc || 'osm',
				ModeKey: 'map'
			};
			var promise = new Promise(function(resolve, reject) {
				gmxSessionManager.requestSessionKey(serverHost, options.apiKey).then(function(sessionKey) {
					opt.key = sessionKey;

					gmxAPIutils.requestJSONP(L.gmxUtil.protocol + '//' + serverHost + '/TileSender.ashx', opt).then(function(json) {
						if (json && json.Status === 'ok' && json.Result) {
							json.Result.properties.hostName = serverHost;
							json.Result.properties.sessionKey = sessionKey;
							L.gmx._maps[serverHost] = L.gmx._maps[serverHost] || {};
							L.gmx._maps[serverHost][mapName] = {
								_rawTree: json.Result,
								_nodes: {}
							};
							resolve(json.Result);
						} else {
							reject(json);
						}
					}, reject);
				}, reject);
			});
            maps[serverHost] = maps[serverHost] || {};
            maps[serverHost][mapName] = {promise: promise};
        }
        return maps[serverHost][mapName].promise;
    },

	syncParams: {},
    // установка дополнительных параметров для серверных запросов
    setSyncParams: function(hash) {
		this.syncParams = hash;
    },
    getSyncParams: function(stringFlag) {
		var res = this.syncParams;
		if (stringFlag) {
			var arr = [];
			for (var key in res) {
				arr.push(key + '=' + res[key]);
			}
			res = arr.join('&');
		}
		return res;
    },

    //we will (lazy) create index by layer name to speed up multiple function calls
    findLayerInfo: function(serverHost, mapID, layerID) {
		var hostMaps = L.gmx._maps[serverHost],
			layerInfo = null;

		if (hostMaps && hostMaps[mapID]) {
			var mapInfo = hostMaps[mapID];
			if (!mapInfo._nodes[layerID]) {
				gmxMapManager.iterateNode(mapInfo._rawTree, function(it) {
					mapInfo._nodes[it.content.properties.name] = it;
				});
			}
			layerInfo = mapInfo._nodes[layerID];
		}
		return layerInfo ? layerInfo.content : null;
    },
    iterateLayers: function(treeInfo, callback) {
        var iterate = function(arr) {
            for (var i = 0, len = arr.length; i < len; i++) {
                var layer = arr[i];

                if (layer.type === 'group') {
                    iterate(layer.content.children);
                } else if (layer.type === 'layer') {
                    callback(layer.content);
                }
            }
        };

        treeInfo && iterate(treeInfo.children);
    },
    iterateNode: function(treeInfo, callback) {
        var iterate = function(node) {
			var arr = node.children;
            for (var i = 0, len = arr.length; i < len; i++) {
                var layer = arr[i];

				callback(layer);
                if (layer.type === 'group') {
                    iterate(layer.content);
                }
            }
        };

        treeInfo && iterate(treeInfo);
    },
    _maps: {} //Promise for each map. Structure: maps[serverHost][mapID]: {promise:, layers:}
};

L.gmx = L.gmx || {};
L.gmx._maps = {};			// свойства слоев по картам
L.gmx._clientLayers = {};	// свойства слоев без карт (клиентские слои)

if (/\bsw=1\b/.test(location.search)) {
	L.gmx._sw = 1;	// признак загрузки данных через Service Worker
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('./gmx-sw1.js')
		  .then(function(registration) {
			console.log('ServiceWorker registration successful with scope: ', registration.scope);
		  })
		  .catch(function(err) {
			console.log('ServiceWorker registration failed: ', err);
		  });
	} else {
		console.error('Your browser does not support Service Workers.');
	}
}

L.gmx.gmxMapManager = gmxMapManager;


//Helper class, that represents layers of single Geomixer's map
//Creates layers from given map description
var gmxMap = L.Class.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    initialize: function(mapInfo, commonLayerOptions) {
		this.layers = [];
		this.layersByTitle = {};
		this.layersByID = {};
		this.dataManagers = {};

		var _this = this;

		this.properties = L.extend({}, mapInfo.properties);
		this.properties.BaseLayers = this.properties.BaseLayers ? JSON.parse(this.properties.BaseLayers) : [];
		this.rawTree = mapInfo;
		var _skipTiles = commonLayerOptions.skipTiles || 'All',
			_ftc = commonLayerOptions.ftc || 'osm',
			_srs = commonLayerOptions.srs || 3857;

		// var hostName = this.properties.hostName,
		var mapID = this.properties.name;

		this.layersCreated = new Promise(function(resolve) {
			var missingLayerTypes = {},
				dataSources = {};

			gmxMapManager.iterateLayers(mapInfo, function(layerInfo) {
				var props = layerInfo.properties,
					options = {
						mapID: mapID,
						sessionKey: mapInfo.properties.sessionKey,
						layerID: props.name
					};

				props.hostName = mapInfo.properties.hostName;
				if (mapInfo.srs) {
					props.srs = mapInfo.srs;
				}

				var type = props.ContentID || props.type,
					meta = props.MetaProperties || {},
					layerOptions = L.extend(options, commonLayerOptions);

				if (props.dataSource || 'parentLayer' in meta) {      	// Set dataSource layer
					layerOptions.parentLayer = props.dataSource || '';
					if ('parentLayer' in meta) {      	// todo удалить после изменений вов вьювере
						layerOptions.parentLayer = meta.parentLayer.Value || '';
					}
					dataSources[options.layerID] = {
						info: layerInfo,
						options: layerOptions
					};
				} else if (type in L.gmx._layerClasses) {
					_this.addLayer(L.gmx.createLayer(layerInfo, layerOptions));
				} else {
					missingLayerTypes[type] = missingLayerTypes[type] || [];
					missingLayerTypes[type].push({
						info: layerInfo,
						options: layerOptions
					});
				}
			});

			//load missing layer types
			var loaders = [];
			for (var type in missingLayerTypes) {
				loaders.push(L.gmx._loadLayerClass(type).then(/*eslint-disable no-loop-func */function (type) {/*eslint-enable */
					var it = missingLayerTypes[type];
					for (var i = 0, len = it.length; i < len; i++) {
						_this.addLayer(L.gmx.createLayer(it[i].info, it[i].options));
					}
				}.bind(null, type)));
			}
			var hosts = {}, host, id, it;
			for (id in dataSources) {
				it = dataSources[id];
				var opt = it.options,
					pId = opt.parentLayer,
					pLayer = this.layersByID[pId];
				if (pLayer) {
					it.options.parentOptions = pLayer.getGmxProperties();
					it.options.dataManager = this.dataManagers[pId] || new DataManager(it.options.parentOptions, true);
					this.dataManagers[pId] = it.options.dataManager;
					this.addLayer(L.gmx.createLayer(it.info, it.options));
				} else {
					host = opt.hostName;
					if (!hosts[host]) { hosts[host] = {}; }
					if (!hosts[host][pId]) { hosts[host][pId] = []; }
					hosts[host][pId].push(id);
				}
			}
			for (host in hosts) {
				var arr = [],
					prefix = L.gmxUtil.protocol + '//' + host;
				for (id in hosts[host]) {
					arr.push({Layer: id});
				}
				loaders.push(L.gmxUtil.requestJSONP(prefix + '/Layer/GetLayerJson.ashx',
					{
						WrapStyle: 'func',
						skipTiles: _skipTiles,
						srs: _srs,
						ftc: _ftc,
						Layers: JSON.stringify(arr)
					},
					{
						ids: hosts[host]
					}
				).then(function(json, opt) {
					if (json && json.Status === 'ok' && json.Result) {
						json.Result.forEach(function(it) {
							var props = it.properties,
								pId = props.name;

							props.tiles = [];
							props.srs = _srs;
							props.ftc = _ftc;
							var dataManager = _this.addDataManager(it);
							if (opt && opt.ids && opt.ids[pId]) {
								opt.ids[pId].forEach(function(id) {
									var pt = dataSources[id];
									pt.options.parentOptions = it.properties;
									pt.options.dataManager = dataManager;
									pt.info.properties.tiles = [];	// Шумилов должен убрать
									pt.info.properties.srs = _srs;
									pt.info.properties.ftc = _ftc;
									_this.addLayer(L.gmx.createLayer(pt.info, pt.options));
								});
							}
						});
					} else {
						console.info('Error: loading ', prefix + '/Layer/GetLayerJson.ashx', json.ErrorInfo);
						if (opt && opt.ids) {
							for (var pId in opt.ids) {
								opt.ids[pId].forEach(function(id) {
									_this.addLayer(new L.gmx.DummyLayer(dataSources[id].info.properties));
								});
							}
						}
					}
				}));
			}
			Promise.all(loaders).then(resolve);
		}.bind(this));
	},

	addDataManager: function(it) {
		var pid = it.properties.name;
		if (!this.dataManagers[pid]) {
			this.dataManagers[pid] = new DataManager(it.properties);
		}
		return this.dataManagers[pid];
	},
	getDataManager: function(id) {
		return this.dataManagers[id];
	},

	addLayer: function(layer) {
		var props = layer.getGmxProperties();

		this.layers.push(layer);
		this.layersByTitle[props.title] = layer;
		this.layersByID[props.name] = layer;
		this.fire('layeradd', {layer: layer});

		return this;
	},

	removeLayer: function(layer) {
		var props = layer.getGmxProperties();

		for (var i = 0; i < this.layers.length; i++) {
			if (this.layers[i].getGmxProperties().name === props.name) {
				this.layers.splice(i, 1);
				break;
			}
		}

		delete this.layersByTitle[props.title];
		delete this.layersByID[props.name];
		this.fire('layerremove', {layer: layer});

		return this;
	},

	addLayersToMap: function(leafletMap) {
		for (var l = this.layers.length - 1; l >= 0; l--) {
			var layer = this.layers[l];
			if (layer.getGmxProperties().visible) {
				leafletMap.addLayer(layer);
			}
		}

		return this;
	}
});
L.gmx = L.gmx || {};
L.gmx.gmxMap = gmxMap;


/*
 * gmxEventsManager - handlers manager
 */
var GmxEventsManager = L.Handler.extend({
    options: {
    },

    initialize: function (map) {
        this._map = map;
        this._layers = {};
        this._lastLayer = null;
        this._lastId = null;
        var _this = this;
        this._drawstart = null;
        this._lastCursor = '';

        var isDrawing = function () {
            if (_this._drawstart) {
                return true;
            } else if (_this._drawstart === null) {
                if (map.gmxControlsManager) {
                    var drawingControl = map.gmxControlsManager.get('drawing');
                    if (drawingControl) {
                        drawingControl.on('activechange', function (ev) {
                            _this._drawstart = ev.activeIcon;
                            map._container.style.cursor = _this._drawstart ? 'pointer' : '';
                        });
                    }
                }
                _this._drawstart = false;
            }
            return false;
        };

        var getDomIndex = function (layer) {
            var container = layer._container;
            if (container) {
                var arr = container.parentNode.childNodes;
                for (var i = 0, len = arr.length; i < len; i++) {
                    if (container === arr[i]) {
                        return i;
                    }
                }
            }
            return 0;
        };

        // var skipNodeName = {
            // IMG: true,
            // DIV: true,
            // path: true
        // };

        var clearLastHover = function () {
            if (_this._lastLayer) {
                _this._lastLayer.gmxEventCheck({type: 'mousemove'}, true);
                _this._lastLayer = null;
            }
        };

        var eventCheck = function (ev) {
            var type = ev.type,
                map = _this._map;
                // skipNode = false;
            if (ev.originalEvent) {
                map.gmxMouseDown = L.Browser.webkit && !L.gmxUtil.isIEOrEdge ? ev.originalEvent.which : ev.originalEvent.buttons;
                // var target = ev.originalEvent.target;
                // skipNode = skipNodeName[target.nodeName] && !L.DomUtil.hasClass(target, 'leaflet-tile') && !L.DomUtil.hasClass(target, 'leaflet-popup-tip-container');
            }
            if (map._animatingZoom ||
                isDrawing() ||
                !ev.latlng ||
                (type === 'click' &&  map._skipClick) ||        // from drawing
                (type === 'mousemove' &&  map.gmxMouseDown)
                ) {
                clearLastHover();
                map._skipClick = false;
                return;
            }
            if (ev.layerPoint) {
                map._gmxMouseLatLng = ev.latlng;
                map.gmxMousePos = map.getPixelOrigin().add(ev.layerPoint);
            }

            var arr = Object.keys(_this._layers).sort(function(a, b) {
                var la = map._layers[a],
                    lb = map._layers[b];
                if (la && lb) {
                    var oa = la.options, ob = lb.options,
                        za = (oa.zIndexOffset || 0) + (oa.zIndex || 0),
                        zb = (ob.zIndexOffset || 0) + (ob.zIndex || 0),
                        delta = zb - za;
                    return delta ? delta : _this._layers[b] - _this._layers[a];
                }
                return 0;
            });

            var layer,
                foundLayer = null,
                cursor = '';

            for (var i = 0, len = arr.length; i < len; i++) {
                var id = arr[i];
                layer = map._layers[id];
                if (layer && layer._map && !layer._animating && layer.options.clickable) {
                    if (layer.gmxEventCheck(ev)) {
                        if (layer.hasEventListeners('mouseover')) {
                            cursor = 'pointer';
                        }
                        foundLayer = layer;
                        break;
                    }
                }
            }
            if (_this._lastCursor !== cursor && !isDrawing()) {
                map._container.style.cursor = cursor;
            }
            _this._lastCursor = cursor;

            if (type !== 'zoomend') {
                if (foundLayer) {
                    if (_this._lastLayer !== foundLayer) {
                        clearLastHover();
                    }
                    _this._lastLayer = foundLayer;
                } else {
                    clearLastHover();
                }
            }
        };

        map.on({
            zoomend: function () {
                if (map._gmxMouseLatLng) {
                    setTimeout(function () {
                        eventCheck({type: 'mousemove', latlng: map._gmxMouseLatLng});
                    }, 0);
                }
            },
            click: eventCheck,
            dblclick: eventCheck,
            mousedown: eventCheck,
            mouseup: eventCheck,
            mousemove: eventCheck,
            contextmenu: eventCheck,
            layeradd: function (ev) {
                var layer = ev.layer;
                if ('gmxEventCheck' in layer && layer.options.clickable) {
                    _this._layers[layer._leaflet_id] = getDomIndex(layer);
                }
            },
            layerremove: function (ev) {
                var id = ev.layer._leaflet_id;
                delete _this._layers[id];
                if (_this._lastLayer && _this._lastLayer._leaflet_id === id) {
                    _this._lastLayer = null;
                    _this._lastId = 0;
                }
            }
        }, this);
    }
});

L.Map.addInitHook(function () {
    // Check to see if handler has already been initialized.
    if (!this._gmxEventsManager) {
        this._gmxEventsManager = new GmxEventsManager(this);
		this.isGmxDrawing = function () {
			return this._gmxEventsManager._drawstart;
		};

        this.on('remove', function () {
            if (this._gmxEventsManager) {
                this._gmxEventsManager.removeHooks();
            }
        });
    }
});


(function() {
    var DEFAULT_LANGUAGE = 'rus',
        _setKeyText = function(lang, key, item, hash) {
            if (!hash[lang]) { hash[lang] = {}; }
            hash[lang][key] = item;
        };
    L.gmxLocale = {

        setLanguage: function(lang) {
            this._language = lang;
        },

        getLanguage: function() {
            return window.language || this._language || DEFAULT_LANGUAGE;
        }
    };

    L.gmxLocaleMixin = {
        addText: function() {
            var lang = arguments[0],
                newHash = arguments[1];
            if (arguments.length === 1) {
                newHash = lang;
                lang = null;
            }
            for (var k in newHash) {
                if (lang === null) {
                    for (var k1 in newHash[k]) {
                        _setKeyText(k, k1, newHash[k][k1], this);
                    }
                } else {
                    _setKeyText(lang, k, newHash[k], this);
                }
            }
            return this;
        },

        getText: function(key) {
            var lang = L.gmxLocale.getLanguage(),
                locale = this[lang] || {};

            var keyArr = key ? key.split(/\./) : [];
            for (var i = 0, len = keyArr.length; i < len; i++) {
                if (!locale) { break; }
                locale = locale[keyArr[i]];
            }
            return locale;
        }
    };
    L.extend(L.gmxLocale, L.gmxLocaleMixin);
})();


L.extend(L.gmxLocale, {
    rus: {
        Coordinates : 'Координаты',
        Length : 'Длина',
        nodeLength : 'Длина от начала',
        edgeLength : 'Длина сегмента',
        Area : 'Площадь',
        Perimeter : 'Периметр',
        units: {
            m: 'м',
            nm: 'м.мили',
            km: 'км',
            m2: 'кв. м',
            km2: 'кв. км',
            ha: 'га',
            m2html: 'м<sup>2',
            km2html: 'км<sup>2'
        }
    }
});


L.extend(L.gmxLocale, {
    eng: {
        Coordinates : 'Coordinates',
        Length : 'Length',
        nodeLength : 'From start point',
        edgeLength : 'Segment length',
        Area : 'Area',
        Perimeter : 'Perimeter',
        units: {
            m: 'm',
            nm: 'nmi',
            km: 'km',
            m2: 'sq. m',
            km2: 'sq. km',
            ha: 'ha',
            m2html: 'm<sup>2',
            km2html: 'km<sup>2'
        }
    }
});


var gmxVectorTileLoader = {
    _loadedTiles: {},
    _getKey: function(ti) {
        return [ti.layerID, ti.x, ti.y, ti.z, typeof ti.d === 'undefined' ? -1 : ti.d, typeof ti.s === 'undefined' ? -1 : ti.s, ti.v].join(':');
    },
    load: function(tileSenderPrefix, tileInfo) {
        var key = gmxVectorTileLoader._getKey(tileInfo);

        if (!this._loadedTiles[key]) {
            var requestParams = {
                ModeKey: 'tile',
                ftc: 'osm',
                r: 'j',
                LayerName: tileInfo.layerID,
                z: tileInfo.z,
                x: tileInfo.x,
                y: tileInfo.y,
                v: tileInfo.v
            };

            if (tileInfo.srs) {
                requestParams.srs = tileInfo.srs;
            }
            if (tileInfo.d !== -1) {
                requestParams.Level = tileInfo.d;
                requestParams.Span = tileInfo.s;
            }
            if (L.gmx._sw) {
                requestParams.sw = L.gmx._sw;
            }

			var promise = new Promise(function(resolve, reject) {
				var query = tileSenderPrefix + '&' + Object.keys(requestParams).map(function(name) {
					return name + '=' + requestParams[name];
				}).join('&');
				fetch(query, {
					mode: 'cors',
					credentials: 'include'
				})
					.then(function(response) { return response.text(); })
					.then(function(txt) {
						var pref = 'gmxAPI._vectorTileReceiver(';
						if (txt.substr(0, pref.length) === pref) {
							txt = txt.replace(pref, '');
							var data = JSON.parse(txt.substr(0, txt.length -1));
							resolve(data);
						} else {
							reject();
						}
					});
			});
            this._loadedTiles[key] = promise;
        }
        return this._loadedTiles[key];
    }
};

window.gmxAPI = window.gmxAPI || {};
window.gmxAPI._vectorTileReceiver = window.gmxAPI._vectorTileReceiver || function(data) {
    var key = gmxVectorTileLoader._getKey({
        layerID: data.LayerName,
        x: data.x,
        y: data.y,
        z: data.z,
        d: data.level,
        s: data.span,
        v: data.v
    });

    gmxVectorTileLoader._loadedTiles[key] && gmxVectorTileLoader._loadedTiles[key].resolve({
		bbox: data.bbox,
		srs: data.srs,
		isGeneralized: data.isGeneralized,
		values: data.values
	});
};


//Single vector tile, received from GeoMixer server
//  dataProvider: has single method "load": function(x, y, z, v, s, d, callback), which calls "callback" with the following parameters:
//      - {Object[]} data - information about vector objects in tile
//      - {Number[4]} [bbox] - optional bbox of objects in tile
//  options:
//      x, y, z, v, s, d: GeoMixer vector tile point
//      dateZero: zero Date for temporal layers
//      isGeneralized: flag for generalized tile
var VectorTile = function(dataProvider, options) {
    this.dataProvider = dataProvider;
    this.x = options.x;
    this.y = options.y;
    this.z = options.z;
    this.v = options.v;
    this.s = options.s || -1;
    this.d = options.d || -1;
    // this._itemsArr = options._itemsArr;
    this.attributes = options.attributes;
    this.isGeneralized = options.isGeneralized;
    this.isFlatten = options.isFlatten;
    this.bounds = gmxAPIutils.getBoundsByTilePoint(this.z ? options : {z:0, x:0, y:0});
    this.gmxTilePoint = {x: this.x, y: this.y, z: this.z, s: this.s, d: this.d};
    this.vectorTileKey = VectorTile.makeTileKey(this.x, this.y, this.z, this.v, this.s, this.d);

    if (this.s >= 0 && options.dateZero) {
        this.beginDate = new Date(options.dateZero.valueOf() + this.s * this.d * gmxAPIutils.oneDay * 1000);
        this.endDate = new Date(options.dateZero.valueOf() + (this.s + 1) * this.d * gmxAPIutils.oneDay * 1000);
    }
	this.clear();
};

VectorTile.prototype = {
    addData: function(data, keys) {

        if (keys) {
            this.removeData(keys, true);
        }

        var len = data.length,
            dataOptions = new Array(len),
            dataBounds = gmxAPIutils.bounds();
        for (var i = 0; i < len; i++) {
            var dataOption = this._parseItem(data[i]);
            dataOptions[i] = dataOption;
            dataBounds.extendBounds(dataOption.bounds);
        }

        if (!this.data) {
            this.data = data;
            this.dataOptions = dataOptions;
        } else {
            this.data = this.data.concat(data);
            this.dataOptions = this.dataOptions.concat(dataOptions);
        }

        this.loaded(data);
        return dataBounds;
    },

    removeData: function(keys) {
        for (var arr = this.data || [], i = arr.length - 1; i >= 0; i--) {
            if (keys[arr[i][0]]) {
                arr.splice(i, 1);
                if (this.dataOptions) { this.dataOptions.splice(i, 1); }
            }
        }
    },

    loaded: function(data) {
        this.state = 'loaded';
        this._resolve(data);
    },

    load: function() {
        if (this.state === 'notLoaded') {
            this.state = 'loading';
            var _this = this;
            this.dataProvider.load(_this.x, _this.y, _this.z, _this.v, _this.s, _this.d, function(data) {
                _this.bbox = data.bbox;
                _this.srs = data.srs;
                _this.isGeneralized = data.isGeneralized;
                _this.addData(data.values);
            });
        }

        return this.loadDef;
    },

    clear: function() {
        this.state = 'notLoaded';	 //notLoaded, loading, loaded
        this.data = null;
        this.dataOptions = null;

		this.loadDef = new Promise(function(resolve, reject) {
			this._resolve = resolve;
			this._reject = reject;
        }.bind(this));
    },

    // TODO: Для упаковки атрибутов
	// _getLinkProp: function(nm, val) {
		// var attr = this.attributes,
			// name = attr[nm - 1],
			// arr = this._itemsArr[name],
			// len = arr.length,
			// i = 0;

		// for (; i < len; i++) {
			// if (val === arr[i]) { return i; }
		// }
		// arr[i] = val;
		// return i;
    // },

    _parseItem: function(it) {
        var len = it.length - 1,
			// props = new Uint32Array(len),
			i;

        // props[0] = it[0];
		// TODO: old properties null = ''
        for (i = 1; i < len; i++) {
            if (it[i] === null) { it[i] = ''; }
			// props[i] = this._getLinkProp(i, it[i]);
        }

        var geo = it[len],
            needFlatten = this.isFlatten,
            type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            isPolygon = type === 'POLYGON' || type === 'Polygon',
            coords = geo.coordinates,
            hiddenLines = [],
            bounds = null,
            boundsArr = [];

        if (isLikePolygon) {
            if (isPolygon) { coords = [coords]; }
            bounds = gmxAPIutils.bounds();
            var edgeBounds = gmxAPIutils.bounds().extendBounds(this.bounds).addBuffer(-0.05),
                hiddenFlag = false;
            for (i = 0, len = coords.length; i < len; i++) {
                var arr = [],
                    hiddenLines1 = [];

                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    if (needFlatten && typeof coords[i][j][0] !== 'number') {
                        coords[i][j] = gmxAPIutils.flattenRing(coords[i][j]);
                    }
                    var b = gmxAPIutils.bounds(coords[i][j]);
                    arr.push(b);
                    if (j === 0) { bounds.extendBounds(b); }
                    // EdgeLines calc
                    var edgeArr = gmxAPIutils.getHidden(coords[i][j], edgeBounds);
                    hiddenLines1.push(edgeArr);
                    if (edgeArr.length) {
                        hiddenFlag = true;
                    }
                }
                boundsArr.push(arr);
                hiddenLines.push(hiddenLines1);
            }
            if (!hiddenFlag) { hiddenLines = null; }
            if (isPolygon) { boundsArr = boundsArr[0]; }
        } else if (type === 'POINT' || type === 'Point') {
            bounds = gmxAPIutils.bounds([coords]);
        } else if (type === 'MULTIPOINT' || type === 'MultiPoint') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                bounds.extendBounds(gmxAPIutils.bounds([coords[i]]));
            }
        } else if (type === 'LINESTRING' || type === 'LineString') {
            bounds = gmxAPIutils.bounds(coords);
        } else if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                bounds.extendBounds(gmxAPIutils.bounds(coords[i]));
            }
        }
        var dataOption = {
            // props: props,
            bounds: bounds,
            boundsArr: boundsArr
        };
        if (hiddenLines) {
            dataOption.hiddenLines = hiddenLines;
        }
        return dataOption;
    }
};
//class methods

VectorTile.makeTileKey = function(x, y, z, v, s, d) {
    return z + '_' + x + '_' + y + '_' + v + '_' + s + '_' + d;
};

VectorTile.createTileKey = function(opt) {
    return [opt.z, opt.x, opt.y, opt.v, opt.s, opt.d].join('_');
};

VectorTile.parseTileKey = function(gmxTileKey) {
    var p = gmxTileKey.split('_').map(function(it) { return Number(it); });
    return {z: p[0], x: p[1], y: p[2], v: p[3], s: p[4], d: p[5]};
};

VectorTile.boundsFromTileKey = function(gmxTileKey) {
    var p = VectorTile.parseTileKey(gmxTileKey);
    return gmxAPIutils.getTileBounds(p.x, p.y, p.z);
};


//Single observer with vector data
var Observer = L.Class.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
    /* options : {
            type: 'resend | update',    // `resend` - send all data (like screen tile observer)
                                        // `update` - send only changed data
            callback: Func,             // will be called when layer's data for this observer is changed
            dateInterval: [dateBegin,dateEnd], // temporal interval
            bbox: bbox,                 // bbox to observe on Mercator
            filters: [String]           // filter keys array
            active: [Boolean=true]      // is this observer active
            layerID: String           	// ID слоя view
			target: String				// ключ назначения обсервера
			z: zoom						// zoom для 'screen' обсервера
            targetZoom: [Number]        // for zoom generalized type default(null)
			topLeft: {}					// для screen
            needBbox: [Boolean=false]   // режим запросов списка тайлов по BBOX
        }
    */
    initialize: function(options) {
        this.type = options.type || 'update';
        this._callback = options.callback;
        this.layerID = options.layerID;
        this.target = options.target;
        this.itemHook = options.itemHook;	// set hook for item (set empty data for callback function)
        this._items = null;
        this.bbox = options.bbox;      		// set bbox by Mercator bounds
        this.needBbox = options.needBbox;   // режим запросов списка тайлов по BBOX
        this.filters = options.filters || [];
        this.targetZoom = options.targetZoom || null;
        this.active = 'active' in options ? options.active : true;
        this.srs = options.srs || 3857;	// 3857, 3395

        if (options.bounds) {   // set bbox by LatLngBounds
            this.setBounds(options.bounds);
        }

		var w = gmxAPIutils.worldWidthMerc,
			dx;
        if (!this.bbox) {
            this.bbox = gmxAPIutils.bounds([[-w, -w], [w, w]]);
            this.world = true;
        } else if (this.bbox.max.x > w) {
			dx = this.bbox.max.x - w;
            this.bbox1 = gmxAPIutils.bounds([[dx - w, this.bbox.max.y], [-(dx + w), this.bbox.min.y]]);
        } else if (this.bbox.min.x < -w) {
			dx = this.bbox.min.x + w;
            this.bbox1 = gmxAPIutils.bounds([[dx + w, this.bbox.max.y], [w - dx, this.bbox.min.y]]);
        }

        if (options.dateInterval) {
            this._setDateInterval(options.dateInterval[0], options.dateInterval[1]);
        }
    },

    hasFilter: function(filterName) {
        for (var i = 0, len = this.filters.length; i < len; i++) {
            if (this.filters[i] === filterName) {
                return true;
            }
        }
        return false;
    },

    activate: function() {
        if (!this.active) {
            this.active = true;
            this.fire('activate');
        }
        return this;
    },

    deactivate: function() {
        if (this.active) {
            this.active = false;
            this.fire('activate');
        }
        return this;
    },

    toggleActive: function(isActive) {
        return isActive ? this.activate() : this.deactivate();
    },

    isActive: function() {
        return this.active;
    },

    updateData: function(data) {
        var len = data.length,
            out = {count: len};

        if (this.type === 'update') {
            //calculate difference with previous data
            if (!this._items) { this._items = {}; }
            var prevItems = this._items,
                newItems = {},
                added = [],
                removed = [],
                key;

            for (var i = 0; i < len; i++) {
                var it = data[i];

                key = it.id + '_' + it.tileKey;

                newItems[key] = it;

                if (!prevItems[key]) {
                    added.push(it);
                }
            }

            for (key in prevItems) {
                if (!newItems[key]) {
                    removed.push(prevItems[key]);
                }
            }

            if (added.length) {
                out.added = added;
            }
            if (removed.length) {
                out.removed = removed;
            }

            this._items = newItems;

        } else {
            out.added = data;
        }
		this.fire('data', {data: this._callback(out)});
        out = null;
        data = null;

        return this;
    },

    removeData: function(keys) {
        if (this.type !== 'update' || !this._items) {
            return this;
        }

        var items = this._items,
            removed = [];

        for (var id in keys) {
            if (items[id]) {
                removed.push(items[id]);
                delete items[id];
            }
        }

        if (removed.length) {
            this._callback({removed: removed});
        }

        return this;
    },

    /*setFilter: function (func) {
        this._filters.userFilter = func;
        this.fire('update');
        return this;
    },

    removeFilter: function () {
        delete this._filters.userFilter;
        this.fire('update');
        return this;
    },*/

    setBounds: function(bounds, buffer) {
        var w;
        if (!bounds) {
            if (!this.world) {
                w = gmxAPIutils.worldWidthMerc;
                this.bbox = gmxAPIutils.bounds([[-w, -w], [w, w]]);
                this.bbox1 = null;
                this.world = true;
                this.fire('update');
            }
            return this;
        }

        var min = bounds.min,
            max = bounds.max;
        if (!min || !max) {
            var latLngBounds = L.latLngBounds(bounds),
                sw = latLngBounds.getSouthWest(),
                ne = latLngBounds.getNorthEast();
            min = {x: sw.lng, y: sw.lat};
            max = {x: ne.lng, y: ne.lat};
        }
        var minX = min.x, maxX = max.x,
            minY = min.y, maxY = max.y,
            minX1 = null,
            maxX1 = null;

        this.world = false;
        w = (maxX - minX) / 2;
        if (w >= 180) {
            minX = -180; maxX = 180;
            this.world = true;
        } else if (maxX > 180 || minX < -180) {
            var center = ((maxX + minX) / 2) % 360;
            if (center > 180) { center -= 360; }
            else if (center < -180) { center += 360; }
            minX = center - w; maxX = center + w;
            if (minX < -180) {
                minX1 = minX + 360; maxX1 = 180; minX = -180;
            } else if (maxX > 180) {
                minX1 = -180; maxX1 = maxX - 360; maxX = 180;
            }
        }
		var crs = this.srs == 3857 ? L.CRS.EPSG3857 : L.Projection.Mercator,
			m1 = crs.project(L.latLng(minY, minX)),
			m2 = crs.project(L.latLng(maxY, maxX));

		this.bbox = gmxAPIutils.bounds([[m1.x, m1.y], [m2.x, m2.y]]);
		if (buffer) { this.bbox.addBuffer(buffer); }
        this.bbox1 = null;
        if (minX1) {
            m1 = crs.project(L.latLng(minY, minX1));
            m2 = crs.project(L.latLng(maxY, maxX1));
            this.bbox1 = gmxAPIutils.bounds([[m1.x, m1.y], [m2.x, m2.y]]);
			if (buffer) { this.bbox1.addBuffer(buffer); }
        }

        this.fire('update');
        return this;
    },

    intersects: function(bounds) {
        return this.world || this.bbox.intersects(bounds) || !!(this.bbox1 && this.bbox1.intersects(bounds));
    },

    intersectsWithTile: function(tile) {
        if (this.targetZoom && !this.needBbox) {
            var z = this.targetZoom + (this.targetZoom % 2 ? 1 : 0);
            if ((tile.isGeneralized && tile.z !== z) || tile.z > z) { return false; }
        }
        var di = this.dateInterval;
        return this.intersects(tile.bounds) && (!tile.beginDate || (di && di.endDate >= tile.beginDate && di.beginDate <= tile.endDate));
    },

    intersectsWithGeometry: function(geometry) {
        var type = geometry.type.toUpperCase(),
			coords = geometry.coordinates;
		if (type === 'POINT') {
			return this.world || this.bbox.contains(coords) || !!(this.bbox1 && this.bbox1.contains(coords));
		} else if (type === 'POLYGON') {
			coords = [coords[0]];
		} else if (type === 'MULTIPOLYGON') {
			coords = coords.map(function(arr) { return arr[0]; });
        } else if (type === 'LINESTRING') {
			coords = [coords];
        // } else if (type === 'MULTILINESTRING') {
		}
		for (var i = 0, len = coords.length; i < len; i++) {
			if (this.bbox.clipPolygon(coords[i]).length || (this.bbox1 && this.bbox1.clipPolygon(coords[i]).length)) {
				return true;
			}
		}
		return false;
    },

    _setDateInterval: function(beginDate, endDate) {
        if (beginDate && endDate) {
            // var beginValue = beginDate.valueOf(),
                // endValue = endDate.valueOf();
            this.dateInterval = {
                beginDate: beginDate,
                endDate: endDate
            };
        } else {
            this.dateInterval = null;
        }
    },

    setDateInterval: function(beginDate, endDate) {
        var isValid = beginDate && endDate;

        if (!this.dateInterval !== !isValid ||
            isValid && (
                this.dateInterval.beginDate.valueOf() !== beginDate.valueOf() ||
                this.dateInterval.endDate.valueOf() !== endDate.valueOf()
            )
        ) {
            this._setDateInterval(beginDate, endDate);
            this.fire('update', {temporalFilter: true});
        }
        return this;
    }
});
L.gmx.observer = function(options) {
    return new Observer(options);
};


(function() {
//tree for fast tiles selection inside temporal interval
//  options:
//      TemporalTiles: tilePoints array
//      TemporalVers: tiles version array
//      TemporalPeriods: periods
//      ZeroDate: start Date
var TilesTree = function(options) {
    var _rootNodes = [],
        tiles = options.TemporalTiles || [],
        vers = options.TemporalVers || [],
        periods = options.TemporalPeriods || [],
        maxPeriod = periods[periods.length - 1],
        smin = Number.MAX_VALUE,
        arr = options.ZeroDate.split('.'),
        zn = new Date(
            (arr.length > 2 ? arr[2] : 2008),
            (arr.length > 1 ? arr[1] - 1 : 0),
            (arr.length > 0 ? arr[0] : 1)
        ),
        dateZero = new Date(zn.getTime()  - zn.getTimezoneOffset() * 60000),
        zeroUT = dateZero.getTime() / 1000;

    this.dateZero = dateZero;

    var addTile = function (node, tile, key) {
        var d = node.d;
        if (tile.d === periods[d]) {
            node.count++;
            node.tiles.push(key);
            return;
        }

        var pd = periods[d - 1],
            childrenCount = periods[d] / pd;

        if (!('children' in node)) {
            node.children = new Array(childrenCount);
        }

        var sChild = Math.floor(tile.s * tile.d / pd),
            ds = sChild - node.s * childrenCount;

        if (!node.children[ds]) {
            var pdOneDay = pd * gmxAPIutils.oneDay,
                t1 = sChild * pdOneDay + zeroUT;
            node.children[ds] = {
                d: d - 1,
                s: sChild,
                t1: t1,
                t2: t1 + pdOneDay,
                count: 0,
                children: [],
                tiles: []
            };
        }

        addTile(node.children[ds], tile, key);
    };

    var dmax = periods.length - 1,
        dmaxOneDay = periods[dmax] * gmxAPIutils.oneDay,
        i, len;

    for (i = 0, len = tiles.length; i < len; i++) {
        arr = tiles[i];
        var s = Number(arr[1]),
            d = Number(arr[0]);

        if (d === maxPeriod) {
            smin = Math.min(smin, s);
        }
    }
    for (i = 0, len = tiles.length; i < len; i++) {
        arr = tiles[i];
        var t = {
            x: Number(arr[2]),
            y: Number(arr[3]),
            z: Number(arr[4]),
            v: Number(vers[i]),
            s: Number(arr[1]),
            d: Number(arr[0])
        };
        if (t.d < 0) {
            continue;
        }

        var ds = Math.floor(t.s * t.d / periods[dmax]) - smin,
            cs = ds + smin;

        _rootNodes[ds] = _rootNodes[ds] || {
            d: dmax,
            s: cs,
            t1: cs * dmaxOneDay + zeroUT,
            t2: (cs + 1) * dmaxOneDay + zeroUT,
            count: 0,
            tiles: []
        };
        var key = VectorTile.createTileKey(t);

        addTile(_rootNodes[ds], t, key);
    }
    tiles = vers = null;

    //options: bounds (in mercator projection)
    this.selectTiles = function(t1, t2, options) {

        options = options || {};

        var t1Val = t1.valueOf() / 1000,
            t2Val = t2.valueOf() / 1000;

        // We will restrict tile levels by the nearest two levels to target date interval length
        // For example, if date interval length is 3 days, we wll search tiles among 1-day and 4-day tiles
        var minLevel = 0,
            dateIntervalLength = (t2Val - t1Val) / 3600 / 24;

        for (var i = 0; i < periods.length; i++) {
            if (periods[i] > dateIntervalLength) {
                minLevel = Math.max(0, i - 1);
                break;
            }
        }

        if (periods[periods.length - 1] <= dateIntervalLength) {
            minLevel = periods.length - 1;
        }

        var maxLevel = Math.min(periods.length - 1, minLevel + Number(dateIntervalLength > periods[minLevel]));

        var getCountOfIntersected = function(tileBounds, bounds) {
            var count = 0;
            for (var t = 0; t < tileBounds.length; t++) {
                if (tileBounds[t].intersects(bounds)) {
                    count++;
                }
            }

            return count;
        };

        // --------------------
        var selectTilesForNode = function(node, t1, t2) {
            if (t1 >= node.t2 || t2 <= node.t1) {
                return {count: 0, tiles: [], nodes: []};
            }

            if (options.bounds && !node.tileBounds) {
                node.tileBounds = node.tiles.map(function(it) {
                    return VectorTile.boundsFromTileKey(it);
                });
            }

            if (node.d === minLevel) {
                var count = options.bounds ? getCountOfIntersected(node.tileBounds, options.bounds) : node.count;
                return {
                    tiles: node.tiles,
                    count: count,
                    nodes: [node]
                };
            }

            var childrenCount = 0, //number of tiles if we use shorter intervals
                childrenRes = [],
				len = node.children ? node.children.length : 0,
                ds;

            for (ds = 0; ds < len; ds++) {
                if (node.children[ds]) {
                    childrenRes[ds] = selectTilesForNode(node.children[ds], Math.max(t1, node.t1), Math.min(t2, node.t2));
                } else {
                    childrenRes[ds] = {count: 0, tiles: [], nodes: []};
                }
                childrenCount += childrenRes[ds].count;
            }

            var intersectCount = options.bounds ? getCountOfIntersected(node.tileBounds, options.bounds) : node.count;

            if (node.d > maxLevel || childrenCount < intersectCount) {
                var resTilesArr = [],
                    resNodesArr = [];
                for (ds = 0; ds < childrenRes.length; ds++) {
                    resNodesArr.push(childrenRes[ds].nodes);
                    resTilesArr.push(childrenRes[ds].tiles);
                }

                return {
                    tiles: [].concat.apply([], resTilesArr),
                    count: childrenCount,
                    nodes: [].concat.apply([], resNodesArr)
                };
            } else {
                return {
                    tiles: node.tiles,
                    count: intersectCount,
                    nodes: [node]
                };
            }
        };

        var resTiles = [];
        for (var ds = 0; ds < _rootNodes.length; ds++) {
            if (_rootNodes[ds]) {
                var nodeSelection = selectTilesForNode(_rootNodes[ds], t1Val, t2Val);
                if (nodeSelection.tiles.length) {
                    resTiles = resTiles.concat(nodeSelection.tiles);
                }
            }
        }

        var resTilesHash = {};
        for (var t = 0; t < resTiles.length; t++) {
            resTilesHash[resTiles[t]] = true;
        }

        return {tiles: resTilesHash};
    };

    this.getNode = function(d, s) {
        if (d < 0 || s < 0) {
            return null;
        }

        var findNode = function(node, d, s) {
            if (!node) { return null; }

            if (periods[node.d] === d) {
                return node.s === s ? node : null;
            }

            var childrenCount = periods[node.d] / periods[node.d - 1];
            var sChild = Math.floor(s * d / periods[node.d - 1]);
            var ds = sChild - node.s * childrenCount;

            return node.children[ds] ? findNode(node.children[ds], d, s) : null;
        };

        for (var ds = 0; ds < _rootNodes.length; ds++) {
            var node = findNode(_rootNodes[ds], d, s);
            if (node) {
                return node;
            }
        }

        return null;
    };
};
L.gmx.tilesTree = function(options) {
    return new TilesTree(options);
};
})();


var ObserverTileLoader = L.Class.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
    initialize: function(dataManager) {
        this._dataManager = dataManager;
        this._observerData = {};
        this._tileData = {};
    },

    addObserver: function(observer) {
        this._observerData[observer.id] = {
            observer: observer,
            tiles: {},
            leftToLoad: 0,
            loadingState: false //are we loading any tiles for this observer?
        };

        observer.on('update', this._updateObserver.bind(this, observer));

        this._updateObserver(observer);

        return this;
    },

    removeObserver: function(id) {
        var obsTiles = this._observerData[id].tiles;

        for (var tileId in obsTiles) {
            delete this._tileData[tileId].observers[id];
        }

        delete this._observerData[id];

        return this;
    },

    addTile: function(tile) {
        var leftToLoadDelta = tile.state === 'loaded' ? 0 : 1;
        tile.loadDef.then(this._tileLoadedCallback.bind(this, tile));

        var tileObservers = {};

        for (var key in this._observerData) {
            var obsInfo = this._observerData[key];

            if (obsInfo.observer.intersectsWithTile(tile)) {
                obsInfo.tiles[tile.vectorTileKey] = true;
                obsInfo.leftToLoad += leftToLoadDelta;
                tileObservers[key] = true;
            }
        }

        this._tileData[tile.vectorTileKey] = {
            observers: tileObservers,
            tile: tile
        };

        return this;
    },

    removeTile: function(tileId) {
        var tileData = this._tileData[tileId],
            leftToLoadDelta = tileData.tile.state === 'loaded' ? 0 : 1;

        for (var id in tileData.observers) {
            var observerData = this._observerData[id];
            observerData.leftToLoad -= leftToLoadDelta;
            delete observerData.tiles[tileId];
        }

        delete this._tileData[tileId];

        return this;
    },

    startLoadTiles: function(observer) {
        //force active tile list update
        this._dataManager._getActiveTileKeys();

        var obsData = this._observerData[observer.id];
        if (obsData) {
			if (obsData.leftToLoad < 1) {
				this.fire('observertileload', {observer: observer});
				return this;
			}

			if (!obsData.loadingState) {
				obsData.loadingState = true;
				observer.fire('startLoadingTiles');
			}

			for (var tileId in obsData.tiles) {
				this._tileData[tileId].tile.load();
			}
        }

        return this;
    },

    getTileObservers: function(tileId) {
        return this._tileData[tileId].observers;
    },

    getObserverLoadingState: function(observer) {
        return this._observerData[observer.id].loadingState;
    },

    getObserverLeftToLoad: function(observer) {
        return this._observerData[observer.id].leftToLoad;
    },

    _updateObserver: function(observer) {
        if (this._observerData[observer.id]) {
			var obsData = this._observerData[observer.id],
				newObserverTiles = {},
				leftToLoad = 0,
				key;

			for (key in this._tileData) {
				var tile = this._tileData[key].tile;
				if (observer.intersectsWithTile(tile)) {
					newObserverTiles[key] = true;
					if (tile.state !== 'loaded') {
						leftToLoad++;
					}
					this._tileData[key].observers[observer.id] = true;
				}
			}

			for (key in obsData.tiles) {
				if (!(key in newObserverTiles)) {
					delete this._tileData[key].observers[observer.id];
				}
			}

			obsData.tiles = newObserverTiles;
			obsData.leftToLoad = leftToLoad;
		}
    },

    _tileLoadedCallback: function(tile) {
        this.fire('tileload', {tile: tile});

        if (!(tile.vectorTileKey in this._tileData)) {
            return;
        }

        var tileObservers = this._tileData[tile.vectorTileKey].observers;
        for (var id in tileObservers) {
            var obsData = this._observerData[id];
            obsData.leftToLoad--;

            if (obsData.leftToLoad < 1) {
                if (obsData.loadingState) {
                    obsData.loadingState = false;
                    obsData.observer.fire('stopLoadingTiles');
                }
                this.fire('observertileload', {observer: obsData.observer});
            }
        }
    }
});

var DataManager = L.Class.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    options: {
        name: null,                         // layer ID
		srs: '',							// geometry projection (3395 or 3857)
        identityField: '',                  // attribute name for identity items
        attributes: [],                     // attributes names
        attrTypes: [],                      // attributes types
        tiles: null,                        // tiles array for nontemporal data
        tilesVers: null,                    // tiles version array for nontemporal data
        LayerVersion: -1,                   // layer version
        GeoProcessing: null,                // processing data
        Temporal: false,                    // only for temporal data
        TemporalColumnName: '',             // temporal attribute name
        ZeroDate: '01.01.2008',             // 0 date string
        TemporalPeriods: [],                // temporal periods
        TemporalTiles: [],                  // temporal tiles array
        TemporalVers: [],                   // temporal version array
        hostName: 'maps.kosmosnimki.ru',    // default hostName
        sessionKey: '',                     // session key
        isGeneralized: false,               // flag for use generalized tiles
		needBbox: false,               		// flag for get tiles list by BBOX
        isFlatten: false                    // flag for flatten geometry
    },

    setOptions: function(options) {
        this._clearProcessing();
        if (options.GeoProcessing) {
            this.processingTile = this.addData([]);
            this._chkProcessing(options.GeoProcessing);
        }
        L.setOptions(this, options);
        this.optionsLink = options;
        this._isTemporalLayer = this.options.Temporal;

        var tileAttributes = L.gmxUtil.getTileAttributes(this.options);
        this.tileAttributeIndexes = tileAttributes.tileAttributeIndexes;
        this.temporalColumnType = tileAttributes.tileAttributeTypes[this.options.TemporalColumnName];

        var hostName = this.options.hostName,
            sessionKey = this.options.sessionKey;

        // if (!sessionKey) {
            // sessionKey = L.gmx.gmxSessionManager.getSessionKey(hostName);
        // }
        this.tileSenderPrefix = L.gmxUtil.protocol + '//' + hostName + '/' +
            'TileSender.ashx?WrapStyle=None' +
            '&key=' + encodeURIComponent(sessionKey);

        this._needCheckActiveTiles = true;
    },

    _vectorTileDataProviderLoad: function(x, y, z, v, s, d, callback) {
        var _this = this;
        gmxVectorTileLoader.load(
            _this.tileSenderPrefix,
            {x: x, y: y, z: z, v: v, s: s, d: d, srs: this.options.srs, layerID: _this.options.name}
        ).then(callback, function() {
            console.log('Error loading vector tile');
            callback({values:[]});
            _this.fire('chkLayerUpdate', {dataProvider: _this}); //TODO: do we really need event here?
        });
    },

    initialize: function(options, clearVersion) {
        this._tilesTree = null;
        this._activeTileKeys = {};
        this._endDate = null;
        this._beginDate = null;

        this._tiles = {};
        this._filters = {};
        this._filtersView = {};
        this._freeSubscrID = 0;
        this._items = {};
        this._observers = {};

        this._needCheckDateInterval = false;
        this._needCheckActiveTiles = true;

        var _this = this;
        this._vectorTileDataProvider = {
            load: this._vectorTileDataProviderLoad.bind(this)
        };

        this._observerTileLoader = new ObserverTileLoader(this);
        this._observerTileLoader.on('tileload', function(event) {
            var tile = event.tile;
            _this._updateItemsFromTile(tile);

            if (_this._tilesTree) {
                var treeNode = _this._tilesTree.getNode(tile.d, tile.s);
                treeNode && treeNode.count--; //decrease number of tiles to load inside this node
            }
        });

        this._observerTileLoader.on('observertileload', function(event) {
            var observer = event.observer;
            if (observer.isActive()) {
                observer.needRefresh = false;
                observer.updateData(_this.getItems(observer.id));
            }
        });
        this.setOptions(options);
        if (clearVersion) {
			this.options.LayerVersion = -1;
		}
        if (this._isTemporalLayer) {
            this.addFilter('TemporalFilter', function(item, tile, observer) {
                var unixTimeStamp = item.options.unixTimeStamp,
                    dates = observer.dateInterval;
                return dates && unixTimeStamp >= dates.beginDate.valueOf() && unixTimeStamp < dates.endDate.valueOf();
            });
        }
    },

    _getActiveTileKeys: function() {

        this._chkMaxDateInterval();
        if (this.options.needBbox || !this._needCheckActiveTiles) {
            return this._activeTileKeys;
        }

        // только для режима с полными списками тайлов
		this._needCheckActiveTiles = false;

		if (this._isTemporalLayer) {
			var newTileKeys = {};
			if (this._beginDate && this._endDate) {
				if (!this._tilesTree) {
					this.initTilesTree();
				}
				newTileKeys = this._tilesTree.selectTiles(this._beginDate, this._endDate).tiles;
			}
			this._updateActiveTilesList(newTileKeys);
		} else {
			this.initTilesList();
		}

        return this._activeTileKeys;
    },

    getViewFilters: function(name, layerID) {
        var out = [];
		name = (name || 'screen');
		for (var key in this._filtersView[layerID]) {
			if (key.indexOf(name) === 0) {
				out.push(key);
			}
		}
        return out;
    },

    _getObserversByFilterName: function(filterName, target) {
        var oKeys = {};
        for (var id in this._observers) {
			var observer = this._observers[id];
			if (observer.hasFilter(filterName)) {
				oKeys[id] = true;
			} else if (target && target === observer.target) {
				observer.filters.push(filterName);
                oKeys[id] = true;
			}
        }
        return oKeys;
    },

    addLayerFilter: function(filterFunc, options) {
        if (options && options.layerID) {
			var	layerID = options.layerID,
				target = options.target || 'screen',
				name = target;

			if (!this._filtersView[layerID]) { this._filtersView[layerID] = {}; }
			if (options.id) { name += '_' + options.id; }

			this._filtersView[layerID][name] = filterFunc;
			this._triggerObservers(this._getObserversByFilterName(name, target));
		}
		return this;
    },

    removeLayerFilter: function(options) {
        if (this._filtersView[options.layerID]) {
			var	layerID = options.layerID,
				target = options.target || 'screen',
				name = target;
			if (options.id) { name += '_' + options.id; }

            if (this._filtersView[layerID][name]) {
				var oKeys = this._getObserversByFilterName(name, target);
				delete this._filtersView[layerID][name];
				this._triggerObservers(oKeys);
			}
        }
		return this;
    },

    addFilter: function(filterName, filterFunc) {
        this._filters[filterName] = filterFunc;
        this._triggerObservers(this._getObserversByFilterName(filterName));
		return this;
    },

    removeFilter: function(filterName) {
        if (this._filters[filterName]) {
            var oKeys = this._getObserversByFilterName(filterName);
            delete this._filters[filterName];
            this._triggerObservers(oKeys);
        }
		return this;
    },

    getItems: function(oId) {
        var resArr = [],
            observer = this._observers[oId];
//console.log('getItems', oId, this.options.name);

        // if (!observer || !observer.isActive()) {
        if (!observer) {
            return [];
        }
        if (!observer.isActive() && observer.id !== 'hover') {
            return [];
        }

        //add internal filters
        var layerID = observer.layerID,
			_filtersView = this._filtersView[layerID] || {},
			filters = observer.filters.concat('processingFilter');
        this._isTemporalLayer && filters.push('TemporalFilter');

        filters = filters.filter(function(filter) {
            return (filter in this._filters) || (filter in _filtersView);
        }.bind(this));

        var _this = this,
            putData = function(tile) {
                var data = tile.data,
					lastIndex = resArr.length,
					len = data.length;

				resArr.length = lastIndex + len;
                for (var i = 0; i < len; i++) {
                    var dataOption = tile.dataOptions[i];
                    if (!observer.intersects(dataOption.bounds)) { continue; }

                    var it = data[i],
						geom = it[it.length - 1];
                    if (!observer.intersectsWithGeometry(geom)) { continue; }

                    var id = it[0],
                        item = _this.getItem(id),
                        isFiltered = false;

                    for (var f = 0; f < filters.length; f++) {
                        var name = filters[f],
							filterFunc = _this._filters[name] || _filtersView[name];
                        if (filterFunc && !filterFunc(item, tile, observer, geom, dataOption)) {
                            isFiltered = true;
                            break;
                        }
                    }

                    if (!isFiltered) {
						var rItem = {
                            id: id,
                            properties: it,
                            item: item,
                            dataOption: dataOption,
                            v: tile.v,
                            tileKey: tile.vectorTileKey
                        };
						if (observer.itemHook) {
							observer.itemHook(rItem);
						} else {
							resArr[lastIndex++] = rItem;
						}
                    }
                }
				resArr.length = lastIndex;
            };
        var activeTileKeys =  this._getActiveTileKeys();
        for (var tkey in activeTileKeys) {
            var tile = _this._tiles[tkey].tile;
            if (tile.data && tile.data.length > 0 && (tile.z === 0 || observer.intersectsWithTile(tile))) {
                putData(tile);
            }
        }

        return resArr;
    },

    _updateItemsFromTile: function(tile) {
        var vectorTileKey = tile.vectorTileKey,
            data = tile.data || [],
            len = data.length,
            geomIndex = data[0] && (data[0].length - 1);

        for (var i = 0; i < len; i++) {
            var it = data[i],
                geom = it[geomIndex],
                id = it[0],
                item = this._items[id];
            if (item) {
                if (!item.processing) {
                    item.properties = it;
                    if (item.type.indexOf('MULTI') === -1) {
                        item.type = 'MULTI' + item.type;
                    }
                } else {
                    tile.data[i] = item.properties;
                }
                delete item.bounds;
                item.currentFilter = null;
            } else {
                item = {
                    id: id,
                    type: geom.type,
                    properties: it,
                    options: {
                        fromTiles: {}
                    }
                };
                this._items[id] = item;
            }
            item.options.fromTiles[vectorTileKey] = i;
            if (tile.isGeneralized) {
                item.options.isGeneralized = true;
            }

            if (this.options.TemporalColumnName) {
                var zn = it[this.tileAttributeIndexes[this.options.TemporalColumnName]];
                item.options.unixTimeStamp = zn * 1000;
            }
        }
        return len;
    },

    getMaxDateInterval: function() {
        this._chkMaxDateInterval();
		return {
			beginDate: this._beginDate,
			endDate: this._endDate
		};
    },

    _chkMaxDateInterval: function() {
        if (this._isTemporalLayer && this._needCheckDateInterval) {
            this._needCheckDateInterval = false;
            var observers = this._observers,
                newBeginDate = null,
                newEndDate = null;
            for (var oId in observers) {
                var observer = observers[oId],
                    dateInterval = observer.dateInterval;

                if (!dateInterval) {
                    continue;
                }

                if (!newBeginDate || dateInterval.beginDate < newBeginDate) {
                    newBeginDate = dateInterval.beginDate;
                }

                if (!newEndDate || dateInterval.endDate > newEndDate) {
                    newEndDate = dateInterval.endDate;
                }
            }
            if (newBeginDate && newEndDate && (this._beginDate !== newBeginDate || this._endDate !== newEndDate)) {
                this._beginDate = newBeginDate;
                this._endDate = newEndDate;
                this._needCheckActiveTiles = true;
            }
        }
    },

    addObserver: function(options, id) {
        id = id || 's' + (++this._freeSubscrID);
        var _this = this,
            observer = new Observer(options);

        observer.id = id;
        observer.needRefresh = true;
        this._observerTileLoader.addObserver(observer);

        observer
            .on('update', function(ev) {
                observer.needRefresh = true;
                if (ev.temporalFilter) {
                    _this._needCheckDateInterval = true;
                }

				L.gmx.layersVersion.now();
                _this._waitCheckObservers();
            })
            .on('activate', function() {
                _this.fire('observeractivate');
                _this.checkObserver(observer);
            });

        _this._needCheckDateInterval = true;
        this._observers[id] = observer;
        this._waitCheckObservers();

        if (observer.isActive()) {
            this.fire('observeractivate');
        }

        return observer;
    },

    getActiveObserversCount: function() {
        var count = 0;
        for (var k in this._observers) {
            if (this._observers[k].isActive()) { count++; }
        }
        return count;
    },

    getObserver: function(id) {
        return this._observers[id];
    },

    removeScreenObservers: function(z) {
        for (var k in this._observers) {
            var observer = this._observers[k];
            if (observer.target === 'screen') {
				if (z && observer.z === z) {
					continue;
				}
				observer.deactivate();
				this.removeObserver(k);
			}
        }
    },

    toggleScreenObservers: function(flag, z) {
        for (var k in this._observers) {
            var observer = this._observers[k];
            if (observer.target === 'screen' && observer.z === z) {
				if (flag) {
					observer.activate();
				} else {
					observer.deactivate();
				}
			}
        }
    },

    removeObserver: function(id) {
        if (this._observers[id]) {
            this._observerTileLoader.removeObserver(id);
            var isActive = this._observers[id].isActive();

            delete this._observers[id];

            if (isActive) {
                this.fire('observeractivate');
            }
        }
    },

    getObserverLoadingState: function(observer) {
        return this._observerTileLoader.getObserverLoadingState(observer);
    },

    getObserverLeftToLoad: function(observer) {
        return this._observerTileLoader.getObserverLeftToLoad(observer);
    },

    getTileKeysToLoad: function(beginDate, endDate) {
		var newTileKeys = this._tilesTree.selectTiles(beginDate, endDate).tiles;
        return newTileKeys;
    },

    getItemsBounds: function() {
        if (!this._itemsBounds) {
            this._itemsBounds = gmxAPIutils.bounds();
            for (var id in this._items) {
                var item = this.getItem(id);
                this._itemsBounds.extendBounds(item.bounds);
            }
        }
        return this._itemsBounds;
    },

    //combine and return all parts of geometry
    getItem: function(id) {
        var item = this._items[id];
        if (item && !item.bounds) {
            var fromTiles = item.options.fromTiles,
                arr = [];
            for (var key in fromTiles) {    // get full object bounds
                if (this._tiles[key]) {
                    var num = fromTiles[key],
                        tile = this._tiles[key].tile;
                    if (tile.state === 'loaded' && tile.dataOptions[num]) {
                        arr.push(tile.dataOptions[num].bounds);
                    } else {
                        delete fromTiles[key];
                    }
                }
            }
            if (arr.length === 1) {
                item.bounds = arr[0];
            } else {
                item.bounds = gmxAPIutils.bounds();
                var w = gmxAPIutils.worldWidthMerc;
                for (var i = 0, len = arr.length; i < len; i++) {
                    var it = arr[i];
                    if (item.bounds.max.x - it.min.x > w) {
                        it = gmxAPIutils.bounds([
                            [it.min.x + 2 * w, it.min.y],
                            [it.max.x + 2 * w, it.max.y]
                        ]);
                    }
                    item.bounds.extendBounds(it);
                }
            }
        }
        return item;
    },

    getItemMembers: function(id) {
        var fromTiles = this._items[id].options.fromTiles,
            members = [];
        for (var key in fromTiles) {
            if (this._tiles[key]) {
                var tile = this._tiles[key].tile;
                if (tile.data) {
                    var objIndex = fromTiles[key],
                        props = tile.data[objIndex],
                        dataOption = tile.dataOptions[objIndex],
                        bbox = dataOption.bounds;

                    members.push({
                        geo: props[props.length - 1],
                        width: bbox.max.x - bbox.min.x,
                        dataOption: dataOption
                    });
                }

            }
        }
        return members.sort(function(a, b) {
            return b.width - a.width;
        });
    },

    getItemGeometries: function(id) {
        var fromTiles = this._items[id] ? this._items[id].options.fromTiles : {},
            geomItems = [];
        for (var key in fromTiles) {
            if (this._tiles[key] && this._tiles[key].tile.data) {
                var tileData = this._tiles[key].tile.data,
                    props = tileData[fromTiles[key]];

                geomItems.push(gmxAPIutils.getUnFlattenGeo(props[props.length - 1]));
            }
        }
        return geomItems;
    },

    addTile: function(tile) {
        this._tiles[tile.vectorTileKey] = {tile: tile};
        this._getActiveTileKeys()[tile.vectorTileKey] = true;
        this._observerTileLoader.addTile(tile);
        this.checkObservers();
    },

    checkObserver: function(observer) {
        if (observer.needRefresh && observer.isActive()) {
            this._observerTileLoader.startLoadTiles(observer);
        }
    },

    checkObservers: function() {
        var observers = this._observers;
        for (var id in this._observers) {
            this.checkObserver(observers[id]);
        }
    },

    _waitCheckObservers: function() {
        //TODO: refactor
        if (this._checkObserversTimer) { clearTimeout(this._checkObserversTimer); }
        this._checkObserversTimer = setTimeout(L.bind(this.checkObservers, this), 25);
		//L.Util.requestAnimFrame(this.checkObservers, this);
    },

    _triggerObservers: function(oKeys) {
        var keys = oKeys || this._observers;

        for (var id in keys) {
            if (this._observers[id]) {
                this._observers[id].needRefresh = true;
            }
        }
        this._waitCheckObservers();
    },

    _removeDataFromObservers: function(data) {
        var keys = this._observers;
        for (var id in keys) {
            this._observers[id].removeData(data);
        }
        this._waitCheckObservers();
    },

    preloadTiles: function(dateBegin, dateEnd, bounds) {
        var tileKeys = {};
        if (this._isTemporalLayer) {
            if (!this._tilesTree) {
                this.initTilesTree();
            }
            tileKeys = this._tilesTree.selectTiles(dateBegin, dateEnd).tiles;
        } else {
            this._needCheckActiveTiles = true;
            tileKeys = this._getActiveTileKeys();
        }

        var loadingDefs = [];
        for (var key in tileKeys) {
            var tile = this._getVectorTile(key, true).tile;

            if (tile.state !== 'notLoaded') {
                continue;
            }

            if (bounds && !bounds.intersects(tile.bounds)) {
                continue;
            }

            var loadDef = tile.load();
            loadingDefs.push(loadDef);
        }

        return Deferred.all.apply(null, loadingDefs);
    },

    _updateActiveTilesList: function(newTilesList) {

        if (this._tileFilteringHook) {
            var filteredTilesList = {};
            for (var tk in newTilesList) {
                if (this._tileFilteringHook(this._getVectorTile(tk, true).tile)) {
                    filteredTilesList[tk] = true;
                }
            }
            newTilesList = filteredTilesList;
        }

        var oldTilesList = this._activeTileKeys || {};

        var observersToUpdate = {},
            _this = this,
            key;

        if (this.processingTile) {
            newTilesList[this.processingTile.vectorTileKey] = true;
        }
        if (this._rasterVectorTile) {
			key = this._rasterVectorTile.vectorTileKey;
            newTilesList[key] = true;
			this._tiles[key] = {tile: this._rasterVectorTile};
		}

        var checkSubscription = function(vKey) {
            var observerIds = _this._observerTileLoader.getTileObservers(vKey);
            for (var sid in observerIds) {
                observersToUpdate[sid] = true;
            }
        };

        for (key in newTilesList) {
            if (!oldTilesList[key]) {
                this._observerTileLoader.addTile(this._getVectorTile(key, true).tile);
                checkSubscription(key);
            }
        }

        for (key in oldTilesList) {
            if (!newTilesList[key]) {
                checkSubscription(key);
                this._observerTileLoader.removeTile(key);
            }
        }

        this._activeTileKeys = newTilesList;

        this._triggerObservers(observersToUpdate);
    },

    _propertiesToArray: function(it) {
        var prop = it.properties,
            indexes = this.tileAttributeIndexes,
            arr = [];

        for (var key in indexes)
            arr[indexes[key]] = prop[key];

        arr[arr.length] = it.geometry;
        arr[0] = it.id;
        return arr;
    },

    _clearProcessing: function() {
        if (this.processingTile) {
            var _items = this._items,
                tile = this.processingTile,
                vKey = tile.vectorTileKey,
                data = tile.data || [];
            for (var i = 0, len = data.length; i < len; i++) {
                var id = data[i][0];
                if (_items[id]) {
                    var item = _items[id];
                    item.processing = null;
                    item.currentFilter = null;
                    delete item.options.fromTiles[vKey];
                    delete item.fromServerProps;
                    delete item.geometry;
               }
            }
            tile.clear();
        }
    },

    _chkProcessing: function(processing) {
        var _items = this._items,
            needProcessingFilter = false,
            skip = {},
            id, i, len, it, data;

        if (processing) {
            if (processing.Deleted) {
                for (i = 0, len = processing.Deleted.length; i < len; i++) {
                    id = processing.Deleted[i];
                    skip[id] = true;
                    if (_items[id]) {
                        _items[id].processing = true;
                        _items[id].currentFilter = null;
                    }
                    if (len > 0) { needProcessingFilter = true; }
                }
            }

            var out = {};
            if (processing.Inserted) {
                for (i = 0, len = processing.Inserted.length; i < len; i++) {
                    it = processing.Inserted[i];
                    if (!skip[it[0]]) { out[it[0]] = it; }
                }
            }

            if (processing.Updated) {
                for (i = 0, len = processing.Updated.length; i < len; i++) {
                    it = processing.Updated[i];
                    if (!skip[it[0]]) { out[it[0]] = it; }
                }
                if (!needProcessingFilter && len > 0) { needProcessingFilter = true; }
            }

            data = [];
            for (id in out) {
                if (this._items[id]) {
                    this._items[id].properties = out[id];
                    this._items[id].processing = true;
                    this._items[id].currentFilter = null;
                }
                data.push(out[id]);
            }

            if (data.length > 0) {
                this.processingTile = this.addData(data);
            }
        }
        if (needProcessingFilter) {
            this.addFilter('processingFilter', function(item, tile) {
                return tile.z === 0 || !item.processing;
            });
        } else {
            this.removeFilter('processingFilter');
        }
    },

    enableGeneralization: function() {
        if (!this.options.isGeneralized) {
            this.options.isGeneralized = true;
            this._resetTilesTree();
        }
    },

    disableGeneralization: function() {
        if (this.options.isGeneralized) {
            this.options.isGeneralized = false;
            this._resetTilesTree();
        }
    },

    _resetTilesTree: function() {
        this._tilesTree = null;
        this._needCheckActiveTiles = true;
        this._getActiveTileKeys(); //force list update
    },

    updateVersion: function(options, tiles) {
		if (!L.gmx.skipLoadTiles) {
			if (options) {
				this.setOptions(options);
			}
			if (tiles) {	// есть списки тайлов по BBOX
				this._needCheckActiveTiles = false;
				var tKey, newTiles = {}, newActiveTileKeys = {};
				for (var i = 0, cnt = 0, len = tiles.length; i < len; i += 6, cnt++) {
					tKey = VectorTile.createTileKey({z: Number(tiles[i]), x: Number(tiles[i + 1]), y: Number(tiles[i + 2]), v: Number(tiles[i + 3]), d: Number(tiles[i + 4]), s: Number(tiles[i + 5])});
					newTiles[tKey] = this._getVectorTile(tKey, true);
					newActiveTileKeys[tKey] = true;
				}
				this._tiles = newTiles;
				if (this.processingTile) {
					this._tiles[this.processingTile.vectorTileKey] = {
						tile: this.processingTile
					};
				}
				this._updateActiveTilesList(newActiveTileKeys);
			} else {
				this._resetTilesTree();
			}
		}
    },

    getNotLoadedVectorTiles: function(options) {
		var count = 0;

        if (options.tiles) {
				// options.tilesOrder = ["Z", "X", "Y", "V", "Level", "Span"]
            var arr = options.tiles || [];

            for (var i = 0, cnt = 0, len = arr.length; i < len; i += 6, cnt++) {
                if (!this._tiles[VectorTile.createTileKey({z: Number(arr[i]), x: Number(arr[i + 1]), y: Number(arr[i + 2]), v: Number(arr[i + 3]), d: Number(arr[i + 4]), s: Number(arr[i + 5])})]) {
					count++;
				}
			}
		}
		return count;
    },

    _getDataKeys: function(data) {
        var chkKeys = {};
        for (var i = 0, len = data.length; i < len; i++) {
            chkKeys[data[i][0]] = true;
        }
        return chkKeys;
    },

    _getProcessingTile: function() {
        if (!this.processingTile) {
        var x = -0.5, y = -0.5, z = 0, v = 0, s = -1, d = -1, isFlatten = this.options.isFlatten;

            this.processingTile = new VectorTile({load: function(x, y, z, v, s, d, callback) {
                            callback({values: []});
            }}, {x: x, y: y, z: z, v: v, s: s, d: d, isFlatten: isFlatten});

            this.addTile(this.processingTile);
        }
        return this.processingTile;
    },

    addData: function(data) {
        if (!data) {
            data = [];
        }
        var vTile = this._getProcessingTile(),
            chkKeys = this._getDataKeys(data),
            dataBounds = vTile.addData(data, chkKeys);

        if (this._itemsBounds) {
            this._itemsBounds.extendBounds(dataBounds);
        }
        this._updateItemsFromTile(vTile);
        this._triggerObservers();
        return vTile;
    },

    removeData: function(data) {
        this._itemsBounds = null;
        var vTile = this.processingTile;
        if (vTile) {
			var chkKeys = (data || vTile.data).reduce(function(a,item) {
				var id = item[0];
				a[id] = true;
				delete this._items[id];
				return a;
			}.bind(this), {});
            this._removeDataFromObservers(chkKeys);
            vTile.removeData(chkKeys, true);
            this._updateItemsFromTile(vTile);

            this._triggerObservers();
        }

        return vTile;
    },

    initTilesTree: function() {
        this._tilesTree = L.gmx.tilesTree(this.options);
        this.options.TemporalTiles = this.options.TemporalVers = null;

        if ('TemporalTiles' in this.optionsLink) {
            this.optionsLink.TemporalVers = this.optionsLink.TemporalTiles = null;
        }
        this.dateZero = this._tilesTree.dateZero;
        if (this.processingTile) {
            this._tiles[this.processingTile.vectorTileKey] = {
                tile: this.processingTile
            };
        }
    },

    _getVectorTile: function(vKey, createFlag) {
        if (!this._tiles[vKey] && createFlag) {
            var info = VectorTile.parseTileKey(vKey);
            info.dateZero = this.dateZero;
            this._addVectorTile(info);
        }
        return this._tiles[vKey];
    },

    _addVectorTile: function(info) {
        info.isFlatten = this.options.isFlatten;
        info.needBbox = this.options.needBbox;
        info.attributes = this.options.attributes;
        var tile = new VectorTile(this._vectorTileDataProvider, info),
            vKey = tile.vectorTileKey;

        this._tiles[vKey] = {tile: tile};
        return vKey;
    },

    _getGeneralizedTileKeys: function(vTilePoint) {
        var dz = vTilePoint.z % 2 ? 1 : 2,
            pz = Math.pow(2, dz),
            z = vTilePoint.z - dz,
            x = Math.floor(vTilePoint.x / pz),
            y = Math.floor(vTilePoint.y / pz),
            temp = {v: vTilePoint.v, s: -1, d: -1, isGeneralized: true},
            keys = {};

        while (z > 1) {
            var gKey = [z, x, y].join('_');
            keys[gKey] = L.extend({}, temp, {x: x, y: y, z: z});
            z -= 2;
            x = Math.floor(x / 4);
            y = Math.floor(y / 4);
        }
        return keys;
    },

    initTilesList: function() {         // For non temporal layers we create all Vector tiles
        var newActiveTileKeys = {};
        if (this.options.tiles) {
            var arr = this.options.tiles || [],
                vers = this.options.tilesVers,
                generalizedKeys = this.options.isGeneralized ? {} : null,
                newTiles = {},
                gKey, tKey, info, tHash;

            for (var i = 0, cnt = 0, len = arr.length; i < len; i += 3, cnt++) {
                info = {
                    x: Number(arr[i]),
                    y: Number(arr[i + 1]),
                    z: Number(arr[i + 2]),
                    v: Number(vers[cnt]),
                    s: -1,
                    d: -1
                };

                tHash = this._getVectorTile(VectorTile.createTileKey(info), true);
                tKey = tHash.tile.vectorTileKey;
                newTiles[tKey] = tHash;
                newActiveTileKeys[tKey] = true;
                if (generalizedKeys) {
                    var gKeys = this._getGeneralizedTileKeys(info);
                    for (gKey in gKeys) {
                        var gPoint = gKeys[gKey];
                        if (generalizedKeys[gKey]) {
                            generalizedKeys[gKey].v = Math.max(gPoint.v, generalizedKeys[gKey].v);
                        } else {
                            generalizedKeys[gKey] = gPoint;
                        }
                    }
                }
            }
            if (generalizedKeys) {
                for (gKey in generalizedKeys) {
                    info = generalizedKeys[gKey];
                    tKey = VectorTile.createTileKey(info);
                    if (!newTiles[tKey]) {
                        if (!this._tiles[tKey]) { this._addVectorTile(info); }
                        newTiles[tKey] = this._tiles[tKey];
                        newActiveTileKeys[tKey] = true;
                    }
                }
            }
            this._tiles = newTiles;
            if (this.processingTile) {
                this._tiles[this.processingTile.vectorTileKey] = {
                    tile: this.processingTile
                };
            }
        }
        this._updateActiveTilesList(newActiveTileKeys);
    },

    //Tile filtering hook filters out active vector tiles.
    //Can be used to prevent loading data from some spatial-temporal region
    setTileFilteringHook: function(filteringHook) {
        this._tileFilteringHook = filteringHook;
        this._needCheckActiveTiles = true;
        this._getActiveTileKeys(); //force list update
    },

    removeTileFilteringHook: function() {
        this._tileFilteringHook = null;
        this._needCheckActiveTiles = true;
        this._getActiveTileKeys(); //force list update
    }

});
L.gmx = L.gmx || {};
L.gmx.DataManager = DataManager;


L.gmx.VectorLayer = L.GridLayer.extend({
    options: {
		tilesCRS: L.CRS.EPSG3395,
        openPopups: [],
        minZoom: 1,
        zIndexOffset: 0,
        isGeneralized: true,
        isFlatten: false,
        useWebGL: false,
		skipTiles: 'All', // All, NotVisible, None
        iconsUrlReplace: [],
        cacheRasters: true,
        cacheQuicklooks: true,
        clearCacheOnLoad: true,
        showScreenTiles: false,
		updateWhenZooming: false,
		// bubblingMouseEvents: false,
        clickable: true
    },

	// extended from L.GridLayer
    initialize: function(options) {
        options = L.setOptions(this, options);

        this._initPromise = new Promise(function(resolve, reject) {
			this._resolve = resolve;
			this._reject = reject;
		}.bind(this));

        this.repaintObservers = {};    // external observers like screen

        this._gmx = {
            hostName: gmxAPIutils.normalizeHostname(options.hostName || 'maps.kosmosnimki.ru'),
            mapName: options.mapID,
			sessionKey: this.options.sessionKey,
			iconsUrlReplace: this.options.iconsUrlReplace,
			showScreenTiles: this.options.showScreenTiles,
            skipTiles: options.skipTiles,
            needBbox: options.skipTiles === 'All',
            useWebGL: options.useWebGL,
			srs: options.srs || '',
            layerID: options.layerID,
            beginDate: options.beginDate,
            endDate: options.endDate,
            sortItems: options.sortItems || null,
            styles: options.styles || [],
            shiftXlayer: 0,
            shiftYlayer: 0,
            renderHooks: [],
            preRenderHooks: [],
            _needPopups: {}
        };
		if (/\buseWebGL=1\b/.test(location.search)) {
			this._gmx.useWebGL = true;
		}
        if (options.cacheQuicklooks) {			// cache quicklooks for CR
            this._gmx.quicklooksCache = {};
        }
        if (options.cacheRasters) {				// cache rasters for CR
            this._gmx.rastersCache = {};
        }
        if (options.crossOrigin) {
            this._gmx.crossOrigin = options.crossOrigin;
        }
	},

	__repaintNotLoaded: function () {
		//return;
		if (!this._map) { return; }

		var arr = [], key, tile, z;
		for (key in this._tiles) {
			tile = this._tiles[key];
			z = tile.coords.z;
			if (z == this._tileZoom) {
				if (!tile.loaded) {
					arr.push(key);
					//break;
				// } else if (tile.count) {
					// if (!tile.el.parentNode && this._levels[z]) {
						// this._levels[z].el.appendChild(tile.el);
					// }
				// } else if (tile.el.parentNode) {
					// tile.el.parentNode.removeChild(tile.el);
				}
			}
		}
		if (arr.length) {
			// console.log('_repaintNotLoaded ', this._gmx.layerID, arr.length);
			this.repaint(arr);
		} else if (this.options.clearCacheOnLoad) {
			this._gmx.rastersCache = {};
			this._gmx.quicklooksCache = {};
		}
    },
	__runRepaint: function (msek) {
		if (this.__repaintNotLoadedTimer) { cancelIdleCallback(this.__repaintNotLoadedTimer); }
		this.__repaintNotLoadedTimer = requestIdleCallback(L.bind(this.__repaintNotLoaded, this), {timeout: msek || 100});

		// if (this.__repaintNotLoadedTimer) { clearTimeout(this.__repaintNotLoadedTimer); }
		// this.__repaintNotLoadedTimer = setTimeout(L.bind(this.__repaintNotLoaded, this), msek || 100);
    },

	//block: extended from L.GridLayer
	_setView: function (center, zoom, noPrune, noUpdate) {
		if (!this._map) { return; }
		L.GridLayer.prototype._setView.call(this, center, zoom, noPrune, noUpdate);
	},

	_updateOpacity: function () {
		if (!this._map) { return; }

		// IE doesn't inherit filter opacity properly, so we're forced to set it on tiles
		if (L.Browser.ielt9) { return; }
		var willPrune = false;
		for (var key in this._tiles) {
			var tile = this._tiles[key];
			if (!tile.current || !tile.loaded) { continue; }
			if (tile.active) {
				willPrune = true;
			}
			tile.active = true;
		}
		if (willPrune && !this._noPrune) { this._pruneTiles(); }
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

        var gmx = this._gmx,
			dm = gmx.dataManager;
        if (dm) {
			dm.removeObserver(key);		// TODO: про active
		}

		// Cancels any pending http requests associated with the tile	dataManager
		// unless we're on Android's stock browser,
		// see https://github.com/Leaflet/Leaflet/issues/137
		// if (!Browser.androidStock) {
			// tile.el.setAttribute('src', Util.emptyImageUrl);
		// }
		L.DomUtil.remove(tile.el);

		delete this._tiles[key];

		// @event tileunload: TileEvent
		// Fired when a tile is removed (e.g. when a tile goes off the screen).
		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	},

	_tileReady: function (coords, err, tile) {
		if (!this._map) { return; }

		if (err) {
			// @event tileerror: TileErrorEvent
			// Fired when there is an error loading a tile.
			this.fire('tileerror', {
				error: err,
				tile: tile,
				coords: coords
			});
		}

		var key = this._tileCoordsToKey(coords);

		tile = this._tiles[key];
		if (!tile) { return; }

		tile.loaded = +new Date();
		if (this._map._fadeAnimated) {
			L.Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = L.Util.requestAnimFrame(this._updateOpacity, this);
		} else {
			tile.active = true;
		}

		if (!err) {
			L.DomUtil.addClass(tile.el, 'leaflet-tile-loaded');

			// @event tileload: TileEvent
			// Fired when a tile loads.
			this.fire('tileload', {
				tile: tile.el,
				coords: coords
			});
		}

		if (this._noTilesToLoad()) {
			this._loading = false;
			// @event load: Event
			// Fired when the grid layer loaded all visible tiles.
			this.fire('load');

			if (L.Browser.ielt9 || !this._map._fadeAnimated) {
				L.Util.requestAnimFrame(this._pruneTiles, this);
			} else {
				// Wait a bit more than 0.2 secs (the duration of the tile fade-in)
				// to trigger a pruning.
				requestIdleCallback(L.bind(this._pruneTiles, this), {timeout: 250});
				// setTimeout(L.bind(this._pruneTiles, this), 250);
			}
		}
	},

	// stops loading all tiles in the background layer
	_abortLoading: function () {
// console.log('_abortLoading ', this._loading, this._tileZoom, this._map._zoom, this._map.getZoom());
		var zoom = this._tileZoom,
			i, tile;
		for (i in this._tiles) {
			tile = this._tiles[i];
			if (tile.observer) {
				if (tile.coords.z === zoom) {
					tile.observer.activate();
				} else {
					tile.observer.deactivate();
				}
			}
		}
	},

    _onCreateLevel: function(level) {
		this._updateShiftY(level.zoom);
		//console.log('_onCreateLevel ', level);
    },

	_initContainer: function () {
		if (this._container) { return; }

		this._container = L.DomUtil.create('div', 'leaflet-layer ' + (this.options.className || ''));
		if (this.options.clickable === false) {
			this._container.style.pointerEvents = 'none';
		}
		this._updateZIndex();

		this.getPane(this.options.pane).appendChild(this._container);
	},

    _onVersionChange: function () {
        this._updateProperties(this._gmx.rawProperties);
    },

	_getEvents: function () {
		var events = L.GridLayer.prototype.getEvents.call(this);
		L.extend(events, {
			zoomstart: function() {
				this._gmx.zoomstart = true;
			},
			zoomend: function() {
				this._gmx.zoomstart = false;
				this.__runRepaint();
			}
		});
        var gmx = this._gmx;
		if (gmx.properties.type === 'Vector') {
			events.moveend = function() {
				if ('dataManager' in this._gmx) {
					this._gmx.dataManager.fire('moveend');
				}
				//console.log('_moveEnd', this._gmx.layerID);
			};
		}

		return {
			map: events,
			owner: {
				dateIntervalChanged: function() {
					this.__runRepaint(150);
				},
				tileloadstart: function(ev) {				// тайл (ev.coords) загружается
					var key = this._tileCoordsToKey(ev.coords),
						tLink = this._tiles[key];
					// console.log('tileloadstart ', this._loading, this._tileZoom, ev);

					tLink.loaded = 0;
					tLink.screenTile = new ScreenVectorTile(this, tLink);
					L.Util.requestAnimFrame(L.bind(this.__drawTile, this, ev));
				},
				stylechange: function() {
					var gmx = this._gmx;
					if (!gmx.balloonEnable && this._popup) {
						this.unbindPopup();
					} else if (gmx.balloonEnable && !this._popup) {
						this.bindPopup('');
					}
					if (this._map) {
						if (this.options.minZoom !== gmx.styleManager.minZoom || this.options.maxZoom !== gmx.styleManager.maxZoom) {
							this.options.minZoom = gmx.styleManager.minZoom;
							this.options.maxZoom = gmx.styleManager.maxZoom;
							this._map._updateZoomLevels();
						}
						if (gmx.labelsLayer) {
							this._map._labelsLayer.add(this);
						} else if (!gmx.labelsLayer) {
							this._map._labelsLayer.remove(this);
						}
						this.redraw();
					}
				},
				versionchange: this._onVersionChange
			}
		};
	},

	beforeAdd: function(map) {
		this._updateShiftY(map.getZoom());
        L.GridLayer.prototype.beforeAdd.call(this, map);
		this._map = map;
    },

    onAdd: function(map) {
		map = map || this._map;
        if (map.options.crs !== L.CRS.EPSG3857 && map.options.crs !== L.CRS.EPSG3395) {
            throw 'GeoMixer-Leaflet: map projection is incompatible with GeoMixer layer';
        }
		this.beforeAdd(map);

        var gmx = this._gmx;

		this.options.tilesCRS = gmx.srs == 3857 ? L.CRS.EPSG3857 : L.CRS.EPSG3395;
        gmx.shiftY = 0;
        gmx.applyShift = map.options.crs === L.CRS.EPSG3857 && gmx.srs != 3857;
        gmx.currentZoom = map.getZoom();
		this._levels = {}; // need init before styles promise resolved
		this._tiles = {};
		this._initContainer();

		gmx.styleManager.promise.then(function () {
			if (gmx.balloonEnable && !this._popup) { this.bindPopup(''); }

			if (this._map) {
				var events = this._getEvents();
				map.on(events.map, this);
				this.on(events.owner, this);
				this.once('remove', function () {
					map.off(events.map, this);
					this.off(events.owner, this);
				}, this);

				this._resetView();
				this._update();
			}
			L.gmx.layersVersion.add(this);
			this.fire('add');
		}.bind(this));
        gmx.styleManager.initStyles();
   },

    onRemove: function(map) {
        var gmx = this._gmx,
			dm = gmx.dataManager;
        if (dm) {
			dm.removeScreenObservers();
		}
		this._removeAllTiles();
		if (this._container) { L.DomUtil.remove(this._container); }
		map._removeZoomLimit(this);
		this._container = null;
		this._tileZoom = undefined;

		if (gmx.labelsLayer) {	// удалить из labelsLayer
			map._labelsLayer.remove(this);
		}

		//gmx.badTiles = {};
        gmx.quicklooksCache = {};
        gmx.rastersCache = {};
        this._map = null;
        delete gmx.map;
        if (dm && !dm.getActiveObserversCount()) {
			L.gmx.layersVersion.remove(this);
        }
        this.fire('remove');
    },

    _updateZIndex: function () {
        if (this._container) {
            var options = this.options,
                zIndex = options.zIndex || 0,
                zIndexOffset = options.zIndexOffset || 0;

            this._container.style.zIndex = zIndexOffset + zIndex;
        }
    },
	// Private method to load tiles in the grid's active zoom level according to map bounds
	_update: function (center) {
		var map = this._map;
		if (this._gmx.zoomstart || !map) { return; }
		if (this._updateTimer) { cancelIdleCallback(this._updateTimer); }
		this._updateTimer = requestIdleCallback(L.bind(this._updateWait, this, center), {timeout: 150});
    },
	// Private method to load tiles in the grid's active zoom level according to map bounds
	_updateWait: function (center) {
		var map = this._map;
		if (this._gmx.zoomstart || !map) { return; }
		var zoom = this._clampZoom(map.getZoom());

		if (center === undefined) { center = map.getCenter(); }
		if (this._tileZoom === undefined) { return; }	// if out of minzoom/maxzoom

		var pixelBounds = this._getTiledPixelBounds(center),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    // tileCenter = tileRange.getCenter(),
		    queue = [],
		    margin = this.options.keepBuffer,
		    noPruneRange = new L.Bounds(tileRange.getBottomLeft().subtract([margin, -margin]),
		                              tileRange.getTopRight().add([margin, -margin]));

		// Sanity check: panic if the tile range contains Infinity somewhere.
		if (!(isFinite(tileRange.min.x) &&
		      isFinite(tileRange.min.y) &&
		      isFinite(tileRange.max.x) &&
		      isFinite(tileRange.max.y))) { throw new Error('Attempted to load an infinite number of tiles'); }

		for (var key in this._tiles) {
			var c = this._tiles[key].coords;
			if (c.z !== this._tileZoom || !noPruneRange.contains(new L.Point(c.x, c.y))) {
				this._tiles[key].current = false;
			}
		}

		// _update just loads more tiles. If the tile zoom level differs too much
		// from the map's, let _setView reset levels and prune old tiles.
		if (Math.abs(zoom - this._tileZoom) > 1) { this._setView(center, zoom); return; }

		// create a queue of coordinates to load tiles from
		var i, j, len, coords;
		for (j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (i = tileRange.min.x; i <= tileRange.max.x; i++) {
				coords = new L.Point(i, j);
				coords.z = this._tileZoom;

				if (!this._isValidTile(coords)) { continue; }

				var tile = this._tiles[this._tileCoordsToKey(coords)];
				if (tile) {
					tile.current = true;
				} else {
					queue.push(coords);
				}
			}
		}

		if (queue.length !== 0) {
			// if it's the first batch of tiles to load
			if (!this._loading) {
				this._loading = true;
				// @event loading: Event
				// Fired when the grid layer starts loading tiles.
				this.fire('loading');
			}

			for (i = 0, len = queue.length; i < len; i++) {
				this._addTile(queue[i]);
			}
		}
	},

/*eslint-disable no-unused-vars */
	createTile: function(coords , done) {
		this._test = [coords, done];
		var tile = L.DomUtil.create('canvas', 'leaflet-tile');
		var size = this.getTileSize();
		tile.width = tile.height = 0;
		tile.style.width = size.x + 'px';
		tile.style.height = size.y + 'px';
		tile.onselectstart = L.Util.falseFn;
		tile.onmousemove = L.Util.falseFn;

		// without this hack, tiles disappear after zoom on Chrome for Android
		// https://github.com/Leaflet/Leaflet/issues/2078
		if (L.Browser.android && !L.Browser.android23) {
			tile.style.WebkitBackfaceVisibility = 'hidden';
		}

		// tile.style.opacity = this.options.opacity;
		return tile;
    },
/*eslint-enable */

	_addTile: function (coords) {
		var tile = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords)),
			key = this._tileCoordsToKey(coords);

		// save tile in cache
		this._tiles[key] = {
			el: tile,
			coords: coords,
			current: true
		};

		// @event tileloadstart: TileEvent
		// Fired when a tile is requested and starts loading.
		this.fire('tileloadstart', {
			tile: tile,
			coords: coords
		});
	},

    //block: public interface
    initFromDescription: function(ph) {
        var gmx = this._gmx;

        gmx.properties = ph.properties;
        gmx.geometry = ph.geometry;

        if (gmx.properties._initDone) {    // need delete tiles key
            delete gmx.properties[gmx.properties.Temporal ? 'TemporalTiles' : 'tiles'];
        }
        gmx.properties._initDone = true;

        if (!gmx.geometry) {
            var worldSize = gmxAPIutils.tileSizes[1];
            gmx.geometry = {
                type: 'POLYGON',
                coordinates: [[[-worldSize, -worldSize], [-worldSize, worldSize], [worldSize, worldSize], [worldSize, -worldSize], [-worldSize, -worldSize]]]
            };
        }

        // Original properties from the server.
        // Descendant classes can override this property
        // Not so good solution, but it works
        gmx.rawProperties = ph.rawProperties || ph.properties;

        this._updateProperties(ph.properties);
        if (gmx.rawProperties.type === 'Vector') {
			ph.properties.srs = gmx.srs = 3857;
			gmx.RasterSRS = Number(gmx.rawProperties.RasterSRS) || 3857;
        // } else if (gmx.rawProperties.RasterSRS) {
			// ph.properties.srs = gmx.srs = Number(gmx.rawProperties.RasterSRS);
		}

        ph.properties.needBbox = gmx.needBbox;
        ph.properties.isGeneralized = this.options.isGeneralized;
        ph.properties.isFlatten = this.options.isFlatten;

        gmx.dataManager = this.options.dataManager || new DataManager(ph.properties);

        if (this.options.parentOptions) {
			if (!ph.properties.styles) { ph.properties.styles = this.options.parentOptions.styles; }
			gmx.dataManager.on('versionchange', this._onVersionChange, this);
		}

		gmx.styleManager = new StyleManager(gmx);
        this.options.minZoom = gmx.styleManager.minZoom;
        this.options.maxZoom = gmx.styleManager.maxZoom;

        gmx.dataManager.on('observeractivate', function() {
            if (gmx.dataManager.getActiveObserversCount()) {
                L.gmx.layersVersion.add(this);
            } else {
                L.gmx.layersVersion.remove(this);
            }
        }, this);

        if (gmx.properties.type === 'Vector' && !('chkUpdate' in this.options)) {
            this.options.chkUpdate = true; //Check updates for vector layers by default
        }
        if (gmx.rawProperties.type !== 'Raster' && this._objectsReorderInit) {
            this._objectsReorderInit(this);
        }

        if (gmx.clusters) {
            this.bindClusters(JSON.parse(gmx.clusters));
        }
        if (gmx.filter) {
/*eslint-disable no-useless-escape */
            var func = L.gmx.Parsers.parseSQL(gmx.filter.replace(/[\[\]]/g, '"'));
/*eslint-enable */
            if (func) {
				gmx.dataManager.addFilter('userFilter_' + gmx.layerID, function(item) {
					return gmx.layerID !== this._gmx.layerID || !func || func(item.properties, gmx.tileAttributeIndexes, gmx.tileAttributeTypes) ? item.properties : null;
				}.bind(this));
            }
        }
        if (gmx.dateBegin && gmx.dateEnd) {
            this.setDateInterval(gmx.dateBegin, gmx.dateEnd);
        }

        this._resolve();
        return this;
    },

    getDataManager: function () {
		return this._gmx.dataManager;
    },

    enableGeneralization: function () {
        if (!this.options.isGeneralized) {
            this.options.isGeneralized = true;
            if (this._gmx.dataManager) {
                // this._clearAllSubscriptions();
                this._gmx.dataManager.enableGeneralization();
                this.redraw();
            }
        }
    },

    disableGeneralization: function () {
        if (this.options.isGeneralized) {
            this.options.isGeneralized = false;
            if (this._gmx.dataManager) {
                // this._clearAllSubscriptions();
                this._gmx.dataManager.disableGeneralization();
                this.redraw();
            }
        }
    },

    setRasterOpacity: function (opacity) {
        if (this._gmx.rasterOpacity !== opacity) {
            this._gmx.rasterOpacity = opacity;
            this._initPromise.then(this.repaint.bind(this));
        }
        return this;
    },

    getStyles: function () {
        return this._gmx.styleManager.getStyles();
    },

    getIcons: function (callback) {
        this._gmx.styleManager.getIcons(callback);
        return this;
    },

    setStyles: function (styles) {
        this._initPromise.then(function() {
            this._gmx.styleManager.clearStyles();
            if (styles) {
                styles.forEach(function(it, i) {
                    this.setStyle(it, i, true);
                }.bind(this));
            } else {
                this.fire('stylechange');
            }
        }.bind(this));
        return this;
    },

    getStyle: function (num) {
        return this.getStyles()[num];
    },

    setStyle: function (style, num, createFlag) {
        this._initPromise.then(function() {
            this._gmx.styleManager.setStyle(style, num, createFlag).then(function () {
                this.fire('stylechange', {num: num || 0});
            }.bind(this));
        }.bind(this));
        return this;
    },

    setStyleHook: function (func) {
        this._gmx.styleHook = func;
        this.repaint();
        return this;
    },

    removeStyleHook: function () {
        this._gmx.styleHook = null;
        return this;
    },

    setRasterHook: function (func) {
        this._gmx.rasterProcessingHook = func;
        this.repaint();
        return this;
    },

    removeRasterHook: function () {
        this._gmx.rasterProcessingHook = null;
        this.repaint();
        return this;
    },

    setFilter: function (func) {
        var gmx = this._gmx;
        gmx.dataManager.addFilter('userFilter', function(item) {
            return gmx.layerID !== this._gmx.layerID || !func || func(item) ? item.properties : null;
        }.bind(this));
        return this;
    },

    removeFilter: function () {
        this._gmx.dataManager.removeFilter('userFilter');
        return this;
    },

    addLayerFilter: function (func, options) {
        var gmx = this._gmx;

		options = options || {};
		options.layerID = gmx.layerID;

        gmx.dataManager.addLayerFilter(function(item) {
            return !func || func(item) ? item.properties : null;
        }.bind(this), options);

        return this;
    },

    removeLayerFilter: function (options) {
		options = options || {};
		options.layerID = this._gmx.layerID;
        this._gmx.dataManager.removeLayerFilter(options);
        return this;
    },

    setDateInterval: function (beginDate, endDate) {
        var gmx = this._gmx;

        if (gmx.dateBegin && gmx.dateEnd) {
			beginDate = gmx.dateBegin;
			endDate = gmx.dateEnd;
		}

        //check that something changed
        if (!gmx.beginDate !== !beginDate ||
            !gmx.endDate !== !endDate ||
            beginDate && (gmx.beginDate.valueOf() !== beginDate.valueOf()) ||
            endDate && (gmx.endDate.valueOf() !== endDate.valueOf())
        ) {
            if (gmx.rawProperties.maxShownPeriod && beginDate) {
                var msecPeriod = gmx.rawProperties.maxShownPeriod * 24 * 3600 * 1000;
                beginDate = new Date(Math.max(beginDate.valueOf(), endDate.valueOf() - msecPeriod));
            }

            gmx.beginDate = beginDate;
            gmx.endDate = endDate;

            var observer = null,
				dataManager = gmx.dataManager;
            for (var key in this._tiles) {
				this._tiles[key].loaded = 0;
				observer = this._tiles[key].observer;
				if (observer) {
					observer.setDateInterval(beginDate, endDate);
				}
            }
            observer = dataManager.getObserver('_Labels');
            if (observer) {
                observer.setDateInterval(beginDate, endDate);
            }
			if (gmx.skipTiles === 'NotVisible' || gmx.needBbox || gmx.properties.UseTiles === false) {
				if (!gmx.needBbox) {
					gmx.properties.LayerVersion = -1;
					dataManager.setOptions({LayerVersion: -1});
				}
				if (this._map) {
					L.gmx.layersVersion.now();
				}
			}
            this.fire('dateIntervalChanged');
        }

        return this;
    },

    getDateInterval: function() {
        return {
            beginDate: this._gmx.beginDate,
            endDate: this._gmx.endDate
        };
    },

    addObserver: function (options) {
        return this._gmx.dataManager.addObserver(options);
    },

    removeObserver: function(observer) {
        return this._gmx.dataManager.removeObserver(observer.id);
    },

    setPositionOffset: function(dx, dy) {
        var gmx = this._gmx;
        gmx.shiftXlayer = dx;
        gmx.shiftYlayer = dy;
        this._update();
        return this;
    },

    getPositionOffset: function() {
        var gmx = this._gmx;
        return {shiftX: gmx.shiftXlayer, shiftY: gmx.shiftYlayer};
    },

    setZIndexOffset: function (offset) {
        if (arguments.length) {
            this.options.zIndexOffset = offset;
        }
        this._updateZIndex();
        return this;
    },

    _clearLoaded: function (zKey) {
		if (this._tiles[zKey]) {
			this._tiles[zKey].loaded = 0;
		}
    },

    repaint: function (zKeys) {
        if (this._map) {
            if (!zKeys) {
                zKeys = {};
                for (var key in this._tiles) { zKeys[key] = true; this._clearLoaded(key); }
                L.extend(zKeys, this.repaintObservers);
            } else if (L.Util.isArray(zKeys)) {
				var arr = zKeys;
				zKeys = {};
				arr.forEach(function (it) { zKeys[it] = true; this._clearLoaded(it); }.bind(this) );
            } else if (typeof zKeys === 'string') {
				var it = zKeys;
				this._clearLoaded(it);
				zKeys = {};
				zKeys[it] = true;
			}
            this._gmx.dataManager._triggerObservers(zKeys);
        }
    },

    redrawItem: function (id) {
        if (this._map) {
            var item = this._gmx.dataManager.getItem(id),
                gmxTiles = this._getTilesByBounds(item.bounds);

            this.repaint(gmxTiles);
        }
    },

    appendTileToContainer: function (tileLink) {		// call from screenTile
		if (this._tileZoom === tileLink.coords.z) {
			var tilePos = this._getTilePos(tileLink.coords),
				tile = tileLink.el,
				levelEl = this._levels[tileLink.coords.z],
				cont = levelEl ? levelEl.el : this._tileContainer;

			if (cont) {
				cont.appendChild(tile);
				L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
			}
		}
    },

    addData: function(data, options) {
        if (!this._gmx.mapName) {     // client side layer
            this._gmx.dataManager.addData(data, options);
            this.repaint();
        }
        return this;
    },

    removeData: function(data, options) {
        if (!this._gmx.mapName) {     // client side layer
            this._gmx.dataManager.removeData(data, options);
            this.repaint();
        }
        return this;
    },

    getStylesByProperties: function(propArray, zoom) {
        return this._gmx.styleManager.getCurrentFilters(propArray, zoom);
    },

    getItemStyle: function(id) {
        var gmx = this._gmx,
            item = gmx.dataManager.getItem(id);
        return gmx.styleManager.getObjStyle(item);
    },

    getTileAttributeTypes: function() {
        return this._gmx.tileAttributeTypes;
    },

    getTileAttributeIndexes: function() {
        return this._gmx.tileAttributeIndexes;
    },

    getItemBalloon: function(id) {
        var gmx = this._gmx,
            item = gmx.dataManager.getItem(id),
            styles = this.getStyles(),
            out = '';

        if (item && styles[item.currentFilter]) {
            var propsArr = item.properties;
            out = L.gmxUtil.parseBalloonTemplate(styles[item.currentFilter].Balloon, {
                properties: this.getItemProperties(propsArr),
                geometries: [propsArr[propsArr.length - 1]],
                tileAttributeTypes: gmx.tileAttributeTypes,
                unitOptions: this._map ? this._map.options : {}
            });
        }
        return out;
    },

    getItemProperties: function(propArray) {
        var properties = {},
            indexes = this._gmx.tileAttributeIndexes;
        for (var key in indexes) {
            properties[key] = propArray[indexes[key]];
        }
        return properties;
    },

    addPreRenderHook: function(renderHook) {
        this._gmx.preRenderHooks.push(renderHook);
        this.repaint();
    },

    removePreRenderHook: function(hook) {
        var arr = this._gmx.preRenderHooks;
        for (var i = 0, len = arr.length; i < len; i++) {
            if (arr[i] === hook) {
                arr.splice(i, 1);
                this.repaint();
                break;
            }
        }
    },

    addRenderHook: function(renderHook) {
        this._gmx.renderHooks.push(renderHook);
        this.repaint();
    },

    removeRenderHook: function(hook) {
        var arr = this._gmx.renderHooks;
        for (var i = 0, len = arr.length; i < len; i++) {
            if (arr[i] === hook) {
                arr.splice(i, 1);
                this.repaint();
                break;
            }
        }
    },
    getGmxProperties: function() {
        return this._gmx.rawProperties;
	},

    //returns L.LatLngBounds
    getBounds: function() {
        var gmxBounds = this._gmx.layerID ? gmxAPIutils.geoItemBounds(this._gmx.geometry).bounds : this._gmx.dataManager.getItemsBounds();

        if (gmxBounds) {
			return gmxBounds.toLatLngBounds(this._gmx.srs == 3857);
        } else {
            return new L.LatLngBounds();
        }
    },

    getGeometry: function() {
        if (!this._gmx.latLngGeometry) {
            this._gmx.latLngGeometry = L.gmxUtil.geometryToGeoJSON(this._gmx.geometry, true, this._gmx.srs == 3857);
        }

        return this._gmx.latLngGeometry;
    },

    getPropItem: function (key, propArr) {
        return gmxAPIutils.getPropItem(key, propArr, this._gmx.tileAttributeIndexes);
    },

	//block: internal

    _getTilesByBounds: function (bounds) {    // Получить список gmxTiles по bounds
        var gmx = this._gmx,
            zoom = this._tileZoom || this._map._zoom,
            shiftX = gmx.shiftX || 0,   // Сдвиг слоя
            shiftY = gmx.shiftY || 0,   // Сдвиг слоя + OSM
			latLngBounds = bounds.toLatLngBounds(gmx.srs == 3857),
            minLatLng = latLngBounds.getSouthWest(),
            maxLatLng = latLngBounds.getNorthEast(),
            screenBounds = this._map.getBounds(),
            sw = screenBounds.getSouthWest(),
            ne = screenBounds.getNorthEast(),
            dx = 0;

        if (ne.lng - sw.lng < 360) {
            if (maxLatLng.lng < sw.lng) {
                dx = 360 * (1 + Math.floor((sw.lng - maxLatLng.lng) / 360));
            } else if (minLatLng.lng > ne.lng) {
                dx = 360 * Math.floor((ne.lng - minLatLng.lng) / 360);
            }
        }
        minLatLng.lng += dx;
        maxLatLng.lng += dx;

        var pixelBounds = this._map.getPixelBounds(),
            minPoint = this._map.project(minLatLng),
            maxPoint = this._map.project(maxLatLng);

        var minY, maxY, minX, maxX;
        if (pixelBounds) {
            minY = Math.floor((Math.max(maxPoint.y, pixelBounds.min.y) + shiftY) / 256);
            maxY = Math.floor((Math.min(minPoint.y, pixelBounds.max.y) + shiftY) / 256);
            minX = minLatLng.lng <= -180 ? pixelBounds.min.x : Math.max(minPoint.x, pixelBounds.min.x);
            minX = Math.floor((minX + shiftX) / 256);
            maxX = maxLatLng.lng >= 180 ? pixelBounds.max.x : Math.min(maxPoint.x, pixelBounds.max.x);
            maxX = Math.floor((maxX + shiftX) / 256);
        } else {
            minY = Math.floor((maxPoint.y + shiftY) / 256);
            maxY = Math.floor((minPoint.y + shiftY) / 256);
            minX = Math.floor((minPoint.x + shiftX) / 256);
            maxX = Math.floor((maxPoint.x + shiftX) / 256);
        }
        var gmxTiles = {};
        for (var x = minX; x <= maxX; x++) {
            for (var y = minY; y <= maxY; y++) {
                var zKey = this._tileCoordsToKey({x: x, y: y, z:zoom});
                gmxTiles[zKey] = true;
            }
        }
        return gmxTiles;
    },

    _updateProperties: function (prop) {
        var gmx = this._gmx;
        if (!gmx.sessionKey) {
			gmx.sessionKey = prop.sessionKey = this.options.sessionKey || ''; //should be already received
		}

        if (this.options.parentOptions) {
			prop = this.options.parentOptions;
		}

        gmx.identityField = prop.identityField; // ogc_fid
        gmx.GeometryType = (prop.GeometryType || '').toLowerCase();   // тип геометрий обьектов в слое
        gmx.minZoomRasters = prop.RCMinZoomForRasters || 1;// мин. zoom для растров
        gmx.minZoomQuicklooks = gmx.minZoomRasters; // по умолчанию minZoom для квиклуков и КР равны

        var type = prop.type || 'Vector';
        if (prop.Temporal) { type += 'Temporal'; }
        gmx.layerType = type;   // VectorTemporal Vector
        gmx.items = {};

        L.extend(gmx, L.gmxUtil.getTileAttributes(prop));
        if (gmx.dataManager) {
            gmx.dataManager.setOptions(prop);
        }
        if ('ZIndexField' in prop) {
            if (prop.ZIndexField in gmx.tileAttributeIndexes) {
                gmx.zIndexField = gmx.tileAttributeIndexes[prop.ZIndexField];   // sort field index
            }
        }
        if (this._objectsReorder) {
            this._objectsReorder.initialize();
        }

        // if ('clusters' in prop) {
            // gmx.clusters = prop.clusters;
        // }

        gmx.filter = prop.filter; 	// for dataSource attr
        gmx.dateBegin = prop.dateBegin;
        gmx.dateEnd = prop.dateEnd;
        gmx.dataSource = prop.dataSource;
        if ('MetaProperties' in gmx.rawProperties) {
            var meta = gmx.rawProperties.MetaProperties;
            if ('srs' in meta) {  		// проекция слоя
                gmx.srs = meta.srs.Value || '';
            }
            if ('parentLayer' in meta) {  // фильтр слоя		// todo удалить после изменений вов вьювере
                gmx.dataSource = meta.parentLayer.Value || '';
            }
            if ('filter' in meta) {  // фильтр слоя
                gmx.filter = meta.filter.Value || '';
            }
            if ('dateBegin' in meta) {  // фильтр для мультивременного слоя
                gmx.dateBegin = L.gmxUtil.getDateFromStr(meta.dateBegin.Value || '01.01.1980');
            }
            if ('dateEnd' in meta) {  // фильтр для мультивременного слоя
                gmx.dateEnd = L.gmxUtil.getDateFromStr(meta.dateEnd.Value || '01.01.1980');
            }
            if ('shiftX' in meta || 'shiftY' in meta) {  // сдвиг всего слоя
                gmx.shiftXlayer = meta.shiftX ? Number(meta.shiftX.Value) : 0;
                gmx.shiftYlayer = meta.shiftY ? Number(meta.shiftY.Value) : 0;
            }
            if ('shiftXfield' in meta || 'shiftYfield' in meta) {    // поля сдвига растров объектов слоя
                if (meta.shiftXfield) { gmx.shiftXfield = meta.shiftXfield.Value; }
                if (meta.shiftYfield) { gmx.shiftYfield = meta.shiftYfield.Value; }
            }
            if ('quicklookPlatform' in meta) {    // тип спутника
                gmx.quicklookPlatform = meta.quicklookPlatform.Value;
                if (gmx.quicklookPlatform === 'image') { delete gmx.quicklookPlatform; }
            }
            if ('quicklookX1' in meta) { gmx.quicklookX1 = meta.quicklookX1.Value; }
            if ('quicklookY1' in meta) { gmx.quicklookY1 = meta.quicklookY1.Value; }
            if ('quicklookX2' in meta) { gmx.quicklookX2 = meta.quicklookX2.Value; }
            if ('quicklookY2' in meta) { gmx.quicklookY2 = meta.quicklookY2.Value; }
            if ('quicklookX3' in meta) { gmx.quicklookX3 = meta.quicklookX3.Value; }
            if ('quicklookY3' in meta) { gmx.quicklookY3 = meta.quicklookY3.Value; }
            if ('quicklookX4' in meta) { gmx.quicklookX4 = meta.quicklookX4.Value; }
            if ('quicklookY4' in meta) { gmx.quicklookY4 = meta.quicklookY4.Value; }

            if ('multiFilters' in meta) {    // проверка всех фильтров для обьектов слоя
                gmx.multiFilters = meta.multiFilters.Value === '1' ? true : false;
            }
            if ('isGeneralized' in meta) {    // Set generalization
                this.options.isGeneralized = meta.isGeneralized.Value !== 'false';
            }
            if ('isFlatten' in meta) {        // Set flatten geometry
                this.options.isFlatten = meta.isFlatten.Value !== 'false';
            }
        }
        if (prop.Temporal) {    // Clear generalization flag for Temporal layers
            this.options.isGeneralized = false;
        }

        if (prop.IsRasterCatalog) {
            gmx.IsRasterCatalog = prop.IsRasterCatalog;
            var layerLink = gmx.tileAttributeIndexes.GMX_RasterCatalogID;
            if (layerLink) {
                gmx.rasterBGfunc = function(x, y, z, item, srs) {
                    var properties = item.properties,
						url = L.gmxUtil.protocol + '//' + gmx.hostName
							+ '/TileSender.ashx?ModeKey=tile&ftc=osm'
							+ '&x=' + x
							+ '&y=' + y
							+ '&z=' + z;
					if (srs || gmx.srs) { url += '&srs=' + (srs || gmx.srs); }
					if (gmx.crossOrigin) { url += '&cross=' + gmx.crossOrigin; }
					url += '&LayerName=' + properties[layerLink];
					if (gmx.sessionKey) { url += '&key=' + encodeURIComponent(gmx.sessionKey); }
					if (L.gmx._sw && item.v) { url += '&sw=' + L.gmx._sw + '&v=' + item.v; }
                    return url;
                };
            }
        }
        if (prop.Quicklook) {
            var quicklookParams;

            //раньше это была просто строка с шаблоном квиклука, а теперь стало JSON'ом
            if (prop.Quicklook[0] === '{') {
                quicklookParams = JSON.parse(prop.Quicklook);
            } else {
                quicklookParams = {
                    minZoom: gmx.minZoomRasters,
                    template: prop.Quicklook
                };
            }

            if ('X1' in quicklookParams) { gmx.quicklookX1 = quicklookParams.X1; }
            if ('Y1' in quicklookParams) { gmx.quicklookY1 = quicklookParams.Y1; }
            if ('X2' in quicklookParams) { gmx.quicklookX2 = quicklookParams.X2; }
            if ('Y2' in quicklookParams) { gmx.quicklookY2 = quicklookParams.Y2; }
            if ('X3' in quicklookParams) { gmx.quicklookX3 = quicklookParams.X3; }
            if ('Y3' in quicklookParams) { gmx.quicklookY3 = quicklookParams.Y3; }
            if ('X4' in quicklookParams) { gmx.quicklookX4 = quicklookParams.X4; }
            if ('Y4' in quicklookParams) { gmx.quicklookY4 = quicklookParams.Y4; }

            var template = gmx.Quicklook = quicklookParams.template;
            if ('minZoom' in quicklookParams) { gmx.minZoomQuicklooks = quicklookParams.minZoom; }
            gmx.quicklookBGfunc = function(item) {
                var url = template,
                    reg = /\[([^\]]+)\]/,
                    matches = reg.exec(url);
                while (matches && matches.length > 1) {
                    url = url.replace(matches[0], item.properties[gmx.tileAttributeIndexes[matches[1]]]);
                    matches = reg.exec(url);
                }
				if (gmx.srs) { url += (url.indexOf('?') === -1 ? '?' : '&') + 'srs=' + gmx.srs; }
                return url;
            };
            gmx.imageQuicklookProcessingHook = L.gmx.gmxImageTransform;
        }
        this.options.attribution = prop.Copyright || '';
    },

    _updateShiftY: function(zoom) {
        var gmx = this._gmx;
		gmx.currentZoom = zoom;
		gmx.tileSize = gmxAPIutils.tileSizes[zoom];
		gmx.mInPixel = 256 / gmx.tileSize;
    },

    __drawTile: function (ev) {
		var coords = ev.coords,
			zKey = this._tileCoordsToKey(coords),
			tileElem = this._tiles[zKey];
		if (!tileElem) {
			return;
		}

        var myLayer = this,
			zoom = this._tileZoom,
            gmx = this._gmx;

        if (tileElem && !tileElem.promise) {
			tileElem.loaded = 0;
			tileElem.key = zKey;
			tileElem.promise = new Promise(function(resolve, reject) {
				tileElem.resolve = resolve;
				tileElem.reject = reject;
				var filters = gmx.dataManager.getViewFilters('screen', gmx.layerID);
                var done = function() {
					myLayer._tileReady(coords, null, tileElem.el);
                };
				tileElem.observer = gmx.dataManager.addObserver({
                    type: 'resend',
                    layerID: gmx.layerID,
                    needBbox: gmx.needBbox,
					//topLeft: tileElem.screenTile.topLeft,
                    srs: gmx.srs,
                    target: 'screen',
                    z: zoom,
					targetZoom: myLayer.options.isGeneralized ? zoom : null,
					dateInterval: gmx.layerType === 'VectorTemporal' ? [gmx.beginDate, gmx.endDate] : null,
                    active: true,
                    bbox: gmx.styleManager.getStyleBounds(coords),
                    filters: ['clipFilter', 'userFilter_' + gmx.layerID, 'styleFilter', 'userFilter'].concat(filters),
                    callback: function(data) {
                        if (myLayer._tiles[zKey]) {
							myLayer._tiles[zKey].loaded = 0;

							if (!tileElem.screenTile) {
								tileElem.screenTile = new ScreenVectorTile(myLayer, tileElem);
							}

							tileElem.screenTile.drawTile(data).then(function(res) {
								// console.log('resolve', zKey, res, data);
								if (res) { tileElem.count = res.count; }
								done(res);
							}, function(err) {
								// console.log('reject', zKey, err, data);
								done(err);
							});
						} else {
							// console.log('bad key', zKey);
							done();
						}
                    }
				}, zKey)
					.on('activate', function() {
						//if observer is deactivated before drawing,
						//we can consider corresponding tile as already drawn
						if (!this.isActive()) {
							// console.log('isActive', zKey)
							done();
						}
					});
					//.activate();
			}).catch(function(e) {
				console.warn('catch:', e);
			});
		} else {
			tileElem.resolve();
		}
    }
});
L.Map.addInitHook(function () {
    if (L.Mixin.ContextMenu) {
		L.gmx.VectorLayer.include(L.Mixin.ContextMenu);
	}
	this.options.ftc = this.options.ftc || 'osm';
	this.options.srs = this.options.srs || 3857;
	this.options.skipTiles = this.options.skipTiles || 'All';
});


// Single tile on screen with vector data
var fetchOptions = {
	//mode: 'cors',
	credentials: 'include'
};

function ScreenVectorTile(layer, tileElem) {
    this.layer = layer;
	this.tileElem = tileElem;
	this.tile = tileElem.el;
	var tilePoint = tileElem.coords,
		zoom = tilePoint.z,
		pz = Math.pow(2, zoom),
		x = tilePoint.x % pz,
		y = tilePoint.y % pz,
		utils = gmxAPIutils;

    if (x < 0) { x += pz; }
    if (y < 0) { y += pz; }
    this.ntp = {z: zoom, x: x, y: y};

	this.tilePoint = tilePoint;
    this.zoom = zoom;
    this.gmx = layer._gmx;
    this.zKey = this.layer._tileCoordsToKey(tilePoint, zoom);
    this.worldWidthMerc = utils.worldWidthMerc;

    var gmxTilePoint = utils.getTileNumFromLeaflet(tilePoint, zoom);
    this.tpx = 256 * gmxTilePoint.x;
    this.tpy = 256 * (1 + gmxTilePoint.y);

	var tileSize = utils.tileSizes[tilePoint.z];

    this.tbounds = utils.getBoundsByTilePoint(this.ntp);
    this.topLeft = {
		tilePoint: tilePoint,
		tileSize: tileSize,
		mInPixel: 256 / tileSize,
		pix: {
			px: 256 * tilePoint.x,
			py: 256 * tilePoint.y
		},
		wm: {
			x: tileSize * tilePoint.x - this.worldWidthMerc,
			y: this.worldWidthMerc - tileSize * tilePoint.y
		},
		bounds: utils.getBoundsByTilePoint(tilePoint)
	};

    this.gmxTilePoint = gmxTilePoint;

    this.showRaster =
        (zoom >= this.gmx.minZoomRasters && 'rasterBGfunc' in this.gmx) ||
        (zoom >= this.gmx.minZoomQuicklooks && 'quicklookBGfunc' in this.gmx);
    this.rasters = {}; //combined and processed canvases for each vector item in tile
    this.rasterRequests = {};   // all cached raster requests
    this.itemsView = [];   		// items on screen tile + todo: without not visible
    this._uniqueID = 0;         // draw attempt id
    this.gmx.badTiles = this.gmx.badTiles || {};
}

ScreenVectorTile.prototype = {
    _getUrlFunction: function (gtp, item) {
		return this.gmx.rasterBGfunc(gtp.x, gtp.y, gtp.z, item);
    },

    _loadTileRecursive: function (tilePoint, item) {    //return promise, which resolves with object {gtp, image}
        var gmx = this.gmx,
			gtp = {z: tilePoint.z, x: this.ntp.x, y: this.ntp.y},
            _this = this;

		// for (var key in this.rasterRequests) {
			// this.rasterRequests[key].reject();
		// }
		this.rasterRequests = {};

		return new Promise(function(resolve) {
			var tryLoad = function(gtp, crossOrigin) {
				var rUrl = _this._getUrlFunction(gtp, item);
				if (gmx.rastersCache && gmx.rastersCache[rUrl]) {
					resolve({gtp: gtp, image: gmx.rastersCache[rUrl]});
				} else {
					var tryHigherLevelTile = function(url) {
						if (url) {
							gmx.badTiles[url] = true;
						}
						if (gtp.z > 1) {
							tryLoad({
								x: Math.floor(gtp.x / 2),
								y: Math.floor(gtp.y / 2),
								z: gtp.z - 1
							}, ''); // 'anonymous' 'use-credentials'
						} else {
							resolve({gtp: gtp});
						}
					};

					if (gmx.badTiles[rUrl] || (gmx.maxNativeZoom && gmx.maxNativeZoom < gtp.z)) {
						tryHigherLevelTile();
						return;
					}

					if (L.gmx.getBitmap) {
						L.gmx.getBitmap(rUrl, fetchOptions).then(
							function(res) {
								var imageObj = res.imageBitmap,
									canvas_ = document.createElement('canvas');
								canvas_.width = imageObj.width;
								canvas_.height = imageObj.height;
								canvas_.getContext('2d').drawImage(imageObj, 0, 0, canvas_.width, canvas_.width);
								if (gmx.rastersCache) {
									gmx.rastersCache[rUrl] = canvas_;
								}
								resolve({gtp: gtp, image: canvas_});
							},
							function() {
								tryHigherLevelTile(rUrl);
							}
						)
						.catch(L.Util.falseFn);
					} else {
						var request = _this.rasterRequests[rUrl];
						if (!request) {
							if (gmx.rasterProcessingHook) {
								crossOrigin = 'anonymous';
							}
							request = L.gmx.imageLoader.push(rUrl, {
								tileRastersId: _this._uniqueID,
								zoom: _this.zoom,
								cache: true,
								crossOrigin: gmx.crossOrigin || crossOrigin || ''
							});
							_this.rasterRequests[rUrl] = request;
						} else {
							request.options.tileRastersId = _this._uniqueID;
						}
						request.def.then(
							function(imageObj) {
								if (imageObj) {
									if (gmx.rastersCache) {
										gmx.rastersCache[rUrl] = imageObj;
									}
									resolve({gtp: gtp, image: imageObj});
								} else {
									tryHigherLevelTile(rUrl);
								}
							},
							function() {
								// console.log('tryHigherLevelTile111 ', rUrl);
								tryHigherLevelTile(rUrl);
							}
						);
					}
				}
			};

			tryLoad(gtp);
		});
    },

    _rasterHook: function (attr) {
        var source = attr.sourceTilePoint || attr.destinationTilePoint,
            info = {
                geoItem: attr.geoItem,
                destination: {
                    z: attr.destinationTilePoint.z,
                    x: attr.destinationTilePoint.x,
                    y: attr.destinationTilePoint.y
                },
                source: {
                    z: source.z,
                    x: source.x,
                    y: source.y
                }
            };
        if (attr.url) { info.quicklook = attr.url; }
        return (this.gmx.rasterProcessingHook || this._defaultRasterHook)(
            attr.res, attr.image,
            attr.sx || 0, attr.sy || 0, attr.sw || 256, attr.sh || 256,
            attr.dx || 0, attr.dy || 0, attr.dw || 256, attr.dh || 256,
            info
        );
    },

    // default rasterHook: res - result canvas other parameters as http://www.w3schools.com/tags/canvas_drawimage.asp
    _defaultRasterHook: function (res, image, sx, sy, sw, sh, dx, dy, dw, dh) {
		if (image) {
			var ptx = res.getContext('2d');
			ptx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
		}
    },

    // get pixels parameters for shifted object
    _getShiftPixels: function (it) {
        var w = it.dx + (it.dx < 0 ? 256 : 0),
            h = it.dy + (it.dy < 0 ? 256 : 0),
            sx = 0, sw = 256 - w, dx = w, dw = sw;
        if (it.tx > it.x) {
            sx = sw; sw = w; dx = 0; dw = sw;
        }
        if (sx === 256 || sw < 1) { return null; }

        var sy = h, sh = 256 - h, dy = 0, dh = sh;
        if (it.ty > it.y) {
            sy = 0; dy = sh; sh = h; dh = sh;
        }
        if (sy === 256 || sh < 1) { return null; }

        return {
            sx: sx, sy: sy, sw: sw, sh: sh,
            dx: dx, dy: dy, dw: dw, dh: dh
        };
    },

    // get tiles parameters for shifted object
    _getShiftTilesArray: function (bounds, shiftX, shiftY) {
        var mInPixel = this.topLeft.mInPixel,
            gmxTilePoint = this.gmxTilePoint,
            px = shiftX * mInPixel,
            py = shiftY * mInPixel,
            deltaX = Math.floor(0.5 + px % 256),            // shift on tile in pixel
            deltaY = Math.floor(0.5 + py % 256),
            tileSize = 256 / mInPixel,
            tminX = gmxTilePoint.x - shiftX / tileSize,     // by screen tile
            tminY = gmxTilePoint.y - shiftY / tileSize,
            rminX = Math.floor(tminX),
            rmaxX = rminX + (tminX === rminX ? 0 : 1),
            rminY = Math.floor(tminY),
            rmaxY = rminY + (tminY === rminY ? 0 : 1),
            minX = Math.floor((bounds.min.x - shiftX) / tileSize),  // by geometry bounds
            maxX = Math.floor((bounds.max.x - shiftX) / tileSize),
            minY = Math.floor((bounds.min.y - shiftY) / tileSize),
            maxY = Math.floor((bounds.max.y - shiftY) / tileSize);

        if (rminX < minX) { rminX = minX; }
        if (rmaxX > maxX) { rmaxX = maxX; }
        if (rminY < minY) { rminY = minY; }
        if (rmaxY > maxY) { rmaxY = maxY; }

        var arr = [];
        for (var j = rminY; j <= rmaxY; j++) {
            for (var i = rminX; i <= rmaxX; i++) {
                arr.push({
                    z: gmxTilePoint.z,
                    x: i,
                    y: j,
                    dx: deltaX,
                    dy: deltaY,
                    tx: tminX,
                    ty: tminY
                });
            }
        }
        return arr;
    },

    _chkRastersByItemIntersect: function (arr, item) {
		var geo = item.properties[item.properties.length - 1],
			out = [];
		arr.forEach(function(it) {
			var bounds = gmxAPIutils.getBoundsByTilePoint(it);
			if (gmxAPIutils.isItemIntersectBounds(geo, bounds)) {
				out.push(it);
			}
		});
		return out;
    },

	getTilePosZoomDelta: function(tilePoint, zoomFrom, zoomTo) {		// получить смещение тайла на меньшем zoom
        var dz = Math.pow(2, zoomFrom - zoomTo),
            size = 256 / dz,
            dx = tilePoint.x % dz,
            dy = tilePoint.y % dz;
		return {
			size: size,
			zDelta: dz,
			x: size * dx,
			y: size * dy
		};
    },

    // Loads missing rasters for single item and combines them in canvas.
    // Stores resulting canvas in this.rasters
    _getItemRasters: function (geo) {
        var properties = geo.properties,
            idr = properties[0],
            _this = this,
            gmx = this.gmx,
            indexes = gmx.tileAttributeIndexes,
            rasters = this.rasters,
            shiftX = Number(gmx.shiftXfield ? gmxAPIutils.getPropItem(gmx.shiftXfield, properties, indexes) : 0) % this.worldWidthMerc,
            shiftY = Number(gmx.shiftYfield ? gmxAPIutils.getPropItem(gmx.shiftYfield, properties, indexes) : 0),
            isShift = shiftX || shiftY,
            urlBG = gmxAPIutils.getPropItem('urlBG', properties, indexes),
            url = '',
            itemImageProcessingHook = null,
            isTiles = false,
            item = gmx.dataManager.getItem(idr),
            gmxTilePoint = this.gmxTilePoint,
            tilePoint = this.tilePoint,
            ntp = this.ntp,
            resCanvas = null;

		item.v = geo.v;

		var itemRasterPromise = new Promise(function(resolve) {
			if (gmx.IsRasterCatalog && (gmx.rawProperties.type === 'Raster' || gmxAPIutils.getPropItem('GMX_RasterCatalogID', properties, indexes))) {
				isTiles = true;                     // Raster Layer
			} else if (gmx.quicklookBGfunc) {
				url = gmx.quicklookBGfunc(item);    // Quicklook
				itemImageProcessingHook = gmx.imageQuicklookProcessingHook;
			} else if (urlBG) {
				url = urlBG;                        // Image urlBG from properties
				itemImageProcessingHook = gmx.imageQuicklookProcessingHook;
			}
			new Promise(function(resolve1) {
				if (isTiles) {
					var dataOption = geo.dataOption || {},
						tileToLoadPoints = this._chkRastersByItemIntersect(isShift ? this._getShiftTilesArray(dataOption.bounds, shiftX, shiftY) : [ntp], geo);

					var cnt = tileToLoadPoints.length,
						chkReadyRasters = function() {
							if (cnt < 1) { resolve1(); }
						},
						skipRasterFunc = function() {
							cnt--;
							chkReadyRasters();
						},
						onLoadFunction = function(gtp, p, img) {
							item.skipRasters = false;
							var isImage = true;

							if (itemImageProcessingHook) {
								img = itemImageProcessingHook(img, {
									gmx: gmx,
									geoItem: geo,
									item: item,
									gmxTilePoint: gtp
								});
								isImage = false;
							}

							var info = {
									geoItem: geo,
									image: img,
									destinationTilePoint: tilePoint,
									sourceTilePoint: gtp,
									sx: 0, sy: 0, sw: 256, sh: 256,
									dx: 0, dy: 0, dw: 256, dh: 256
								};

							if (isShift) {
								var pos = _this._getShiftPixels(p);
								if (pos === null) {
									skipRasterFunc();
									return;
								}
								L.extend(info, pos);
								isImage = false;
							}

							if (gtp.z !== ntp.z) {
								var posInfo = _this.getTilePosZoomDelta(ntp, ntp.z, gtp.z);
								if (posInfo.size < 1 / 256) {// меньше 1px
									chkReadyRasters();
									return;
								}
								isImage = false;
								info.sx = Math.floor(posInfo.x);
								info.sy = Math.floor(posInfo.y);
								info.sw = info.sh = posInfo.size;
								if (isShift) {
									var sw = Math.floor(info.dw / posInfo.zDelta);
									info.sx = (info.dx === 0 ? info.sw : 256) - sw;
									info.sw = sw;

									var sh = Math.floor(info.dh / posInfo.zDelta);
									info.sy = (info.dy === 0 ? info.sh : 256) - sh;
									info.sh = sh;
								}
							}
							if (isImage && !gmx.rasterProcessingHook) {
								cnt--;
								resCanvas = img;
								rasters[idr] = resCanvas;
								chkReadyRasters();
							} else {
								if (!resCanvas) {
									resCanvas = document.createElement('canvas');
									resCanvas.width = resCanvas.height = 256;
								}
								info.res = resCanvas;
								var hookResult = _this._rasterHook(info),
									then = function() {
										cnt--;
										//p.resImage = resCanvas;
										rasters[idr] = resCanvas;
										chkReadyRasters();
									};

								if (hookResult) {
									if (hookResult.then) {
										hookResult.then(then);
									}
								} else if (hookResult === null) {
									item.skipRasters = true;
									skipRasterFunc();
								} else {
									then();
								}
							}
						};
					if (cnt) {
						tileToLoadPoints.map(function(it) {
							var loader = _this._loadTileRecursive(it, item);
							loader.then(function(loadResult) {
								onLoadFunction(loadResult.gtp, it, loadResult.image);
							}, skipRasterFunc);
							return loader;
						});
					} else {
						item.skipRasters = true;
						skipRasterFunc();
					}
				} else {
					if (url) {
						if (gmx.sessionKey) { url += (url.indexOf('?') === -1 ? '?' : '&') + 'key=' + encodeURIComponent(gmx.sessionKey); }

						if (gmx.quicklooksCache && gmx.quicklooksCache[url]) {
							resolve1(gmx.quicklooksCache[url]);
						} else if (L.gmx.getBitmap) {
							L.gmx.getBitmap(url, fetchOptions).then(
								function(res) {
									var imageObj = res.imageBitmap,
										canvas_ = document.createElement('canvas');
									canvas_.width = imageObj.width;
									canvas_.height = imageObj.height;
									canvas_.getContext('2d').drawImage(imageObj, 0, 0, canvas_.width, canvas_.width);
									resolve1(canvas_);
								},
								function() {
									resolve1();
								}
							)
							.catch(L.Util.falseFn);
						} else {
							var request = this.rasterRequests[url];
							if (!request) {
								request = L.gmx.imageLoader.push(url, {
									tileRastersId: _this._uniqueID,
									crossOrigin: gmx.crossOrigin || 'anonymous'
								});
								this.rasterRequests[url] = request;
							} else {
								request.options.tileRastersId = this._uniqueID;
							}

							// in fact, we want to return request.def, but need to do additional action during cancellation.
							// so, we consctruct new promise and add pipe it with request.def
							request.def.then(resolve1, resolve1);
						}
					} else {
						resolve1();
					}
					item.skipRasters = false;
				}
			}.bind(this)).then(function(img) {
				if (isTiles) {
					resolve();
				} else {
					if (img) {
						if (gmx.quicklooksCache) {
							gmx.quicklooksCache[url] = img;
						}
						var imgAttr = {
							gmx: gmx,
							topLeft: _this.topLeft,
							geoItem: geo,
							item: item,
							gmxTilePoint: gmxTilePoint
						};
						if (!resCanvas) {
							resCanvas = document.createElement('canvas');
							resCanvas.width = resCanvas.height = 256;
						}
						var prepareItem = function(imageElement) {
							var promise = _this._rasterHook({
								topLeft: _this.topLeft,
								geoItem: geo,
								res: resCanvas,
								image: itemImageProcessingHook ? itemImageProcessingHook(imageElement, imgAttr) : imageElement,
								destinationTilePoint: gmxTilePoint,
								url: url
							}),
							then = function() {
								rasters[idr] = resCanvas;
								resolve();
							};
							if (promise) {
								if (promise.then) {
									promise.then(then);
								}
							} else if (promise === null) {
								item.skipRasters = true;
								resolve();
							} else {
								then();
							}
						};
						prepareItem(img);
					} else {
							item.skipRasters = true;
							resolve();
					}
					delete _this.rasterRequests[url];
				}
			}.bind(this));
		}.bind(this));
        return itemRasterPromise;
    },

    _getVisibleItems: function (geoItems) {
        if (geoItems.length < 2) {
			this.itemsView = geoItems;
            return geoItems;
        }
        if (!gmxAPIutils._tileCanvas) {
            gmxAPIutils._tileCanvas = document.createElement('canvas');
            gmxAPIutils._tileCanvas.width = gmxAPIutils._tileCanvas.height = 256;
        }
        var i, len,
            gmx = this.gmx,
            dm = gmx.dataManager,
            canvas = gmxAPIutils._tileCanvas,
            ctx = canvas.getContext('2d'),
            dattr = {
                tbounds: this.tbounds,
                gmx: gmx,
				topLeft: this.topLeft,
                tpx: this.tpx,
                tpy: this.tpy,
                ctx: ctx
            };
        ctx.clearRect(0, 0, 256, 256);
        ctx.imageSmoothingEnabled = false;
        for (i = 0, len = geoItems.length; i < len; i++) {
            ctx.fillStyle = gmxAPIutils.dec2rgba(i + 1, 1);
            var geoItem = geoItems[i];
            L.gmxUtil.drawGeoItem(
                geoItem,
                dm.getItem(geoItem.properties[0]),
                dattr,
                {fillStyle: ctx.fillStyle}
            );
        }
        var items = {},
            data = ctx.getImageData(0, 0, 256, 256).data;

        for (i = 0, len = data.length; i < len; i += 4) {
            if (data[i + 3] === 255) {
                var color = data[i + 2];
                if (data[i + 1]) { color += (data[i + 1] << 8); }
                if (data[i]) { color += (data[i] << 16); }
                if (color) { items[color] = true; }
            }
        }
        var out = [];
        for (var num in items) {
            var it = geoItems[Number(num) - 1];
            if (it) { out.push(it); }
        }
		this.itemsView = out;
        return out;
    },

    _getNeedRasterItems: function (geoItems) {
        var gmx = this.gmx,
            indexes = gmx.tileAttributeIndexes,
            tbounds = this.tbounds,
            out = [];
        for (var i = 0, len = geoItems.length; i < len; i++) {
            var geo = geoItems[i],
                properties = geo.properties,
                idr = properties[0],
                dataOption = geo.dataOption || {},
                skipRasters = false;

            if (gmx.quicklookBGfunc && !gmxAPIutils.getPropItem('GMX_RasterCatalogID', properties, indexes)) {
                if (gmx.minZoomQuicklooks && this.zoom < gmx.minZoomQuicklooks) { continue; }
                var platform = gmxAPIutils.getPropItem(gmx.quicklookPlatform, properties, indexes) || gmx.quicklookPlatform || '';
                if ((!platform || platform === 'imageMercator') &&
                    !gmxAPIutils.getQuicklookPointsFromProperties(properties, gmx)
                ) {
                    continue;
                }
            }

            if (gmx.styleHook) {
                geo.styleExtend = gmx.styleHook(
                    gmx.dataManager.getItem(idr),
                    gmx.lastHover && idr === gmx.lastHover.id
                );
                skipRasters = geo.styleExtend && geo.styleExtend.skipRasters;
            }
            if (!skipRasters && tbounds.intersectsWithDelta(dataOption.bounds, -1, -1)) {
                out.push(geo);
            }
        }
        return this._getVisibleItems(out);
    },

    _getTileRasters: function (geoItems) {   //load all missing rasters for items we are going to render
		return new Promise(function(resolve) {
			Promise.all(this._getNeedRasterItems(geoItems).map(this._getItemRasters.bind(this)))
				.then(resolve);
		}.bind(this));
    },

    _chkItems: function (data) {
        var layer = this.layer;
        if (!layer._map) {
            return null;
        }
        var items = data && data.added && data.added.length ? data.added : null;

        if (!items) {
            var tLink = layer._tiles[this.zKey];
            if (tLink && tLink.el) {
                tLink.el.getContext('2d').clearRect(0, 0, 256, 256);
            }
            return null;
        }
        return this.gmx.sortItems ? layer.getSortedItems(items) : items;
    },

    destructor: function () {
		if (this._preRenderPromise) {
			this._preRenderPromise.reject();        // cancel preRenderHooks chain if exists
		}
		if (this._renderPromise) {
			this._renderPromise.reject();           // cancel renderHooks chain if exists
		}
        this._cancelRastersPromise();
        this._clearCache();
    },

    _cancelRastersPromise: function () {
        if (this.rastersPromise) {
			if (this.rastersPromise.reject) {
				this.rastersPromise.reject();
			}
            this.rastersPromise = null;
        }
    },

    _clearCache: function () {
        for (var url in this.rasterRequests) {
            this.rasterRequests[url].remove();
        }
        this.rasterRequests = {};
    },

    drawTile: function (data) {
		this.destructor();
		return new Promise(function(resolve, reject) {
			var geoItems = this._chkItems(data);
			var result = function() {
				resolve({count: geoItems.length});
			}.bind(this);
			var _this = this;

			this._uniqueID++;       // count draw attempt

			if (geoItems) {
				this.tile.width = this.tile.height = 256;
				var tile = this.tile,
					ctx = tile.getContext('2d'),
					gmx = this.gmx,
					dattr = {
						//tileLink: tileLink,
						tbounds: this.tbounds,
						rasters: this.rasters,
						gmx: gmx,
						topLeft: this.topLeft,
						tpx: this.tpx,
						tpy: this.tpy,
						ctx: ctx
					};
				L.DomUtil.addClass(tile, 'zKey:' + this.zKey);

				var doDraw = function() {
					ctx.clearRect(0, 0, 256, 256);
					if (gmx.showScreenTiles) {
						ctx.strokeRect(0, 0, 255, 255);
						ctx.strokeText(_this.zKey + ' ' + _this.gmxTilePoint.x + ' ' + _this.gmxTilePoint.y, 50, 50);
					}
					var hookInfo = {
							zKey: _this.zKey,
							topLeft: _this.topLeft,
							tpx: _this.tpx,
							tpy: _this.tpy,
							x: _this.tilePoint.x,
							y: _this.tilePoint.y,
							z: _this.zoom
						},
						bgImage;

					var fArr = [];
					gmx.preRenderHooks.forEach(function (f) {
						if (!bgImage) {
							bgImage = document.createElement('canvas');
							bgImage.width = bgImage.height = 256;
						}
						var res = f(bgImage, hookInfo);
						if (res && res.then) {
							fArr.push(res);
						}
					});
					Promise.all(fArr).then(function() {
						if (bgImage) { dattr.bgImage = bgImage; }
						//ctx.save();
						for (var i = 0, len = geoItems.length; i < len; i++) {
							var geoItem = geoItems[i],
								id = geoItem.id,
								item = gmx.dataManager.getItem(id);
							if (item) {     // skip removed items   (bug with screen tile screenTileDrawPromise.cancel on hover repaint)
								var style = gmx.styleManager.getObjStyle(item, _this.zoom),
									hover = gmx.lastHover && gmx.lastHover.id === geoItem.id && style;

								if (gmx.multiFilters) {
									for (var j = 0, len1 = item.multiFilters.length; j < len1; j++) {
										var it = item.multiFilters[j];
										L.gmxUtil.drawGeoItem(geoItem, item, dattr, hover ? it.parsedStyleHover : it.parsedStyle, it.style);
									}
								} else {
									L.gmxUtil.drawGeoItem(geoItem, item, dattr, hover ? item.parsedStyleHover : item.parsedStyleKeys, style);
								}
								if (id in gmx._needPopups && !gmx._needPopups[id]) {
									gmx._needPopups[id] = true;
								}
							}
						}
						//ctx.restore();
						_this.rasters = {}; // clear rasters
						Promise.all(_this._getHooksPromises(gmx.renderHooks, tile, hookInfo)).then(result, reject);
					}, reject);
					_this.layer.appendTileToContainer(_this.tileElem);
				};

				if (this.showRaster) {
					this.rastersPromise = this._getTileRasters(geoItems);
					this.rastersPromise.then(doDraw, reject); //first load all raster images, then render all of them at once
				} else {
					doDraw();
				}
			} else {
				resolve();
			}
		}.bind(this)).catch(function(e) {
			console.warn('catch1:', e);
		});
    },

    _getHooksPromises: function (hooks, obj, options) {
		var arr = [];
		hooks.forEach(function (f) {
			var res = f(obj, options);
			if (res && res.then) {
				arr.push(res);
			}
		});
		return arr;
    }
};


/*
 * ObjectsReorder  - Reorder objects in Gemixer layer
 */
(function() {

var MAX = 1000000,
    ObjectsReorder = function (layer) {
        this.all = {};
        this.userSetSortFunc = false;     // user sort func flag
        this.sortFunc = null;
        this.count = 0;
        this.disabled = false;
        this.layer = layer;
        layer.on('add', this.onAdd, this);
        layer.on('remove', this.onRemove, this);
    };
    ObjectsReorder.prototype = {
        addToReorder: function (id, bottomFlag) {
            ++this.count;
            this.all[id] = bottomFlag ? -this.count : this.count;
        },
        clickFunc: function (ev) {
            if (!this.disabled) {
                var id = ev.gmx.id;
                this.addToReorder(id, ev.originalEvent.ctrlKey);
                this.layer.redrawItem(id);
            }
        },
        sortItems: function(a, b) {     // layer context
            var reorder = this._objectsReorder;
            if (reorder.count > 0) {
                var ap = reorder.all[a.id],
                    bp = reorder.all[b.id];

                if (ap || bp) {
                    ap = ap ? ap + (ap > 0 ? MAX : -MAX) : 0;
                    bp = bp ? bp + (bp > 0 ? MAX : -MAX) : 0;
                    return ap - bp;
                }
            }
            return reorder.sortFunc ? reorder.sortFunc.call(this, a, b) : 0;
        },
        resetSortFunc: function () {
            var layer = this.layer,
                gmx = layer._gmx,
                zIndexField = gmx.zIndexField;
            gmx.sortItems = this.sortItems;
            this.sortFunc = (zIndexField && !this.userSetSortFunc ?
                function(a, b) {    // layer context
                    var res = Number(a.properties[zIndexField]) - Number(b.properties[zIndexField]);
                    return res ? res : a.id - b.id;
                }
                :
                function(a, b) {
                    return a.id - b.id;
                }
            );
        },
        initialize: function () {
            var gmx = this.layer._gmx;
            if (!this.userSetSortFunc && (gmx.GeometryType === 'polygon' || gmx.GeometryType === 'linestring')) {
                this.resetSortFunc();
            }
        },
        onAdd: function () {
            this.initialize();
            this.layer.on('click', this.clickFunc, this);
        },
        onRemove: function () {
            this.layer.off('click', this.clickFunc, this);
        }
    };

L.gmx.VectorLayer.include({
    _objectsReorder: null,

    _objectsReorderInit: function () {
        if (!this._objectsReorder) {
            this._objectsReorder = new ObjectsReorder(this);
        }
    },

    getReorderArrays: function () {
        var out = {top: [], bottom: []};
        if (this._objectsReorder) {
            var reorder = this._objectsReorder,
                arr = Object.keys(reorder.all).sort(function(a, b) {
                    return reorder.all[a] - reorder.all[b];
                });

            for (var i = 0, len = arr.length; i < len; i++) {
                var id = arr[i];
                if (reorder.all[id] > 0) {
                    out.top.push(id);
                } else {
                    out.bottom.push(id);
                }
            }
        }
        return out;
    },

    bringToTopItem: function (id) {
        this._objectsReorderInit();
        this._objectsReorder.addToReorder(id);
        this.redrawItem(id);
        return this;
    },

    bringToBottomItem: function (id) {
        this._objectsReorderInit();
        this._objectsReorder.addToReorder(id, true);
        this.redrawItem(id);
        return this;
    },

    clearReorderArrays: function () {
        if (this._objectsReorder) {
            var reorder = this._objectsReorder;
            reorder.all = {};
            reorder.count = 0;
            this.repaint();
        }
        return this;
    },

    setReorderArrays: function (top, bottom) {
        this._objectsReorderInit();
        var reorder = this._objectsReorder;
        reorder.all = {};
        reorder.count = 0;
        if (bottom) {
			bottom.forEach(function (id) { reorder.addToReorder(id, true); });
		}
        if (top) {
			top.forEach(function (id) { reorder.addToReorder(id); });
		}
        this.repaint();
        return this;
    },

    getSortedItems: function (arr) {
        this._objectsReorderInit();
        return arr.sort(L.bind(this._objectsReorder.count > 0 ? this._gmx.sortItems : this._objectsReorder.sortFunc, this));
    },

    setSortFunc: function (func) {
        this._objectsReorderInit();
        var reorder = this._objectsReorder;
        reorder.sortFunc = func;
        reorder.userSetSortFunc = func ? true : false;
        this._gmx.sortItems = reorder.sortItems;
        this.repaint();
        return this;
    },
    disableFlip: function() {
        this._objectsReorderInit();
        this._objectsReorder.disabled = true;
        return this;
    },
    enableFlip: function() {
        this._objectsReorderInit();
        this._objectsReorder.disabled = false;
        return this;
    }
});
})();


var StyleManager = function(gmx) {
    this.gmx = gmx;
    this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));

    this._maxVersion = 0;
    this._maxStyleSize = 0;
    this._styles = [];
    this._deferredIcons = [];
    this._parserFunctions = {};
    this._serverStylesParsed = false;

    var minZoom = Infinity,
        maxZoom = -Infinity,
        arr = gmx.properties.styles || [];

    for (var i = 0, len = arr.length; i < len; i++) {
        var st = arr[i];
        minZoom = Math.min(minZoom, st.MinZoom);
        maxZoom = Math.max(maxZoom, st.MaxZoom);
    }
    this.minZoom = minZoom === Infinity ? 0 : minZoom;
    this.maxZoom = maxZoom === -Infinity ? 18 : maxZoom;
};
StyleManager.prototype = {
    _getMaxStyleSize: function(zoom) {  // estimete style size for arbitrary object
        var maxSize = 0;
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var style = this._styles[i];
            if (zoom > style.MaxZoom || zoom < style.MinZoom) { continue; }
            var RenderStyle = style.RenderStyle;
            // if (this._needLoadIcons || !RenderStyle || !RenderStyle.common || !('maxSize' in RenderStyle)) {
            if (this._needLoadIcons || !RenderStyle || !('maxSize' in RenderStyle)) {
                maxSize = StyleManager.MAX_STYLE_SIZE;
                break;
            }
            var maxShift = 0;
            if ('iconAnchor' in RenderStyle && !RenderStyle.iconCenter) {
                maxShift = Math.max(
                    Math.abs(RenderStyle.iconAnchor[0]),
                    Math.abs(RenderStyle.iconAnchor[1])
                );
            }
            maxSize = Math.max(RenderStyle.maxSize + maxShift, maxSize);
        }
        return maxSize;
    },

    getStyleBounds: function(ntp) {
        if (!ntp) {
            return gmxAPIutils.bounds();
        }

        this._maxStyleSize = this._getMaxStyleSize(ntp.z);

        var mercSize = 2 * this._maxStyleSize * gmxAPIutils.tileSizes[ntp.z] / 256; //TODO: check formula
        return gmxAPIutils.getBoundsByTilePoint(ntp).addBuffer(mercSize);
    },

    //is any style is visible at given zoom?
    isVisibleAtZoom: function(zoom) {
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var style = this._styles[i];
            if (zoom >= style.MinZoom && zoom <= style.MaxZoom) {
                return true;
            }
        }
        return false;
    },

    getIcons: function(callback) {
        var _this = this;
        this.promise.then(function() {
            var out = [];
            for (var i = 0, len = _this._styles.length; i < len; i++) {
                var style = _this._styles[i],
                    pt = {};
                if (style.RenderStyle) {
                    pt.RenderStyle = {image: style.RenderStyle.image};
                }
                if (style.HoverStyle) {
                    pt.HoverStyle = {image: style.HoverStyle.image};
                }
                out.push(pt);
            }
            if (callback) {
                callback(out);
            }
        });
        this.initStyles();
    },

    _chkReady: function() {
        if (this._needLoadIcons < 1) {
            var _this = this;
			if (this.gmx.dataManager) {
				this.gmx.dataManager.addFilter('styleFilter', function(it) { return _this._chkStyleFilter(it); });
			}
            this.resolve();
        }
    },

    initStyles: function() {
        if (!this._serverStylesParsed) {
            this._parseServerStyles();
        }
        for (var i = 0, len = this._deferredIcons.length; i < len; i++) {
            this._getImageSize(this._deferredIcons[i]);
        }
        this._deferredIcons = [];
        this._chkReady();
        return this.promise;
    },

    getStyles: function () {
        if (!this._serverStylesParsed) {
            this._parseServerStyles();
        }
        var out = [];
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var style = L.extend({}, this._styles[i]);
            style.RenderStyle = StyleManager.getStyleKeys(style.RenderStyle);
            if (style.HoverStyle) {
                style.HoverStyle = StyleManager.getStyleKeys(style.HoverStyle);
            }
            delete style.filterFunction;
            delete style.version;
            delete style.common;
            delete style.type;
            out.push(style);
        }
        return out;
    },

    clearStyles: function () {
        this._styles = [];
        this.gmx.balloonEnable = false;
        this.gmx.labelsLayer = false;
    },

    _changeStylesVersion: function () {
        var _this = this;
        this._styles.map(function(it) {
            it.version = ++_this._maxVersion;
        });
    },

    setStyle: function(st, num, createFlag) {
        num = num || 0;
        if (num < this._styles.length || createFlag) {
            var style = this._styles[num];
            if (!style) {
                style = this._prepareItem({});
                this._styles[num] = style;
            }
            style.version = ++this._maxVersion;
            if ('Filter' in st) {
                style.Filter = st.Filter;
                var type = typeof (st.Filter);
/*eslint-disable no-useless-escape */
                style.filterFunction = type === 'string' ? L.gmx.Parsers.parseSQL(style.Filter.replace(/[\[\]]/g, '"'))
                    : type === 'function' ? style.Filter : null;
/*eslint-enable */

                this._changeStylesVersion();
            }
            for (var i = 0, len = StyleManager.DEFAULT_KEYS.length; i < len; i++) {
                var key = StyleManager.DEFAULT_KEYS[i];
                if (key in st) { style[key] = st[key]; }
            }
            if (st.RenderStyle) {
                style.RenderStyle = this._parseStyle(st.RenderStyle);
            }
            if (st.HoverStyle) { style.HoverStyle = this._parseStyle(st.HoverStyle, style.RenderStyle); }
            this._checkStyles();
        }
        return this.initStyles();
    },

    getItemBalloon: function(id) {
        var item = this.gmx.dataManager.getItem(id),
            currentFilter = item ? item.currentFilter : 0,
            style = this._styles[currentFilter];
        return style ? {
                DisableBalloonOnMouseMove: style.DisableBalloonOnMouseMove || false,
                DisableBalloonOnClick: style.DisableBalloonOnClick || false,
                templateBalloon: style.Balloon || null,
                isSummary: /\[SUMMARY\]/.test(style.Balloon)
            }
            : null
        ;
    },

    // apply styleHook func
    // applyStyleHook: function(item, hoverFlag) {
        // return this._itemStyleParser(item, this.gmx.styleHook(item, hoverFlag));
    // },

    getObjStyle: function(item, zoom) {
        this._chkStyleFilter(item, zoom);
        var style = this._styles[item.currentFilter],
            version;

        if (!style) { return null; }
        if (style.hoverDiff && this.gmx.lastHover && item.id === this.gmx.lastHover.id) {
            if (style.HoverStyle) {
                version = style.HoverStyle.version || -1;
                if (version !== item.styleVersion) {
                    item.parsedStyleHover = this._itemStyleParser(item, style.HoverStyle);
                }
                return style.HoverStyle;
            } else {
                delete item.parsedStyleHover;
            }
            return null;
        }
        version = style.version || -1;
        if (version !== item.styleVersion) {
            item.parsedStyleKeys = this._itemStyleParser(item, style.RenderStyle);
        }
        return style.RenderStyle;
    },

    _needLoadIcons: 0,
    _getImageSize: function(pt) {     // check image size
        var url = pt.iconUrl || pt.fillIconUrl || '',
            opt = {crossOrigin: 'anonymous'},
			isIE11 = L.gmxUtil.isIE11 && /\.svg/.test(url),
            _this = this;

        if (self.location.protocol !== 'file:') {
            url = url.replace(/http(s*):/, '');	// remove protocol from icon URL
        }
        if (isIE11) {
			url += (url.indexOf('?') === -1 ? '?' : '&') + 'crossOrigin=' + opt.crossOrigin;
        }
        opt.layerID = this.gmx.layerID;
        ++this._needLoadIcons;
        L.gmx.imageLoader.unshift(url, opt).def.then(
            function(it) {
                pt.version = ++_this._maxVersion;
                if (pt.fillIconUrl) {
                    pt.imagePattern = it;
                } else {
                    pt.sx = it.width || it.offsetWidth;
                    pt.sy = it.height || it.offsetHeight;
                    pt.image = it;
                    var maxSize = pt.iconAngle ? Math.sqrt(pt.sx * pt.sx + pt.sy * pt.sy) : Math.max(pt.sx, pt.sy);
                    if (!pt.scaleFunction && !pt.rotateFunction) {
                        if (pt.iconScale || pt.iconScale === 1) { maxSize *= pt.iconScale; }
                        pt.common = true;
                    }
                    pt.maxSize = Number(maxSize.toFixed());
                }
                _this._needLoadIcons--;
                _this._chkReady();
            },
            function() {
                pt.version = ++_this._maxVersion;
                pt.sx = 1;
                pt.sy = 0;
                pt.image = null;
                _this._needLoadIcons--;
                _this._chkReady();
                console.log({url: url, func: '_getImageSize', Error: 'image not found'});
            }
        );
    },

    getCurrentFilters: function(propArray, zoom) {
        var gmx = this.gmx,
            indexes = gmx.tileAttributeIndexes,
            types = gmx.tileAttributeTypes,
            z = zoom || 1,
            out = [];

        if (!this._serverStylesParsed) {
            this._parseServerStyles();
        }
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var st = this._styles[i];
            if (z > st.MaxZoom || z < st.MinZoom
                || (st.filterFunction && !st.filterFunction(propArray, indexes, types))) {
                continue;
            }
            out.push(i);
            if (!gmx.multiFilters) { break; }
        }
        return out;
    },

    _chkStyleFilter: function(item, zoom) {
        var gmx = this.gmx,
            fnum = gmx.multiFilters ? -1 : item.currentFilter,
            curr = this._styles[fnum],
            needParse = !curr || curr.version !== item.styleVersion;

		zoom = zoom || gmx.currentZoom;
        if (needParse || item._lastZoom !== zoom) {
            item.currentFilter = -1;
            item.multiFilters = [];
            var filters = this.getCurrentFilters(item.properties, zoom);
            for (var i = 0, len = filters.length; i < len; i++) {
                var num = filters[i],
                    st = this._styles[num];
                item.hoverDiff = st.hoverDiff;
                item.currentFilter = num;
                if (needParse || fnum !== num) {
                    var parsed = st.common && st.common.RenderStyle || this._itemStyleParser(item, st.RenderStyle),
                        parsedHover = null;

                    item.parsedStyleKeys = parsed;
                    if (st.HoverStyle) {
                        parsedHover = st.common && st.common.HoverStyle || this._itemStyleParser(item, st.HoverStyle);
                        item.parsedStyleHover = parsedHover;
                    }
                    if (gmx.multiFilters) {
                        item.multiFilters.push({
                            style: st.RenderStyle,
                            styleHover: st.HoverStyle,
                            parsedStyle: parsed,
                            parsedStyleHover: parsedHover
                        });
                    }
                }
                item.styleVersion = st.version;
                if (!gmx.multiFilters) { break; }
            }
            item._lastZoom = zoom;
        }
        if (this._styles[item.currentFilter]) {
            return true;
        } else {
            item.currentFilter = -1;
            return false;
        }
    },

    _parseServerStyles: function() {
        var gmx = this.gmx,
            props = gmx.properties,
            arr = props.styles || [{MinZoom: 1, MaxZoom: 21, RenderStyle: StyleManager.DEFAULT_STYLE}],
            len = Math.max(arr.length, gmx.styles.length);

        for (var i = 0; i < len; i++) {
            if (!this._styles[i]) {
                var gmxStyle = gmx.styles[i] || arr[i];
                if (!gmxStyle.RenderStyle) { gmxStyle.RenderStyle = StyleManager.DEFAULT_STYLE; }
                if (gmxStyle.HoverStyle === undefined) {
                    var hoveredStyle = JSON.parse(JSON.stringify(gmxStyle.RenderStyle));
                    if (hoveredStyle.outline) { hoveredStyle.outline.thickness += 1; }
                    gmxStyle.HoverStyle = hoveredStyle;
                } else if (gmxStyle.HoverStyle === null) {
                    delete gmxStyle.HoverStyle;
                }
                var pt = this._prepareItem(gmxStyle);
                this._styles.push(pt);
                if (this._isLabel(pt.RenderStyle)) { gmx.labelsLayer = true; }
            }
        }
        this._checkStyles();
        this._serverStylesParsed = true;
    },

    _iconsUrlReplace: function(iconUrl) {
		var str = iconUrl || '';
		if (iconUrl && this.gmx.iconsUrlReplace) {
			this.gmx.iconsUrlReplace.forEach(function(it) {
				str = str.replace(it.from, it.to);
			});
		}
		return str;
    },

    _checkStyles: function() {
        var minZoom = Infinity,
            maxZoom = -Infinity,
            balloonEnable = false,
            labelsLayer = false;

        for (var i = 0, len = this._styles.length; i < len; i++) {
            var st = this._styles[i];

            st.DisableBalloonOnMouseMove = st.DisableBalloonOnMouseMove === false ? false : true;
            st.DisableBalloonOnClick = st.DisableBalloonOnClick || false;
            if (st.DisableBalloonOnMouseMove === false || st.DisableBalloonOnClick === false) {
                balloonEnable = true;
                st.BalloonEnable = true;
            }
            st.hoverDiff = null;
            st.common = {};
            if (st.RenderStyle) {
				if (st.RenderStyle.iconUrl) {
					st.RenderStyle.iconUrl = this._iconsUrlReplace(st.RenderStyle.iconUrl);
				}
				if (st.HoverStyle && st.HoverStyle.iconUrl) {
					st.HoverStyle.iconUrl = this._iconsUrlReplace(st.HoverStyle.iconUrl);
				}

				if (!labelsLayer) {
                    if (this._isLabel(st.RenderStyle)) {
                        labelsLayer = true;
                    }
                }
                if (st.RenderStyle.common) {
                    st.common.RenderStyle = this._itemStyleParser({}, st.RenderStyle);
                }
                if (st.HoverStyle) {
                    st.hoverDiff = StyleManager.checkDiff(st.RenderStyle, st.HoverStyle);
                }
            }
            if (st.HoverStyle && st.HoverStyle.common) {
                st.common.HoverStyle = this._itemStyleParser({}, st.HoverStyle);
            }
            minZoom = Math.min(minZoom, st.MinZoom);
            maxZoom = Math.max(maxZoom, st.MaxZoom);
        }
        if (this.minZoom !== Infinity) { this.minZoom = minZoom; }
        if (this.maxZoom !== -Infinity) { this.maxZoom = maxZoom; }
        this.gmx.balloonEnable = balloonEnable;
        this.gmx.labelsLayer = labelsLayer;
    },

    _parseStyle: function(st, renderStyle) {
        if (st) {
            st.common = true;
            for (var key in st) {
                if (gmxAPIutils.styleFuncKeys[key]) {
                    var fkey = gmxAPIutils.styleFuncKeys[key],
                        val = st[key];
                    if (typeof (val) === 'string') {
                        st.common = false;
                        if (renderStyle && renderStyle[key] === val) {
                            st[fkey] = renderStyle[fkey];
                        } else {
                            if (!this._parserFunctions[val]) {
                                this._parserFunctions[val] = L.gmx.Parsers.parseExpression(val);
                            }
                            st[fkey] = this._parserFunctions[val];
                        }
                    } else if (typeof (val) === 'function') {
                        st.common = false;
                        st[fkey] = val;
                    }
                }
            }

            var type = '';
            if ('iconUrl' in st) {
                type = 'image';
                if (st.iconUrl) {
                    st.maxSize = 256;
                    this._deferredIcons.push(st);
                }
            } else if (st.fillIconUrl) {
                type = 'square';
                this._deferredIcons.push(st);
            } else if (st.fillPattern) {
                type = 'square';
                st.common = StyleManager.parsePattern(st.fillPattern);
                st.canvasPattern = gmxAPIutils.getPatternIcon(null, st);
            } else if (st.iconCircle) {
                type = 'circle';
                if (!('iconSize' in st)) { st.iconSize = 4; }
            } else if (st.iconPath) {
                type = 'iconPath';
                var iconSize = 0,
                    arr = L.Util.isArray(st.iconPath) ? st.iconPath : StyleManager.DEFAULT_ICONPATH;
                st.iconPath = StyleManager.DEFAULT_ICONPATH.map(function(it, i) {
                    var z = arr[i] || it;
                    iconSize = Math.max(iconSize, z);
                    return z;
                });
                st.iconSize = 2 * iconSize;
            } else if (st.fillRadialGradient) {
                type = 'circle';
                if (!('iconCenter' in st)) { st.iconCenter = true; }
                var size = StyleManager.parseRadialGradient(st.fillRadialGradient);
                if (size === null) {
                    st.common = false;
                } else {
                    st.iconSize = size;
                }
            } else if (st.fillLinearGradient) {
                type = 'square';
                st.common = StyleManager.parseLinearGradient(st.fillLinearGradient);
            } else if (st.iconSize) {
                type = 'square';
                if (!('iconCenter' in st)) { st.iconCenter = true; }
            }
            st.type = type;
            if (st.common && !st.maxSize) {
                st.maxSize = st.iconSize || 0;
                st.maxSize += st.weight ? st.weight : 0;
                if ('iconScale' in st) { st.maxSize *= st.iconScale; }
            }
        }
        return st;
    },

    _prepareItem: function(style) { // Style Scanex->leaflet
        var pt = {
            MinZoom: style.MinZoom || 0,
            MaxZoom: style.MaxZoom || 18,
            Filter: style.Filter || null,
            Balloon: style.Balloon || '',
            RenderStyle: (style.RenderStyle ? this._parseStyle(L.gmxUtil.fromServerStyle(style.RenderStyle)) : {}),
            version: ++this._maxVersion
        };
        pt.DisableBalloonOnMouseMove = style.DisableBalloonOnMouseMove === false ? false : true;
        pt.DisableBalloonOnClick = style.DisableBalloonOnClick || false;

        if (style.HoverStyle) {
            pt.HoverStyle = this._parseStyle(L.gmxUtil.fromServerStyle(style.HoverStyle), pt.RenderStyle);
        }

        if ('Filter' in style) {
/*eslint-disable no-useless-escape */
            var ph = L.gmx.Parsers.parseSQL(style.Filter.replace(/[\[\]]/g, '"'));
/*eslint-enable */
            if (ph) { pt.filterFunction = ph; }
        }
        return pt;
    },

    _isLabel: function(st) {
        var indexes = this.gmx.tileAttributeIndexes;
        return (st && (st.labelTemplate || (st.labelField && st.labelField in indexes)));
    },

    _itemStyleParser: function(item, pt) {
        pt = pt || {};
        var out = {}, arr, i, len,
            indexes = this.gmx.tileAttributeIndexes,
            prop = item.properties || {},
            itemType = item.type,
            type = pt.type,
            color = 'color' in pt ? pt.color : 255,
            opacity = 'opacity' in pt ? pt.opacity : 1;

        out.sx = pt.sx;
        out.sy = pt.sy;
        if (pt.maxSize) {
            out.maxSize = pt.maxSize;
        }
        if (pt.iconAngle) {
            var rotateRes = pt.iconAngle || 0;
            if (rotateRes && typeof (rotateRes) === 'string') {
                rotateRes = (pt.rotateFunction ? pt.rotateFunction(prop, indexes) : 0);
            }
            out.rotate = rotateRes || 0;
        }
        if ('iconColor' in pt) {
            out.iconColor = 'iconColorFunction' in pt ? pt.iconColorFunction(prop, indexes) : pt.iconColor;
        }
        if ('iconScale' in pt) {
            out.iconScale = 'scaleFunction' in pt ? (pt.scaleFunction ? pt.scaleFunction(prop, indexes) : 1) : pt.iconScale;
        }
        if (type === 'image') {
            out.type = type;
            if (pt.iconUrl) { out.iconUrl = pt.iconUrl; }
            if (pt.image) { out.image = pt.image; }
        } else if (pt.fillRadialGradient) {
            var rgr = pt.fillRadialGradient,
                r1 = (rgr.r1Function ? rgr.r1Function(prop, indexes) : rgr.r1),
                r2 = (rgr.r2Function ? rgr.r2Function(prop, indexes) : rgr.r2),
                x1 = (rgr.x1Function ? rgr.x1Function(prop, indexes) : rgr.x1),
                y1 = (rgr.y1Function ? rgr.y1Function(prop, indexes) : rgr.y1),
                x2 = (rgr.x2Function ? rgr.x2Function(prop, indexes) : rgr.x2),
                y2 = (rgr.y2Function ? rgr.y2Function(prop, indexes) : rgr.y2);
            if (rgr.r2max) {
                r2 = Math.min(r2, rgr.r2max);
            }
            var colorStop = [];
            len = rgr.addColorStop.length;
            if (!rgr.addColorStopFunctions) {
                rgr.addColorStopFunctions = new Array(len);
            }
            for (i = 0; i < len; i++) {
                arr = rgr.addColorStop[i];
                var arrFunc = rgr.addColorStopFunctions[i] || [],
                    p0 = (arrFunc[0] ? arrFunc[0](prop, indexes) : arr[0]),
                    p3 = arr[3];
                if (arr.length < 4) {
                    var op = arr.length < 3 ? 1 : arrFunc[2] ? arrFunc[2](prop, indexes) : arr[2];
                    p3 = gmxAPIutils.dec2color(arrFunc[1] ? arrFunc[1](prop, indexes) : arr[1], op);
                 }
                colorStop.push([p0, p3]);
            }
            out.maxSize = out.sx = out.sy = out.iconSize = r2;
            out.fillRadialGradient = {
                x1:x1, y1:y1, r1:r1, x2:x2, y2:y2, r2:r2,
                addColorStop: colorStop
            };
            out._radialGradientParsed = {
                create: [x1, y1, r1, x2, y2, r2],
                colorStop: colorStop
            };
        } else if (pt.fillLinearGradient) {
            out.fillLinearGradient = pt.fillLinearGradient;
        } else {
            if (pt.fillPattern) {
                out.canvasPattern = (pt.canvasPattern ? pt.canvasPattern : gmxAPIutils.getPatternIcon(item, pt, indexes));
            }

            if (type === 'iconPath') {
                out.type = type;
                out.iconPath = pt.iconPath;
            }

            if (itemType === 'POLYGON' || itemType === 'MULTIPOLYGON' || this.gmx.GeometryType === 'polygon') {
                type = 'polygon';
            }
            if (pt.iconSize) {
                var iconSize = ('sizeFunction' in pt ? pt.sizeFunction(prop, indexes) : pt.iconSize);
                out.sx = out.sy = iconSize;
                // iconSize += pt.weight ? pt.weight : 0;
                out.iconSize = iconSize;
                if ('iconScale' in pt) {
                    out.iconSize *= pt.iconScale;
                }
                out.maxSize = iconSize;
            }
            out.stroke = true;
            if ('colorFunction' in pt || 'opacityFunction' in pt) {
                color = 'colorFunction' in pt ? pt.colorFunction(prop, indexes) : color;
                opacity = 'opacityFunction' in pt ? pt.opacityFunction(prop, indexes) : opacity;
            }
            out.strokeStyle = gmxAPIutils.dec2color(color, opacity);
            out.lineWidth = 'weight' in pt ? pt.weight : 1;
        }

        if ('iconScale' in pt) {
            out.iconScale = 'scaleFunction' in pt ? (pt.scaleFunction ? pt.scaleFunction(prop, indexes) : 1) : pt.iconScale;
        }
        if ('iconAnchor' in pt) {
            out.iconAnchor = pt.iconAnchor;
        }
        if ('iconCenter' in pt) {
            out.iconCenter = pt.iconCenter;
        }

        if (type === 'square' || type === 'polygon' || type === 'circle' || type === 'iconPath') {
            out.type = type;
            var fop = pt.fillOpacity,
                fc = pt.fillColor,
                fcDec = typeof (fc) === 'string' ? parseInt(fc.replace(/#/, ''), 16) : fc;

            if ('fillColor' in pt) {
                out.fillStyle = gmxAPIutils.dec2color(fcDec, 1);
            }
            if ('fillColorFunction' in pt || 'fillOpacityFunction' in pt) {
                color = ('fillColorFunction' in pt ? pt.fillColorFunction(prop, indexes) : fc || 255);
                opacity = ('fillOpacityFunction' in pt ? pt.fillOpacityFunction(prop, indexes) : fop || 1);
                out.fillStyle = gmxAPIutils.dec2color(color, opacity);
            } else if ('fillOpacity' in pt && 'fillColor' in pt) {
                out.fillStyle = gmxAPIutils.dec2color(fcDec, fop);
            }
        }

        if ('dashArray' in pt) { out.dashArray = pt.dashArray; }
        if ('dashOffset' in pt) { out.dashOffset = pt.dashOffset; }

        if (this.gmx.labelsLayer) {
            arr = gmxAPIutils.styleKeys.label.client;
            for (i = 0, len = arr.length; i < len; i++) {
                var it = arr[i];
                if (it in pt) {
                    if (it === 'labelField') {
                        if (!indexes[pt[it]]) {
                            continue;
                        }
                    } else if (it === 'labelTemplate') {
                        var properties = gmxAPIutils.getPropertiesHash(prop, indexes);
                        out.labelText = gmxAPIutils.parseTemplate(pt[it], properties);
                    }
                    out[it] = pt[it];
                }
            }
            if ('labelAnchor' in pt) {
                out.labelAnchor = pt.labelAnchor;
            }
        }
        return out;
    }
};
StyleManager.MAX_STYLE_SIZE = 256;
//StyleManager.DEFAULT_STYLE = {outline: {color: 255, thickness: 1}, marker: {size: 8, circle: true}};
StyleManager.DEFAULT_STYLE = {outline: {color: 255, thickness: 1}, marker: {size: 8}};
StyleManager.DEFAULT_KEYS = ['MinZoom', 'MaxZoom', 'Balloon', 'BalloonEnable', 'DisableBalloonOnMouseMove', 'DisableBalloonOnClick'];
StyleManager.DEFAULT_ICONPATH = [0, 10, 5, -10, -5, -10, 0, 10];  // [TL.x, TL.y, BR.x, BR.y, BL.x, BL.y, TL.x, TL.y]

StyleManager.parsePattern = function(pattern) {
    var common = true,
        parsers = L.gmx.Parsers;
    if ('step' in pattern && typeof (pattern.step) === 'string') {
        pattern.patternStepFunction = parsers.parseExpression(pattern.step);
        common = false;
    }
    if ('width' in pattern && typeof (pattern.width) === 'string') {
        pattern.patternWidthFunction = parsers.parseExpression(pattern.width);
        common = false;
    }
    if ('colors' in pattern) {
        var arr = [];
        for (var i = 0, len = pattern.colors.length; i < len; i++) {
            var rt = pattern.colors[i];
            if (typeof (rt) === 'string') {
                arr.push(parsers.parseExpression(rt));
                common = false;
            } else {
                arr.push(null);
            }
        }
        pattern.patternColorsFunction = arr;
    }
    return common;
};

StyleManager.getStyleKeys = function(style) {
    var out = {};
    for (var key in gmxAPIutils.styleKeys) {
        var keys = gmxAPIutils.styleKeys[key];
        for (var i = 0, len = keys.client.length; i < len; i++) {
            var key1 = keys.client[i];
            if (key1 in style) {
                if (style[key1] !== undefined) {
                    out[key1] = JSON.parse(JSON.stringify(style[key1]));
                }
                if (key1 === 'fillPattern') { delete out[key1].patternColorsFunction; }
                else if (key1 === 'fillLinearGradient') { delete out[key1].addColorStopFunctions; }
            }
        }
    }
    if ('iconAnchor' in style) {
        out.iconAnchor = style.iconAnchor;
    }
    if ('labelAnchor' in style) {
        out.labelAnchor = style.labelAnchor;
    }
    return out;
};

StyleManager.checkDiff = function(st, st1) {
    for (var key in st) {
        if (st[key] !== st1[key]) {
            return key;
        }
    }
    return null;
};

StyleManager.parseRadialGradient = function(rg) {
    //	x1,y1,r1 — координаты центра и радиус первой окружности;
    //	x2,y2,r2 — координаты центра и радиус второй окружности.
    //	addColorStop - стоп цвета объекта градиента [[position, color]...]
    //		position — положение цвета в градиенте. Значение должно быть в диапазоне 0.0 (начало) до 1.0 (конец);
    //		color — код цвета или формула.
    //		opacity — прозрачность
    //		canvasStyleColor — результрующий цвет в формате canvas
    var common = true,
        parsers = L.gmx.Parsers,
        i = 0,
        arr = ['r1', 'x1', 'y1', 'r2', 'x2', 'y2'],
        len = arr.length;
    for (i = 0; i < len; i++) {
        var it = arr[i];
        if (!rg[it]) { rg[it] = 0; }
        if (typeof (rg[it]) === 'string') {
            rg[it + 'Function'] = parsers.parseExpression(rg[it]);
            common = false;
        }
    }

    rg.addColorStop = rg.addColorStop || [[0, 0xFF0000, 0.5], [1, 0xFFFFFF, 0.5]];
    rg.addColorStopFunctions = [];
    for (i = 0, len = rg.addColorStop.length; i < len; i++) {
        arr = rg.addColorStop[i];
        var resFunc = [
                (typeof (arr[0]) === 'string' ? parsers.parseExpression(arr[0]) : null),
                (typeof (arr[1]) === 'string' ? parsers.parseExpression(arr[1]) : null),
                (typeof (arr[2]) === 'string' ? parsers.parseExpression(arr[2]) : null)
            ];
        rg.addColorStopFunctions.push(resFunc);
        if (resFunc[1] === null && resFunc[2] === null) {
            arr[3] = gmxAPIutils.dec2color(arr[1], arr[2] > 1 ? arr[2] / 100 : arr[2]);
        } else {
            common = false;
        }
    }
    if ('r2Function' in rg) { common = false; }
    return common ? Math.max(rg.r1, rg.r2) : null;
};

StyleManager.parseLinearGradient = function(lg) {
    var common = true;
    //	x1,y1 — координаты начальной точки
    //	x2,y2 — координаты конечной точки
    //	addColorStop - стоп цвета объекта градиента [[position, color]...]
    //		position — положение цвета в градиенте. Значение должно быть в диапазоне 0.0 (начало) до 1.0 (конец);
    //		color — код цвета или формула.
    //		opacity — прозрачность
    var i = 0,
        parsers = L.gmx.Parsers,
        arr = ['x1', 'y1', 'x2', 'y2'],
        def = [0, 0, 0, 256],
        len = arr.length;
    for (i = 0; i < len; i++) {
        var it = arr[i];
        if (it in lg) {
            if (typeof (lg[it]) === 'string') {
                lg[it + 'Function'] = parsers.parseExpression(lg[it]);
                common = false;
            }
        } else {
            lg[it] = def[i];
        }
    }

    lg.addColorStop = lg.addColorStop || [[0, 0xFF0000], [1, 0xFFFFFF]];
    lg.addColorStopFunctions = [];
    for (i = 0, len = lg.addColorStop.length; i < len; i++) {
        arr = lg.addColorStop[i];
        lg.addColorStopFunctions.push([
            (typeof (arr[0]) === 'string' ? parsers.parseExpression(arr[0]) : null),
            (typeof (arr[1]) === 'string' ? parsers.parseExpression(arr[1]) : null),
            (typeof (arr[2]) === 'string' ? parsers.parseExpression(arr[2]) : null)
        ]);
    }
    return common;
};


L.gmx.VectorLayer.include({
    bindPopup: function (content, options) {
        var popupOptions = L.extend({maxWidth: 10000, className: 'gmxPopup', layerId: this._gmx.layerID}, options);

        if (this._popup) { this.unbindPopup(); }
        if (content instanceof L.Popup) {
            this._popup = content;
        } else {
            if (!this._popup || options) {
                this._popup = new L.Popup(popupOptions);
            }
            this._popup.setContent(content);
        }
        this._popup._initContent = content;
        this._popup._state = '';

        if (!this._popupHandlersAdded) {
            this
                .on('click', this._openClickPopup, this)
                .on('mousemove', this._movePopup, this)
                .on('mouseover', this._overPopup, this)
                .on('mouseout', this._outPopup, this)
                .on('doneDraw', this._chkNeedOpenPopup, this);

            this._popupHandlersAdded = true;
        }
        if (popupOptions && popupOptions.popupopen) {
            this._popupopen = popupOptions.popupopen;
        }

        this._popup.updateLayout = this._popup._updateLayout;

        return this;
    },

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this
			    .off('click', this._openClickPopup, this)
                .off('mousemove', this._movePopup, this)
			    .off('mouseover', this._overPopup, this)
                .off('mouseout', this._outPopup, this)
                .off('doneDraw', this._chkNeedOpenPopup, this);

            this._popupopen = null;
			this._popupHandlersAdded = false;
		}
        this._gmx.balloonEnable = false;
		return this;
	},

    _chkNeedOpenPopup: function () {
        for (var id in this._gmx._needPopups) {
            if (this._gmx._needPopups[id]) {
                this.addPopup(id);
                delete this._gmx._needPopups[id];
            }
        }
    },

    disablePopup: function () {
        this._popupDisabled = true;
		return this;
    },

    enablePopup: function () {
        this._popupDisabled = false;
		return this;
    },

	openPopup: function (latlng, options) {
		if (this._popup) {
			// open the popup from one of the path's points if not specified
			latlng = latlng || this._latlng ||
			         this._latlngs[Math.floor(this._latlngs.length / 2)];

			options = options || {};
            options.latlng = latlng;
            this._openPopup(options);
		}

		return this;
	},

	closePopup: function (type) {
		if (this._popup) {
			this._popup._close();
			if (type !== 'mouseout') {
			this.getPopups().forEach(this._clearPopup.bind(this));
			}
            this.fire('popupclose', {popup: this._popup});
		}
		return this;
	},

    _movePopup: function (options) {
        if (this._popup._state === 'mouseover') {
            var id = this._popup.options._gmxID || -1;
            if (id !== options.gmx.id) {
                this._setPopupContent(options);
            }
            this._popup.setLatLng(options.latlng);
        }
    },

    _overPopup: function (options) {
        var _popup = this._popup;
        if (!_popup._map) {
            this._openPopup(options);
        } else {
            this.fire('popupopen', {
                popup: _popup,
                gmx: this._setPopupContent(options, _popup)
            });
        }
        if (_popup._state === 'mouseover') {
            _popup.setLatLng(options.latlng);
        }
    },

    _outPopup: function (ev) {
        if (this._popup._state === 'mouseover' && !ev.gmx.prevId) {
            this.closePopup(ev.type);
        }
    },

    _callBalloonHook: function (props, div) {

        var spans = div.getElementsByTagName('span'),
            hooksCount = {},
            key, i, len;
        for (key in this._balloonHook) {    // collect hook counts
            var hookID = this._balloonHook[key].hookID;
            hooksCount[key] = 0;
            for (i = 0, len = spans.length; i < len; i++) {
                if (spans[i].id === hookID) {
                    hooksCount[key]++;
                }
            }
        }

        for (key in this._balloonHook) {
            var hook = this._balloonHook[key],
                fid = hook.hookID,
                notFound = true;

            for (i = 0, len = spans.length; i < len; i++) {
                var node = spans[i];
                if (node.id === fid) {
                    notFound = false;
                    node.id += '_' + i;
                    hook.callback(props, div, node, hooksCount);
                }
            }
            if (notFound) {
                hook.callback(props, div, null, hooksCount);
            }
        }
    },

    _setPopupContent: function (options, _popup) {
        if (!_popup) { _popup = this._popup; }
        var gmx = options.gmx || {},
            balloonData = gmx.balloonData || {},
            properties = L.extend({}, gmx.properties),
            target = gmx.target || {},
            geometry = target.geometry || {},
            offset = target.offset,
            templateBalloon = _popup._initContent || balloonData.templateBalloon || '',
            type = options.type,
            skipSummary = this.options.isGeneralized && (type === 'mouseover' || type === 'mousemove'),
            outItem = {
                id: gmx.id,
                type: type,
                nodePoint: gmx.nodePoint,
                latlng: options.latlng,
                properties: properties,
                templateBalloon: templateBalloon
            };

        if (geometry.type === 'POINT') {
			var geoJson = L.gmxUtil.geometryToGeoJSON(geometry, true, gmx.srs == 3857);
            outItem.latlng = L.latLng(geoJson.coordinates.reverse());
        }
        if (offset) {
            var protoOffset = L.Popup.prototype.options.offset;
            _popup.options.offset = [-protoOffset[0] - offset[0], protoOffset[1] - offset[1]];
        } else {
			_popup.options.offset[1] = type === 'mouseover' ? -7 : 7;
		}

        if (this._popupopen) {
            this._popupopen({
                popup: _popup,
                latlng: outItem.latlng,
                layerPoint: options.layerPoint,
                contentNode: _popup._contentNode,
                containerPoint: options.containerPoint,
                originalEvent: options.originalEvent,
                gmx: outItem
            });
        } else if (!(templateBalloon instanceof L.Popup)) {
            if (!(templateBalloon instanceof HTMLElement)) {
                var geometries,
                    summary = '',
                    unitOptions = this._map ? this._map.options : {};

                if (!skipSummary) {
                    geometries = target.geometry ? [target.geometry] : (gmx.geometries || this._gmx.dataManager.getItemGeometries(gmx.id) || []);
                    outItem.summary = summary = L.gmxUtil.getGeometriesSummary(geometries, unitOptions);
                }
                if (this._balloonHook) {
                    if (!templateBalloon) {
                        templateBalloon = gmxAPIutils.getDefaultBalloonTemplate(properties);
                    }
                    for (var key in this._balloonHook) {
                        properties[key] = gmxAPIutils.parseTemplate(this._balloonHook[key].resStr, properties);
                    }
                }
                templateBalloon = L.gmxUtil.parseBalloonTemplate(templateBalloon, {
                    properties: properties,
                    tileAttributeTypes: this._gmx.tileAttributeTypes,
                    unitOptions: unitOptions,
                    summary: summary,
                    geometries: geometries
                });
            }

            var contentDiv = L.DomUtil.create('div', '');
            contentDiv.innerHTML = templateBalloon;
            _popup.setContent(contentDiv);
            if (this._balloonHook) {
                this._callBalloonHook(gmx.properties, _popup.getContent());
            }
            //outItem.templateBalloon = templateBalloon;
        }
        _popup.options._gmxID = gmx.id;
        return outItem;
    },

    _openClickPopup: function (options) {
        var originalEvent = options.originalEvent || {},
            skip = !options.gmx || this._popupDisabled || originalEvent.ctrlKey || originalEvent.altKey || originalEvent.shiftKey;

        if (!skip) {
            var type = options.type,
                gmx = options.gmx,
                balloonData = gmx.balloonData,
                flag = type === 'click' && balloonData.isSummary && !balloonData.DisableBalloonOnClick,
                item = gmx.target;

            if (flag && item.options.isGeneralized && !item.geometry) {
                var layerProp = gmx.layer.getGmxProperties();
                gmxAPIutils.getLayerItemFromServer({
                    options: options,
                    layerID: layerProp.name,
                    value: item.id,
                    field: layerProp.identityField
                }).then(function(json, params) {
                    if (json && json.Status === 'ok' && json.Result) {
                        var pArr = json.Result.values[0];
                        params.options.gmx.target.fromServerProps = pArr;
                        params.options.gmx.target.geometry = pArr[pArr.length - 1];
                        this._openPopup(params.options);
                    }
                }.bind(this));
            } else {
				if (item.type.indexOf('POINT') !== -1) {
					options.latlng = L.latLng(L.gmxUtil.geometryToGeoJSON(item.properties[item.properties.length - 1], true, this._gmx.srs == 3857).coordinates.reverse());
                }
				this._openPopup(options);
            }
        }
    },

    _openPopup: function (options, notSkip) {
        var map = this._map,
            originalEvent = options.originalEvent || {},
            skip = notSkip ? !notSkip : this._popupDisabled || originalEvent.ctrlKey || originalEvent.altKey || originalEvent.shiftKey;

        if (!skip) {
            var type = options.type,
                _popup = this._popup,
                gmx = options.gmx || {},
                balloonData = gmx.balloonData || {};

            if (type === 'click') {
                if (!notSkip && balloonData.DisableBalloonOnClick && !this.hasEventListeners('popupopen')) { return; }

                if (!('_gmxPopups' in map)) {
                    map._gmxPopups = [];
                }
                if (!('maxPopupCount' in map.options)) { map.options.maxPopupCount = 1; }
                if (!this._gmx._gmxPopupsInit) {
                    this._gmx._gmxPopupsInit = true;
                    map.on({
                        layerremove: function (ev) {
                            if (ev.layer instanceof L.Popup) {
                                this._clearPopup(ev.layer);
                            } else if (ev.layer === this) {
                                if (map._gmxPopups) {
                                    var layerId = this._gmx.layerID;
                                    map._gmxPopups = map._gmxPopups.reduce(function(p, c) {
                                        if (c._map) {
                                            if (c.options.layerId === layerId) { c._map.removeLayer(c); }
                                            else { p.push(c); }
                                        }
                                        return p;
                                    }, []);
                                }
                                this.closePopup();
                            }
                        }
                    }, this);
                }

                this._clearPopup(gmx.id);
                var opt = this._popup ? this._popup.options : {maxWidth: 10000, className: 'gmxPopup', layerId: this._gmx.layerID};
                _popup = new L.Popup(L.extend({}, opt, {closeOnClick: map.options.maxPopupCount === 1, autoPan: true}));
            } else if (type === 'mouseover') {
                if (balloonData.DisableBalloonOnMouseMove) {
                    _popup._state = '';
                    return;
                }
                _popup.options.autoPan = false;
            } else {
                return;
            }
            _popup.options.objectId = gmx.id;
            _popup._state = type;
            var outItem = this._setPopupContent(options, _popup);
            _popup.setLatLng(outItem.latlng);

            this.fire('popupopen', {
                popup: _popup,
                gmx: outItem
            });
            if (type === 'click') {
                if (map._gmxPopups.length >= map.options.maxPopupCount) {
                    map.removeLayer(map._gmxPopups.shift());
                }
                map._gmxPopups.push(_popup);
            }
            _popup.addTo(map);    // this._map.openPopup(_popup);

            if (_popup._closeButton) {
                var closeStyle = _popup._closeButton.style;
                if (type === 'mouseover' && closeStyle !== 'hidden') {
                    closeStyle.visibility = 'hidden';
                    _popup._container.style.marginBottom = '7px';
                    _popup._container.style.pointerEvents = 'none';
                } else if (type === 'click' && closeStyle !== 'inherit') {
                    closeStyle.visibility = 'inherit';
                    _popup._container.style.marginBottom = '';
                    _popup._container.style.pointerEvents = '';
                }
            }
        }
    },

	_clearPopup: function (item /* <L.Popup> or objectId */) {
        var map = this._map;
        if (map && map._gmxPopups) {
            var layerId = this._gmx.layerID,
                flagPopup = item instanceof L.Popup;
            map._gmxPopups = map._gmxPopups.reduce(function(p, c) {
                if (c._map) {
                    if (flagPopup && c === item) { c._map.removeLayer(c); }
                    else if (c.options.layerId === layerId && c.options.objectId === item) { c._map.removeLayer(c); }
                    else { p.push(c); }
                }
                return p;
            }, []);
        }
    },

    getPopups: function (flag) {
        var map = this._map,
            out = [];
        if (map && map._gmxPopups) {
            var layerId = this._gmx.layerID;
            map._gmxPopups.reduce(function(p, c) {
                if (c.options.layerId === layerId) { p.push(flag ? c : c.options.objectId); }
                return p;
            }, out);
        }
        return out;
    },

    addPopup: function (id) {
        var gmx = this._gmx,
            item = gmx.dataManager.getItem(id);
        if (!item || !this._map) {
            gmx._needPopups[id] = false;
        } else {
            var center = item.bounds.getCenter(),
                latlng = L.latLng(L.gmxUtil.coordsFromMercator('Point', center, gmx.srs == 3857).reverse());
            this._openPopup({
                type: 'click',
                latlng: latlng,
                gmx: this.getHoverOption(item)
            }, true);
            delete gmx._needPopups[id];
        }
        return this;
    },

    addPopupHook: function (key, callback) {
        if (!this._balloonHook) { this._balloonHook = {}; }
        if (!this._balloonHook[key]) {
            var hookID = '_' + L.stamp({});
            this._balloonHook[key] = {
                key: key,
                hookID: hookID,
                resStr: '<span id="' + hookID + '"></span>',
                callback: callback
            };
        }
        return this;
    },

    removePopupHook: function(key) {
        if (this._balloonHook) { delete this._balloonHook[key]; }
        return this;
    }
});


L.gmx.VectorLayer.include({
    _gmxFirstObjectsByPoint: function (geoItems, mercPoint, bounds) {    // Получить верхний объект по координатам mouseClick
        var gmx = this._gmx,
            mInPixel = gmx.mInPixel,
            j,
            len;

        for (var i = geoItems.length - 1; i >= 0; i--) {
            var geoItem = geoItems[i].properties,
                idr = geoItem[0],
                dataOption = geoItems[i].dataOption || {},
                item = gmx.dataManager.getItem(idr),
                currentStyle = item.currentStyle || item.parsedStyleKeys || {},
                iconScale = currentStyle.iconScale || 1,
                iconCenter = currentStyle.iconCenter,
                iconAnchor = !iconCenter && currentStyle.iconAnchor ? currentStyle.iconAnchor : null,
                parsedStyle = gmx.styleManager.getObjStyle(item),
                lineWidth = currentStyle.lineWidth || parsedStyle.lineWidth || 0,
                sx = lineWidth + (parsedStyle.sx || currentStyle.sx || 0),
                sy = lineWidth + (parsedStyle.sy || currentStyle.sy || 0),
                offset = [
                    iconScale * sx / 2,
                    iconScale * sy / 2
                ],
                point = mercPoint,
                geom = geoItem[geoItem.length - 1],
                type = geom.type;

            if (type === 'POINT' && parsedStyle.type === 'circle') {
                offset[0] *= 2;
                offset[1] *= 2;
            }
            var radius = offset[0],
                objBounds = gmxAPIutils.bounds()
                    .extendBounds(dataOption.bounds)
                    .addBuffer(offset[0] / mInPixel, offset[1] / mInPixel);
            if (iconAnchor) {
                offset = [
                    iconAnchor[0] - offset[0],
                    iconAnchor[1] - offset[1]
                ];
                point = [
                    mercPoint[0] + offset[0] / mInPixel,
                    mercPoint[1] - offset[1] / mInPixel
                ];
            }
            if (!objBounds.contains(point)) { continue; }

            var fill = currentStyle.fillStyle || currentStyle.canvasPattern || parsedStyle.bgImage || parsedStyle.fillColor,
                marker = parsedStyle && parsedStyle.image ? parsedStyle.image : null,
                chktype = type,
                hiddenLines = dataOption.hiddenLines || [],
                boundsArr = dataOption.boundsArr,
                coords = geom.coordinates,
                nodePoint = null,
                ph = {
                    point: mercPoint,
                    bounds: bounds,
                    coords: coords,
                    boundsArr: boundsArr
                };

            if (type === 'MULTIPOLYGON' || type === 'POLYGON') {
                if (marker) {
                    chktype = 'POINT';
                } else if (!fill) {
                    if (type === 'POLYGON') {
                        chktype = 'MULTILINESTRING';
                        hiddenLines = hiddenLines[0];
                    } else {
                        chktype = 'LIKEMULTILINESTRING';
                    }
                    ph.hidden = hiddenLines;
                }
            }

            if (chktype === 'LINESTRING') {
                if (!gmxAPIutils.isPointInPolyLine(mercPoint, lineWidth / mInPixel, coords)) {
                    nodePoint = gmxAPIutils.bounds([point]).addBuffer(offset[0] / mInPixel, offset[1] / mInPixel).isNodeIntersect(coords);
                    if (nodePoint === null) { continue; }
                }
            } else if (chktype === 'LIKEMULTILINESTRING') {
                ph.delta = lineWidth / mInPixel;
                var flag = false;
                for (j = 0, len = coords.length; j < len; j++) {
                    ph.coords = coords[j];
                    ph.hidden = hiddenLines ? hiddenLines[j] : null;
                    ph.boundsArr = boundsArr[j];
                    if (gmxAPIutils.isPointInLines(ph)) {
                        flag = true;
                        break;
                    }
                }
                if (!flag) { continue; }
            } else if (chktype === 'MULTILINESTRING') {
                ph.delta = lineWidth / mInPixel;
                ph.hidden = hiddenLines;
                if (!gmxAPIutils.isPointInLines(ph)) {
                    var pBounds = gmxAPIutils.bounds([point]).addBuffer(offset[0] / mInPixel, offset[1] / mInPixel);
                    for (j = 0, len = coords.length; j < len; j++) {
                        nodePoint = pBounds.isNodeIntersect(coords[j]);
                        if (nodePoint !== null) {
                            nodePoint.ring = j;
                            break;
                        }
                    }
                    if (nodePoint === null) { continue; }
                }
            } else if (chktype === 'MULTIPOLYGON' || chktype === 'POLYGON') {
                var chkPoint = mercPoint;
                flag = false;
                if (chktype === 'POLYGON') {
                    coords = [geom.coordinates];
                    boundsArr = [dataOption.boundsArr];
                }
                for (j = 0, len = coords.length; j < len; j++) {
                    var arr = coords[j],
                        bbox = boundsArr[j];
                    for (var j1 = 0, len1 = arr.length; j1 < len1; j1++) {
                        var b = bbox[j1];
                        if (b.intersects(bounds)) {
                            if (gmxAPIutils.isPointInPolygonWithHoles(chkPoint, arr)) {
                                flag = j1 === 0 ? true : false;
                                break;
                            }
                        }
                    }
                }
                if (!flag) { continue; }
            } else if (chktype === 'POINT') {
                if (parsedStyle.type === 'circle') {
                    var x = (coords[0] - point[0]) * mInPixel,
                        y = (coords[1] - point[1]) * mInPixel;
                    if (x * x + y * y > radius * radius) { continue; }
                }
            }
            if (!this.isPointInClipPolygons(mercPoint)) {
                continue;
            }

            return {
                id: idr,
                properties: item.properties,
                geometry: geom,
                bounds: item.bounds,
                nodePoint: nodePoint,
                offset: iconAnchor ? offset : null,
                parsedStyle: parsedStyle
            };
        }
        return null;
    },

    gmxEventCheck: function (ev, skipOver) {
        if (!this._map) {
            return 0;
        }
        var layer = this,
            gmx = layer._gmx,
            type = ev.type,
            lastHover = gmx.lastHover,
            chkHover = function (evType) {
                if (lastHover && type === 'mousemove') {
                    if (evType && layer.hasEventListeners(evType)) {
                        ev.gmx = lastHover;
                        layer.fire(evType, ev);
                    }
                    if (lastHover.hoverDiff) { layer.redrawItem(lastHover.id); }
                }
            };

        var zoom = this._map.getZoom();
        if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
            skipOver = true;
        }
        if (skipOver) {
            if (lastHover) { lastHover.prevId = null; }
            chkHover('mouseout');
            gmx.lastHover = null;
        } else if (
            this.hasEventListeners('mouseover') ||
            this.hasEventListeners('mouseout') ||
            this.hasEventListeners(type) ||
            (type === 'mousemove' && gmx.properties.fromType !== 'Raster')
            ) {

            var lng = ev.latlng.lng % 360,
                latlng = new L.LatLng(ev.latlng.lat, lng + (lng < -180 ? 360 : (lng > 180 ? -360 : 0))),
				crs = gmx.srs == 3857 ? L.CRS.EPSG3857 : L.Projection.Mercator,
                point = crs.project(latlng)._subtract(
                    {x: gmx.shiftXlayer || 0, y: gmx.shiftYlayer || 0}
                ),
                delta = Math.max(5, gmx.styleManager._getMaxStyleSize(zoom)) / gmx.mInPixel,
                mercatorPoint = [point.x, point.y],
				filters = gmx.dataManager.getViewFilters('screen', gmx.layerID);

            //создаём observer только для того, чтобы сделать выборку данных вокруг курсора
            var observerOptions = {
                type: 'resend',
				layerID: gmx.layerID,
				needBbox: gmx.needBbox,
                bbox: gmxAPIutils.bounds([mercatorPoint]).addBuffer(delta),
                dateInterval: gmx.layerType === 'VectorTemporal' ? [gmx.beginDate, gmx.endDate] : null,
                filters: ['clipFilter', 'userFilter_' + gmx.layerID, 'styleFilter', 'userFilter'].concat(filters),
                active: false //делаем его неактивным, так как потом будем явно выбирать данные
            };
            if (this.options.isGeneralized) {
                observerOptions.targetZoom = zoom;
            }

            gmx.dataManager.addObserver(observerOptions, 'hover');

            var geoItems = gmx.dataManager.getItems('hover');

            gmx.dataManager.removeObserver('hover');

            if (geoItems && geoItems.length) {
                if (geoItems.length > 1 && gmx.sortItems) { geoItems = this.getSortedItems(geoItems); }

                var target = this._gmxFirstObjectsByPoint(geoItems, mercatorPoint, observerOptions.bbox);
                if (target) {
                    var idr = target.id,
                        item = gmx.dataManager.getItem(idr),
                        prevId = lastHover ? lastHover.id : null,
                        changed = !lastHover || lastHover.id !== idr;
                    if (type === 'mousemove' && lastHover) {
                        if (!changed) {
                            ev.gmx = lastHover;
                            this.fire(type, ev);
                            return idr;
                        } else {
							ev.gmx = lastHover;
							this.fire('mouseout', ev);
                        }
                        chkHover(item.currentFilter !== lastHover.currentFilter ? 'mouseout' : '');
                        gmx.lastHover = null;
                    }

                    ev.gmx = L.extend(this.getHoverOption(item), {
                        targets: geoItems,
                        nodePoint: target.nodePoint,
                        prevId: prevId,
                        hoverDiff: item.hoverDiff
                    });
                    if (this.hasEventListeners(type)) { this.fire(type, ev); }
                    if (type === 'mousemove' && changed) {
                        lastHover = gmx.lastHover = ev.gmx;
                        chkHover('mouseover');
                        gmx.lastMouseover = gmx.lastHover;
                    }
                    this._map.doubleClickZoom.disable();
                    return idr;
                }
            }
        }
        if (this._map) {
            this._map.doubleClickZoom.enable();
        }
        return 0;
    },

    getHoverOption: function (item) {
        return {
            layer: this,
            target: item,
            balloonData: this._gmx.styleManager.getItemBalloon(item.id),
            properties: this.getItemProperties(item.properties),
            currentFilter: item.currentFilter || 0,
            id: item.id
        };
    }
});


(function() {
var delay = 20000,
    layers = {},
    dataManagersLinks = {},
    script = '/Layer/CheckVersion.ashx',
    intervalID = null,
    timeoutID = null,
    lastParams = {};
    // lastLayersStr = '';

var isExistsTiles = function(prop) {
    var tilesKey = prop.Temporal ? 'TemporalTiles' : 'tiles';
    return tilesKey in prop || prop.currentTiles;
};
var getParams = function(prop, dm, gmx) {
    var pt = {
        Name: prop.name,
        Version: isExistsTiles(prop) ? prop.LayerVersion : -1
    };
	if (dm && (prop.UseTiles === false || gmx.skipTiles === 'NotVisible' || gmx.needBbox)) {
		var maxDateInterval = dm.getMaxDateInterval(),
			beginDate = maxDateInterval.beginDate || gmx.beginDate,
			endDate = maxDateInterval.endDate || gmx.endDate;
        if (beginDate) { pt.dateBegin = Math.floor(beginDate.getTime() / 1000); }
        if (endDate) { pt.dateEnd = Math.floor(endDate.getTime() / 1000); }
    }
    return pt;
};
var getRequestParams = function(layer) {
    var hosts = {},
        prop, hostName, dm, gmx;
    if (layer) {
        if (layer.target instanceof L.gmx.DataManager) {
			layer = layer.target;
		}
        if (layer instanceof L.gmx.DataManager) {
			dm = layer;
			prop = dm.options;
		} else {
			prop = layer._gmx.properties;
			dm = layer._gmx.dataManager;
			gmx = layer._gmx;
		}
        hostName = prop.hostName || layer._gmx.hostName;
		hosts[hostName] = [getParams(prop, dm, gmx)];
    } else {
        var skipItems = {};
        for (var id in layers) {
            var obj = layers[id],
				isDataManager = obj instanceof L.gmx.DataManager;
            if (obj.options.chkUpdate || isDataManager) {
				dm = isDataManager ? obj : obj._gmx.dataManager;
                prop = isDataManager ? obj.options : obj._gmx.properties;
				gmx = isDataManager ? obj : obj._gmx;
                hostName = prop.hostName || obj._gmx.hostName;
                var pt = getParams(prop, dm, gmx),
                    key = pt.Name + pt.Version;
                if (!skipItems[key]) {
                    if (hosts[hostName]) { hosts[hostName].push(pt); }
                    else { hosts[hostName] = [pt]; }
                }
                skipItems[key] = true;
            }
        }
    }
    return hosts;
};

var chkVersion = function (layer, callback) {
	var map = layersVersion._map;
    var processResponse = function(res) {
        if (res && res.Status === 'ok' && res.Result) {
			var arr = res.Result,
				len = arr.length,
				count = 0,
				i, key, curLayer, id, item;

			if (layersVersion.needBbox) {
				for (i = 0; i < len; i++) {
					item = arr[i];
					id = item.name || item.properties.name;
					curLayer = null;
					if (layer && layer._gmx.properties.name === id) {
						curLayer = layer;
					} else {
						for (key in layers) {
							curLayer = layers[key];
							if (layer && layer === curLayer && 'updateVersion' in layer) { continue; }
							if (curLayer._gmx && curLayer._gmx.properties.name === id && 'updateVersion' in curLayer) {	// слои
								break;
							} else if (curLayer instanceof L.gmx.DataManager && curLayer.options.name === id) {	// источники данных
								break;
							}
						}
					}
					if (curLayer) {
						count += (curLayer.getDataManager ? curLayer.getDataManager() : curLayer).getNotLoadedVectorTiles(item);
					}
				}
				map.fire('needLoadTiles', {count: count});
				if (L.gmx.skipLoadTiles) {
					console.log('Skiped tiles: ', L.gmx.needLoadTiles);
					return;
				}
			}

            for (i = 0; i < len; i++) {
                item = arr[i];
				id = item.name || item.properties.name;

				if (layer && layer._gmx.properties.name === id && 'updateVersion' in layer) { layer.updateVersion(item); }
                for (key in layers) {
                    curLayer = layers[key];
					if (layer && layer === curLayer) { continue; }
                    if (curLayer._gmx && curLayer._gmx.properties.name === id && 'updateVersion' in curLayer) {	// слои
						curLayer.updateVersion(item);
					} else if (curLayer instanceof L.gmx.DataManager && curLayer.options.name === id) {	// источники данных
						curLayer.updateVersion(item.properties, item.tiles);
					}
                }
            }
        }
        // lastLayersStr = '';
        if (callback) { callback(res); }
    };

    if (document.body && !L.gmxUtil.isPageHidden()) {
        var hosts = getRequestParams(layer),
            chkHost = function(hostName) {
				var url = L.gmxUtil.protocol + '//' + hostName + script,
                    layersStr = JSON.stringify(hosts[hostName]);
				var params = 'WrapStyle=None&ftc=osm';
				if (layersVersion.needBbox) {
					var crs = L.Projection.Mercator;
					if (map.options.srs == 3857) {
						params += '&srs=3857';
						crs = L.CRS.EPSG3857;
					}
					var zoom = map.getZoom(),
						bbox = map.getBounds(),
						min = crs.project(bbox.getSouthWest()),
						max = crs.project(bbox.getNorthEast()),
						bboxStr = [min.x, min.y, max.x, max.y].join(',');
					params += '&zoom=' + zoom;
					params += '&bbox=[' + bboxStr + ']';
				}
				params += '&layers=' + encodeURIComponent(layersStr);

                if (layer || !lastParams[hostName] || lastParams[hostName] !== params) {
                    // lastLayersStr = layersStr;
                    if ('FormData' in window) {
                        L.gmxUtil.request({
                            url: url,
                            async: true,
                            headers: {
                                'Content-type': 'application/x-www-form-urlencoded'
                            },
                            type: 'POST',
                            params: params,
                            withCredentials: true,
                            callback: function(response) {
								lastParams[hostName] = params;
                                processResponse(JSON.parse(response));
                            },
                            onError: function(response) {
                                console.log('Error: LayerVersion ', response);
                            }
                        });
                    // } else {
                        // L.gmxUtil.sendCrossDomainPostRequest(url, {
                            // WrapStyle: 'message',
                            // layers: layersStr
                        // }, processResponse);
                    }
                    var timeStamp = Date.now();
                    for (var key in layers) {
                        var it = layers[key];
                        var options = it._gmx || it.options;
                        if (options.hostName === hostName) { options._stampVersionRequest = timeStamp; }
                    }
                }
            };
        for (var hostName in hosts) {
            chkHost(hostName);
        }
    }
};

var layersVersion = {
    needBbox: false,

    addDataManager: function(dataManager) {
        var options = dataManager.options,
			id = options.name;
        if (id in layers) {
            return;
		}
		if (options.needBbox && !layersVersion.needBbox) {
			layersVersion.needBbox = options.needBbox;
		}
		dataManager.on('chkLayerUpdate', chkVersion.bind(dataManager));
		layers[id] = dataManager;
    },

    removeDataManager: function(dataManager) {
        var id = dataManager.options.name;
        if (id in layers) {
			dataManager.off('chkLayerUpdate', chkVersion.bind(dataManager));
			delete layers[id];
		}
    },

    remove: function(layer) {
        delete layers[layer._gmx.layerID];
        var _gmx = layer._gmx,
			pOptions = layer.options.parentOptions;
		if (pOptions) {
			var pId = pOptions.name;
			if (dataManagersLinks[pId]) {
				delete dataManagersLinks[pId][_gmx.properties.name];
				if (!Object.keys(dataManagersLinks[pId]).length) {
					layersVersion.removeDataManager(_gmx.dataManager);
					delete dataManagersLinks[pId];
				}
			}
		} else {
			_gmx.dataManager.off('chkLayerUpdate', _gmx._chkVersion);
		}
    },

    add: function(layer) {
        var id = layer._gmx.layerID;
        if (id in layers) {
            return;
		}

        var _gmx = layer._gmx,
            prop = _gmx.properties;
        if ('LayerVersion' in prop) {
            layers[id] = layer;
            _gmx._chkVersion = function () {
                chkVersion(layer);
            };
            _gmx.dataManager.on('chkLayerUpdate', _gmx._chkVersion);
			var pOptions = layer.options.parentOptions;
			if (pOptions) {
				var pId = pOptions.name;
				layersVersion.addDataManager(_gmx.dataManager);
				if (!dataManagersLinks[pId]) { dataManagersLinks[pId] = {}; }
				dataManagersLinks[pId][prop.name] = layer;
			}

            if (_gmx.needBbox && !layersVersion.needBbox) {
				layersVersion.needBbox = _gmx.needBbox;
			}
			layersVersion.start();
            // if (!_gmx._stampVersionRequest || _gmx._stampVersionRequest < Date.now() - 19000 || !isExistsTiles(prop)) {
				layersVersion.now();
            // }
        }
    },

    chkVersion: chkVersion,

    now: function() {
		if (timeoutID) { clearTimeout(timeoutID); }
		timeoutID = setTimeout(chkVersion, 0);
    },

    stop: function() {
        if (intervalID) { clearInterval(intervalID); }
        intervalID = null;
    },

    start: function(msec) {
        if (msec) { delay = msec; }
        layersVersion.stop();
        intervalID = setInterval(chkVersion, delay);
    }
};

if (!L.gmx) { L.gmx = {}; }
L.gmx.layersVersion = layersVersion;

L.gmx.VectorLayer.include({
    updateVersion: function (layerDescription) {
        if (layerDescription) {
            var gmx = this._gmx;
            if (layerDescription.geometry) {
                gmx.geometry = layerDescription.geometry;
            }
            if (layerDescription.properties) {
                L.extend(gmx.properties, layerDescription.properties);
                gmx.properties.currentTiles = layerDescription.tiles;
                gmx.properties.GeoProcessing = layerDescription.properties.GeoProcessing;
                gmx.rawProperties = gmx.properties;
                this.fire('versionchange');
            }
			if (!gmx.dataSource && gmx.dataManager) {
				gmx.dataManager.updateVersion(gmx.rawProperties, layerDescription.tiles);
			}
        }
    }
});
L.Map.addInitHook(function () {
	layersVersion._map = this;
	var map = this,
		prev = {};
	this.on('moveend', function () {
		var z = map.getZoom(),
			center = map.getPixelBounds().getCenter();
		if (z !== prev.z || prev.center.distanceTo(center) > 128) {
			chkVersion();
			prev.z = z;
			prev.center = center;
		}
	});
});

})();


//Raster layer is just vector layer with the single object and special background tiles
L.gmx.RasterLayer = L.gmx.VectorLayer.extend(
{
    options: {
        isGeneralized: false,
        zIndexOffset: 0
        //clickable: false
    },
    initFromDescription: function(ph) {
        var props = ph.properties,
            styles = props.styles[0] || {MinZoom: props.MinZoom || 0, MaxZoom: props.MaxZoom || 21},
            vectorProperties = {
                type: 'Vector',
                fromType: props.type,
                identityField: 'ogc_fid',
                GeometryType: 'POLYGON',
                IsRasterCatalog: true,
				RasterSRS: Number(props.RasterSRS) || 3857,
                Copyright: props.Copyright || '',
                RCMinZoomForRasters: styles.MinZoom,
                visible: props.visible,
                styles: [{
                    DisableBalloonOnClick: true,
                    MinZoom: styles.MinZoom,
                    MaxZoom: styles.MaxZoom,
                    RenderStyle: {outline: {thickness: 0}, fill: {opacity: 100}},
                    HoverStyle: null
                }]
            },
            gmx = this._gmx,
            worldSize = gmxAPIutils.tileSizes[1];

        if (props.MaxZoom) {
            gmx.maxNativeZoom = props.MaxZoom;
        }
        if (props.sessionKey) {
            gmx.sessionKey = props.sessionKey;
        }
        if (!ph.geometry) {
            ph.geometry = {
                type: 'POLYGON',
                coordinates: [[[-worldSize, -worldSize], [-worldSize, worldSize], [worldSize, worldSize], [worldSize, -worldSize], [-worldSize, -worldSize]]]
            };
        } else if (gmx.srs == 3857 && gmx.srs != vectorProperties.RasterSRS) {
			ph.geometry = gmxAPIutils.convertGeometry(gmxAPIutils.convertGeometry(ph.geometry, true, true), false, true);
		}

		L.gmx.VectorLayer.prototype.initFromDescription.call(this, {geometry: ph.geometry, properties: vectorProperties, rawProperties: ph.properties});

        gmx.rasterBGfunc = function(x, y, z) {
			var url = L.gmxUtil.protocol + '//' + gmx.hostName + '/' +
					'TileSender.ashx?ModeKey=tile&ftc=osm' +
					'&z=' + z +
					'&x=' + x +
					'&y=' + y;
			if (gmx.srs) { url += '&srs=' + gmx.srs; }
			if (gmx.crossOrigin) { url += '&cross=' + gmx.crossOrigin; }
			url += '&LayerName=' + gmx.layerID;
			if (gmx.sessionKey) { url += '&key=' + encodeURIComponent(gmx.sessionKey); }
			return url;
		};

		gmx.dataManager._rasterVectorTile = new VectorTile({
			load: function(x, y, z, v, s, d, callback) {
					var objects = [[777, ph.geometry]],
						itemBounds = gmxAPIutils.geoItemBounds(ph.geometry),
						bounds = itemBounds.bounds;

					if (bounds.max.x > worldSize) {
						// for old layers geometry
						var ww2 = 2 * worldSize,
							id = 777,
							coords = ph.geometry.coordinates,
							bboxArr = itemBounds.boundsArr;

						objects = [];
						if (ph.geometry.type === 'POLYGON') {
							coords = [coords];
							bboxArr = [bboxArr];
						}

						for (var i = 0, len = coords.length; i < len; i++) {
							var it = coords[i],
								bbox = bboxArr[i][0],
								arr = it;
							objects.push([id++, {type: 'POLYGON', coordinates: arr}]);
							if (bbox.max.x > worldSize) {
								arr = [];
								for (var j = 0, len1 = it.length; j < len1; j++) {
									var it1 = it[j];
									for (var j1 = 0, arr1 = [], len2 = it1.length; j1 < len2; j1++) {
										var it2 = it1[j1];
										arr1.push([it2[0] - ww2, it2[1]]);
									}
									arr.push(arr1);
								}
								objects.push([id++, {type: 'POLYGON', coordinates: arr}]);
							}
						}
					}
					callback({
						bbox: [bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y],
						srs: gmx.srs,
						isGeneralized: false,
						changeState: true,
						values: objects
					});
					gmx.dataManager._updateItemsFromTile(gmx.dataManager._rasterVectorTile);
				}
			},
			{x: 0, y: 0, z: 0, v: 0, s: -2, d: -2}
		);
		gmx.dataManager.addTile(gmx.dataManager._rasterVectorTile);

        return this;
    },

    setZoomBounds: function(minZoom, maxZoom) {
        var styles = this.getStyles().slice(0);
        styles[0] = L.extend({}, styles[0]);
        styles[0].MinZoom = minZoom;
        styles[0].MaxZoom = maxZoom;
        this.setStyles(styles);
    }
});


/*
 (c) 2014, Sergey Alekseev
 Leaflet.LabelsLayer, plugin for Gemixer layers.
*/
// L.LabelsLayer = L.Class.extend({
L.LabelsLayer = (L.Layer || L.Class).extend({

    options: {
		labels: 'default',
        pane: 'overlayPane'
    },

    initialize: function (map, options) {
        L.setOptions(this, options);
        this._observers = {};
        this._styleManagers = {};
        this._labels = {};
        this._labelsIndex = {};
        var _this = this;

        this.bbox = gmxAPIutils.bounds();

        var chkData = function (data, layer) {
            if (!data.added && !data.removed) { return; }

            var opt = layer.options,
                added = map._zoom >= opt.minZoom && map._zoom <= opt.maxZoom ? data.added : [],
                layerId = '_' + layer._leaflet_id,
                gmx = layer._gmx,
                labels = {};

            for (var i = 0, len = added.length; i < len; i++) {
                var item = added[i].item,
                    isPoint = item.type === 'POINT' || item.type === 'MULTIPOINT',
                    currentStyle = item.parsedStyleKeys || item.currentStyle || {};

                if (gmx.styleHook) {
                    var styleExtend = gmx.styleHook(item, gmx.lastHover && item.id === gmx.lastHover.id);
                    if (styleExtend) {
                        currentStyle = L.extend({}, currentStyle, styleExtend);
                    } else {
                        continue;
                    }
                }
                if (item.multiFilters) {
                    for (var j = 0, len1 = item.multiFilters.length; j < len1; j++) {
                        var st = item.multiFilters[j].parsedStyle;
                        if ('labelField' in st || 'labelText' in st) {
                            currentStyle = st;
                            break;
                        }
                    }
                }
                var style = gmx.styleManager.getObjStyle(item) || {},
                    labelText = currentStyle.labelText || style.labelText,
                    labelField = currentStyle.labelField || style.labelField,
                    fieldType = gmx.tileAttributeTypes[labelField],
                    txt = String(labelText || L.gmxUtil.attrToString(fieldType, layer.getPropItem(labelField, item.properties)));

                if (style.labelTemplate) {
					var reg = /\[([^\]]*)\]/g,
						match;
					txt = style.labelTemplate;

					while ((match = reg.exec(style.labelTemplate))) {
						if (match.length === 2) {
							labelField = match[1];
							fieldType = gmx.tileAttributeTypes[labelField];
							var val = L.gmxUtil.attrToString(fieldType, layer.getPropItem(labelField, item.properties));
							txt = txt.replace(match[0], val);
						}
					}
                }
				if (txt || txt === 0) {
                    var fontSize = style.labelFontSize || currentStyle.labelFontSize || 12,
                        id = '_' + item.id,
                        changed = true,
                        width = 0,
						arrTxtWidth,
                        options = item.options,
                        labelStyle = {
                            font: fontSize + 'px "Arial"',
                            labelHaloColor: ('labelHaloColor' in currentStyle ? currentStyle.labelHaloColor : ('labelHaloColor' in style ? style.labelHaloColor : 0xffffff)),
                            labelColor: currentStyle.labelColor || style.labelColor,
                            labelAlign: currentStyle.labelAlign || style.labelAlign,
                            labelAnchor: currentStyle.labelAnchor || style.labelAnchor,
                            labelFontSize: fontSize
                        };
                    if (options) {
                        if (!('center' in options)) {
                            var center = gmxAPIutils.getItemCenter(item, gmx.dataManager.getItemMembers(item.id));
                            if (!center) { continue; }
                            options.center = center;
                        }
                        if (options.label) {
                            width = options.label.width;
                            arrTxtWidth = options.label.arrTxtWidth;
                            var pstyle = options.label.style;
                            changed = options.label.txt !== txt ||
                                pstyle.labelHaloColor !== labelStyle.labelHaloColor ||
                                pstyle.labelColor !== labelStyle.labelColor ||
                                pstyle.labelAlign !== labelStyle.labelAlign ||
                                pstyle.labelAnchor !== labelStyle.labelAnchor ||
                                pstyle.labelFontSize !== labelStyle.labelFontSize;
                        }
                    }
                    if (changed) {
						width = 0;
                        arrTxtWidth = gmxAPIutils.getLabelWidth(txt, labelStyle);
						if (arrTxtWidth) {
						    arrTxtWidth.forEach(function(it) {
								width = Math.max(width, it[1]);
							});
						}

                        if (!width) {
                            delete labels[id];
                            continue;
                        }
                        width += 4;
                        item.options.labelStyle = null;
                    }
                    options.label = {
                        isPoint: isPoint,
                        width: width,
                        sx: style.sx || 0,
                        txt: txt,
                        arrTxtWidth: arrTxtWidth,
                        style: labelStyle
                    };
                    labels[id] = item;
                }
            }
            _this._labelsIndex[layerId] = layer.options.zIndex;
            _this._labels[layerId] = labels;
        };

        var addObserver = function (layer, id) {
            var gmx = layer._gmx,
                filters = ['styleFilter', 'userFilter'],
                options = {
                    type: 'resend',
                    bbox: _this.bbox,
                    filters: filters,
                    callback: function(data) {
                        chkData(data, layer);
                        _this.redraw();
                    }
                };
            if (gmx.beginDate && gmx.endDate) {
                options.dateInterval = [gmx.beginDate, gmx.endDate];
            }
            return gmx.dataManager.addObserver(options, '_Labels_' + id);
        };
        this.add = function (layer) {
            var id = layer._leaflet_id,
                gmx = layer._gmx;

            if (!_this._observers[id] && gmx && gmx.labelsLayer && id) {
                gmx.styleManager.promise.then(function () {
                    var observer = addObserver(layer, id),
						_zoom = _this._map._zoom;
                    if (layer.options.isGeneralized) {
                        observer.targetZoom = _zoom;	//need update to current zoom
                    }
                    if (observer.dateInterval) {
                        layer.on('dateIntervalChanged', function(ev) {
							var dInterval = ev.target.getDateInterval();
							this.setDateInterval(dInterval.beginDate, dInterval.endDate);
						}, observer);
                    }
                    if (!gmx.styleManager.isVisibleAtZoom(_zoom)) {
                        observer.deactivate();
                    }
                    _this._observers[id] = observer;
                    _this._styleManagers[id] = gmx.styleManager;

                    _this._labels['_' + id] = {};
					_this._labelsIndex['_' + id] = {};

                    _this._updateBbox();
                });
            }
        };
        this.remove = function (layer) {
            var id = layer._leaflet_id;
            if (_this._observers[id]) {
                var gmx = layer._gmx,
                    dataManager = gmx.dataManager;
                dataManager.removeObserver(_this._observers[id].id);
                delete _this._observers[id];
                delete _this._styleManagers[id];
                delete _this._labels['_' + id];
                delete _this._labelsIndex['_' + id];
                _this.redraw();
            }
        };
        this._layeradd = function (ev) {
            _this.add(ev.layer);
        };
        this._layerremove = function (ev) {
            _this.remove(ev.layer);
        };
    },

    redraw: function () {
        if (!this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    _addToPane: function () {
        var pane = this._map.getPanes()[this.options.pane];
        if (pane) {
            pane.insertBefore(this._canvas, pane.firstChild);
        }
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }
		var arr = window.location.search.match('labels=([^&]+)');
		if (arr) {
			this.options.labels = arr[1];
		}

        // this._addToPane();

        map.on('moveend', this._reset, this);
        map.on({
            layeradd: this._layeradd,
            layerremove: this._layerremove
        });
        // if (map.options.zoomAnimation && L.Browser.any3d) {
            // map.on('zoomanim', this._animateZoom, this);
        // } else {
			map.on('zoomstart', function() {
				if (this._canvas.parentNode) { this._canvas.parentNode.removeChild(this._canvas); }
			}, this);
		// }

        this._reset();
    },

    onRemove: function (map) {
        if (this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }

        map.off('moveend', this._reset, this);
        map.off('layeradd', this._layeradd);
        map.off('layerremove', this._layerremove);

        // if (map.options.zoomAnimation) {
            // map.off('zoomanim', this._animateZoom, this);
		// }
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _initCanvas: function () {
        var canvas = L.DomUtil.create('canvas', 'leaflet-labels-layer leaflet-layer'),
            size = this._map.getSize();
        canvas.width  = size.x; canvas.height = size.y;
        canvas.style.pointerEvents = 'none';
        this._canvas = canvas;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
    },

    _updateBbox: function () {
        var _map = this._map,
            screenBounds = _map.getBounds(),
            southWest = screenBounds.getSouthWest(),
            northEast = screenBounds.getNorthEast(),
			crs = _map.options.srs == 3857 ? L.CRS.EPSG3857 : L.Projection.Mercator,
            m1 = crs.project(southWest),	// предполагаем что все слои в одной проекции
            m2 = crs.project(northEast),
			_zoom = _map.getZoom();

        this.mInPixel = gmxAPIutils.getPixelScale(_zoom);
        this._ctxShift = [m1.x * this.mInPixel, m2.y * this.mInPixel];
        for (var id in this._observers) {
			var observer = this._observers[id];
			if (observer.targetZoom) {
				observer.targetZoom = _zoom;
			}
            observer.setBounds({
                min: {x: southWest.lng, y: southWest.lat},
                max: {x: northEast.lng, y: northEast.lat}
            });
        }
    },

    _reset: function () {
        this._updateBbox();
        for (var id in this._observers) {
            var observer = this._observers[id];
            if (!observer.isActive() &&
                this._styleManagers[id].isVisibleAtZoom(this._map.getZoom())
            ) {
                observer.activate();
            }
            observer.fire('update');
        }
    },

    _redraw: function () {
        var out = [],
            _map = this._map,
            mapSize = _map.getSize(),
            _canvas = this._canvas,
            chkIntersects = this.options.labels,
            offset = _map.latLngToContainerPoint(_map.getBounds().getNorthWest()),
            topLeft = _map.containerPointToLayerPoint(offset);

		_canvas.width = mapSize.x; _canvas.height = mapSize.y;
        L.DomUtil.setPosition(_canvas, topLeft);

        var w2 = 2 * this.mInPixel * gmxAPIutils.worldWidthMerc,
            start = w2 * Math.floor(_map.getPixelBounds().min.x / w2),
            ctx = _canvas.getContext('2d'),
			arr = Object.keys(this._labels).sort(function(a ,b) { return this._labelsIndex[b] - this._labelsIndex[a]; }.bind(this)),
            i, len, it;

        arr.forEach(function(layerId) {
            var labels = this._labels[layerId];
            for (var id in labels) {
                it = labels[id];
                var options = it.options,
                    label = options.label,
                    style = label.style,
					labelAlign = style.labelAlign || 'center',
                    arrTxtWidth = label.arrTxtWidth,
					count = arrTxtWidth.length || 1,
                    width = label.width,
                    width2 = width / 2,
                    size = style.labelFontSize || 12,
                    size2 = size / 2,
                    center = options.center,
                    pos = [center[0] * this.mInPixel, center[1] * this.mInPixel],
                    isFiltered = false;

                if (label.isPoint) {
                    var delta = label.sx;
                    if (labelAlign === 'left') {
                        pos[0] += width2 + delta;
                    } else if (labelAlign === 'right') {
                        pos[0] -= width + delta;
                    }
                }
                pos[0] -= width2 + this._ctxShift[0];
                pos[1] = -size2 - pos[1] + this._ctxShift[1];
				size2 *= count;
                if (style.labelAnchor) {
                    pos[0] += style.labelAnchor[0];
                    pos[1] += style.labelAnchor[1];
                }

                for (var tx = pos[0] + start; tx < mapSize.x; tx += w2) {
                    var coord = [Math.floor(tx), Math.floor(pos[1])],
                        bbox = gmxAPIutils.bounds([
                            [coord[0], coord[1] - size2],
                            [coord[0] + width, coord[1] + size2]
                        ]);
					if (chkIntersects !== 'All') {
						for (i = 0, len = out.length; i < len; i++) {
							if (bbox.intersects(out[i].bbox)) {
								isFiltered = true;
								break;
							}
						}
						if (isFiltered) { continue; }
					}

                    if (!options.labelStyle) {
                        options.labelStyle = {
                            font: size + 'px "Arial"',
                            fillStyle: gmxAPIutils.dec2color(style.labelColor || 0, 1),
                            shadowBlur: 4
                        };
                        if (style.labelHaloColor !== -1) {
                            options.labelStyle.strokeStyle =
                            options.labelStyle.shadowColor =
                                gmxAPIutils.dec2color(style.labelHaloColor, 1);
                        }
                    }
                    out.push({
                        arr: it.properties,
                        bbox: bbox,
                        arrTxtWidth: arrTxtWidth,
                        width2: labelAlign === 'center' ? width2 : 0,
                        txt: label.txt,
                        style: options.labelStyle,
                        size: size,
                        coord: coord
                    });
                }
            }
		}.bind(this));

        if (out.length) {
            ctx.clearRect(0, 0, _canvas.width, _canvas.height);
            for (i = 0, len = out.length; i < len; i++) {
                it = out[i];
				it.arrTxtWidth.forEach(function(pt, nm) {
					var coord = [it.coord[0], it.coord[1] + (nm + 1) * it.size];
					gmxAPIutils.setLabel(ctx, pt[0], coord, it.style);
				});
            }
            if (!_canvas.parentNode) { this._addToPane(); }
        } else if (_canvas.parentNode) {
            _canvas.parentNode.removeChild(_canvas);
        }

        this._frame = null;
    }
	// ,

    // _animateZoom: function (e) {
        // var scale = this._map.getZoomScale(e.zoom),
            // pixelBoundsMin = this._map.getPixelBounds().min;

        // var offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
        // if (pixelBoundsMin.y < 0) {
            // offset.y += pixelBoundsMin.multiplyBy(-scale).y;
        // }

        // this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
    // }
});

L.labelsLayer = function (map, options) {
    return new L.LabelsLayer(map, options);
};

L.Map.addInitHook(function () {
	// Check to see if Labels has already been initialized.
    if (!this._labelsLayer) {
        this._labelsLayer = new L.LabelsLayer(this, this.options);
        this._labelsLayer.addTo(this);
    }
});


(function() {
var isBoundsIntersects = function (bounds, clipPolygons) {
    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var it = arr[i],
                type = it.geometry.type,
                boundsArr = it.boundsArr;
            for (var j = 0, len1 = boundsArr.length; j < len1; j++) {
                var bbox = boundsArr[j];
                if (type === 'Polygon') { bbox = [bbox]; }
                for (var j1 = 0, len2 = bbox.length; j1 < len2; j1++) {
                    if (bbox[j1].intersects(bounds)) { return true; }
                }
            }
        }
    }
    return false;
};
var isObserverIntersects = function (observer, clipPolygons) {
    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var it = arr[i],
                type = it.geometry.type,
                boundsArr = it.boundsArr;
            for (var j = 0, len1 = boundsArr.length; j < len1; j++) {
                var bbox = boundsArr[j];
                if (type === 'Polygon') { bbox = [bbox]; }
                for (var j1 = 0, len2 = bbox.length; j1 < len2; j1++) {
                    if (observer.intersects(bbox[j1])) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

var isPointInClipPolygons = function (chkPoint, clipPolygons) {
    if (!clipPolygons || Object.keys(clipPolygons).length === 0) { return true; }
    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var it = arr[i],
                type = it.geometry.type,
                boundsArr = it.boundsArr;
            for (var j = 0, len1 = boundsArr.length; j < len1; j++) {
                var bbox = boundsArr[j];
                if (type === 'Polygon') { bbox = [bbox]; }
                for (var j1 = 0, len2 = bbox.length; j1 < len2; j1++) {
                    if (bbox[j1].contains(chkPoint)) {
                        var coords = it.geometry.coordinates,
                            isIn = false;
                        if (type === 'Polygon') { coords = [coords]; }
                        for (var j2 = 0, len3 = coords.length; j2 < len3; j2++) {
                            if (gmxAPIutils.isPointInPolygonWithHoles(chkPoint, coords[j2])) {
                                isIn = true;
                                break;
                            }
                        }
                        if (isIn) { return true; }
                    }
                }
            }
        }
    }
    return false;
};

var getClipPolygonItem = function (geo) {
    var geometry = gmxAPIutils.convertGeometry(geo),
        bboxArr = gmxAPIutils.geoItemBounds(geometry);
    bboxArr.geometry = geometry;
    return bboxArr;
};

var clipTileByPolygon = function (dattr) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    var ctx = canvas.getContext('2d'),
        clipPolygons = dattr.clipPolygons;

    dattr.ctx = ctx;
    ctx.fillStyle = ctx.createPattern(dattr.tile, 'no-repeat');

    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var geo = arr[i].geometry,
                coords = geo.coordinates;
            if (geo.type === 'Polygon') { coords = [coords]; }
            for (var i1 = 0, len1 = coords.length; i1 < len1; i1++) {
                var coords1 = coords[i1];
                ctx.beginPath();
                for (var j1 = 0, len2 = coords1.length; j1 < len2; j1++) {
                    dattr.coords = coords1[j1];
                    var pixels = gmxAPIutils.getRingPixels(dattr);
                    dattr.coords = pixels.coords;
                    gmxAPIutils.polygonToCanvasFill(dattr);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
    }
    ctx = dattr.tile.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(canvas, 0, 0);
};

L.gmx.VectorLayer.include({

    isPointInClipPolygons: function (point) { // point [x, y] in Mercator
        return isPointInClipPolygons(point, this._gmx._clipPolygons);
    },

    addClipPolygon: function (polygon) { // (L.Polygon) or (L.GeoJSON with Polygons)
        var item = [],
            i, len;

        if ('coordinates' in polygon && 'type' in polygon) {
            item.push(getClipPolygonItem(polygon));
        } else if (polygon instanceof L.Polygon) {
            item.push(getClipPolygonItem(polygon.toGeoJSON().geometry));
        } else if (polygon instanceof L.GeoJSON) {
            var layers = polygon.getLayers();
            for (i = 0, len = layers.length; i < len; i++) {
                var layer = layers[i];
                if (layer instanceof L.Polygon && layer.feature) {
                    item.push(getClipPolygonItem(layer.feature.geometry));
                } else if (layer instanceof L.MultiPolygon && layer.feature) {
                    item.push(getClipPolygonItem(layer.feature.geometry));
                }
            }
        }
        if (item.length) {
            var gmx = this._gmx,
                dataManager = gmx.dataManager,
                _this = this,
                id = L.stamp(polygon);

            if (!this._gmx._clipPolygons) { this._gmx._clipPolygons = {}; }
            this._gmx._clipPolygons[id] = item;
            dataManager.setTileFilteringHook(function (tile) {
                return isBoundsIntersects(tile.bounds, _this._gmx._clipPolygons);
            });

            dataManager.addFilter('clipFilter', function (item, tile, observer) {
                return isObserverIntersects(observer, _this._gmx._clipPolygons);
            });

            dataManager.addFilter('clipPointsFilter', function (item) {
                if (item.type === 'POINT') {
                    var propArr = item.properties,
                        geom = propArr[propArr.length - 1];
                    return isPointInClipPolygons(geom.coordinates, _this._gmx._clipPolygons);
                }
                return true;
            });
            if (Object.keys(this._gmx._clipPolygons).length === 1) {
                gmx.renderHooks.unshift(function (tile, hookInfo) {
                    if (tile && Object.keys(_this._gmx._clipPolygons).length > 0) {
                        clipTileByPolygon({
                            tile: tile,
							topLeft: hookInfo.topLeft,
							tpx: hookInfo.tpx,
                            tpy: hookInfo.tpy,
                            gmx: {mInPixel: gmx.mInPixel},
                            clipPolygons: _this._gmx._clipPolygons
                        });
                    }
                });
            }
        }
        return this;
    },

    removeClipPolygon: function (polygon) {
        var id = L.stamp(polygon);
        if (this._gmx._clipPolygons) {
            delete this._gmx._clipPolygons[id];
            if (Object.keys(this._gmx._clipPolygons).length === 0) {
                this._gmx.dataManager.removeTileFilteringHook();
                this._gmx.dataManager.removeFilter('clipFilter');
            }
        }
        return this;
    }
});
})();


L.gmx.gmxImageTransform = function(img, hash) {
    var gmx = hash.gmx,
        topLeft = hash.topLeft,
		mInPixel = topLeft.mInPixel,
        gmxTilePoint = hash.gmxTilePoint,
        geoItem = hash.geoItem,
        properties = geoItem.properties,
        dataOption = geoItem.dataOption || {},
        // geom = properties[properties.length - 1],
        // coord = geom.coordinates[0],
        indexes = gmx.tileAttributeIndexes,
        quicklookPlatform = properties[indexes[gmx.quicklookPlatform]] || gmx.quicklookPlatform || '',
        points = {};

    // if (geom.type === 'MULTIPOLYGON') { coord = coord[0]; }
    if (quicklookPlatform === 'LANDSAT8') {
        points.x1 = dataOption.bounds.min.x; points.y1 = dataOption.bounds.max.y;
        points.x2 = dataOption.bounds.max.x; points.y2 = dataOption.bounds.max.y;
        points.x3 = dataOption.bounds.max.x; points.y3 = dataOption.bounds.min.y;
        points.x4 = dataOption.bounds.min.x; points.y4 = dataOption.bounds.min.y;
    } else {
        points = gmxAPIutils.getQuicklookPointsFromProperties(properties, gmx);
    }

    var x1 = mInPixel * points.x1, y1 = mInPixel * points.y1,
        x2 = mInPixel * points.x2, y2 = mInPixel * points.y2,
        x3 = mInPixel * points.x3, y3 = mInPixel * points.y3,
        x4 = mInPixel * points.x4, y4 = mInPixel * points.y4,
        boundsP = gmxAPIutils.bounds([[x1, y1], [x2, y2], [x3, y3], [x4, y4]]),
        ww = Math.round(boundsP.max.x - boundsP.min.x),
        hh = Math.round(boundsP.max.y - boundsP.min.y),
        dy = 256 - boundsP.max.y + 256 * gmxTilePoint.y,
        itbounds = geoItem.item.bounds,
        wMerc = gmxAPIutils.worldWidthMerc,
        tpx = gmxTilePoint.x;

    if (tpx < 0 && itbounds.max.x > wMerc && itbounds.min.x < -wMerc) {	// For points intersects 180 deg
		tpx += Math.round(wMerc * mInPixel / 128);
	}
	var dx = boundsP.min.x - 256 * tpx;

    x1 -= boundsP.min.x; y1 = boundsP.max.y - y1;
    x2 -= boundsP.min.x; y2 = boundsP.max.y - y2;
    x3 -= boundsP.min.x; y3 = boundsP.max.y - y3;
    x4 -= boundsP.min.x; y4 = boundsP.max.y - y4;

    var shiftPoints = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];

    if (!gmx.ProjectiveImage) {
        gmx.ProjectiveImage = (gmx.useWebGL ? L.gmx.projectiveImageWebGL() : null) || L.gmx.projectiveImage();
    }
    var pt = gmx.ProjectiveImage.getCanvas({
        imageObj: img,
        points: shiftPoints,
        wView: ww,
        hView: hh,
        deltaX: dx,
        deltaY: dy
    });
    return pt.canvas;
};


(function() {
var ProjectiveImageWebGL = L.Class.extend({
    options: {
        antialias: true,
        depth: false,
        preserveDrawingBuffer: true,
        shaderVS: 'attribute vec2 aVertCoord;\
            uniform mat4 uTransformMatrix;\
            varying vec2 vTextureCoord;\
            void main(void) {\
                vTextureCoord = aVertCoord;\
                gl_Position = uTransformMatrix * vec4(aVertCoord, 0.0, 1.0);\
            }\
        ',
        shaderFS: 'precision mediump float;\
            varying vec2 vTextureCoord;\
            uniform sampler2D uSampler;\
            void main(void) {\
                gl_FragColor = texture2D(uSampler, vTextureCoord);\
            }\
        '
    },

    setOptions: function(options) {
        L.setOptions(this, options);
    },

    initialize: function(options) {
        this.setOptions(options);

        var canvas = document.createElement('canvas'),
            glOpts = {
                antialias: this.options.antialias,
                depth: this.options.depth,
                preserveDrawingBuffer: this.options.preserveDrawingBuffer
            },
            gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
        if (!gl) { return; }
        var glResources = this._setupGlContext(gl);
        if (!glResources) { return; }

        canvas.width = canvas.height = 256;
        glResources.canvas = canvas;

        this.glResources = glResources;
        this.canvas = canvas;
        this.gl = gl;
    },

    _getShader: function (type, source, gl) {
        var shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    },

    _setupGlContext: function (gl) {
        // Store return values here
        var vertexShader = this._getShader(gl.VERTEX_SHADER, this.options.shaderVS, gl),
            fragmentShader = this._getShader(gl.FRAGMENT_SHADER, this.options.shaderFS, gl);

        if (vertexShader && fragmentShader) {
            // Compile the program
            var shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);

            if (gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                // Find and set up the uniforms and attributes
                gl.useProgram(shaderProgram);
                this.vertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
                var vertexBuffer = gl.createBuffer(),    // Create a buffer to hold the vertices
                    vertAttrib = gl.getAttribLocation(shaderProgram, 'aVertCoord');
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);

                // draw the triangles
                gl.enableVertexAttribArray(vertAttrib);
                gl.vertexAttribPointer(vertAttrib, 2, gl.FLOAT, false, 0, 0);
                return {
                    transMatUniform: gl.getUniformLocation(shaderProgram, 'uTransformMatrix'),
                    samplerUniform: gl.getUniformLocation(shaderProgram, 'uSampler'),
                    screenTexture: gl.createTexture() // Create a texture to use for the screen image
                };
            }
        }
        return null;
    },

    _bindTexture: function (gl, image, texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        // gl.NEAREST is also allowed, instead of gl.LINEAR, as neither mipmap.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // Prevents s-coordinate wrapping (repeating).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // Prevents t-coordinate wrapping (repeating).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    },

    getCanvas: function (attr) {
        var p = attr.points,
            deltaX = attr.deltaX,
            deltaY = attr.deltaY,
            dstPoints = new Float32Array([
                (p[0][0] + deltaX) / 128 - 1, 1 - (p[0][1] + deltaY) / 128,
                (p[1][0] + deltaX) / 128 - 1, 1 - (p[1][1] + deltaY) / 128,
                (p[3][0] + deltaX) / 128 - 1, 1 - (p[3][1] + deltaY) / 128,
                (p[2][0] + deltaX) / 128 - 1, 1 - (p[2][1] + deltaY) / 128
            ]);

        var v = ProjectiveImageWebGL.Utils.general2DProjection(this.vertices, dstPoints),
            gl = this.gl,
            glResources = this.glResources;

        this._bindTexture(gl, attr.imageObj, glResources.screenTexture);

        gl.viewport(0, 0, 256, 256);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);    // set background to full transparency

        gl.uniformMatrix4fv(
            glResources.transMatUniform,
            false, [
                v[0], v[3],    0, v[6],
                v[1], v[4],    0, v[7],
                   0,    0,    1,    0,
                v[2], v[5],    0,    1
            ]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glResources.screenTexture);
        gl.uniform1i(glResources.samplerUniform, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return this;
    }
});

function adj(m) { // Compute the adjugate of m
    return [
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
    ];
}

function multmm(a, b) { // multiply two matrices
    var c = Array(9);
    for (var i = 0; i !== 3; ++i) {
        for (var j = 0; j !== 3; ++j) {
            var cij = 0;
            for (var k = 0; k !== 3; ++k) {
                cij += a[3 * i + k] * b[3 * k + j];
            }
            c[3 * i + j] = cij;
        }
    }
    return c;
}

function multmv(m, v) { // multiply matrix and vector
    return [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
}

function basisToPoints(p) {
    var m = [
        p[0], p[2], p[4],
        p[1], p[3], p[5],
        1,  1,  1
    ];
    var v = multmv(adj(m), [p[6], p[7], 1]);
    return multmm(m, [
        v[0], 0, 0,
        0, v[1], 0,
        0, 0, v[2]
    ]);
}

ProjectiveImageWebGL.Utils = {
    general2DProjection: function(from, to) {
        var arr = multmm(basisToPoints(to), adj(basisToPoints(from)));
        if (arr[8]) {
            for (var i = 0; i !== 9; ++i) {
                arr[i] = arr[i] / arr[8];
            }
        }
        return arr;
    },

    getWebGlResources: function(options) {
        var obj = new ProjectiveImageWebGL(options);
        return obj.gl ? obj : null;
    }
};
L.gmx.projectiveImageWebGL = function(options) {
    var res = new ProjectiveImageWebGL(options);
    return res.gl ? res : null;
};
})();


(function() {
// ProjectiveImage - projective transform that maps [0,1]x[0,1] onto the given set of points.
var ProjectiveImage = function() {
	var cnt = 0,
        limit = 4,
        patchSize = 64,
        transform = null;

	var allocate = function (w, h) {
	  var values = [];
	  for (var i = 0; i < h; ++i) {
		values[i] = [];
		for (var j = 0; j < w; ++j) {
		  values[i][j] = 0;
		}
	  }
	  return values;
	};

	var Matrix = function (w, h, values) {
	  this.w = w;
	  this.h = h;
	  this.values = values || allocate(h);
	};

	var cloneValues = function (values) {
		var clone = [];
		for (var i = 0; i < values.length; ++i) {
			clone[i] = [].concat(values[i]);
		}
		return clone;
	};

	Matrix.prototype = {
		add : function (operand) {
			if (operand.w !== this.w || operand.h !== this.h) {
				throw new Error('Matrix add size mismatch');
			}

			var values = allocate(this.w, this.h);
			for (var y = 0; y < this.h; ++y) {
				for (var x = 0; x < this.w; ++x) {
				  values[y][x] = this.values[y][x] + operand.values[y][x];
				}
			}
			return new Matrix(this.w, this.h, values);
		},
		transformProjectiveVector : function (operand) {
			var out = [], x, y;
			for (y = 0; y < this.h; ++y) {
				out[y] = 0;
				for (x = 0; x < this.w; ++x) {
					out[y] += this.values[y][x] * operand[x];
				}
			}
			var zn = out[out.length - 1];
			if (zn) {
				var iz = 1 / (out[out.length - 1]);
				for (y = 0; y < this.h; ++y) {
					out[y] *= iz;
				}
			}
			return out;
		},
		multiply : function (operand) {
			var values, x, y;
			if (+operand !== operand) {
				// Matrix mult
				if (operand.h !== this.w) {
					throw new Error('Matrix mult size mismatch');
				}
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < operand.w; ++x) {
						var accum = 0;
						for (var s = 0; s < this.w; s++) {
							accum += this.values[y][s] * operand.values[s][x];
						}
						values[y][x] = accum;
					}
				}
				return new Matrix(operand.w, this.h, values);
			}
			else {
				// Scalar mult
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < this.w; ++x) {
						values[y][x] = this.values[y][x] * operand;
					}
				}
				return new Matrix(this.w, this.h, values);
			}
		},
		rowEchelon : function () {
			if (this.w <= this.h) {
				throw new Error('Matrix rowEchelon size mismatch');
			}

			var temp = cloneValues(this.values);

			// Do Gauss-Jordan algorithm.
			for (var yp = 0; yp < this.h; ++yp) {
				// Look up pivot value.
				var pivot = temp[yp][yp];
				while (pivot === 0) {
					// If pivot is zero, find non-zero pivot below.
					for (var ys = yp + 1; ys < this.h; ++ys) {
						if (temp[ys][yp] !== 0) {
							// Swap rows.
							var tmpRow = temp[ys];
							temp[ys] = temp[yp];
							temp[yp] = tmpRow;
							break;
						}
					}
					if (ys === this.h) {
						// No suitable pivot found. Abort.
						return new Matrix(this.w, this.h, temp);
					}
					else {
						pivot = temp[yp][yp];
					}
				}
				// Normalize this row.
				var scale = 1 / pivot;
				for (var x = yp; x < this.w; ++x) {
					temp[yp][x] *= scale;
				}
				// Subtract this row from all other rows (scaled).
				for (var y = 0; y < this.h; ++y) {
					if (y === yp) { continue; }
					var factor = temp[y][yp];
					temp[y][yp] = 0;
					for (x = yp + 1; x < this.w; ++x) {
						temp[y][x] -= factor * temp[yp][x];
					}
				}
			}

			return new Matrix(this.w, this.h, temp);
		},
		invert : function () {
			var x, y;

			if (this.w !== this.h) {
				throw new Error('Matrix invert size mismatch');
			}

			var temp = allocate(this.w * 2, this.h);

			// Initialize augmented matrix
			for (y = 0; y < this.h; ++y) {
				for (x = 0; x < this.w; ++x) {
					temp[y][x] = this.values[y][x];
					temp[y][x + this.w] = (x === y) ? 1 : 0;
				}
			}

			temp = new Matrix(this.w * 2, this.h, temp);
			temp = temp.rowEchelon();

			// Extract right block matrix.
			var values = allocate(this.w, this.h);
			for (y = 0; y < this.w; ++y) {
				// @todo check if "x < this.w;" is mistake
				for (x = 0; x < this.w; ++x) {
					values[y][x] = temp.values[y][x + this.w];
				}
			}
			return new Matrix(this.w, this.h, values);
		}
	};

	var getProjectiveTransform = function (points) {
	  var eqMatrix = new Matrix(9, 8, [
		[1, 1, 1,   0, 0, 0, -points[2][0], -points[2][0], -points[2][0]],
		[0, 1, 1,   0, 0, 0,  0, -points[3][0], -points[3][0]],
		[1, 0, 1,   0, 0, 0, -points[1][0], 0, -points[1][0]],
		[0, 0, 1,   0, 0, 0,  0, 0, -points[0][0]],

		[0, 0, 0,  -1, -1, -1,  points[2][1], points[2][1], points[2][1]],
		[0, 0, 0,   0, -1, -1,  0, points[3][1], points[3][1]],
		[0, 0, 0,  -1,  0, -1,  points[1][1], 0, points[1][1]],
		[0, 0, 0,   0,  0, -1,  0, 0, points[0][1]]

	  ]);

	  var kernel = eqMatrix.rowEchelon().values;
	  var transform = new Matrix(3, 3, [
		[-kernel[0][8], -kernel[1][8], -kernel[2][8]],
		[-kernel[3][8], -kernel[4][8], -kernel[5][8]],
		[-kernel[6][8], -kernel[7][8],             1]
	  ]);
	  return transform;
	};

	var divide = function (u1, v1, u4, v4, p1, p2, p3, p4, limit, attr) {
		if (limit) {
			// Measure patch non-affinity.
			var d1 = [p2[0] + p3[0] - 2 * p1[0], p2[1] + p3[1] - 2 * p1[1]];
			var d2 = [p2[0] + p3[0] - 2 * p4[0], p2[1] + p3[1] - 2 * p4[1]];
			var d3 = [d1[0] + d2[0], d1[1] + d2[1]];
			var r = Math.abs((d3[0] * d3[0] + d3[1] * d3[1]) / (d1[0] * d2[0] + d1[1] * d2[1]));

			// Measure patch area.
			d1 = [p2[0] - p1[0] + p4[0] - p3[0], p2[1] - p1[1] + p4[1] - p3[1]];
			d2 = [p3[0] - p1[0] + p4[0] - p2[0], p3[1] - p1[1] + p4[1] - p2[1]];
			var area = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);

			// Check area > patchSize pixels (note factor 4 due to not averaging d1 and d2)
			// The non-affinity measure is used as a correction factor.
			if ((u1 === 0 && u4 === 1) || ((.25 + r * 5) * area > (patchSize * patchSize))) {
				// Calculate subdivision points (middle, top, bottom, left, right).
				var umid = (u1 + u4) / 2;
				var vmid = (v1 + v4) / 2;
				var pmid = transform.transformProjectiveVector([umid, vmid, 1]);
				var pt   = transform.transformProjectiveVector([umid, v1, 1]);
				var pb   = transform.transformProjectiveVector([umid, v4, 1]);
				var pl   = transform.transformProjectiveVector([u1, vmid, 1]);
				var pr   = transform.transformProjectiveVector([u4, vmid, 1]);

				// Subdivide.
				limit--;
				divide.call(this, u1,   v1, umid, vmid,   p1,   pt,   pl, pmid, limit, attr);
				divide.call(this, umid,   v1,   u4, vmid,   pt,   p2, pmid,   pr, limit, attr);
				divide.call(this, u1,  vmid, umid,   v4,   pl, pmid,   p3,   pb, limit, attr);
				divide.call(this, umid, vmid,   u4,   v4, pmid,   pr,   pb,   p4, limit, attr);
				return;
			}
		}

		var ctx = attr.ctx;

		// Get patch edge vectors.
		var d12 = [p2[0] - p1[0], p2[1] - p1[1]];
		var d24 = [p4[0] - p2[0], p4[1] - p2[1]];
		var d43 = [p3[0] - p4[0], p3[1] - p4[1]];
		var d31 = [p1[0] - p3[0], p1[1] - p3[1]];

		// Find the corner that encloses the most area
		var a1 = Math.abs(d12[0] * d31[1] - d12[1] * d31[0]);
		var a2 = Math.abs(d24[0] * d12[1] - d24[1] * d12[0]);
		var a4 = Math.abs(d43[0] * d24[1] - d43[1] * d24[0]);
		var a3 = Math.abs(d31[0] * d43[1] - d31[1] * d43[0]);
		var amax = Math.max(Math.max(a1, a2), Math.max(a3, a4));
		var dx = 0, dy = 0, padx = 0, pady = 0;

		// Align the transform along this corner.
		// Calculate 1.05 pixel padding on vector basis.
		if (amax === a1) {
				ctx.setTransform(d12[0], d12[1], -d31[0], -d31[1], p1[0] + attr.deltaX, p1[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]); }
		} else if (amax === a2) {
				ctx.setTransform(d12[0], d12[1],  d24[0],  d24[1], p2[0] + attr.deltaX, p2[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]); }
				dx = -1;
		} else if (amax === a4) {
				ctx.setTransform(-d43[0], -d43[1], d24[0], d24[1], p4[0] + attr.deltaX, p4[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]); }
				dx = -1;
				dy = -1;
		} else if (amax === a3) {
				ctx.setTransform(-d43[0], -d43[1], -d31[0], -d31[1], p3[0] + attr.deltaX, p3[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]); }
				dy = -1;
		}

		// Calculate image padding to match.
		var du = (u4 - u1);
		var dv = (v4 - v1);
		padx++;
		pady++;

        var iw = attr.imageObj.width,
            ih = attr.imageObj.height,
            sx = Math.floor(u1 * iw),
            sy = Math.floor(v1 * ih),
            sw = Math.floor(Math.min(padx * du, 1) * iw),
            sh = Math.floor(Math.min(pady * dv, 1) * ih);

		cnt++;
        ctx.drawImage(
            attr.imageObj,
            sx, sy,
            sw, sh,
            dx, dy,
            padx, pady
        );
	};

	this.getCanvas = function (attr) {
		cnt = 0;
		transform = getProjectiveTransform(attr.points);
		// Begin subdivision process.

		var ptl = transform.transformProjectiveVector([0, 0, 1]),
            ptr = transform.transformProjectiveVector([1, 0, 1]),
            pbl = transform.transformProjectiveVector([0, 1, 1]),
            pbr = transform.transformProjectiveVector([1, 1, 1]);

		var canvas = document.createElement('canvas');
		canvas.width = canvas.height = 256;
		attr.canvas = canvas;
		attr.ctx = canvas.getContext('2d');

		var	boundsP = gmxAPIutils.bounds([ptl, ptr, pbr, pbl]),
            maxSize = Math.max(boundsP.max.x - boundsP.min.x, boundsP.max.y - boundsP.min.y);

		limit = 'limit' in attr ? attr.limit : (maxSize < 200 ? 1 : 4);
		patchSize = 'patchSize' in attr ? attr.patchSize : maxSize / 8;

		try {
			divide(0, 0, 1, 1, ptl, ptr, pbl, pbr, limit, attr);
		} catch (e) {
			console.log('Error: ProjectiveImage event:', e);
			canvas = null;
		}
		return {
			canvas: canvas,
			ptl: ptl,
			ptr: ptr,
			pbl: pbl,
			pbr: pbr,
			cnt: cnt
		};
	};
};
L.gmx.projectiveImage = function() {
    return new ProjectiveImage();
};
})();


// https://github.com/bbecquet/Leaflet.PolylineDecorator/blob/master/src/L.RotatedMarker.js

L.RotatedMarker = L.Marker.extend({
    options: {
        angle: 0
    },

    statics: {
        TRANSFORM_ORIGIN: L.DomUtil.testProp(
            ['transformOrigin', 'WebkitTransformOrigin', 'OTransformOrigin', 'MozTransformOrigin', 'msTransformOrigin'])
    },

    _initIcon: function() {
        L.Marker.prototype._initIcon.call(this);

        this._icon.style[L.RotatedMarker.TRANSFORM_ORIGIN] = this._getTransformOrigin();
    },

    _getTransformOrigin: function() {
        var iconAnchor = this.options.icon.options.iconAnchor;

        if (!iconAnchor) {
            return '50% 50%';
        }

        return iconAnchor[0] + 'px ' + iconAnchor[1] + 'px';
    },

    _setPos: function(pos) {
        L.Marker.prototype._setPos.call(this, pos);

        if (L.DomUtil.TRANSFORM) {
            // use the CSS transform rule if available
            this._icon.style[L.DomUtil.TRANSFORM] += ' rotate(' + this.options.angle + 'deg)';
        } else if (L.Browser.ie) {
            // fallback for IE6, IE7, IE8
            var rad = this.options.angle * (Math.PI / 180),
                costheta = Math.cos(rad),
                sintheta = Math.sin(rad);
            this._icon.style.filter += ' progid:DXImageTransform.Microsoft.Matrix(sizingMethod=\'auto expand\', M11=' +
                costheta + ', M12=' + (-sintheta) + ', M21=' + sintheta + ', M22=' + costheta + ')';
        }
    },

    setAngle: function(ang) {
        this.options.angle = ang;
    }
});

L.rotatedMarker = function(pos, options) {
    return new L.RotatedMarker(pos, options);
};


L.gmx.ExternalLayer = L.Class.extend({
    createExternalLayer: function () {          // extend: must return <ILayer> or null = this.externalLayer
        return null;
    },

    isExternalVisible: function (/*zoom*/) {    // extend: return true view this.externalLayer, return false view this.parentLayer
        return true;
    },

    updateData: function (/*data*/) {           // extend: for data update in this.externalLayer
    },

    setDateInterval: function () {
        if (this._observer) {
            var gmx = this.parentLayer._gmx;
            this._observer.setDateInterval(gmx.beginDate, gmx.endDate);
        }
    },

    options: {
        useDataManager: true,
        observerOptions: {
			delta: 0,
            filters: ['clipFilter', 'userFilter', 'clipPointsFilter']
        }
    },

    initialize: function (options, layer) {
        L.setOptions(this, options);
        this.parentLayer = layer;

        layer
            .on('add', this._addEvent, this)
            .on('dateIntervalChanged', this.setDateInterval, this);

        if (this.options.useDataManager) {
            this._addObserver(this.options.observerOptions);
        }

        this.externalLayer = this.createExternalLayer();

        if (layer._map) {
            this._addEvent({target:{_map: layer._map}});
            this._updateBbox();
        }
    },

    _addObserver: function (opt) {
        this._items = {};
        this._observer = this.parentLayer.addObserver(
            L.extend({
                bbox: gmxAPIutils.bounds([[Number.MAX_VALUE, Number.MAX_VALUE]]),
                callback: L.bind(this.updateData, this)
            }, opt)
        ).deactivate();
    },

    unbindLayer: function () {
        this.parentLayer
            .off('add', this._addEvent, this)
            .off('dateIntervalChanged', this.setDateInterval, this);

        if (this._observer) { delete this.parentLayer.repaintObservers[this._observer.id]; }
        var map = this._map || this.parentLayer._map;
        this._onRemove(!map);
        this._removeMapHandlers();
    },

    _addMapHandlers: function (map) {
        if (map) {
			this._map = map;
			this._map.on({
				moveend: this._updateBbox,
				zoomend: this._chkZoom,
				layeradd: this._layeradd,
				layerremove: this._layerremove
			}, this);
		}
    },

    _removeMapHandlers: function () {
        if (this._map) {
            this._map.off({
                moveend: this._updateBbox,
                zoomend: this._chkZoom,
                layeradd: this._layeradd,
                layerremove: this._layerremove
            }, this);
        }
        this._map = null;
    },

    _addEvent: function (ev) {
		this._addMapHandlers(ev.target._map);
        this._updateBbox();
        this._chkZoom();
    },

    _isParentLayer: function (ev) {
        var layer = ev.layer;
        return layer._gmx && layer._gmx.layerID === this.parentLayer.options.layerID;
    },

    _layeradd: function (ev) {
        if (this._isParentLayer(ev)) {
            this._chkZoom();
        }
    },

    _layerremove: function (ev) {
        if (this._isParentLayer(ev)) {
            this._onRemove(true);
            this._removeMapHandlers();
        }
    },

    _onRemove: function (fromMapFlag) {    // remove external layer from parent layer
        if (this._observer) {
            this._observer.deactivate();
        }
        var map = this._map;
        if (map) {
            if (map.hasLayer(this.externalLayer)) {
                this._chkZoom();
                map.removeLayer(this.externalLayer);
            }
            if (!fromMapFlag) {
                this.parentLayer.onAdd(map);
            }
        }
    },

    _chkZoom: function () {
        if (!this._map) { return; }

        var layer = this.parentLayer,
            observer = this._observer,
            map = this._map,
            isExtLayerOnMap = map.hasLayer(this.externalLayer);

        if (layer.setCurrentZoom) { layer.setCurrentZoom(map); }
        if (!this.isExternalVisible(map.getZoom())) {
            if (observer) { observer.deactivate(); }
            if (!layer._map) {
                if (isExtLayerOnMap) {
                    map.removeLayer(this.externalLayer);
                }
                layer.onAdd(map);
            }
            layer.enablePopup();
        } else if (layer._map) {
            layer.onRemove(map);
            if (!isExtLayerOnMap) {
                map.addLayer(this.externalLayer);
            }
            this.setDateInterval();
            if (observer) {
                layer.getIcons(function () {
                    observer.activate();
                }.bind(this));
            }
            layer.disablePopup();
        }
    },


    _updateBbox: function () {
        if (!this._map || !this._observer) { return; }

        var map = this._map,
			screenBounds = map.getBounds(),
            p1 = screenBounds.getNorthWest(),
            p2 = screenBounds.getSouthEast(),
            bbox = L.gmxUtil.bounds([[p1.lng, p1.lat], [p2.lng, p2.lat]]),
			delta = this.options.observerOptions.delta,
			buffer = delta ? delta * L.gmxUtil.tileSizes[map.getZoom()] / 256 : 0;
        this._observer.setBounds(bbox, buffer);
    }
});


(function() {
    'use strict';
    var BindWMS = L.gmx.ExternalLayer.extend({
        options: {
            minZoom: 1,
            maxZoom: 6,
            useDataManager: false,
            format: 'png',
            transparent: true
        },

        createExternalLayer: function () {
            var poptions = this.parentLayer.options,
                opt = {
                    map: poptions.mapID,
                    layers: poptions.layerID,
                    format: this.options.format,
                    transparent: this.options.transparent
                },
                rawProperties = this.parentLayer.getGmxProperties();

            if (rawProperties && rawProperties.Temporal) { this._extendOptionsByDateInterval(opt); }
            if (this.options.apikey) { opt.apikey = this.options.apikey; }
            return L.tileLayer.wms(L.gmxUtil.protocol + '//' + poptions.hostName + '/TileService.ashx', opt);
        },

        _extendOptionsByDateInterval: function (options) {
            var dateInterval = this.parentLayer.getDateInterval(),
                beginDate = dateInterval.beginDate,
                endDate = dateInterval.endDate;
            L.extend(options, {
                StartDate: beginDate && beginDate.toLocaleDateString(),
                EndDate: endDate && endDate.toLocaleDateString()
            });
        },

        setDateInterval: function () {
            this._extendOptionsByDateInterval(this.externalLayer.wmsParams);
            this.externalLayer.redraw();
        },

        isExternalVisible: function (zoom) {
            return !(zoom < this.options.minZoom || zoom > this.options.maxZoom);
        }
    });

    L.gmx.VectorLayer.include({
        bindWMS: function (options) {
            if (this._layerWMS) {
                this._layerWMS.unbindLayer();
            }
            this._layerWMS = new BindWMS(options, this);
            this.isExternalVisible = this._layerWMS.isExternalVisible;
            return this;
        },

        unbindWMS: function () {
            if (this._layerWMS) {
                this._layerWMS.unbindLayer();
                this._layerWMS = null;
                this.isExternalVisible = null;
                this.enablePopup();
            }
            return this;
        }
    });
})();


(function() {
    'use strict';
    var GmxHeatMap = L.gmx.ExternalLayer.extend({
        options: {
            minHeatMapZoom: 1,
            maxHeatMapZoom: 6,
            intensityField: '',
            intensityScale: 1,
            observerOptions: {
                type: 'resend'
            }
        },

        createExternalLayer: function () {
            return L.heatLayer([], L.extend({
                 // minOpacity: 0.05,
                 // maxZoom: 18,
                 // radius: 25,
                 // blur: 15,
                 // max: 1.0
            }, this.options));
        },

        isExternalVisible: function (zoom) {
            return !(zoom < this.options.minHeatMapZoom || zoom > this.options.maxHeatMapZoom);
        },

        updateData: function (data) {
            if (data.added) {
                var latlngs = [],
                    indexes = this.parentLayer.getTileAttributeIndexes(),
                    altIndex = null,
                    intensityField = this.options.intensityField || '',
                    intensityScale = this.options.intensityScale || 1;

                if (intensityField && intensityField in indexes) {
                    altIndex = indexes[intensityField];
                }
                for (var i = 0, len = data.added.length; i < len; i++) {
                    var it = data.added[i].properties,
                        alt = altIndex !== null ? it[altIndex] : 1,
                        geo = it[it.length - 1],
                        coord = geo.coordinates,
                        point = L.Projection.Mercator.unproject({x: coord[0], y: coord[1]});

                    latlngs.push([point.lat, point.lng, typeof intensityScale === 'function' ? intensityScale(alt) : intensityScale * alt]);
                }
                this.externalLayer.setLatLngs(latlngs);
            }
        }
    });


    L.gmx.VectorLayer.include({
        bindHeatMap: function (options) {
            if (L.heatLayer) {
                if (this._heatmap) {
                    this._heatmap.unbindLayer();
                }
                this._heatmap = new GmxHeatMap(options, this);
            }
            return this;
        },

        unbindHeatMap: function () {
            if (L.heatLayer) {
                if (this._heatmap) {
                    this._heatmap.unbindLayer();
                    this._heatmap = null;
                    this.enablePopup();
                }
            }
            return this;
        }
    });
})();


(function() {
    'use strict';
    var _DEFAULTS = {
        radiusFunc: function (count) {
            var r = Math.floor(count / 15);
            if (r > 40) {
                r = 40;
            } else if (r < 20) {
                r = 20;
            }
            return r;
        },
        text: {
            stroke: 'black',
            'stroke-width': 1,
            'text-anchor': 'middle',
            fill: 'white'
        }
    };
    var GmxMarkerCluster = L.gmx.ExternalLayer.extend({
        options: {
            observerOptions: {
				delta: 256,
                filters: ['clipFilter', 'styleFilter', 'userFilter', 'clipPointsFilter']
            },
            spiderfyOnMaxZoom: true,
            minZoom: 1,
            maxZoom: 6
        },

        createExternalLayer: function () {
            var mOptions = L.extend({
                showCoverageOnHover: false,
                disableClusteringAtZoom: 1 + Number(this.options.maxZoom)
            }, this.options);

            if ('clusterIconOptions' in this.options) {
                var opt = this.options.clusterIconOptions;
                if ('radialGradient' in opt) {
                    var radialGradient = opt.radialGradient,
                        text = opt.text || _DEFAULTS.text;
                    mOptions.iconCreateFunction = function (cluster) {
                        var childCount = cluster.getChildCount();

                        text.count = childCount;
                        return  L.gmxUtil.getSVGIcon({
                            type: 'circle',
                            iconSize: 2 * (radialGradient.radiusFunc || _DEFAULTS.radiusFunc)(childCount),
                            text: text,
                            fillRadialGradient: radialGradient
                        });
                    };
                }
            }

            if (this.options.clusterclick) {
                mOptions.clusterclick = this.options.clusterclick;
                if (mOptions.clusterclick === true) { mOptions.zoomToBoundsOnClick = false; }
            }

            this._popup = new L.Popup({maxWidth: 10000, className: 'gmxPopup'});
            var markers = new L.MarkerClusterGroup(mOptions);

            // текущий развёрнутый кластер
            var currentSpiderfiedCluster = null;

            markers
                .on('click', function (ev) {
                    var propsArr = ev.layer.options.properties,
                        properties = this.parentLayer.getItemProperties(propsArr),
                        geometry = [propsArr[propsArr.length - 1]],
                        id = propsArr[0];

                    if (currentSpiderfiedCluster && !(currentSpiderfiedCluster.getAllChildMarkers().indexOf(ev.layer) + 1)) {
                        currentSpiderfiedCluster.unspiderfy();
                        markers.once('unspiderfied', function () {
                            this._openPopup(propsArr, ev.latlng);
                        }, this);
                    } else {
                        this._openPopup(propsArr, ev.latlng);
                    }

                    this.parentLayer.fire('click', L.extend(ev, {
                        eventFrom: 'markerClusters',
                        originalEventType: 'click',
                        gmx: {
                            id: id,
                            layer: this.parentLayer,
                            properties: properties,
                            target: {
                                id: id,
                                properties: propsArr,
                                geometry: geometry
                            }
                        }
                    }));
                }, this)
                .on('animationend', function () {
                    if (this._popup && this._popup._map) {
                        this._popup._map.removeLayer(this._popup);
                    }
                }, this)
                .on('clusterclick', function (ev) {
                    this.parentLayer.fire('clusterclick', L.extend(ev, {
                        eventFrom: 'markerClusters',
                        originalEventType: 'clusterclick'
                    }));
                }, this)
                .on('spiderfied', function (ev) {
                    currentSpiderfiedCluster = ev.cluster;
                }, this)
                .on('unspiderfied', function () {
                    currentSpiderfiedCluster = null;
                }, this);

            if (mOptions.clusterclick) {
                markers.on('clusterclick', mOptions.clusterclick instanceof Function ? mOptions.clusterclick : function (a) {
                    a.layer.spiderfy();
                });
            }

            return markers;
        },

        isExternalVisible: function (zoom) {
            return !(zoom < this.options.minZoom || zoom > this.options.maxZoom);
        },

        updateData: function (data) {
            var arr = [],
                i, len, vectorTileItem, id, marker;
            if (data.removed) {
                for (i = 0, len = data.removed.length; i < len; i++) {
                    vectorTileItem = data.removed[i];
                    id = vectorTileItem.id;
                    marker = this._items[id];
                    if (marker) {
                        arr.push(marker);
                    }
                    delete this._items[id];
                }
                this.externalLayer.removeLayers(arr);
                arr = [];
            }
            if (data.added) {
				var tilesCRS = this.parentLayer.options.tilesCRS || L.Projection.Mercator;
                for (i = 0, len = data.added.length; i < len; i++) {
                    vectorTileItem = data.added[i];
                    id = vectorTileItem.id;
                    marker = this._items[id];
                    var item = vectorTileItem.properties;
                    if (marker && item.processing) {
                        this.externalLayer.removeLayer(marker);
                        marker = null;
                    }
                    if (!marker) {
                        if (!vectorTileItem.item.parsedStyleKeys) {
                            vectorTileItem.item.parsedStyleKeys = this.parentLayer.getItemStyle(id);
                        }
                        var geo = item[item.length - 1],
                            parsedStyle = vectorTileItem.item.parsedStyleKeys,
                            p = geo.coordinates,
                            latlng = tilesCRS.unproject({x: p[0], y: p[1]}),
                            opt = {
                                properties: vectorTileItem.properties,
                                mPoint: p
                            };

                        if (this.options.notClusteredIcon) {
                            var icon = this.options.notClusteredIcon;
                            if (icon instanceof L.Icon) {
                                opt.icon = icon;
                            } else {
                                opt.icon = L.icon(icon);
                            }
                        } else if (parsedStyle) {
                            if (parsedStyle.iconUrl) {
                                var iconAnchor = parsedStyle.iconAnchor;
                                if (!iconAnchor) {
                                    var style = this.parentLayer.getItemStyle(id);
                                    iconAnchor = style.image ? [style.sx / 2, style.sy / 2] : [8, 10];
                                }
                                opt.icon = L.icon({
                                    iconAnchor: iconAnchor,
                                    iconUrl: parsedStyle.iconUrl
                                });
                            } else {
                                opt.icon = L.gmxUtil.getSVGIcon(parsedStyle);
                            }
                        }
                        if (parsedStyle.rotate) {
                            marker = L.rotatedMarker(latlng, L.extend(opt, {
                                angle: parsedStyle.rotate
                            }));
                        } else {
                            marker = L.marker(latlng, L.extend(opt, {
                                angle: parsedStyle.rotate
                            }));
                        }
                        this._items[id] = marker;
                    }
                    arr.push(marker);
                }
                this.externalLayer.addLayers(arr);
            }
        },

        _openPopup: function (propsArr, latlng) {
            var gmx = this.parentLayer._gmx,
                id = propsArr[0],
                balloonData = gmx.styleManager.getItemBalloon(id),
                properties = this.parentLayer.getItemProperties(propsArr),
                geometry = [propsArr[propsArr.length - 1]];

            if (balloonData && !balloonData.DisableBalloonOnClick) {
                var style = this.parentLayer.getItemStyle(id);
                if (style && style.iconAnchor) {
                    var protoOffset = L.Popup.prototype.options.offset;
                    this._popup.options.offset = [-protoOffset[0] - style.iconAnchor[0] + style.sx / 2,
                        protoOffset[1] - style.iconAnchor[1] + style.sy / 2
                    ];
                }
                this._popup
                    .setLatLng(latlng)
                    .setContent(L.gmxUtil.parseBalloonTemplate(balloonData.templateBalloon, {
                        properties: properties,
                        tileAttributeTypes: gmx.tileAttributeTypes,
                        unitOptions: this._map.options || {},
                        geometries: geometry
                    }))
                    .openOn(this._map);
            }
        }
    });

    L.gmx.VectorLayer.include({
        bindClusters: function (options) {
            if (L.MarkerClusterGroup) {
                if (this._clusters) {
                    this._clusters.unbindLayer();
                }
                this._clusters = new GmxMarkerCluster(options, this);
            }
            return this;
        },

        unbindClusters: function () {
            if (L.MarkerClusterGroup) {
                if (this._clusters) {
                    this._clusters.unbindLayer();
                    this._clusters = null;
                    this.enablePopup();
                }
            }
            return this;
        }
    });
})();


L.gmx = L.gmx || {};

var DEFAULT_HOSTNAME = 'maps.kosmosnimki.ru';
var DEFAULT_VECTOR_LAYER_ZINDEXOFFSET = 2000000;

//Build in layer classes
L.gmx._layerClasses = {
    'Raster': L.gmx.RasterLayer,
    'Vector': L.gmx.VectorLayer,
    'VectorView': L.gmx.DummyLayer
};

L.gmx._loadingLayerClasses = {};

L.gmx.addLayerClass = function(type, layerClass) {
    L.gmx._layerClasses[type] = layerClass;
};

L.gmx._layerClassLoaders = [];

L.gmx.addLayerClassLoader = function(layerClassLoader) {
    L.gmx._layerClassLoaders.push(layerClassLoader);

    //delete all loading promises to ensure that new loader will be invoked
    L.gmx._loadingLayerClasses = {};
};

L.gmx._loadLayerClass = function(type) {
    if (!L.gmx._loadingLayerClasses[type]) {
		// var promise = new Promise(function(resolve, reject) {
		// }).

		var promise = new L.gmx.Deferred();
        promise.resolve();

        L.gmx._layerClassLoaders.forEach(function(loader) {
            promise = promise.then(function(layerClass) {
                if (layerClass) {
                    L.gmx._layerClasses[type] = layerClass;
                    return layerClass;
                }

                return loader(type);
            },
            function(){
                //just skip loader errors
            });
        });

        promise = promise.then(function(layerClass) {
            if (layerClass) {
                L.gmx._layerClasses[type] = layerClass;
                return layerClass;
            }
        }, function(){
            //just skip loader errors
        });

        L.gmx._loadingLayerClasses[type] = promise;
    }

    return L.gmx._loadingLayerClasses[type];
};

L.gmx.loadLayer = function(mapID, layerID, options) {
    return new Promise(function(resolve, reject) {
        var layerParams = {
            mapID: mapID,
            layerID: layerID
        };

		options = options || {};
		if (!options.skipTiles) { options.skipTiles = 'All'; }

		for (var p in options) {
			layerParams[p] = options[p];
		}

		var hostName = gmxAPIutils.normalizeHostname(options.hostName || DEFAULT_HOSTNAME);
		layerParams.hostName = hostName;

		gmxMapManager.loadMapProperties({
				srs: options.srs,
				hostName: hostName,
				apiKey: options.apiKey,
				mapName: mapID,
				skipTiles: options.skipTiles
			}).then(function() {
				var layerInfo = gmxMapManager.findLayerInfo(hostName, mapID, layerID);

				if (!layerInfo) {
					reject('There is no layer ' + layerID + ' in map ' + mapID);
					return;
				}

				//to know from what host the layer was loaded
				layerInfo.properties.hostName = hostName;

				var type = layerInfo.properties.ContentID || layerInfo.properties.type;

				var doCreateLayer = function() {
					var layer = L.gmx.createLayer(layerInfo, layerParams);
					if (layer) {
						resolve(layer);
					} else {
						reject('Unknown type of layer ' + layerID);
					}
				};

				if (type in L.gmx._layerClasses) {
					doCreateLayer();
				} else {
					L.gmx._loadLayerClass(type).then(doCreateLayer);
				}
			},
			function(response) {
				reject('Can\'t load layer ' + layerID + ' from map ' + mapID + ': ' + response.error);
			}
		);
	});
};

L.gmx.loadLayers = function(layers, globalOptions) {
	return new Promise(function(resolve) {
		Promise.all(layers.map(function(layerInfo) {
			var options = L.extend({}, globalOptions, layerInfo.options);
			return L.gmx.loadLayer(layerInfo.mapID, layerInfo.layerID, options);
		}))
		.then(function(res) {
			resolve(res);
		})
	});
};

L.gmx.loadMap = function(mapID, options) {
	if (location.search.indexOf('debug=1') !== -1) console.warn('L.gmx.loadMap:', mapID, options);
    options = L.extend({}, options);
    options.hostName = gmxAPIutils.normalizeHostname(options.hostName || DEFAULT_HOSTNAME);
    options.mapName = mapID;

	if (!options.skipTiles) { options.skipTiles = 'All'; }
	if (!options.srs) { options.srs = 3857; }
	if (!options.ftc) { options.ftc = 'osm'; }

    return new Promise(function(resolve, reject) {
		gmxMapManager.loadMapProperties(options).then(function(mapInfo) {
			var mapHash = L.gmx._maps[options.hostName][mapID];
			if (mapHash.loaded) {
				resolve(mapHash.loaded);

			} else {
				var loadedMap = new L.gmx.gmxMap(mapInfo, options);
				mapHash.loaded = loadedMap;

				loadedMap.layersCreated.then(function() {
					if (options.leafletMap || options.setZIndex) {
						var curZIndex = 0,
							layer, rawProperties;

						for (var l = loadedMap.layers.length - 1; l >= 0; l--) {
							layer = loadedMap.layers[l];
							rawProperties = layer.getGmxProperties();
							if (mapInfo.properties.LayerOrder === 'VectorOnTop' && layer.setZIndexOffset && rawProperties.type !== 'Raster') {
								layer.setZIndexOffset(DEFAULT_VECTOR_LAYER_ZINDEXOFFSET);
							}
							if (options.setZIndex && layer.setZIndex) {
								layer.setZIndex(++curZIndex);
							}

							if (options.leafletMap && rawProperties.visible) {
								layer.addTo(options.leafletMap);
							}
						}
					}
					resolve(loadedMap);
				});
			}
		},
		function(response) {
			var errorMessage = (response && response.ErrorInfo && response.ErrorInfo.ErrorMessage) || 'Server error';
			reject('Can\'t load map ' + mapID + ' from ' + options.hostName + ': ' + errorMessage);
		});
    });
};

L.gmx.DummyLayer = function(props) {
    this.onAdd = this.onRemove = function() {};
    this.getGmxProperties = function() { return props; };
};

L.gmx.createLayer = function(layerInfo, options) {
    if (!layerInfo) { layerInfo = {}; }
    if (!layerInfo.properties) { layerInfo.properties = {type: 'Vector'}; }

    var properties = layerInfo.properties,
		type = properties.ContentID || properties.type || 'Vector',
        layer;

    if (!options) { options = properties; }

		if (type in L.gmx._layerClasses) {
        try {
            layer = new L.gmx._layerClasses[type](options || layerInfo.properties);
            layer = layer.initFromDescription(layerInfo);
        } catch (e) {
            layer = new L.gmx.DummyLayer(properties);
        }
    } else {
        layer = new L.gmx.DummyLayer(properties);
    }

    return layer;
};


}());


}());
