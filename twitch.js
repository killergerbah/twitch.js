/// <reference path="Scripts/linq.js" />
/// <reference path="jquery-1.8.0.min.js" />
/// <reference path="jquery.gamequery-0.7.0.js" />
/// <reference path="Scripts/linq.jquery.js" />

//TODO: Multi-hit targets
//      Update scoring system to include target speed, chaining
//      Punish missing by adding delay of some sort till next shot
//      Sounds (for hits, misses, target generation, target removal)
WebFontConfig = {
    google: { families: ['Share'] }
};

var PLAYGROUND_WIDTH = 600;
var PLAYGROUND_HEIGHT = 360;
var REFRESH_RATE = 30;
var MAX_SPEED = 500;
var GAME_SPEED = 1;
var TIME_INTERVAL = REFRESH_RATE * GAME_SPEED / 1000;
var GRAVITY_ACCELERATION = 300;
var MAX_DIFFICULTY = 3;
var DIRECTIONAL_VARIATION = 2;
var BOUNCY_TARGET_HITS_REQUIRED = 3;
var BOUNCY_TARGET_BOUNCE_FORCE = 350;
var scoreCategories = {
	sick:0, ok:1, shit:2, snorlax:3
};
var scoreMap = [50, 10, 5, 1];
var spriteOptions = {
	normal: { animation: new $.gQ.Animation({ imageURL: "sprites/normal.png" }), width: 50, height: 50, posx: -9999, posy: -9999 }
};
var positionFunctions = {
	//Returns function of time that computes projectile position with gravity
	projectile: function (translateVector, directionVector, mass) {
		var speed = directionVector.magnitude();
		var cosT = directionVector.x / speed;
		var sinT = directionVector.y / speed;
		//console.log(directionVector);
		return function (t) {
			return translateVector.add(new Vector(speed * t * cosT, (speed * t * sinT) + (.5 * GRAVITY_ACCELERATION * mass * t * t)));
		};
	}
}
//Convert object to vector
function toVector( xy ){
    return new Vector(xy.x, xy.y);
}

//Map jQuery objects to corresponding game objects
function ObjectMap(){
	this.objectMap = {};
}
ObjectMap.prototype.getObject = function($elem) {
    return this.objectMap[$elem.attr("id")];
}

ObjectMap.prototype.addObject = function($elem, object) {
    this.objectMap[$elem.attr("id")] = object;
}

ObjectMap.prototype.deleteObject = function($elem) {
    delete this.objectMap[$elem.attr("id")];
}

function generateId(type) {
    return type + Math.floor(Math.random() * 10000);
}




//Game internals
function GameState(difficulty, timeLimit) {
    this.objectMap = new ObjectMap();
    this.timeLimit = timeLimit;
    this.stats = { score: 0, totalTimeToHit: 0, longestChain: null, numClicks: 0, numHits: 0 };
    this.$targets = $("#targets");
    this.$playground = $("#playground");
    this.paused = false;
    this.gameHud = new GameHud(this);
    this.targetGenerator = new TargetGenerator(this, difficulty);
}
GameState.prototype.start = function () {
    var that = this;
    this.targetGenerator.start();
    this.gameHud.start();
    this.$playground.click(function () { that.updateStats.call(that); });
    setTimeout(function () { that.end.call(that); }, this.timeLimit * 1000); //time limit is in seconds
}
GameState.prototype.end = function () {
    this.targetGenerator.end();
    this.gameHud.end();
    this.$playground.off("click");
    $(".target").off();
    this.paused = true;
}
GameState.prototype.scoreCategory = function( reactionTime ){
	if(reactionTime < 200){
		return scoreCategories.sick;
	}
	else if(reactionTime < 500){
		return scoreCategories.ok;
	}
	else if(reactionTime < 1000){
		return scoreCategories.shit;
	}
	return scoreCategories.snorlax;
}
GameState.prototype.updateStats = function (target) {
    if (!target) {
        this.stats.numClicks++;
        return;
    }
    var now = new Date().getTime();
    var reaction = now - target.start;
    this.stats.totalTimeToHit += reaction;
    this.stats.numHits++;
	var category = this.scoreCategory( reaction );
	var diff = scoreMap[category];
	this.stats.score += diff;
	this.gameHud.updateStats();
    
	var xy = target.$elem.xy();
	this.gameHud.displayScore(category, diff, { x: xy.x, y: xy.y - 25 } );
};
GameState.prototype.addTarget = function (type, xy) {
    var targetId = generateId("target");
    var $target, target;
    if (type === "normal") {
        this.$targets.addSprite(targetId, spriteOptions.normal);
        $target = $("#" + targetId).addClass("target").xy(xy.x, xy.y);
        target = new NormalTarget(this, $target);
        this.objectMap.addObject($target, target);
    }
    else if (type == "bouncy") {
        this.$targets.addSprite(targetId, spriteOptions.normal);
        $target = $("#" + targetId).addClass("target").xy(xy.x, xy.y);
        target = new BouncyTarget(this, $target, BOUNCY_TARGET_HITS_REQUIRED);
        this.objectMap.addObject($target, target);
    }
	return target;
};



