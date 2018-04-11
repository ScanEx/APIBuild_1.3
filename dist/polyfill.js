(function () {
var define = null;
var buildDate = '2018-4-11 12:43:19';
var buildUUID = '3f7d9a1c53fd46b081bdf4ddf716b1fb';
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.ES6Promise=e()}(this,function(){"use strict";function t(t){var e=typeof t;return null!==t&&("object"===e||"function"===e)}function e(t){return"function"==typeof t}function r(t){V=t}function n(t){X=t}function o(){return function(){return process.nextTick(f)}}function i(){return"undefined"!=typeof K?function(){K(f)}:u()}function s(){var t=0,e=new W(f),r=document.createTextNode("");return e.observe(r,{characterData:!0}),function(){r.data=t=++t%2}}function a(){var t=new MessageChannel;return t.port1.onmessage=f,function(){return t.port2.postMessage(0)}}function u(){var t=setTimeout;return function(){return t(f,1)}}function f(){for(var t=0;t<Y;t+=2){var e=Z[t],r=Z[t+1];e(r),Z[t]=void 0,Z[t+1]=void 0}Y=0}function c(){try{var t=require,e=t("vertx");return K=e.runOnLoop||e.runOnContext,i()}catch(r){return u()}}function h(t,e){var r=arguments,n=this,o=new this.constructor(d);void 0===o[et]&&D(o);var i=n._state;return i?!function(){var t=r[i-1];X(function(){return j(i,o,t,n._result)})}():B(n,o,t,e),o}function l(t){var e=this;if(t&&"object"==typeof t&&t.constructor===e)return t;var r=new e(d);return A(r,t),r}function d(){}function p(){return new TypeError("You cannot resolve a promise with itself")}function y(){return new TypeError("A promises callback cannot return that same promise.")}function b(t){try{return t.then}catch(e){return it.error=e,it}}function v(t,e,r,n){try{t.call(e,r,n)}catch(o){return o}}function m(t,e,r){X(function(t){var n=!1,o=v(r,e,function(r){n||(n=!0,e!==r?A(t,r):T(t,r))},function(e){n||(n=!0,E(t,e))},"Settle: "+(t._label||" unknown promise"));!n&&o&&(n=!0,E(t,o))},t)}function _(t,e){e._state===nt?T(t,e._result):e._state===ot?E(t,e._result):B(e,void 0,function(e){return A(t,e)},function(e){return E(t,e)})}function w(t,r,n){r.constructor===t.constructor&&n===h&&r.constructor.resolve===l?_(t,r):n===it?(E(t,it.error),it.error=null):void 0===n?T(t,r):e(n)?m(t,r,n):T(t,r)}function A(e,r){e===r?E(e,p()):t(r)?w(e,r,b(r)):T(e,r)}function g(t){t._onerror&&t._onerror(t._result),P(t)}function T(t,e){t._state===rt&&(t._result=e,t._state=nt,0!==t._subscribers.length&&X(P,t))}function E(t,e){t._state===rt&&(t._state=ot,t._result=e,X(g,t))}function B(t,e,r,n){var o=t._subscribers,i=o.length;t._onerror=null,o[i]=e,o[i+nt]=r,o[i+ot]=n,0===i&&t._state&&X(P,t)}function P(t){var e=t._subscribers,r=t._state;if(0!==e.length){for(var n=void 0,o=void 0,i=t._result,s=0;s<e.length;s+=3)n=e[s],o=e[s+r],n?j(r,n,o,i):o(i);t._subscribers.length=0}}function x(){this.error=null}function S(t,e){try{return t(e)}catch(r){return st.error=r,st}}function j(t,r,n,o){var i=e(n),s=void 0,a=void 0,u=void 0,f=void 0;if(i){if(s=S(n,o),s===st?(f=!0,a=s.error,s.error=null):u=!0,r===s)return void E(r,y())}else s=o,u=!0;r._state!==rt||(i&&u?A(r,s):f?E(r,a):t===nt?T(r,s):t===ot&&E(r,s))}function O(t,e){try{e(function(e){A(t,e)},function(e){E(t,e)})}catch(r){E(t,r)}}function U(){return at++}function D(t){t[et]=at++,t._state=void 0,t._result=void 0,t._subscribers=[]}function R(t,e){this._instanceConstructor=t,this.promise=new t(d),this.promise[et]||D(this.promise),G(e)?(this.length=e.length,this._remaining=e.length,this._result=new Array(this.length),0===this.length?T(this.promise,this._result):(this.length=this.length||0,this._enumerate(e),0===this._remaining&&T(this.promise,this._result))):E(this.promise,F())}function F(){return new Error("Array Methods must be provided an Array")}function I(t){return new R(this,t).promise}function C(t){var e=this;return new e(G(t)?function(r,n){for(var o=t.length,i=0;i<o;i++)e.resolve(t[i]).then(r,n)}:function(t,e){return e(new TypeError("You must pass an array to race."))})}function L(t){var e=this,r=new e(d);return E(r,t),r}function q(){throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")}function M(){throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")}function k(t){this[et]=U(),this._result=this._state=void 0,this._subscribers=[],d!==t&&("function"!=typeof t&&q(),this instanceof k?O(this,t):M())}function H(){var t=void 0;if("undefined"!=typeof global)t=global;else if("undefined"!=typeof self)t=self;else try{t=Function("return this")()}catch(e){throw new Error("polyfill failed because global object is unavailable in this environment")}var r=t.Promise;if(r){var n=null;try{n=Object.prototype.toString.call(r.resolve())}catch(e){}if("[object Promise]"===n&&!r.cast)return}t.Promise=k}var N=void 0;N=Array.isArray?Array.isArray:function(t){return"[object Array]"===Object.prototype.toString.call(t)};var G=N,Y=0,K=void 0,V=void 0,X=function(t,e){Z[Y]=t,Z[Y+1]=e,Y+=2,2===Y&&(V?V(f):tt())},z="undefined"!=typeof window?window:void 0,J=z||{},W=J.MutationObserver||J.WebKitMutationObserver,$="undefined"==typeof self&&"undefined"!=typeof process&&"[object process]"==={}.toString.call(process),Q="undefined"!=typeof Uint8ClampedArray&&"undefined"!=typeof importScripts&&"undefined"!=typeof MessageChannel,Z=new Array(1e3),tt=void 0;tt=$?o():W?s():Q?a():void 0===z&&"function"==typeof require?c():u();var et=Math.random().toString(36).substring(16),rt=void 0,nt=1,ot=2,it=new x,st=new x,at=0;return R.prototype._enumerate=function(t){for(var e=0;this._state===rt&&e<t.length;e++)this._eachEntry(t[e],e)},R.prototype._eachEntry=function(t,e){var r=this._instanceConstructor,n=r.resolve;if(n===l){var o=b(t);if(o===h&&t._state!==rt)this._settledAt(t._state,e,t._result);else if("function"!=typeof o)this._remaining--,this._result[e]=t;else if(r===k){var i=new r(d);w(i,t,o),this._willSettleAt(i,e)}else this._willSettleAt(new r(function(e){return e(t)}),e)}else this._willSettleAt(n(t),e)},R.prototype._settledAt=function(t,e,r){var n=this.promise;n._state===rt&&(this._remaining--,t===ot?E(n,r):this._result[e]=r),0===this._remaining&&T(n,this._result)},R.prototype._willSettleAt=function(t,e){var r=this;B(t,void 0,function(t){return r._settledAt(nt,e,t)},function(t){return r._settledAt(ot,e,t)})},k.all=I,k.race=C,k.resolve=l,k.reject=L,k._setScheduler=r,k._setAsap=n,k._asap=X,k.prototype={constructor:k,then:h,"catch":function(t){return this.then(null,t)}},k.polyfill=H,k.Promise=k,k.polyfill(),k}),function(t){"use strict";function e(t){if("string"!=typeof t&&(t=String(t)),/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(t))throw new TypeError("Invalid character in header field name");return t.toLowerCase()}function r(t){return"string"!=typeof t&&(t=String(t)),t}function n(t){var e={next:function(){var e=t.shift();return{done:void 0===e,value:e}}};return v.iterable&&(e[Symbol.iterator]=function(){return e}),e}function o(t){this.map={},t instanceof o?t.forEach(function(t,e){this.append(e,t)},this):Array.isArray(t)?t.forEach(function(t){this.append(t[0],t[1])},this):t&&Object.getOwnPropertyNames(t).forEach(function(e){this.append(e,t[e])},this)}function i(t){return t.bodyUsed?Promise.reject(new TypeError("Already read")):void(t.bodyUsed=!0)}function s(t){return new Promise(function(e,r){t.onload=function(){e(t.result)},t.onerror=function(){r(t.error)}})}function a(t){var e=new FileReader,r=s(e);return e.readAsArrayBuffer(t),r}function u(t){var e=new FileReader,r=s(e);return e.readAsText(t),r}function f(t){for(var e=new Uint8Array(t),r=new Array(e.length),n=0;n<e.length;n++)r[n]=String.fromCharCode(e[n]);return r.join("")}function c(t){if(t.slice)return t.slice(0);var e=new Uint8Array(t.byteLength);return e.set(new Uint8Array(t)),e.buffer}function h(){return this.bodyUsed=!1,this._initBody=function(t){if(this._bodyInit=t,t)if("string"==typeof t)this._bodyText=t;else if(v.blob&&Blob.prototype.isPrototypeOf(t))this._bodyBlob=t;else if(v.formData&&FormData.prototype.isPrototypeOf(t))this._bodyFormData=t;else if(v.searchParams&&URLSearchParams.prototype.isPrototypeOf(t))this._bodyText=t.toString();else if(v.arrayBuffer&&v.blob&&_(t))this._bodyArrayBuffer=c(t.buffer),this._bodyInit=new Blob([this._bodyArrayBuffer]);else{if(!v.arrayBuffer||!ArrayBuffer.prototype.isPrototypeOf(t)&&!w(t))throw new Error("unsupported BodyInit type");this._bodyArrayBuffer=c(t)}else this._bodyText="";this.headers.get("content-type")||("string"==typeof t?this.headers.set("content-type","text/plain;charset=UTF-8"):this._bodyBlob&&this._bodyBlob.type?this.headers.set("content-type",this._bodyBlob.type):v.searchParams&&URLSearchParams.prototype.isPrototypeOf(t)&&this.headers.set("content-type","application/x-www-form-urlencoded;charset=UTF-8"))},v.blob&&(this.blob=function(){var t=i(this);if(t)return t;if(this._bodyBlob)return Promise.resolve(this._bodyBlob);if(this._bodyArrayBuffer)return Promise.resolve(new Blob([this._bodyArrayBuffer]));if(this._bodyFormData)throw new Error("could not read FormData body as blob");return Promise.resolve(new Blob([this._bodyText]))},this.arrayBuffer=function(){return this._bodyArrayBuffer?i(this)||Promise.resolve(this._bodyArrayBuffer):this.blob().then(a)}),this.text=function(){var t=i(this);if(t)return t;if(this._bodyBlob)return u(this._bodyBlob);if(this._bodyArrayBuffer)return Promise.resolve(f(this._bodyArrayBuffer));if(this._bodyFormData)throw new Error("could not read FormData body as text");return Promise.resolve(this._bodyText)},v.formData&&(this.formData=function(){return this.text().then(p)}),this.json=function(){return this.text().then(JSON.parse)},this}function l(t){var e=t.toUpperCase();return A.indexOf(e)>-1?e:t}function d(t,e){e=e||{};var r=e.body;if(t instanceof d){if(t.bodyUsed)throw new TypeError("Already read");this.url=t.url,this.credentials=t.credentials,e.headers||(this.headers=new o(t.headers)),this.method=t.method,this.mode=t.mode,r||null==t._bodyInit||(r=t._bodyInit,t.bodyUsed=!0)}else this.url=String(t);if(this.credentials=e.credentials||this.credentials||"omit",!e.headers&&this.headers||(this.headers=new o(e.headers)),this.method=l(e.method||this.method||"GET"),this.mode=e.mode||this.mode||null,this.referrer=null,("GET"===this.method||"HEAD"===this.method)&&r)throw new TypeError("Body not allowed for GET or HEAD requests");this._initBody(r)}function p(t){var e=new FormData;return t.trim().split("&").forEach(function(t){if(t){var r=t.split("="),n=r.shift().replace(/\+/g," "),o=r.join("=").replace(/\+/g," ");e.append(decodeURIComponent(n),decodeURIComponent(o))}}),e}function y(t){var e=new o,r=t.replace(/\r?\n[\t ]+/g," ");return r.split(/\r?\n/).forEach(function(t){var r=t.split(":"),n=r.shift().trim();if(n){var o=r.join(":").trim();e.append(n,o)}}),e}function b(t,e){e||(e={}),this.type="default",this.status=void 0===e.status?200:e.status,this.ok=this.status>=200&&this.status<300,this.statusText="statusText"in e?e.statusText:"OK",this.headers=new o(e.headers),this.url=e.url||"",this._initBody(t)}if(!t.fetch){var v={searchParams:"URLSearchParams"in t,iterable:"Symbol"in t&&"iterator"in Symbol,blob:"FileReader"in t&&"Blob"in t&&function(){try{return new Blob,!0}catch(t){return!1}}(),formData:"FormData"in t,arrayBuffer:"ArrayBuffer"in t};if(v.arrayBuffer)var m=["[object Int8Array]","[object Uint8Array]","[object Uint8ClampedArray]","[object Int16Array]","[object Uint16Array]","[object Int32Array]","[object Uint32Array]","[object Float32Array]","[object Float64Array]"],_=function(t){return t&&DataView.prototype.isPrototypeOf(t)},w=ArrayBuffer.isView||function(t){return t&&m.indexOf(Object.prototype.toString.call(t))>-1};o.prototype.append=function(t,n){t=e(t),n=r(n);var o=this.map[t];this.map[t]=o?o+","+n:n},o.prototype["delete"]=function(t){delete this.map[e(t)]},o.prototype.get=function(t){return t=e(t),this.has(t)?this.map[t]:null},o.prototype.has=function(t){return this.map.hasOwnProperty(e(t))},o.prototype.set=function(t,n){this.map[e(t)]=r(n)},o.prototype.forEach=function(t,e){for(var r in this.map)this.map.hasOwnProperty(r)&&t.call(e,this.map[r],r,this)},o.prototype.keys=function(){var t=[];return this.forEach(function(e,r){t.push(r)}),n(t)},o.prototype.values=function(){var t=[];return this.forEach(function(e){t.push(e)}),n(t)},o.prototype.entries=function(){var t=[];return this.forEach(function(e,r){t.push([r,e])}),n(t)},v.iterable&&(o.prototype[Symbol.iterator]=o.prototype.entries);var A=["DELETE","GET","HEAD","OPTIONS","POST","PUT"];d.prototype.clone=function(){return new d(this,{body:this._bodyInit})},h.call(d.prototype),h.call(b.prototype),b.prototype.clone=function(){return new b(this._bodyInit,{status:this.status,statusText:this.statusText,headers:new o(this.headers),url:this.url})},b.error=function(){var t=new b(null,{status:0,statusText:""});return t.type="error",t};var g=[301,302,303,307,308];b.redirect=function(t,e){if(g.indexOf(e)===-1)throw new RangeError("Invalid status code");return new b(null,{status:e,headers:{location:t}})},t.Headers=o,t.Request=d,t.Response=b,t.fetch=function(t,e){return new Promise(function(r,n){var o=new d(t,e),i=new XMLHttpRequest;i.onload=function(){var t={status:i.status,statusText:i.statusText,headers:y(i.getAllResponseHeaders()||"")};t.url="responseURL"in i?i.responseURL:t.headers.get("X-Request-URL");var e="response"in i?i.response:i.responseText;r(new b(e,t))},i.onerror=function(){n(new TypeError("Network request failed"))},i.ontimeout=function(){n(new TypeError("Network request failed"))},i.open(o.method,o.url,!0),"include"===o.credentials?i.withCredentials=!0:"omit"===o.credentials&&(i.withCredentials=!1),"responseType"in i&&v.blob&&(i.responseType="blob"),o.headers.forEach(function(t,e){i.setRequestHeader(e,t)}),i.send("undefined"==typeof o._bodyInit?null:o._bodyInit)})},t.fetch.polyfill=!0}}("undefined"!=typeof self?self:this);
}());
