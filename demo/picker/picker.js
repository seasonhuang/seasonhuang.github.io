'use strict';

/*
Copyright 2014 Ralph Thomas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// This function sets up a requestAnimationFrame-based timer which calls
// the callback every frame while the physics model is still moving.
// It returns a function that may be called to cancel the animation.
function animation(physicsModel, callback, doneFn) {
    
    function onFrame(handle, model, cb, doneFn) {
        if (handle && handle.cancelled) return;
        cb(model);
        var done = physicsModel.done();
        if (!done && !handle.cancelled) {
            handle.id = requestAnimationFrame(onFrame.bind(null, handle, model, cb, doneFn));
        }
        if (done && doneFn) {
          doneFn(model);
        }
    }
    function cancel(handle) {
        if (handle && handle.id)
            cancelAnimationFrame(handle.id);
        if (handle)
            handle.cancelled = true;
    }

    var handle = { id: 0, cancelled: false };
    onFrame(handle, physicsModel, callback, doneFn);

    return { cancel: cancel.bind(null, handle), model: physicsModel };
}



'use strict';
/*
Copyright 2014 Ralph Thomas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/***
 * Friction physics simulation. Friction is actually just a simple
 * power curve; the only trick is taking the natural log of the
 * initial drag so that we can express the answer in terms of time.
 */
function Friction(drag) {
    this._drag = drag;
    this._dragLog = Math.log(drag);
    this._x = 0;
    this._v = 0;
    this._startTime = 0;
}
Friction.prototype.set = function(x, v) {
    this._x = x;
    this._v = v;
    this._startTime = (new Date()).getTime();
}
Friction.prototype.x = function(dt) {
    if (dt === undefined) dt = ((new Date()).getTime() - this._startTime) / 1000;
    var powDragDt;
    if (dt === this._dt && this._powDragDt) {
      powDragDt = this._powDragDt;
    } else {
      powDragDt = this._powDragDt = Math.pow(this._drag, dt);
    }
    this._dt = dt;
    return this._x + this._v * powDragDt / this._dragLog - this._v / this._dragLog;
}
Friction.prototype.dx = function(dt) {
    if (dt === undefined) dt = ((new Date()).getTime() - this._startTime) / 1000;
    var powDragDt;
    if (dt === this._dt && this._powDragDt) {
      powDragDt = this._powDragDt;
    } else {
      powDragDt = this._powDragDt = Math.pow(this._drag, dt);
    }
    this._dt = dt;
    return this._v * powDragDt;
}
Friction.prototype.done = function() {
    return Math.abs(this.dx()) < 3;
}
Friction.prototype.reconfigure = function(drag) {
    var x = this.x();
    var v = this.dx();
    this._drag = drag;
    this._dragLog = Math.log(drag);
    this.set(x, v);
}
Friction.prototype.configuration = function() {
    var self = this;
    return [
        {
            label: 'Friction',
            read: function() { return self._drag; },
            write: function(drag) { self.reconfigure(drag); },
            min: 0.001,
            max: 0.1,
            step: 0.001
        }
    ];
}


'use strict';
/*
Copyright 2014 Ralph Thomas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var epsilon = 0.1;
function almostEqual(a, b, epsilon) { return (a > (b - epsilon)) && (a < (b + epsilon)); }
function almostZero(a, epsilon) { return almostEqual(a, 0, epsilon); }

/***
 * Simple Spring implementation -- this implements a damped spring using a symbolic integration
 * of Hooke's law: F = -kx - cv. This solution is significantly more performant and less code than
 * a numerical approach such as Facebook Rebound which uses RK4.
 *
 * This physics textbook explains the model:
 *  http://www.stewartcalculus.com/data/CALCULUS%20Concepts%20and%20Contexts/upfiles/3c3-AppsOf2ndOrders_Stu.pdf
 *
 * A critically damped spring has: damping*damping - 4 * mass * springConstant == 0. If it's greater than zero
 * then the spring is overdamped, if it's less than zero then it's underdamped.
 */