function GameHud(game){
	this.game = game;
	this.$score = $("#score");
	this.$hud = $("#hud");
	this.$targets = $("#targets");
	this.timer = new GameTimer(this.game.timeLimit);
}
//For now
GameHud.prototype.start = function () {
    this.$hud.append(this.timer.$elem);
    this.timer.start();
}
GameHud.prototype.end = function () {
    var stats = this.game.stats;
    var $stats = $("<div id=\"stats\"><div id=\"statsTitle\">Result</div><div id=\"statsStats\">Score: " + stats.score + "<br />Accuracy: " + ( stats.numHits / stats.numClicks ) + "<br />Average time to hit: " + ( stats.totalTimeToHit / stats.numClicks ) + "<br />Number of clicks: " + stats.numClicks + "<div id=\"statsClose\">Done</div></div></div>");
    $stats.css({ position: "relative", "top": 50 });
    $stats.appendTo(this.$targets);
        
    $("#statsClose").one("click", function () { $stats.remove(); });
}
GameHud.prototype.updateStats = function(){
	console.log(this.$score);
	this.$score.text(this.game.stats.score.toString());
};
GameHud.prototype.displayScore = function (category, score, xy) {
    $("<div style=\"position:absolute;top:" + xy.y + "px;left:" + xy.x + "px;\" class=\"score score" + category + "\">" + score + "</div>")
        .appendTo(this.$hud)
        .animate({ top: xy.y - 15 }, { duration: 500, easing: "linear", complete: function () { $(this).remove(); } });
}




function GameTimer(timeLimit) {
    this.currentTime = timeLimit;
    this.$elem = $("<div class=\"timer hudText\"></div>");
    this.ticker;
}
GameTimer.prototype.start = function () {
    var that = this;
    setTimeout(function () { that.end.call(that); }, this.currentTime * 1000);
    this.$elem.text(this.currentTime.toString());
    this.currentTime--;
    this.ticker = setInterval(function () {
        that.$elem.text(that.currentTime.toString());
        that.currentTime--;
    }, 1000);
}
GameTimer.prototype.end = function () {
    clearInterval(this.ticker);
    this.$elem.remove();
}
function TargetGenerator(game, difficulty){
	this.game = game;
	this.difficulty = difficulty;
	this.targetTimeout;
};




TargetGenerator.prototype.start = function(){
	var that = this;
	var difficulty = this.difficulty;
	var draw = Math.random();
	var translateVector, directionVector;
	if( draw > .5 ){ //from bottom
		translateVector = new Vector( Math.random() * (PLAYGROUND_WIDTH - 200) + 100, PLAYGROUND_HEIGHT );
		directionVector = new Vector( Math.random() * DIRECTIONAL_VARIATION * difficulty, -1 * Math.random() * difficulty * ( MAX_SPEED - 200 ) - 200  ); 
	}
	else{ //from left or right 
		var drawAgain = Math.random();
		var translateX = drawAgain > .5 ? -50 : PLAYGROUND_WIDTH;
		var direction = drawAgain > .5 ? 1 : -1;
		translateVector = new Vector( translateX, Math.random() * (PLAYGROUND_HEIGHT - 200) + 100 );
		directionVector = new Vector( direction * Math.random() * difficulty * ( MAX_SPEED - 100 ) + direction * 100, Math.random() * DIRECTIONAL_VARIATION * difficulty ); 
	}
	this.targetTimeout = setTimeout( function(){ 
	    var target = that.game.addTarget("normal", translateVector);
	    target.punt(directionVector);
		that.start();
	}, Math.random() * 2000 );
};
TargetGenerator.prototype.end = function () {
	clearTimeout(this.targetTimeout);
};
//2D vector
function Vector(x, y) {
    this.x = x;
    this.y = y;
}

Vector.prototype.add = function (vector) {
    return new Vector(this.x + vector.x, this.y + vector.y);
}

Vector.prototype.magnitude = function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
}

Vector.prototype.scale = function (constant) {
    return new Vector(this.x * constant, this.y * constant);
}
Vector.prototype.unit = function () {
    return this.scale(1 / this.magnitude());
}
Vector.prototype.toString = function () {
    return "(" + this.x + ", " + this.y + ")";
}

randomVector = function(maxMagnitude) {
    if (maxMagnitude) {
        var c = Math.sqrt(2) / 2;
        return new Vector((2 * Math.random() * c - 1) * maxMagnitude, (2 * Math.random() * c - 1) * maxMagnitude); 
    }
    return new Vector(Math.random() * PLAYGROUND_WIDTH, Math.random() * PLAYGROUND_HEIGHT);
}

//Compute the next x, y values
function Stepper(position, timeInterval) {
    this.time = 0;
	this.timeScale = 1;
    this.timeInterval = timeInterval;
    this.position = position;
    //console.log(this.position);
}

