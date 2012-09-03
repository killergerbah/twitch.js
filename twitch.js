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
var scoreCategories = {
	sick:0, ok:1, shit:2, snorlax:3
};
var scoreMap = [5000, 1000, 500, 100];
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
    this.targetGenerator = new TargetGenerator(this, difficulty);
    this.objectMap = new ObjectMap();
    this.gameHud = new GameHud(this);
    this.timeLimit = timeLimit;
    this.score = 0;
    this.$targets = $("#targets");
}
GameState.prototype.start = function () {
    var that = this;
    this.targetGenerator.start();
    this.gameHud.start();
    setTimeout(function () { that.end.call(that); }, this.timeLimit * 1000); //time limit is in seconds
}
GameState.prototype.end = function () {
    this.targetGenerator.end();
    this.gameHud.end();
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
GameState.prototype.updateScore = function( target ){
	var now = new Date().getTime();
	var category = this.scoreCategory( now - target.start );
	var diff = scoreMap[category];
	this.score += diff;
	console.log(this.score);
	this.gameHud.updateScore();
    
	var xy = target.$elem.xy();
	this.gameHud.displayScore(category, diff, { x: xy.x, y: xy.y - 25 } );
};
GameState.prototype.addTarget = function (type, xy) {
    var targetId = generateId("target");
    if (type === "normal") {
        this.$targets.addSprite(targetId, spriteOptions.normal);
        var $target = $("#" + targetId).addClass("target");
        var target = new NormalTarget(this, $target, xy);
        this.objectMap.addObject($target, target);
    }
	return target;
};





function GameHud(game){
	this.game = game;
	this.$score = $("#score");
	this.$hud = $("#hud");
	this.timer = null;
}
//For now
GameHud.prototype.start = function () {
    this.timer = new GameTimer(this.game.timeLimit);
    this.$hud.append(this.timer.$elem);
    this.timer.start();
}
GameHud.prototype.end = function () {

}
GameHud.prototype.updateScore = function(){
	console.log(this.$score);
	this.$score.text(this.game.score.toString());
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
		console.log("bottom");
		translateVector = new Vector( Math.random() * (PLAYGROUND_WIDTH - 200) + 100, PLAYGROUND_HEIGHT );
		directionVector = new Vector( Math.random() * DIRECTIONAL_VARIATION * difficulty, -1 * Math.random() * difficulty * ( MAX_SPEED - 200 ) - 200  ); 
	}
	else{ //from left or right 
		console.log("sides");
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
	console.log("translate " + translateVector.x + " " + translateVector.y + " direction " + directionVector.x + " " + directionVector.y);
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
function Target(game, $elem, xy, mass, stepper) {
    var that = this;
	this.game = game;
    this.$elem = $elem;
    this.stepper = stepper;
    this.xy = xy;
    this.mass = mass;
    this.start = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    setTimeout(function () { that.disposable = true; }, 500);
 }
//Minimalistically blow up target off screen
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
     this.$elem.addClass("blink");
     this.game.updateScore(this);
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
    this.stepper = new Stepper(positionFunctions.projectile(this.xy, directionVector, this.mass), TIME_INTERVAL);
    console.log(this.stepper);
};



function NormalTarget(game, $elem, xy) {
    var that = this;
    this.game = game;
    this.$elem = $elem;
    this.xy = xy;
    this.stepper = null;
    this.start = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    this.mass = 1;   //mass of normal targets is 1
    setTimeout(function () { that.disposable = true; }, 500);
    //Explode on click
    this.$elem.one("mousedown", function () { that.explode.call(that) });
}

NormalTarget.prototype = new Target();



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
	
	var game = new GameState(1, 60);
	game.start();

    $.playground().registerCallback(function () {
        $(".target").each(function () { 
            $this = $(this);
            var target = game.objectMap.getObject($this);
			target.step(); 
			if (target.disposable && target.offPlayground()) {
			    target.dispose();
			}
		});
    }, REFRESH_RATE);
    //start the mothafuckin game
    $.playground().startGame();
});
