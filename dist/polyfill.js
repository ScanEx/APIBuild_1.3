(function () {
var define = null;
var buildDate = '2018-9-4 10:07:23';
var buildUUID = 'b6bf3ea130c547798c9b9b1992f36529';
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.ES6Promise=e()}(this,function(){"use strict";function t(t){var e=typeof t;return null!==t&&("object"===e||"function"===e)}function e(t){return"function"==typeof t}function r(t){X=t}function n(t){K=t}function o(){return function(){return process.nextTick(c)}}function i(){return"undefined"!=typeof V?function(){V(c)}:u()}function s(){var t=0,e=new J(c),r=document.createTextNode("");return e.observe(r,{characterData:!0}),function(){r.data=t=++t%2}}function a(){var t=new MessageChannel;return t.port1.onmessage=c,function(){return t.port2.postMessage(0)}}function u(){var t=setTimeout;return function(){return t(c,1)}}function c(){for(var t=0;t<Y;t+=2){var e=Z[t],r=Z[t+1];e(r),Z[t]=void 0,Z[t+1]=void 0}Y=0}function f(){try{var t=require,e=t("vertx");return V=e.runOnLoop||e.runOnContext,i()}catch(r){return u()}}function h(t,e){var r=arguments,n=this,o=new this.constructor(d);void 0===o[et]&&L(o);var i=n._state;return i?!function(){var t=r[i-1];K(function(){return O(i,o,t,n._result)})}():B(n,o,t,e),o}function l(t){var e=this;if(t&&"object"==typeof t&&t.constructor===e)return t;var r=new e(d);return g(r,t),r}function d(){}function p(){return new TypeError("You cannot resolve a promise with itself")}function y(){return new TypeError("A promises callback cannot return that same promise.")}function b(t){try{return t.then}catch(e){return it.error=e,it}}function m(t,e,r,n){try{t.call(e,r,n)}catch(o){return o}}function v(t,e,r){K(function(t){var n=!1,o=m(r,e,function(r){n||(n=!0,e!==r?g(t,r):E(t,r))},function(e){n||(n=!0,T(t,e))},"Settle: "+(t._label||" unknown promise"));!n&&o&&(n=!0,T(t,o))},t)}function _(t,e){e._state===nt?E(t,e._result):e._state===ot?T(t,e._result):B(e,void 0,function(e){return g(t,e)},function(e){return T(t,e)})}function w(t,r,n){r.constructor===t.constructor&&n===h&&r.constructor.resolve===l?_(t,r):n===it?(T(t,it.error),it.error=null):void 0===n?E(t,r):e(n)?v(t,r,n):E(t,r)}function g(e,r){e===r?T(e,p()):t(r)?w(e,r,b(r)):E(e,r)}function A(t){t._onerror&&t._onerror(t._result),P(t)}function E(t,e){t._state===rt&&(t._result=e,t._state=nt,0!==t._subscribers.length&&K(P,t))}function T(t,e){t._state===rt&&(t._state=ot,t._result=e,K(A,t))}function B(t,e,r,n){var o=t._subscribers,i=o.length;t._onerror=null,o[i]=e,o[i+nt]=r,o[i+ot]=n,0===i&&t._state&&K(P,t)}function P(t){var e=t._subscribers,r=t._state;if(0!==e.length){for(var n=void 0,o=void 0,i=t._result,s=0;s<e.length;s+=3)n=e[s],o=e[s+r],n?O(r,n,o,i):o(i);t._subscribers.length=0}}function S(){this.error=null}function x(t,e){try{return t(e)}catch(r){return st.error=r,st}}function O(t,r,n,o){var i=e(n),s=void 0,a=void 0,u=void 0,c=void 0;if(i){if(s=x(n,o),s===st?(c=!0,a=s.error,s.error=null):u=!0,r===s)return void T(r,y())}else s=o,u=!0;r._state!==rt||(i&&u?g(r,s):c?T(r,a):t===nt?E(r,s):t===ot&&T(r,s))}function j(t,e){try{e(function(e){g(t,e)},function(e){T(t,e)})}catch(r){T(t,r)}}function D(){return at++}function L(t){t[et]=at++,t._state=void 0,t._result=void 0,t._subscribers=[]}function U(t,e){this._instanceConstructor=t,this.promise=new t(d),this.promise[et]||L(this.promise),G(e)?(this.length=e.length,this._remaining=e.length,this._result=new Array(this.length),0===this.length?E(this.promise,this._result):(this.length=this.length||0,this._enumerate(e),0===this._remaining&&E(this.promise,this._result))):T(this.promise,R())}function R(){return new Error("Array Methods must be provided an Array")}function C(t){return new U(this,t).promise}function I(t){var e=this;return new e(G(t)?function(r,n){for(var o=t.length,i=0;i<o;i++)e.resolve(t[i]).then(r,n)}:function(t,e){return e(new TypeError("You must pass an array to race."))})}function F(t){var e=this,r=new e(d);return T(r,t),r}function k(){throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")}function M(){throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")}function N(t){this[et]=D(),this._result=this._state=void 0,this._subscribers=[],d!==t&&("function"!=typeof t&&k(),this instanceof N?j(this,t):M())}function q(){var t=void 0;if("undefined"!=typeof global)t=global;else if("undefined"!=typeof self)t=self;else try{t=Function("return this")()}catch(e){throw new Error("polyfill failed because global object is unavailable in this environment")}var r=t.Promise;if(r){var n=null;try{n=Object.prototype.toString.call(r.resolve())}catch(e){}if("[object Promise]"===n&&!r.cast)return}t.Promise=N}var H=void 0;H=Array.isArray?Array.isArray:function(t){return"[object Array]"===Object.prototype.toString.call(t)};var G=H,Y=0,V=void 0,X=void 0,K=function(t,e){Z[Y]=t,Z[Y+1]=e,Y+=2,2===Y&&(X?X(c):tt())},$="undefined"!=typeof window?window:void 0,z=$||{},J=z.MutationObserver||z.WebKitMutationObserver,W="undefined"==typeof self&&"undefined"!=typeof process&&"[object process]"==={}.toString.call(process),Q="undefined"!=typeof Uint8ClampedArray&&"undefined"!=typeof importScripts&&"undefined"!=typeof MessageChannel,Z=new Array(1e3),tt=void 0;tt=W?o():J?s():Q?a():void 0===$&&"function"==typeof require?f():u();var et=Math.random().toString(36).substring(16),rt=void 0,nt=1,ot=2,it=new S,st=new S,at=0;return U.prototype._enumerate=function(t){for(var e=0;this._state===rt&&e<t.length;e++)this._eachEntry(t[e],e)},U.prototype._eachEntry=function(t,e){var r=this._instanceConstructor,n=r.resolve;if(n===l){var o=b(t);if(o===h&&t._state!==rt)this._settledAt(t._state,e,t._result);else if("function"!=typeof o)this._remaining--,this._result[e]=t;else if(r===N){var i=new r(d);w(i,t,o),this._willSettleAt(i,e)}else this._willSettleAt(new r(function(e){return e(t)}),e)}else this._willSettleAt(n(t),e)},U.prototype._settledAt=function(t,e,r){var n=this.promise;n._state===rt&&(this._remaining--,t===ot?T(n,r):this._result[e]=r),0===this._remaining&&E(n,this._result)},U.prototype._willSettleAt=function(t,e){var r=this;B(t,void 0,function(t){return r._settledAt(nt,e,t)},function(t){return r._settledAt(ot,e,t)})},N.all=C,N.race=I,N.resolve=l,N.reject=F,N._setScheduler=r,N._setAsap=n,N._asap=K,N.prototype={constructor:N,then:h,"catch":function(t){return this.then(null,t)}},N.polyfill=q,N.Promise=N,N.polyfill(),N}),"document"in self&&("classList"in document.createElement("_")&&(!document.createElementNS||"classList"in document.createElementNS("http://www.w3.org/2000/svg","g"))||!function(t){"use strict";if("Element"in t){var e="classList",r="prototype",n=t.Element[r],o=Object,i=String[r].trim||function(){return this.replace(/^\s+|\s+$/g,"")},s=Array[r].indexOf||function(t){for(var e=0,r=this.length;e<r;e++)if(e in this&&this[e]===t)return e;return-1},a=function(t,e){this.name=t,this.code=DOMException[t],this.message=e},u=function(t,e){if(""===e)throw new a("SYNTAX_ERR","The token must not be empty.");if(/\s/.test(e))throw new a("INVALID_CHARACTER_ERR","The token must not contain space characters.");return s.call(t,e)},c=function(t){for(var e=i.call(t.getAttribute("class")||""),r=e?e.split(/\s+/):[],n=0,o=r.length;n<o;n++)this.push(r[n]);this._updateClassName=function(){t.setAttribute("class",this.toString())}},f=c[r]=[],h=function(){return new c(this)};if(a[r]=Error[r],f.item=function(t){return this[t]||null},f.contains=function(t){return~u(this,t+"")},f.add=function(){var t,e=arguments,r=0,n=e.length,o=!1;do t=e[r]+"",~u(this,t)||(this.push(t),o=!0);while(++r<n);o&&this._updateClassName()},f.remove=function(){var t,e,r=arguments,n=0,o=r.length,i=!1;do for(t=r[n]+"",e=u(this,t);~e;)this.splice(e,1),i=!0,e=u(this,t);while(++n<o);i&&this._updateClassName()},f.toggle=function(t,e){var r=this.contains(t),n=r?e!==!0&&"remove":e!==!1&&"add";return n&&this[n](t),e===!0||e===!1?e:!r},f.replace=function(t,e){var r=u(t+"");~r&&(this.splice(r,1,e),this._updateClassName())},f.toString=function(){return this.join(" ")},o.defineProperty){var l={get:h,enumerable:!0,configurable:!0};try{o.defineProperty(n,e,l)}catch(d){void 0!==d.number&&d.number!==-2146823252||(l.enumerable=!1,o.defineProperty(n,e,l))}}else o[r].__defineGetter__&&n.__defineGetter__(e,h)}}(self),function(){"use strict";var t=document.createElement("_");if(t.classList.add("c1","c2"),!t.classList.contains("c2")){var e=function(t){var e=DOMTokenList.prototype[t];DOMTokenList.prototype[t]=function(t){var r,n=arguments.length;for(r=0;r<n;r++)t=arguments[r],e.call(this,t)}};e("add"),e("remove")}if(t.classList.toggle("c3",!1),t.classList.contains("c3")){var r=DOMTokenList.prototype.toggle;DOMTokenList.prototype.toggle=function(t,e){return 1 in arguments&&!this.contains(t)==!e?e:r.call(this,t)}}"replace"in document.createElement("_").classList||(DOMTokenList.prototype.replace=function(t,e){var r=this.toString().split(" "),n=r.indexOf(t+"");~n&&(r=r.slice(n),this.remove.apply(this,r),this.add(e),this.add.apply(this,r.slice(1)))}),t=null}()),function(t){"use strict";function e(t){if("string"!=typeof t&&(t=String(t)),/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(t))throw new TypeError("Invalid character in header field name");return t.toLowerCase()}function r(t){return"string"!=typeof t&&(t=String(t)),t}function n(t){var e={next:function(){var e=t.shift();return{done:void 0===e,value:e}}};return m.iterable&&(e[Symbol.iterator]=function(){return e}),e}function o(t){this.map={},t instanceof o?t.forEach(function(t,e){this.append(e,t)},this):Array.isArray(t)?t.forEach(function(t){this.append(t[0],t[1])},this):t&&Object.getOwnPropertyNames(t).forEach(function(e){this.append(e,t[e])},this)}function i(t){return t.bodyUsed?Promise.reject(new TypeError("Already read")):void(t.bodyUsed=!0)}function s(t){return new Promise(function(e,r){t.onload=function(){e(t.result)},t.onerror=function(){r(t.error)}})}function a(t){var e=new FileReader,r=s(e);return e.readAsArrayBuffer(t),r}function u(t){var e=new FileReader,r=s(e);return e.readAsText(t),r}function c(t){for(var e=new Uint8Array(t),r=new Array(e.length),n=0;n<e.length;n++)r[n]=String.fromCharCode(e[n]);return r.join("")}function f(t){if(t.slice)return t.slice(0);var e=new Uint8Array(t.byteLength);return e.set(new Uint8Array(t)),e.buffer}function h(){return this.bodyUsed=!1,this._initBody=function(t){if(this._bodyInit=t,t)if("string"==typeof t)this._bodyText=t;else if(m.blob&&Blob.prototype.isPrototypeOf(t))this._bodyBlob=t;else if(m.formData&&FormData.prototype.isPrototypeOf(t))this._bodyFormData=t;else if(m.searchParams&&URLSearchParams.prototype.isPrototypeOf(t))this._bodyText=t.toString();else if(m.arrayBuffer&&m.blob&&_(t))this._bodyArrayBuffer=f(t.buffer),this._bodyInit=new Blob([this._bodyArrayBuffer]);else{if(!m.arrayBuffer||!ArrayBuffer.prototype.isPrototypeOf(t)&&!w(t))throw new Error("unsupported BodyInit type");this._bodyArrayBuffer=f(t)}else this._bodyText="";this.headers.get("content-type")||("string"==typeof t?this.headers.set("content-type","text/plain;charset=UTF-8"):this._bodyBlob&&this._bodyBlob.type?this.headers.set("content-type",this._bodyBlob.type):m.searchParams&&URLSearchParams.prototype.isPrototypeOf(t)&&this.headers.set("content-type","application/x-www-form-urlencoded;charset=UTF-8"))},m.blob&&(this.blob=function(){var t=i(this);if(t)return t;if(this._bodyBlob)return Promise.resolve(this._bodyBlob);if(this._bodyArrayBuffer)return Promise.resolve(new Blob([this._bodyArrayBuffer]));if(this._bodyFormData)throw new Error("could not read FormData body as blob");return Promise.resolve(new Blob([this._bodyText]))},this.arrayBuffer=function(){return this._bodyArrayBuffer?i(this)||Promise.resolve(this._bodyArrayBuffer):this.blob().then(a)}),this.text=function(){var t=i(this);if(t)return t;if(this._bodyBlob)return u(this._bodyBlob);if(this._bodyArrayBuffer)return Promise.resolve(c(this._bodyArrayBuffer));if(this._bodyFormData)throw new Error("could not read FormData body as text");return Promise.resolve(this._bodyText)},m.formData&&(this.formData=function(){return this.text().then(p)}),this.json=function(){return this.text().then(JSON.parse)},this}function l(t){var e=t.toUpperCase();return g.indexOf(e)>-1?e:t}function d(t,e){e=e||{};var r=e.body;if(t instanceof d){if(t.bodyUsed)throw new TypeError("Already read");this.url=t.url,this.credentials=t.credentials,e.headers||(this.headers=new o(t.headers)),this.method=t.method,this.mode=t.mode,r||null==t._bodyInit||(r=t._bodyInit,t.bodyUsed=!0)}else this.url=String(t);if(this.credentials=e.credentials||this.credentials||"omit",!e.headers&&this.headers||(this.headers=new o(e.headers)),this.method=l(e.method||this.method||"GET"),this.mode=e.mode||this.mode||null,this.referrer=null,("GET"===this.method||"HEAD"===this.method)&&r)throw new TypeError("Body not allowed for GET or HEAD requests");this._initBody(r)}function p(t){var e=new FormData;return t.trim().split("&").forEach(function(t){if(t){var r=t.split("="),n=r.shift().replace(/\+/g," "),o=r.join("=").replace(/\+/g," ");e.append(decodeURIComponent(n),decodeURIComponent(o))}}),e}function y(t){var e=new o,r=t.replace(/\r?\n[\t ]+/g," ");return r.split(/\r?\n/).forEach(function(t){var r=t.split(":"),n=r.shift().trim();if(n){var o=r.join(":").trim();e.append(n,o)}}),e}function b(t,e){e||(e={}),this.type="default",this.status=void 0===e.status?200:e.status,this.ok=this.status>=200&&this.status<300,this.statusText="statusText"in e?e.statusText:"OK",this.headers=new o(e.headers),this.url=e.url||"",this._initBody(t)}if(!t.fetch){var m={searchParams:"URLSearchParams"in t,iterable:"Symbol"in t&&"iterator"in Symbol,blob:"FileReader"in t&&"Blob"in t&&function(){try{return new Blob,!0}catch(t){return!1}}(),formData:"FormData"in t,arrayBuffer:"ArrayBuffer"in t};if(m.arrayBuffer)var v=["[object Int8Array]","[object Uint8Array]","[object Uint8ClampedArray]","[object Int16Array]","[object Uint16Array]","[object Int32Array]","[object Uint32Array]","[object Float32Array]","[object Float64Array]"],_=function(t){return t&&DataView.prototype.isPrototypeOf(t)},w=ArrayBuffer.isView||function(t){return t&&v.indexOf(Object.prototype.toString.call(t))>-1};o.prototype.append=function(t,n){t=e(t),n=r(n);var o=this.map[t];this.map[t]=o?o+","+n:n},o.prototype["delete"]=function(t){delete this.map[e(t)]},o.prototype.get=function(t){return t=e(t),this.has(t)?this.map[t]:null},o.prototype.has=function(t){return this.map.hasOwnProperty(e(t))},o.prototype.set=function(t,n){this.map[e(t)]=r(n)},o.prototype.forEach=function(t,e){for(var r in this.map)this.map.hasOwnProperty(r)&&t.call(e,this.map[r],r,this)},o.prototype.keys=function(){var t=[];return this.forEach(function(e,r){t.push(r)}),n(t)},o.prototype.values=function(){var t=[];return this.forEach(function(e){t.push(e)}),n(t)},o.prototype.entries=function(){var t=[];return this.forEach(function(e,r){t.push([r,e])}),n(t)},m.iterable&&(o.prototype[Symbol.iterator]=o.prototype.entries);var g=["DELETE","GET","HEAD","OPTIONS","POST","PUT"];d.prototype.clone=function(){return new d(this,{body:this._bodyInit})},h.call(d.prototype),h.call(b.prototype),b.prototype.clone=function(){return new b(this._bodyInit,{status:this.status,statusText:this.statusText,headers:new o(this.headers),url:this.url})},b.error=function(){var t=new b(null,{status:0,statusText:""});return t.type="error",t};var A=[301,302,303,307,308];b.redirect=function(t,e){if(A.indexOf(e)===-1)throw new RangeError("Invalid status code");return new b(null,{status:e,headers:{location:t}})},t.Headers=o,t.Request=d,t.Response=b,t.fetch=function(t,e){return new Promise(function(r,n){var o=new d(t,e),i=new XMLHttpRequest;i.onload=function(){var t={status:i.status,statusText:i.statusText,headers:y(i.getAllResponseHeaders()||"")};t.url="responseURL"in i?i.responseURL:t.headers.get("X-Request-URL");var e="response"in i?i.response:i.responseText;r(new b(e,t))},i.onerror=function(){n(new TypeError("Network request failed"))},i.ontimeout=function(){n(new TypeError("Network request failed"))},i.open(o.method,o.url,!0),"include"===o.credentials?i.withCredentials=!0:"omit"===o.credentials&&(i.withCredentials=!1),"responseType"in i&&m.blob&&(i.responseType="blob"),o.headers.forEach(function(t,e){i.setRequestHeader(e,t)}),i.send("undefined"==typeof o._bodyInit?null:o._bodyInit)})},t.fetch.polyfill=!0}}("undefined"!=typeof self?self:this);
}());