function Spring(mass, springConstant, damping) {
    this._m = mass;
    this._k = springConstant;
    this._c = damping;
    this._solution = null;
    this._endPosition = 0;
    this._startTime = 0;
}
Spring.prototype._solve = function(initial, velocity) {
    var c = this._c;
    var m = this._m;
    var k = this._k;
    // Solve the quadratic equation; root = (-c +/- sqrt(c^2 - 4mk)) / 2m.
    var cmk = c * c - 4 * m * k;
    if (cmk == 0) {
        // The spring is critically damped.
        // x = (c1 + c2*t) * e ^(-c/2m)*t
        var r = -c / (2 * m);
        var c1 = initial;
        var c2 = velocity / (r * initial);
        return {
            x: function(t) { return (c1 + c2 * t) * Math.pow(Math.E, r * t); },
            dx: function(t) { var pow = Math.pow(Math.E, r * t); return r * (c1 + c2 * t) * pow + c2 * pow; }
        };
    } else if (cmk > 0) {
        // The spring is overdamped; no bounces.
        // x = c1*e^(r1*t) + c2*e^(r2t)
        // Need to find r1 and r2, the roots, then solve c1 and c2.
        var r1 = (-c - Math.sqrt(cmk)) / (2 * m);
        var r2 = (-c + Math.sqrt(cmk)) / (2 * m);
        var c2 = (velocity - r1 * initial) / (r2 - r1);
        var c1 = initial - c2;

        return {
          x: function(t) {
            var powER1T, powER2T;
            if (t === this._t) {
              powER1T = this._powER1T;
              powER2T = this._powER2T;
            }

            this._t = t;

            if (!powER1T) {
              powER1T = this._powER1T = Math.pow(Math.E, r1 * t);
            }
            if (!powER2T) {
              powER2T = this._powER2T = Math.pow(Math.E, r2 * t);
            }

            return (c1 * powER1T + c2 * powER2T);
          },
          dx: function(t) {
            var powER1T, powER2T;
            if (t === this._t) {
              powER1T = this._powER1T;
              powER2T = this._powER2T;
            }

            this._t = t;

            if (!powER1T) {
              powER1T = this._powER1T = Math.pow(Math.E, r1 * t);
            }
            if (!powER2T) {
              powER2T = this._powER2T = Math.pow(Math.E, r2 * t);
            }

            return (c1 * r1 * powER1T + c2 * r2 * powER2T);
          }
        };
    } else {
        // The spring is underdamped, it has imaginary roots.
        // r = -(c / 2*m) +- w*i
        // w = sqrt(4mk - c^2) / 2m
        // x = (e^-(c/2m)t) * (c1 * cos(wt) + c2 * sin(wt))
        var w = Math.sqrt(4*m*k - c*c) / (2 * m);
        var r = -(c / 2*m);
        var c1= initial;
        var c2= (velocity - r * initial) / w;
            
        return {
            x: function(t) { return Math.pow(Math.E, r * t) * (c1 * Math.cos(w * t) + c2 * Math.sin(w * t)); },
            dx: function(t) {
                var power =  Math.pow(Math.E, r * t);
                var cos = Math.cos(w * t);
                var sin = Math.sin(w * t);
                return power * (c2 * w * cos - c1 * w * sin) + r * power * (c2 * sin + c1 * cos);
            }
        };
    }
}
Spring.prototype.x = function(dt) {
    if (dt == undefined) dt = ((new Date()).getTime() - this._startTime) / 1000.0;
    return this._solution ? this._endPosition + this._solution.x(dt) : 0;
}
Spring.prototype.dx = function(dt) {
    if (dt == undefined) dt = ((new Date()).getTime() - this._startTime) / 1000.0;
    return this._solution ? this._solution.dx(dt) : 0;
}
Spring.prototype.setEnd = function(x, velocity, t) {
    if (!t) t = (new Date()).getTime();
    if (x == this._endPosition && almostZero(velocity, epsilon)) return;
    velocity = velocity || 0;
    var position = this._endPosition;
    if (this._solution) {
        // Don't whack incoming velocity.
        if (almostZero(velocity, epsilon))
            velocity = this._solution.dx((t - this._startTime) / 1000.0);
        position = this._solution.x((t - this._startTime) / 1000.0);
        if (almostZero(velocity, epsilon)) velocity = 0;
        if (almostZero(position, epsilon)) position = 0;
        position += this._endPosition;
    }
    if (this._solution && almostZero(position - x, epsilon) && almostZero(velocity, epsilon)) {
        return;
    }
    this._endPosition = x;
    this._solution = this._solve(position - this._endPosition, velocity);
    this._startTime = t;
}
Spring.prototype.snap = function(x) {
    this._startTime = (new Date()).getTime();
    this._endPosition = x;
    this._solution = {
        x: function() { return 0; },
        dx: function() { return 0; }
    };
}
Spring.prototype.done = function(t) {
    if (!t) t = (new Date()).getTime();
    return almostEqual(this.x(), this._endPosition, epsilon) && almostZero(this.dx(), epsilon);
}
Spring.prototype.reconfigure = function(mass, springConstant, damping) {
    this._m = mass;
    this._k = springConstant;
    this._c = damping;

    if (this.done()) return;
    this._solution = this._solve(this.x() - this._endPosition, this.dx());
    this._startTime = (new Date()).getTime();
}
Spring.prototype.springConstant = function() { return this._k; }
Spring.prototype.damping = function() { return this._c; }

