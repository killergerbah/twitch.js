/// <reference path="Scripts/linq.js" />
/// <reference path="jquery-1.8.0.min.js" />
/// <reference path="jquery.gamequery-0.7.0.js" />
/// <reference path="Scripts/linq.jquery.js" />


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
			return translateVector.add(new Vector(speed * t * cosT, -speed * t * sinT + .5 * GRAVITY_ACCELERATION * mass * t * t));
		};
	}
}
//Random choice of -1 or 1
function flip(){
	var chance = Math.random();
	return chance < .5 ? -1 : 1;
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

//Detect when off the map
function offPlayground($elem){
	return $elem.y() > PLAYGROUND_HEIGHT || $elem.x() > PLAYGROUND_WIDTH || $elem.x() < -1 * $elem.width() || $elem.y() < -1 * $elem.height();
}
//Game internals
function GameState(){
	this.objectMap = new ObjectMap();
	this.gameHud = new GameHud(this);
	this.score = 0;
	this.$targets = $("#targets");
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
	this.gameHud.displayScore( category, target.$elem.xy() );
};
GameState.prototype.addTarget = function( stepper ){
	var targetId = generateId("target");
	this.$targets.addSprite(targetId, spriteOptions.normal);
	var $target = $("#" + targetId).addClass("target");
	this.objectMap.addObject($target, new Target(this, $target, stepper));
};
function GameHud(game){
	this.game = game;
	this.$score = $("#score");
	this.$hud = $("#hud");
}
GameHud.prototype.updateScore = function(){
	console.log(this.$score);
	this.$score.text(this.game.score.toString()).css("font-size", 40).animate( { fontSize: 36 }, 400 );
};
GameHud.prototype.displayScore = function( diff, xy ) {
	
}
function TargetGenerator(game, difficulty){
	this.game = game;
	this.difficulty = difficulty;
	this.targetTimeout;
};
TargetGenerator.prototype.start = function(){
	var that = this;
	var difficulty = this.difficulty;
	var draw = Math.floor(Math.random() * difficulty) % 3;
	var translateVector, directionVector;
	if( draw == 0 ){ //from bottom
		console.log("bottom");
		translateVector = new Vector( Math.random() * (PLAYGROUND_WIDTH - 200) + 100, -50 );
		directionVector = new Vector( Math.random() * DIRECTIONAL_VARIATION * difficulty, -1 * Math.random() * difficulty * ( MAX_SPEED - 100 ) - 100  ); 
	}
	else if ( draw == 1 ){ //from left or right 
		console.log("sides");
		var drawAgain = Math.random();
		var translateX = drawAgain > .5 ? -50 : PLAYGROUND_WIDTH;
		var direction = drawAgain > .5 ? 1 : -1;
		translateVector = new Vector( translateX, Math.random() * (PLAYGROUND_HEIGHT - 200) + 100 );
		directionVector = new Vector( direction * Math.random() * difficulty * ( MAX_SPEED - 100 ) + direction * 100, Math.random() * DIRECTIONAL_VARIATION * difficulty ); 
	}
	else { //from top
		console.log("top");
		translateVector = new Vector( Math.random() * (PLAYGROUND_WIDTH - 200) + 100, -50 );
		directionVector = new Vector( Math.random() * DIRECTIONAL_VARIATION * difficulty, Math.random() * difficulty * ( MAX_SPEED - 100 ) + 100  ); 
	}
	var mass = Math.random() * 1 + difficulty;
	var position = positionFunctions.projectile( translateVector, directionVector, mass );
	this.targetTimeout = setTimeout( function(){ 
		that.game.addTarget( new Stepper( position, TIME_INTERVAL )); 
		that.start();
	}, 1 / difficulty * 3000 + 1 / difficulty * 1000 );
	console.log("translate " + translateVector.x + " " + translateVector.y + " direction " + directionVector.x + " " + directionVector.y);
};

TargetGenerator.prototype.stop = function(){
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
function Target(game, $elem, stepper) {
    var that = this;
	this.game = game;
    this.$elem = $elem;
    this.stepper = stepper;
	this.start = new Date().getTime();
	//Explode on click
	this.$elem.mousedown(function () { that.explode.call(that) });
 }
//Minimalistically blow up target off screen
 Target.prototype.explodeSilently = function() {
	var that = this;
	this.$elem.remove();
	this.game.objectMap.deleteObject(this.$elem);
	delete this.stepper;
	console.log("exploded silently");
 }
//Blow target up and update score
Target.prototype.explode = function(){
	var that = this;
	this.stepper.timeScale = .25;
    this.$elem.addClass("blink");
	this.game.updateScore(this);
	setTimeout(function(){
		that.explodeSilently.call(that);
	}, 500);
 }
//Move target to next position
Target.prototype.step = function () {
    var vector = this.stepper.step();
    //console.log(vector.x);
    this.$elem.xy(vector.x, vector.y);
}

$(function () {
    $("#playground").playground({ width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT, refreshRate: REFRESH_RATE });
    $.playground().addGroup("hud", { width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT })
		.end()
		.addGroup("targets", { width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT })
		.end();
		
	//Score display
	$("#hud").append("<div id=\"score\">0</div>");
	
	var game = new GameState();
    var generator = new TargetGenerator(game, 3);
	generator.start();
    $.playground().registerCallback(function () {
        $(".target").each(function () { 
			$this = $(this);
			game.objectMap.getObject($this).step(); 
			if(offPlayground($this)){
				game.objectMap.getObject($this).explodeSilently();
			}
		});
    }, REFRESH_RATE);
    //start the mothafuckin game
    $.playground().startGame();
});