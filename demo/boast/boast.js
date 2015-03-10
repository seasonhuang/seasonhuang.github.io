
var boastBtn = document.getElementById('boast-btn');

var RAF = (function(){
	return window.requestAnimationFrame       ||
	       window.webkitRequestAnimationFrame ||
	       window.mozRequestAnimationFrame    ||
	       window.msRequestAnimationFrame     ||
	       function (callback) {
	           var id = window.setTimeout( callback, 1000/60 );
	           return id;
	       }
})();


var Boast = {

	defaultOpt: {
		interval: 1000,
		nodeWidth: 100,
		during: 5000,
		nodeImageUrl: './fu.png'
	},

	easing: {
		'easeInQuad': function(x, t, b, c, d){
            return c*(t/=d)*t + b;
        },
        'easeOutQuad': function(x, t, b, c, d){
            return -c *(t/=d)*(t-2) + b;
        }
	},

	run: function(interval){

		interval = interval || Boast.options.interval;

		if (interval > 200) {
			interval -= 100;
		}

		Boast.timer = setTimeout(function(){
			Boast.initAnimation();
			Boast.run(interval);
		}, interval);
	},

	initAnimation: function(){

		var node = Boast.generateNode();
		var keyframeName = Boast.generateKeyframes();

		Boast.beginAnimation(node, keyframeName);
	},

	beginAnimation: function(node, name){

		Boast.ele.appendChild(node);

		var opt = Boast.options;
		var during = (opt.during/2*Math.random()|0);

        node.style.opacity = 1;
        node.style.animationFillMode = 'forwards';
        node.style.webkitAnimationFillMode = 'forwards';
        node.style.animationTimingFunction = 'linear';
        node.style.webkitAnimationTimingFunction = 'linear';
        node.style.animationName       = name;
        node.style.webkitAnimationName = name;
        node.style.animationDuration       = opt.during + during + 'ms';
        node.style.webkitAnimationDuration = opt.during + during + 'ms';
	},

	generateNode: function(){
		var opt  = Boast.options;
        var node = document.createElement('img');
        var width = (Math.random()*opt.nodeWidth|0) + opt.nodeWidth/2;
        var clientRect = Boast.btnClientRect;

        node.style.position = 'absolute';
        node.style.left = clientRect.left + clientRect.width /2 - width/2 + 'px';
        node.style.top  = clientRect.top  + 'px';
        node.style.width  = width + 'px';
        //node.style.height = node.style.width;
        node.src = opt.nodeImageUrl;

        return node;
	},

	generateKeyframes: function(){
		var clientRect = Boast.btnClientRect;
		var sheet = Boast.sheet;
        var maxWidth = Boast.options.nodeWidth;
        var left  = clientRect.left + clientRect.width/2 + maxWidth;
        var top   = clientRect.top  + maxWidth;
        var theta = Math.PI/2 * Math.random() + Math.PI/4;  
        var radiu = Math.sqrt( top*top + left*left );
        var x = radiu * Math.cos(theta);
        var y = radiu * Math.sin(theta);


        var keyframeName = 'node' + (Boast.nodeNum++);
        var length = sheet.rules.length;
        
        sheet.insertRule('@-webkit-keyframes ' + keyframeName + ' {}', length);

        var keyframe = sheet.rules[length];
        
        var b = x / (-0.5*y*y + y);
        var a = -b / 2;
        var rotate = a*180/Math.PI * 10000;
        var tx = 1, bx = 0, cx = y, dx = Boast.options.during;

        Boast.insertKeyframe(keyframe,a,b,tx,bx,cx,dx,rotate);

        return keyframeName;
	},

	insertKeyframe: function(keyframe,a,b,tx,bx,cx,dx,rotate){

		var i, style, by, transform;

        var br = 0, cr = rotate;

        for (i=0; i<101; i+=5) {

            by = a*bx*bx + b*bx;
            transform = 'translate3d('+by+'px,'+(-bx)+'px,0) rotate('+br+'deg);';

            style = i + '% {' + '-webkit-transform:' + transform + ';transform:' + transform + ';}';
            (keyframe.insertRule || keyframe.appendRule).call(keyframe, style);

            tx += dx/20;
            bx = Boast.easing['easeOutQuad'](null, tx, bx, cx, dx);
            br = Boast.easing['easeInQuad'] (null, tx, br, cr, dx);

        }
	},

	init: function(){

		if (!Boast.ele) {
			var div = document.createElement('div');
				div.style.position = 'absolute';
				div.style.zIndex = 9;
			document.body.appendChild(div);
			Boast.ele = div;
		}
		
		if (!Boast.sheet) {
			var style = document.createElement('style');
			document.head.appendChild(style);
			Boast.sheet = style.sheet;
		}

		if (!Boast.btnClientRect) {
			Boast.btnClientRect = Boast.btn.getBoundingClientRect();
		}


		Boast.nodeNum = 0;
		
	},

	start: function(opt){

		Boast.options = Boast.defaultOpt;
		for (var key in opt) {
			if (opt.hasOwnProperty(key)) Boast.options[key] = opt[key];
		}

		var btn = Boast.btn = opt.btn;

		btn.style.zIndex = 10;

		btn.addEventListener('touchstart', function(e){
			e.preventDefault();
			btn.classList.add('btn_pressed');

			Boast.init();
			Boast.run();

			opt.onRunning && opt.onRunning();
		});

		btn.addEventListener('touchmove', function(e){
			e.preventDefault();
		});

		btn.addEventListener('touchend', function(){
			btn.classList.remove('btn_pressed');
			Boast.stop();
		});

		btn.addEventListener('touchcancel', function(){
			btn.classList.remove('btn_pressed');
			Boast.stop();
		});

	},

	stop: function(){
		clearTimeout(Boast.timer);
	}

};



Boast.start({
	btn: document.getElementById('boast-btn')
});	