Spring.prototype.configuration = function() {
    function setSpringConstant(s, c) { s.reconfigure(1, c, s.damping()); };
    function setSpringDamping(s, d) { s.reconfigure(1, s.springConstant(), d); }
    return [
        { label: 'Spring Constant', read: this.springConstant.bind(this), write: setSpringConstant.bind(this, this), min: 100, max: 1000 },
        { label: 'Damping', read: this.damping.bind(this), write: setSpringDamping.bind(this, this), min: 1, max: 500 }
    ];
}


'use strict';
/*
Copyright 2014 Ralph Thomas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/***
 * Scroll combines Friction and Spring to provide the
 * classic "flick-with-bounce" behavior.
 */
function Scroll(extent) {
    this._extent = extent;
    this._friction = new Friction(0.01);
    this._spring = new Spring(1, 90, 20);
    this._startTime = 0;
    this._springing = false;
    this._springOffset = 0;
}
Scroll.prototype.snap = function(x0, x1) {
  this._springOffset = 0;
  this._springing = true;
  this._spring.snap(x0);
  this._spring.setEnd(x1);
}
Scroll.prototype.set = function(x, v) {
    this._friction.set(x, v);

    // If we're over the extent or zero then start springing. Notice that we also consult
    // velocity because we don't want flicks that start in the overscroll to get consumed
    // by the spring.
    if (x > 0 && v >= 0) {
        this._springOffset = 0;
        this._springing = true;
        this._spring.snap(x);
        this._spring.setEnd(0);
    } else if (x < -this._extent && v <= 0) {
        this._springOffset = 0;
        this._springing = true;
        this._spring.snap(x);
        this._spring.setEnd(-this._extent);
    } else {
        this._springing = false;
    }
    this._startTime = (new Date()).getTime();
}
Scroll.prototype.x = function(t) {
    if (!this._startTime) return 0;
    if (!t) t = ((new Date()).getTime() - this._startTime) / 1000.0;
    // We've entered the spring, use the value from there.
    if (this._springing) return this._spring.x() + this._springOffset;
    // We're still in friction.
    var x = this._friction.x(t);
    var dx = this.dx(t);
    // If we've gone over the edge the roll the momentum into the spring.
    if ((x > 0 && dx >= 0) || (x < -this._extent && dx <= 0)) {
        this._springing = true;
        this._spring.setEnd(0, dx);
        if (x < -this._extent) this._springOffset = -this._extent;
        else this._springOffset = 0;
        x = this._spring.x() + this._springOffset;
    }

    return x;
}
Scroll.prototype.dx = function(t) {
    if (this._springing) return this._spring.dx(t);
    return this._friction.dx(t);
}
Scroll.prototype.done = function() {
    if (this._springing) return this._spring.done();
    else return this._friction.done();
}
Scroll.prototype.configuration = function() {
    var config = this._friction.configuration();
    config.push.apply(config, this._spring.configuration());
    return config;
}

