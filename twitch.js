/// <reference path="Scripts/linq.js" />
/// <reference path="jquery-1.8.0.min.js" />
/// <reference path="jquery.gamequery-0.7.0.js" />
/// <reference path="Scripts/linq.jquery.js" />


var PLAYGROUND_WIDTH = 500;
var PLAYGROUND_HEIGHT = 300;
var REFRESH_RATE = 30;
var MAX_SPEED = 40;
var GAME_SPEED = 1;
var TIME_INTERVAL = REFRESH_RATE * GAME_SPEED / 1000;
var GRAVITY_ACCELERATION = 200;

var targetTypes = { Normal: "NormalTarget" };
var spriteOptions = {};
var objectMap = {};

spriteOptions[targetTypes.Normal] = { animation: new $.gQ.Animation({ imageURL: "sprites/normal.png" }), width: 30, height: 30, posx: -9999, posy: -9999 };

//Helpers
function randomVector(maxMagnitude) {
    if (maxMagnitude) {
        var c = Math.sqrt(2) / 2;
        return new Vector(Math.random() * c * maxMagnitude, Math.random() * c * maxMagnitude); 
    }
    return new Vector(Math.random() * PLAYGROUND_WIDTH, Math.random() * PLAYGROUND_HEIGHT);
}

function getObject($elem) {
    return objectMap[$elem.attr("id")];
}

function addObject($elem, object) {
    objectMap[$elem.attr("id")] = object;
}

function deleteObject($elem) {
    delete objectMap[$elem.attr("id")];
}

function generateId(type) {
    return type + Math.floor(Math.random() * 10000);
}

function positionWithGravity(translateVector, directionVector) {
    var speed = directionVector.magnitude();
    var cosT = directionVector.x / speed;
    var sinT = directionVector.y / speed;
    //console.log(directionVector);
    return function (t) {
        return translateVector.add(new Vector(speed * t * cosT, -speed * t * sinT + .5 * GRAVITY_ACCELERATION * t * t));
    };
}

function getOptions(type) {
    return spriteOptions[type];
}

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

//Compute x, y values
function Stepper(position, timeInterval) {
    this.time = 0;
    this.timeInterval = timeInterval;
    this.position = position;
    //console.log(this.position);
}

Stepper.prototype.step = function () {
    this.time += this.timeInterval;
    //console.log(this.position);
    //console.log(this.position(this.time));
    return this.position(this.time);
}

//Targets to blow up
function Target($elem, stepper) {
    var that = this;
    this.$elem = $elem;
    this.$elem.mousedown(function () { that.explode.call(that) });
    this.stepper = stepper;
 }

 Target.prototype.explode = function () {
     //TODO: implement explode
     this.$elem.remove();
     deleteObject(this.$elem);
 }

 Target.prototype.step = function () {
     var vector = this.stepper.step();
     //console.log(vector.x);
     this.$elem.xy(vector.x, vector.y);
 }

$(function () {
    $("#playground").playground({ width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT, refreshRate: REFRESH_RATE });
    $.playground().addGroup("targets", { width: PLAYGROUND_WIDTH, height: PLAYGROUND_HEIGHT });
    $.playground().registerCallback(function () {
        var targetId = generateId("target");
        $("#targets").addSprite(targetId, getOptions(targetTypes.Normal));
        $("#" + targetId).addClass("target").addClass("black");
        objectMap[targetId] = new Target($("#" + targetId), new Stepper(positionWithGravity(randomVector(), randomVector(100)), TIME_INTERVAL));
        console.log("new target");
    }, 1000);
    $.playground().registerCallback(function () {
        $(".target").each(function () { getObject($(this)).step(); });
    }, REFRESH_RATE);
    //start the mothafuckin game
    $.playground().startGame();
});