Stepper.prototype.step = function () {
    this.time += this.timeInterval * this.timeScale;
    //console.log(this.position);
    //console.log(this.position(this.time));
    return this.position(this.time);
}





//Targets to blow up
function Target(game, $elem, mass, stepper) {
    var that = this;
	this.game = game;
    this.$elem = $elem;
    this.stepper = stepper;
    this.mass = mass;
    this.start = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    setTimeout(function () { that.disposable = true; }, 500);
 }
//Remove object from DOM
Target.prototype.dispose = function () {
    var that = this;
    this.$elem.remove();
    this.game.objectMap.deleteObject(this.$elem);
    console.log("disposed");
};
//Blow target up and update score
 Target.prototype.explode = function () {
     var that = this;
     this.stepper.timeScale = .25;
     this.$elem.addClass("blink").off();
     this.game.updateStats(this);
     setTimeout(function () {
         that.dispose.call(that);
     }, 500);
 };
//Move target to next position
Target.prototype.step = function () {
    var vector = this.stepper.step();
    //console.log(vector.x);
    this.lastPosition = this.$elem.xy();
    this.$elem.xy(vector.x, vector.y);
};
//Returns instantaneous speed
Target.prototype.getSpeed = function () {
    return toVector(this.$elem.xy()).add(toVector(lastPosition).scale(-1)).magnitude() / this.stepper.timeInterval;
};
//Detect whether target is offscreen
Target.prototype.offPlayground = function () {
    return this.$elem.y() > PLAYGROUND_HEIGHT || this.$elem.x() > PLAYGROUND_WIDTH || this.$elem.x() < -1 * this.$elem.width() - 50 || this.$elem.y() < -1 * this.$elem.height() - 50;
};
//Punt target in direction indicated by directionVector
Target.prototype.punt = function (directionVector) {
    var xy = this.$elem.xy();
    var translateVector = new Vector(xy.x, xy.y);
    this.stepper = new Stepper(positionFunctions.projectile(translateVector, directionVector, this.mass), TIME_INTERVAL);
};
//Get center position as a vector
Target.prototype.positionAsVector = function () {
    var xy = this.$elem.xy();
    return new Vector(xy.x + 25, xy.y + 25);
}

//A target that explodes on click
function NormalTarget(game, $elem) {
    var that = this;
    this.game = game;
    this.$elem = $elem;
    this.stepper = null;
    this.start = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    this.mass = 1;   //mass of normal targets is 1
    setTimeout(function () { that.disposable = true; }, 500);
    //Explode on click
    this.$elem.one("mousedown", function () { that.explode.call(that); });
}

NormalTarget.prototype = new Target();

//A target that bounces when you hit it
function BouncyTarget(game, $elem, numHits) {
    var that = this;
    this.game = game;
    this.$elem = $elem;
    this.stepper = null;
    this.start = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    this.mass = 1;   //default mass to 1
    this.numHits = numHits; //number of hits needed
    setTimeout(function () { that.disposable = true; }, 500);
    //Explode on click
    this.$elem.on("mousedown", function (e) {
        var playgroundPos = that.game.$playground.offset();
        var mouseX = e.pageX - playgroundPos.left;
        var mouseY = e.pageY - playgroundPos.top;
        that.bounce(mouseX, mouseY);
    });
}

BouncyTarget.prototype = new Target();

BouncyTarget.prototype.bounce = function (mouseX, mouseY) {
    this.numHits--;
    if (this.numHits == 0) {
        this.explode();
    }
    else {
        var mousePosition = new Vector(-mouseX, -mouseY);
        console.log(this.positionAsVector().add(mousePosition).toString());
        this.punt(this.positionAsVector().add(mousePosition).unit().scale(BOUNCY_TARGET_BOUNCE_FORCE));
        this.game.updateStats(this);
    }
};

function loadFonts() {
    var wf = document.createElement('script');
    wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
        '://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
    wf.type = 'text/javascript';
    wf.async = 'true';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(wf, s);
}

$(function () {
    loadFonts();
    $("#playground").playground({ width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT, refreshRate: REFRESH_RATE });
    $.playground().addGroup("hud", { width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT })
		.end()
		.addGroup("targets", { width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT })
		.end();
		
	//Score display
    $("#hud").append("<div id=\"score\" class=\"hudText\">0</div>");
    //Disable text select cursor
    $("#playground")[0].onselectstart = function () { return false; };
	
	var game = new GameState(1, 60);
	game.start();
    $.playground().registerCallback(function () {
        $(".target").each(function () {
            if (!game.paused) {
                $this = $(this);
                var target = game.objectMap.getObject($this);
                target.step();
                if (target.disposable && target.offPlayground()) {
                    target.dispose();
                }
            }
		});
    }, REFRESH_RATE);
    //start the mothafuckin game
    $.playground().startGame();
});