var UNDERSCROLL_TRACKING = 0.5;

function ScrollHandler(element) {
    this._element = element;
    this._position = 0;
    this._extent = this._element.offsetHeight - this._element.parentElement.offsetHeight;
    this._scroll = new Scroll(this._extent);
    this._onTransitionEnd = this.onTransitionEnd.bind(this);
}
ScrollHandler.prototype.onTouchStart = function() {
    this._startPosition = this._position;

    // Ensure that we don't jump discontinuously when applying the underscroll
    // tracking in onTouchMove if the view is currently outside of the valid
    // scroll constraints.
    if (this._startPosition > 0)
        this._startPosition /= UNDERSCROLL_TRACKING;
    else if (this._startPosition < -this._extent)
        this._startPosition = (this._startPosition + this._extent) / UNDERSCROLL_TRACKING - this._extent;

    if (this._animation) this._animation.cancel();

    var pos = this._position;
    var transform = 'translateY(' + pos + 'px)';
    this._element.style.webkitTransform = transform;
    this._element.style.transform = transform;
}
ScrollHandler.prototype.onTouchMove = function(dx, dy) {
    var pos = dy + this._startPosition;
    if (pos > 0) pos *= UNDERSCROLL_TRACKING;
    else if (pos < -this._extent) pos = (pos + this._extent) * UNDERSCROLL_TRACKING - this._extent;

    this._position = pos;
    var transform = 'translateY(' + pos + 'px) translateZ(0)';
    this._element.style.webkitTransform = transform;
    this._element.style.transform = transform;
}
ScrollHandler.prototype.onTouchEnd = function(dx, dy, velocity) {
    var self = this;
    console.log('onTouchEnd', dy, velocity.y)
    if (Math.abs(dy) < 34 && Math.abs(velocity.y) < 300 || Math.abs(velocity.y) < 150) {
      self.snap(20);
      return;
    }
    this._scroll.set(this._position, velocity.y);
    this._animation = animation(this._scroll, function() {
        var pos = self._scroll.x();
        self._position = pos;
        // The translateZ is to help older WebKits not collapse this layer into a non-composited layer
        // since they're also slow at repaints.
        var transform = 'translateY(' + pos + 'px) translateZ(0)';
        self._element.style.webkitTransform = transform;
        self._element.style.transform = transform;
    }, function done() {
      self.snap();
      // var left = self._position % 34;
      // var next = Math.abs(left) > 17 ? self._position - (34 - Math.abs(left)) : self._position - left;
      // console.log(self._position, next);
      // self._element.style.transition = 'transform .2s ease-out';
      // self._element.style.transform = 'translateY(' + next + 'px) translateZ(0)';
      // self._position = next;
      // self._snapping = true;
      // self._element.addEventListener('transitionend', this._onTransitionEnd);

      // self._scroll.snap(self._position, next);
      // self._animation = animation(self._scroll, function() {
      //     var pos = self._scroll.x();
      //     self._position = pos;
      //     // The translateZ is to help older WebKits not collapse this layer into a non-composited layer
      //     // since they're also slow at repaints.
      //     var transform = 'translateY(' + pos + 'px) translateZ(0)';
      //     self._element.style.webkitTransform = transform;
      //     self._element.style.transform = transform;
      // });
    });
}
ScrollHandler.prototype.onTransitionEnd = function() {
  this._snapping = false;
  this._element.style.transition = '';
  this._element.removeEventListener('transitionend', this._onTransitionEnd);
  console.log('transitionEnd');
}
ScrollHandler.prototype.snap = function(init) {
  var left = this._position % 34;
  var next = Math.abs(left) > (init || 17) ? this._position - (34 - Math.abs(left)) : this._position - left;
  console.log('snap', this._position, next);
  this._element.style.transition = 'transform .2s ease-out';
  this._element.style.transform = 'translateY(' + next + 'px) translateZ(0)';
  this._position = next;
  this._snapping = true;
  this._element.addEventListener('transitionend', this._onTransitionEnd);
}
ScrollHandler.prototype.configuration = function() {
    return this._scroll.configuration();
}

