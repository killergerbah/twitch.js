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
var CHAIN_CLIP = 500;
var START_DIFFICULTY = 1;
var LEARNING_RATE = .02;
var scoreCategories = {
	sick:0, ok:1, shit:2, snorlax:3, chain:4
};
var spriteOptions = {
	normal: { animation: new $.gQ.Animation({ imageURL: "sprites/normal.png" }), width: 50, height: 50, posx: -9999, posy: -9999 },
	bouncy: { animation: new $.gQ.Animation({ imageURL: "sprites/bouncy.png" }), width: 50, height: 50, posx: -9999, posy: -9999 }
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

//Round to nearest nth digit
function round( num, digit){
	if(num){
		return Math.round(Math.pow(10, digit) * num) / Math.pow(10, digit);
	}
	return null;
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

function scoreCategory(reactionTime) {
    if (reactionTime < 200) {
        return scoreCategories.sick;
    }
    else if (reactionTime < 500) {
        return scoreCategories.ok;
    }
    else if (reactionTime < 1000) {
        return scoreCategories.shit;
    }
    return scoreCategories.snorlax;
}

//Holds a score along with associated category
function Score(score, category) {
    this.score = score;
    this.category = category;
};

//Game internals
function GameState(timeLimit) {
    this.objectMap = new ObjectMap();
    this.timeLimit = timeLimit;
    this.stats = { score: 0, totalTimeToHit: 0, numMisses: 0, numHits: 0, longestChain: 0, numDrops:0, numFrags:0, numTargets:0, totalLifeSpan:0 };
    this.$targets = $("#targets");
    this.$playground = $("#playground");
    this.paused = false;
    this.chainTimeout;
    this.chainLength = 0;
    this.gameHud = new GameHud(this);
    this.targetGenerator = new TargetGenerator(this);
};
GameState.prototype.start = function () {
    var that = this;
    this.targetGenerator.start();
    this.gameHud.start();
    this.$playground.click(function () { that.registerClick.call(that); });
    setTimeout(function () { that.end.call(that); }, this.timeLimit * 1000); //time limit is in seconds
};
GameState.prototype.end = function () {
    this.targetGenerator.end();
    this.gameHud.end();
    this.$playground.off("click");
    $(".target").off();
    this.paused = true;
};
GameState.prototype.updateStats = function (type, target) {
    if (type === "click") {
        console.log("click");
        this.stats.numMisses++;
        return;
    }
    if (type === "drop") {
        this.stats.numDrops++;
        this.stats.totalLifeSpan += target.getLifeSpan();
        return;
    }
    this.stats.numHits++;
    this.stats.totalTimeToHit += target.getIdleTime();
    this.stats.totalLifeSpan += target.getLifeSpan();
    var score = target.score();
    this.stats.score += score.score;
    if (target.exploded) {
        this.stats.numFrags++;
    }
  
	this.gameHud.updateStats();
    
	var xy = target.$elem.xy();
	this.gameHud.displayScore(score, { x: xy.x, y: xy.y - 25 });
};

GameState.prototype.addTarget = function (type, xy) {
    this.stats.numTargets++;
    var targetId = generateId("target");
    var $target, target;
    if (type === "normal") {
        this.$targets.addSprite(targetId, spriteOptions.normal);
        $target = $("#" + targetId).addClass("target").xy(xy.x, xy.y);
        target = new NormalTarget(this, $target);
        this.objectMap.addObject($target, target);
    }
    else if (type === "bouncy") {
        this.$targets.addSprite(targetId, spriteOptions.bouncy);
        $target = $("#" + targetId).addClass("target").xy(xy.x, xy.y);
        target = new BouncyTarget(this, $target, BOUNCY_TARGET_HITS_REQUIRED);
        this.objectMap.addObject($target, target);
    }
	return target;
};
GameState.prototype.registerHit = function (target) {
    this.targetGenerator.tickle();
    this.updateCurrentChain();
    this.updateStats("hit", target);
};
GameState.prototype.registerClick = function () {
    // console.log("click")
    this.targetGenerator.soothe();
    this.updateStats("click");
};
GameState.prototype.registerDrop = function (target) {
    this.targetGenerator.soothe();
    this.updateStats("drop", target);
};
GameState.prototype.updateCurrentChain = function () {
    var that = this;
    clearTimeout(this.chainTimeout);
    this.chainTimeout = setTimeout(function () { that.chainLength = 0; }, CHAIN_CLIP);
    this.chainLength++;
    if (this.chainLength > this.stats.longestChain) {
        this.stats.longestChain = this.chainLength;
    }
};

GameState.prototype.currentChainLength = function () {
    return this.chainLength;
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
    var that = this;
	this.$targets.css("opacity", .5);
	this.$score.remove();
	var timeUp = $("<div style=\"position:relative;text-align:center;width:100px;margin-left:auto;margin-right:auto;top:45%;\">Time's up!</div>");
	this.$hud.append(timeUp);
	setTimeout(function(){
		var menu = new Menu(that.$hud.removeClass("unsolid"));
		menu.title("result");
		timeUp.remove();
		var detailsId = generateId("details");
		var scoreId = generateId("score");
		var stats = that.game.stats;
		menu.content("<div id=\"" + scoreId + "\" style=\"text-align:center;\"><h1>Score <span style=\"font-weight:bold;\">" + stats.score + "</span></h1></div>" +
            "<table id=\"" + detailsId + "\" style=\"display:none;padding-right:5px;margin-left:auto;margin-right:auto;\">" +
			"<tr><td>Score</td><td style=\"font-weight:bold;\">" + stats.score + "</td></tr>" + 
			"<tr><td>Accuracy</td><td style=\"font-weight:bold;\">" + ( round(stats.numHits / ( stats.numHits + stats.numMisses), 2) || "n/a") + "</td></tr>" +
			"<tr><td>Average time till touch</td style=\"font-weight:bold;\"><td style=\"font-weight:bold;\"> " + ( round(stats.totalTimeToHit / stats.numHits, 1) || "n/a" )  + "</td></tr>" + 
			"<tr><td>Total clicks</td><td style=\"font-weight:bold;\">" + (stats.numHits + stats.numMisses) + "<br/>" + 
			"<tr><td>Longest chain</td><td style=\"font-weight:bold;\"> " + stats.longestChain + "</td></tr>" + 
			"<tr><td>Difficulty</td><td style=\"font-weight:bold;\"> " + round(that.game.targetGenerator.difficulty, 2) + "</td></tr>" + 
			"<tr><td>Total dropped</td><td style=\"font-weight:bold;\">" + stats.numDrops + "</td></tr>" + 
			"<tr><td>Total eliminated</td><td style=\"font-weight:bold;\">"+stats.numFrags + "</td></tr>" + 
			"<tr><td>Total generated</td><td style=\"font-weight:bold;\">" + stats.numTargets + "</td></tr>" +
			"<tr><td>Average lifespan</td><td style=\"font-weight:bold;\">" + (round(stats.totalLifeSpan / stats.numTargets, 1) || "n/a") + "</td></tr>" +
			"</table>"
		);
		var $details = menu.$content.find("#" + detailsId);
		var $score = menu.$content.find("#" + scoreId);
		menu.addButton("done", function () { this.hide(); titleScreen(); }, menu);
		menu.addButton("details", function () {
		    if ($score.css("display") === "block") {
		        this.text("back");
		        $details.show();
		        $score.hide();
		        menu.position();
		    }
		    else {
		        this.text("details");
		        $details.hide();
		        $score.show();
		        menu.position();
		    }
		});
		menu.show();
	}, 2000);
}
GameHud.prototype.updateStats = function(){
	console.log(this.$score);
	this.$score.text(this.game.stats.score.toString());
};
GameHud.prototype.displayScore = function (score, xy) {
    $("<div style=\"position:absolute;top:" + xy.y + "px;left:" + xy.x + "px;\" class=\"score score" + score.category + "\">" + score.score + "</div>")
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
function TargetGenerator(game){
	this.game = game;
	this.targetTimeout;
	this.difficulty = START_DIFFICULTY;
};

TargetGenerator.prototype.start = function(){
	var that = this;
	var draw = Math.random();
	var translateVector, directionVector;
	if( draw > .5 ){ //from bottom
		translateVector = new Vector( Math.random() * (PLAYGROUND_WIDTH - 200) + 100, PLAYGROUND_HEIGHT );
		directionVector = new Vector( Math.random() * DIRECTIONAL_VARIATION, -1 * Math.random() * ( MAX_SPEED - 200 ) - 200  ); 
	}
	else{ //from left or right 
	    draw = Math.random();
	    var translateX, direction;
	    if (draw > .5) {
	        translateX = -50;
	        direction = 1;
        }
	    else {
	        direction = -1;
	        translateX = PLAYGROUND_WIDTH;
	    }
		translateVector = new Vector( translateX, Math.random() * (PLAYGROUND_HEIGHT - 200) + 100 );
		directionVector = new Vector( direction * Math.random() * ( MAX_SPEED - 100 ) + direction * 100, Math.random() * DIRECTIONAL_VARIATION ); 
	}
	this.targetTimeout = setTimeout(function () {
	    draw = Math.random();
	    var target = draw > .9 ? that.game.addTarget("bouncy", translateVector) : target = that.game.addTarget("normal", translateVector);
	    target.punt(directionVector);
		that.start();
	}, Math.random() * 2000 / this.difficulty );
};
TargetGenerator.prototype.tickle = function () {
    this.difficulty += 2 * LEARNING_RATE;
}
TargetGenerator.prototype.soothe = function () {
    this.difficulty = Math.max(.5, this.difficulty - LEARNING_RATE);
}
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
    this.lastTouched = new Date().getTime();
    this.generated = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    this.exploded = false;
    setTimeout(function () { that.disposable = true; }, 500);
 }
//Remove object from DOM
Target.prototype.dispose = function () {
    var that = this;
    if (!this.exploded) {
        this.game.registerDrop(this);
    }
    this.$elem.remove();
    this.game.objectMap.deleteObject(this.$elem);
    console.log("disposed");
};
//Blow target up and update score
 Target.prototype.explode = function () {
     var that = this;
     this.stepper.timeScale = .25;
     this.exploded = true;
     this.$elem.addClass("blink unsolid").off();
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
//Get amount of time since last touched
Target.prototype.getIdleTime = function () {
    var idleTime = new Date().getTime() - this.lastTouched;
    return idleTime;
}
//Get target lifespan
Target.prototype.getLifeSpan = function () {
    var lifeSpan = new Date().getTime() - this.generated;
    return lifeSpan;
}

//A target that explodes on click
function NormalTarget(game, $elem) {
    var that = this;
    this.game = game;
    this.$elem = $elem;
    this.stepper = null;
    this.lastTouched = new Date().getTime();
    this.generated = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    this.mass = 1;   //mass of normal targets is 1
    this.reaction = null;
    setTimeout(function () { that.disposable = true; }, 500);
    //Explode on click
    this.$elem.one("mousedown", function () {
        that.explode.call(that);
        that.game.registerHit(that);
    });
}

NormalTarget.prototype = new Target();

NormalTarget.prototype.score = function () {
    var now = new Date().getTime();
    var reaction = now - this.lastTouched;
    var category = scoreCategory(reaction);
    var score = 0;
    if (category == scoreCategories.sick) {
        score += 50;
    }
    else if (category == scoreCategories.ok) {
        score += 10;
    }
    else if (category == scoreCategories.shit) {
        score += 5;
    }
    else if (category == scoreCategories.snorlax) {
        score += 1;
    }
    var chainLength = this.game.currentChainLength();
    console.log(chainLength);
    if (chainLength > 1) {
        score += 2 * (chainLength - 1);
        return new Score(score, scoreCategories.chain);
    }
    return new Score(score, category);
};

//A target that bounces when you hit it
function BouncyTarget(game, $elem, numHits) {
    var that = this;
    this.game = game;
    this.$elem = $elem;
    this.stepper = null;
    this.lastTouched = new Date().getTime();
    this.generated = new Date().getTime();
    this.lastPosition = null;
    this.disposable = false;
    this.mass = 1;   //default mass to 1
    this.numHits = numHits; //number of hits needed
    setTimeout(function () { that.disposable = true; }, 500);
    
    this.$elem.on("mousedown", function (e) {
        var playgroundPos = that.game.$playground.offset();
        var mouseX = e.pageX - playgroundPos.left;
        var mouseY = e.pageY - playgroundPos.top;
        that.numHits--;
        that.bounce(mouseX, mouseY);
        that.game.registerHit(that);
        that.lastHit = new Date().getTime();
    });
}

BouncyTarget.prototype = new Target();

BouncyTarget.prototype.score = function () {
    var now = new Date().getTime();
    var reaction = now - this.lastTouched;

  
    console.log(reaction);
    var score = 0;
    if (this.numHits == 0) {
        score += 15;
    }
    var category = scoreCategory(reaction);
    if (category == scoreCategories.sick) {
        score += 10;
    }
    else if (category == scoreCategories.ok) {
        score += 5;
    }
    else if (category == scoreCategories.shit) {
        score += 3;
    }
    else if (category == scoreCategories.snorlax) {
        score += 1;
    }
    var chainLength = this.game.currentChainLength();
    if (chainLength > 1) {
        score += (chainLength - 1);
        return new Score(score, scoreCategories.chain);
    }
    console.log(category);
    return new Score(score, category);
}

//Either causes target to explode or punts target in new direction
//depending on numHits field
BouncyTarget.prototype.bounce = function (mouseX, mouseY) {
    if (this.numHits == 0) {
        this.explode();
    }
    else {
        //Change trajectory of target depending on mouse position
        var mousePosition = new Vector(-mouseX, -mouseY);
        console.log(this.positionAsVector().add(mousePosition).toString());
        this.punt(this.positionAsVector().add(mousePosition).unit().scale(BOUNCY_TARGET_BOUNCE_FORCE));
    }
};

function Menu($parent){
	this.$parent = $parent;
	this.id = generateId("menu");
	this.$elem = $("<div id=\"" + this.id + "\" class=\"menu\">" +
        "<div id=\"menuHeader" + this.id +"\" class=\"menuHeader\"></div>" + 
        "<div id=\"menuContent" + this.id + "\" class=\"menuContent\">" +
        "</div>" + 
        "<table class=\"menuButtons\"><tr></tr></table>" + 
        "</div>");
	this.$header = this.$elem.find(".menuHeader");
	this.$content = this.$elem.find(".menuContent");
	this.$buttons = this.$elem.find(".menuButtons").find("tr");
}

Menu.prototype.show = function(){
    if(this.$parent.find("#menu" + this.id).length == 0){
        this.$elem.appendTo(this.$parent);
    }
    this.position();
    this.$elem.show();
};

Menu.prototype.hide = function () {
    this.$elem.hide();
};

Menu.prototype.position = function () {
    this.$elem.css("top", (PLAYGROUND_HEIGHT - this.$elem.height()) / 2);
};

Menu.prototype.title = function (title) {
    this.$header.text(title);
};

Menu.prototype.content = function(content){
	this.$content.html(content);
};

Menu.prototype.remove = function () {
    this.$elem.remove();
};

Menu.prototype.addButton = function(name, callback, obj){
    var that = this;
	var id = "menu" + name + Math.floor(Math.random() * 100);
	var $button = $("<div id=\"" + id + "\" class=\"menuButton\"></div>").text(name)
        .wrap("td")
        .appendTo(this.$buttons);
	obj = obj || $button;
	$button.click(function(){callback.call(obj)});
	return $button;
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

function titleScreen() {
	var menu = new Menu($("#playground"));
	menu.title("twitch");
	var countDown = function(timeLeft){
		var that = this;
		if(timeLeft){
			this.text(timeLeft.toString());
			timeLeft--;
		}
		setTimeout( function(){ countDown.call(that, timeLeft); }, 1000 );
	}
	menu.addButton("play", function() { 
		countDown.call(this, 3);
		setTimeout(function(){
			menu.remove();
			play(60);
		}, 3000);
	});
	menu.show();
}

function play(timeLimit) {
    $.playground().clearAll(true)
      .addGroup("targets", { width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT })
      .end()
      .addGroup("hud", { width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT })
          .addClass("unsolid")
      .end();
    
    $.playground().registerCallback(function () {
        //move each target to its next position
        $(".target").each(function () {
            if (game && !game.paused) {
                $this = $(this);
                var target = game.objectMap.getObject($this);
                target.step();
                if (target.disposable && target.offPlayground()) {
                    //remove offscreen targets from the DOM
                    target.dispose();
                }
            }
        });
    }, REFRESH_RATE);
    
    //Score display
    $("#hud").append("<div id=\"score\" class=\"hudText\">0</div>");
    //Disable text select cursor
    $("#playground")[0].onselectstart = function () { return false; };
    var game = new GameState(timeLimit);

    $.playground().startGame(function () { $("#titleScreen").remove(); $(".target").remove(); game.start(); });
}

$(function () {
    loadFonts();
    $("#playground").playground({ width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT, refreshRate: REFRESH_RATE });
    titleScreen();
});