'use strict';

/*
Copyright 2014 Ralph Thomas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

(function() {
// List of all listeners; dom element and listener object.
var listeners = {};
var listenerSequence = 0;
var registeredGlobalListener = false;

function addListener(domObject, listener) {
    var key = 'touch-listener-' + (listenerSequence++);
    listeners[key] = listener;
    domObject.listenerKey = key;
}
function findListener(domObject) {
    if (domObject && domObject.listenerKey && listeners.hasOwnProperty(domObject.listenerKey)) {
        return listeners[domObject.listenerKey];
    }
    return null;
}
function registerGlobalListener() {
    if (registeredGlobalListener) return;
    registeredGlobalListener = true;

    var touchInfo = { trackingID: -1, maxDy: 0, maxDx: 0 };
    function touchStart(e) {
        if (touchInfo.trackingID != -1) return;
        var listener = findListener(e.target);
        if (!listener) return;

        e.preventDefault();
        if (e.type == 'touchstart') {
            touchInfo.trackingID = e.changedTouches[0].identifier;
            touchInfo.x = e.changedTouches[0].pageX;
            touchInfo.y = e.changedTouches[0].pageY;
        } else {
            touchInfo.trackingID = 'mouse';
            touchInfo.x = e.screenX;
            touchInfo.y = e.screenY;
        }
        touchInfo.maxDx = 0;
        touchInfo.maxDy = 0;
        touchInfo.historyX = [0];
        touchInfo.historyY = [0];
        touchInfo.historyTime = [e.timeStamp];
        touchInfo.listener = listener;

        if (listener.onTouchStart)
            listener.onTouchStart();
    }

    function findDelta(e) {
        if (e.type == 'touchmove' || e.type == 'touchend') {
            for (var i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier == touchInfo.trackingID) {
                    return {x: e.changedTouches[i].pageX - touchInfo.x, y: e.changedTouches[i].pageY - touchInfo.y};
                }
            }
        } else {
            return {x: e.screenX - touchInfo.x, y: e.screenY - touchInfo.y};
        }
        return null;
    }

    function touchMove(e) {
        if (touchInfo.trackingID == -1) return;
        e.preventDefault();
        var delta = findDelta(e);
        if (!delta) return;
        touchInfo.maxDy = Math.max(touchInfo.maxDy, Math.abs(delta.y));
        touchInfo.maxDx = Math.max(touchInfo.maxDx, Math.abs(delta.x));

        // This is all for our crummy velocity computation method. We really
        // should do least squares or anything at all better than just taking
        // the difference between two random samples.
        touchInfo.historyX.push(delta.x);
        touchInfo.historyY.push(delta.y);
        touchInfo.historyTime.push(e.timeStamp);
        while (touchInfo.historyTime.length > 10) {
            touchInfo.historyTime.shift();
            touchInfo.historyX.shift();
            touchInfo.historyY.shift();
        }

        if (touchInfo.listener && touchInfo.listener.onTouchMove)
            touchInfo.listener.onTouchMove(delta.x, delta.y, e.timeStamp);
    }

    function touchEnd(e) {
        if (touchInfo.trackingID == -1) return;
        e.preventDefault();
        var delta = findDelta(e);
        if (!delta) return;

        var listener = touchInfo.listener;
        touchInfo.trackingID = -1;
        touchInfo.listener = null;

        // Compute velocity in the most atrocious way. Walk backwards until we find a sample that's 30ms away from
        // our initial sample. If the samples are too distant (nothing between 30 and 50ms away then blow it off
        // and declare zero velocity. Same if there are no samples.
        var sampleCount = touchInfo.historyTime.length;
        var velocity = { x: 0, y: 0 };
        if (sampleCount > 2) {
            var idx = touchInfo.historyTime.length - 1;
            var lastTime = touchInfo.historyTime[idx];
            var lastX = touchInfo.historyX[idx];
            var lastY = touchInfo.historyY[idx];
            var found = false;
            while (idx > 0) {
                idx--;
                var t = touchInfo.historyTime[idx];
                var dt = lastTime - t;
                if (dt > 30 && dt < 50) {
                    // Ok, go with this one.
                    velocity.x = (lastX - touchInfo.historyX[idx]) / (dt / 1000);
                    velocity.y = (lastY - touchInfo.historyY[idx]) / (dt / 1000);
                    break;
                }
            }
        }
        touchInfo.historyTime = [];
        touchInfo.historyX = [];
        touchInfo.historyY = [];

        if (listener && listener.onTouchEnd)
            listener.onTouchEnd(delta.x, delta.y, velocity);
    }

    document.body.addEventListener('touchstart', touchStart, false);
    document.body.addEventListener('touchmove', touchMove, false);
    document.body.addEventListener('touchend', touchEnd, false);
    document.body.addEventListener('touchcancel', touchEnd, false);
    document.body.addEventListener('mousedown', touchStart, false);
    document.body.addEventListener('mousemove', touchMove, false);
    document.body.addEventListener('mouseup', touchEnd, false);
}

//
// This is a utility to normalize single-point touch events and mouse
// events and implement very simple velocity tracking on top. To do
// mouse we *must* install a global handler (otherwise you can quickly
// drag the mouse out of the object you're dragging and you lose the
// event stream), so just for symmetry we do the same with touch events.
//
// If I was writing a bigger app then I'd hope it was touch only and
// would register touch handlers directly on the objects that need them
// (although typically you have to do some global event handling anyway...).
//
// The `listener` object should implement `onTouchStart`, `onTouchMove` and
// `onTouchEnd` methods.
//
function addTouchOrMouseListener(element, listener) {
    registerGlobalListener();
    addListener(element, listener);
}


window.addTouchOrMouseListener = addTouchOrMouseListener;
})();




(function() {
  // var col1 = document.getElementById('col1');
  // var handler = new ScrollHandler(col1);
  // addTouchOrMouseListener(col1, handler);


  var data = [[],[],[]];

  for (var i = 1990; i <= 2016; i++) {
    data[0].push(i + '年');
  }
  for (var i = 1; i <= 12; i++) {
    data[1].push(i + '月');
  }
  for (var i = 1; i <= 31; i++) {
    data[2].push(i + '日');
  }

  var picker = document.getElementById('picker')
  picker.innerHTML = '';
  var height = (picker.offsetHeight - 34) / 2;
  var colEl = [];

  data.forEach(function(col, idx) {
    var div = document.createElement('div')
    div.className = 'weui-picker__group';

    var mask = document.createElement('div')
    mask.className = 'weui-picker__mask';
    mask.style.backgroundSize = '100% ' + height + 'px';
    div.appendChild(mask);

    var indicator = document.createElement('div');
    indicator.className = 'weui-picker__indicator'
    indicator.style.top = height + 'px'
    div.appendChild(indicator);

    var content = document.createElement('div');
    content.className = 'weui-picker__content';
    content.style.padding = height + 'px 0';
    div.appendChild(content);

    col.forEach(function(item) {
      var div = document.createElement('div')
      div.className = 'weui-picker__item';
      div.innerText = item;
      content.appendChild(div);
      colEl.push(content);
    });

    picker.appendChild(div);
  })

  colEl.forEach(function(el) {
    addTouchOrMouseListener(el, new ScrollHandler(el, height))
  })






})();


















