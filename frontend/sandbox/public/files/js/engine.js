/*
Copyright (C) 2025  Marcus Alexander Dahl <@programkode>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

//# index.html

//#-----------------------------------------------------------------------------
//# Global configuration
const FPS = 60;
const UPS = 20;
var __loopLimit = 1_000_000;


// Initial color and font used, also used as defaults
// defaults to light color scheme, adjusts to color-schema changes

const __COLOR__ = {
    text: "#ffffff",
    background: "#242424",
};

const __FONT__ = {
    name: "Arial",
    size: "30px",
    color: __COLOR__.text,
};


//#-----------------------------------------------------------------------------
//# DEFAULTS
const __DEFAULTS__ = {};

__DEFAULTS__.textColorextColor = __COLOR__.text;
__DEFAULTS__.strokeColor = __COLOR__.text;
__DEFAULTS__.fillColor = __COLOR__.text;
__DEFAULTS__.backgroundColor = __COLOR__.background;
__DEFAULTS__.textAlignment = "left";
__DEFAULTS__.font = `${__FONT__.size} ${__FONT__.name}`;


//#-----------------------------------------------------------------------------
//# Cache
const resizeFunctions = [];

const keyDownMap = {
    name: {},
    code: {},
};

const keyUpMap = {
    name: {},
    code: {},
};

const mouseDownFunctions = [
    [],     // single left
    [],     // single middle
    [],     // single right
];

const mouseUpFunctions = [
    [],     // single left
    [],     // single middle
    [],     // single right
];

//#-----------------------------------------------------------------------------
//# Canvas
const canvas = {
    element: document.createElement("canvas"),
    context: function () {
        return memoize(
            function () { return this.element.getContext("2d"); }.bind(canvas)
        )()
    },
    script: null,
    ready: false,
};


whenReadyRun(function () {
    updateCanvasSize();
    document.body.insertBefore(canvas.element, document.body.firstChild);

    // color-scheme starts as dark, adjust for light color-schema as needed
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        __COLOR__.text = "#213547";
        __COLOR__.background = "#ffffff";

        __FONT__.color = __COLOR__.text;
    }

    // react on color-scheme change, adjust default colors as needed
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        const colorScheme = event.matches ? "dark" : "light";

        if (colorScheme === "dark") {
            __COLOR__.text = "#ffffffde";
            __COLOR__.background = "#242424";
        }
        else {
            __COLOR__.text = "#213547";
            __COLOR__.background = "#ffffff";
        }

        __DEFAULTS__.defaultTextColor = __COLOR__.text;
        __DEFAULTS__.defaultStrokeColor = __COLOR__.text;
        __DEFAULTS__.defaultFillColor = __COLOR__.text;
        __DEFAULTS__.defaultBackgroundColor = __COLOR__.background;
    });

    // debounce makes for less resources used when resizing
    window.addEventListener("resize", debounce(updateCanvasSize, null, 250));

    canvas.element.addEventListener("mousemove", __handleMouseMoveEvent);
    canvas.element.addEventListener("mousedown", __handleMouseClickDownEvent);
    canvas.element.addEventListener("mouseup", __handleMouseClickUpEvent);

    document.addEventListener("keydown", __handleKeyDownEvent);
    document.addEventListener("keyup", __handleKeyUpEvent);

    // prevent right clicking the canvas for native context menu
    canvas.element.addEventListener("contextmenu", evt => evt.preventDefault());

    document.addEventListener("keydown", function (event) {
        if  (event.key === "s" && (
            navigator.platform.match("Mac") ? event.metaKey : event.ctrlKey
        )) {
            event.preventDefault();

            canvas.script = window.open(
                "/editor.html",
                "scriptWindow",
                [
                    "popup=yes",
                    "toolbar=no",
                    "location=no",
                    "status=no",
                    "menubar=no",
                    "titlebar=no",
                    "resizable=yes",
                    `width=${parseInt(width()/1.5)}`,
                    `height=${parseInt(height()/1.2)}`,
                ].join(",")
            );
        }
        else if ((event.key === "d" || event.key === "p") && (navigator.platform.match("Mac") ? event.metaKey : event.ctrlKey)) {
            event.preventDefault();
        }
    }, false);

    window.addEventListener("storage", (event) => {
        if (event.key !== "script") {
            return;
        }

        clearEventsAndListeners();
        __handleScript();
    });

    setFillColor(__DEFAULTS__.fillColor);
    setStrokeColor(__DEFAULTS__.strokeColor);
    setTextFont(__DEFAULTS__.font);
    setTextAlignment(__DEFAULTS__.textAlignment);

    canvas.ready = true;

    startRender();

    if (!!localStorage.getItem("script")) {
        __handleScript();
    }
});


async function __handleScript() {
    let javascript = localStorage.getItem("script");

    // parse javascript for calls to script(...);
    const scripts = [...javascript.matchAll(
        /\s*(script\((?<quote>["']{1}).*\k<quote>{1}[)]{1}[;]?)s*/igm
    )];

    if (scripts.length > 0) {
        // go through each script and pre-fetch each script
        const resources = [];

        for (const script of scripts) {
            console.log("Script found:", script[1]);

            let resource = /(?<quote>["']{1})(.*)\k<quote>{1}/.exec(script[1])[2];

            if (!resource.startsWith("http://")
             && !resource.startsWith("https://")
             && !resource.startsWith("/")) {
                resource = "/" + resource;
            }

            try {
                console.log("Fetching:", resource);

                const response = await fetch(resource);

                if (!response.ok) {
                    console.error(`Failed to fetch script resource: (${resource})`);
                    console.log("Aborting script processing, canvas untouched");

                    return;
                }

                resources.push(await response.text());

            } catch (error) {
                console.log("Failed to fetch:", resource);
                console.error(error);
                console.log("Aborting script processing, canvas untouched");

                return;
            }
        }

        let index = 0;
        let cursor = 0;
        let code = "";

        for (const script of scripts) {
            if (code.length == 0) {
                code = javascript.substring(0, script.index);
            }
            else {
                code += javascript.substring(cursor, script.index);
            }

            code += resources[index ++];

            cursor = script.index + script[1].length + 2;
        }

        code += javascript.substring(cursor);

        __addScript(code);
    }
    else {
        __addScript(javascript);
    }
}


async function __addScript(javascript) {
    const script = document.createElement("script");

    script.setAttribute("async", "");
    script.textContent = `
(function () {
    ${javascript};

    if (typeof update !== "undefined") {
        addUpdateFunction(update);
    }

    if (typeof draw !== "undefined") {
        addRenderFunction(draw);
    }
})();`;

    // check if a script already exists
    var target = document.head.querySelector("script");

    // replace
    if (target !== null) {
        document.head.replaceChild(script, target);
    }
    // append
    else {
        document.head.appendChild(script);
    }
}


function clearEventsAndListeners() {
    $functions.update = {
        nr: 0,
        order: [],
        map: {},
    };

    $functions.render = {
        nr: 0,
        order: [],
        map: {},
    };

    resizeFunctions.length = 0;

    keyDownMap.name = {};
    keyDownMap.code = {};

    keyUpMap.name = {};
    keyUpMap.code = {};

    mouseDownFunctions[0].length = 0;
    mouseDownFunctions[1].length = 0;
    mouseDownFunctions[2].length = 0;

    mouseUpFunctions[0].length = 0;
    mouseUpFunctions[1].length = 0;
    mouseUpFunctions[2].length = 0;
}

const center = pointMiddle();


function updateCanvasSize() {
    let oldWidth = parseInt(canvas.element.getAttribute("width"));
    let oldHeight = parseInt(canvas.element.getAttribute("height"));

    canvas.element.setAttribute("width", width().toString());
    canvas.element.setAttribute("height", height().toString());

    resizeFunctions.forEach(fn => fn(oldWidth, oldHeight, width(), height()));

    center.x = width()/2;
    center.y = height()/2;
}


function onResize(fn) {
    resizeFunctions.push(fn);
}


//# Styling
function setStrokeColor(color) {
    canvas.context().strokeStyle = color;
}


function setFillColor(color) {
    canvas.context().fillStyle = color;
}


//#-----------------------------------------------------------------------------
//# Render + Updates
const $render = {
    active: false,  
};

const $timing = {
    fps: {
        target: FPS,
        interval: 1000/FPS,
        start: 0,
        then: 0,
        now: 0,
        elapsed: 0,
    },
    ups: {
        target: UPS,
        interval: 1000/UPS,
        start: 0,
        then: 0,
        now: 0,
        elapsed: 0,
    },
};

const $functions = {
    update: {
        nr: 0,
        order: [],
        map: {},
    },
    render: {
        nr: 0,
        order: [],
        map: {},
    },
}


function addUpdateFunction(fn) {
    let index = $functions.update.nr ++;
    $functions.update.order.push(index);
    $functions.update.map[index] = fn;

    return index;
}


function addRenderFunction(fn) {
    let index = $functions.render.nr ++;
    $functions.render.order.push(index);
    $functions.render.map[index] = fn;

    return index;
}


function startRender() {
    if (!$render.active) {
        $timing.fps.then = 0;
        $timing.ups.then = 0;

        $timing.fps.start = $timing.fps.then;
        $timing.ups.start = $timing.ups.then;

        $render.active = true;

        requestAnimationFrame(__loop__);
    }
}


function __loop__(now) {
    requestAnimationFrame(__loop__);

    $timing.ups.now = now;
    $timing.ups.elapsed = $timing.ups.now - $timing.ups.then;

    if ($timing.ups.elapsed > $timing.ups.interval) {
        let delta = Math.min(1, ($timing.ups.now - $timing.ups.then)/1000);
        
        $timing.ups.then = $timing.ups.now - (
            $timing.ups.elapsed%$timing.ups.interval
        );

        

        $functions.update.order.forEach(index => {
            $functions.update.map[index](delta);
        })
    }

    $timing.fps.now = now;
    $timing.fps.elapsed = $timing.fps.now - $timing.fps.then;

    if ($timing.fps.elapsed > $timing.fps.interval) {
        $timing.fps.then = $timing.fps.now - (
            $timing.fps.elapsed%$timing.fps.interval
        );

        clearCanvas();

        $functions.render.order.forEach(index => {
            $functions.render.map[index]();
        });
    }
}


//# Key controls
function __handleKeyDownEvent(evt) {
    if (typeof keyDownMap.name[evt.key] !== "undefined") {
        keyDownMap.name[evt.key].forEach(fn => fn({ event: evt, key: evt.key }));
    }

    if (typeof keyDownMap.code[evt.code] !== "undefined") {
        keyDownMap.code[evt.code].forEach(fn => fn({ event: evt, code: evt.code }));
    }
}


function __handleKeyUpEvent(evt) {
    if (typeof keyUpMap.name[evt.key] !== "undefined") {
        keyUpMap.name[evt.key].forEach(fn => fn({ event: evt, key: evt.key }));
    }

    if (typeof keyUpMap.code[evt.code] !== "undefined") {
        keyUpMap.code[evt.code].forEach(fn => fn({ event: evt, code: evt.code }));
    }
}


//#-----------------------------------------------------------------------------
//# Canvas related functions

function cancelDraw(index) {
    if (typeof __render.functions.map[index] !== "undefined"
     && __render.functions.order.includes(index)) {
        __render.functions.order = __render.functions.order.filter(
            nr => nr != index
        );

        delete __render.functions.map[index];
    }
}

function clear() {
    clearCanvas();
}


function clearCanvas() {
    canvas.context().clearRect(0, 0, width(), height());
}


function clearCanvasArea(x, y, w, h) {
    canvas.context().clearRect(x, y, w, h);
}


function width() {
    return document.body.clientWidth;
}


function height() {
    return document.body.clientHeight;
}


//#-----------------------------------------------------------------------------
//# Mouse controls
const mouse = pointMiddle();
const __offset = Object.create(null)


function __handleMouseMoveEvent(evt) {
    __offset.element = canvas.element;
    __offset.x = 0;
    __offset.y = 0;

    while (__offset.element.offsetParent) {
        __offset.x += __offset.element.offsetLeft;
        __offset.y += __offset.element.offsetTop;
        __offset.element = __offset.element.offsetParent;
    }

    mouse.x = evt.pageX - __offset.x;
    mouse.y = evt.pageY - __offset.y;
}


function __handleMouseClickDownEvent(evt) {
    evt.preventDefault();
    evt.stopPropagation();

    for (const fn of mouseDownFunctions[evt.which - 1]) {
        fn(evt.clientX, evt.clientY);
    }
}

function __handleMouseClickUpEvent(evt) {
    evt.preventDefault();
    evt.stopPropagation();

    for (const fn of mouseUpFunctions[evt.which - 1]) {
        fn(evt.clientX, evt.clientY);
    }
}

function onLeftClick(fn) {
    mouseDownFunctions[0].push(fn);
}


function onMiddleClick(fn) {
    mouseDownFunctions[1].push(fn);
}


function onRightClick(fn) {
    mouseDownFunctions[2].push(fn);
}

function onLeftClickRelease(fn) {
    mouseUpFunctions[0].push(fn);
}


function onMiddleClickRelease(fn) {
    mouseUpFunctions[1].push(fn);
}


function onRightClickRelease(fn) {
    mouseUpFunctions[2].push(fn);
}


//#-----------------------------------------------------------------------------
//# HTML elements

function onKeyNameDown(key, fn) {
    if (typeof keyDownMap.name[key] === "undefined") {
        keyDownMap.name[key] = [];
    }

    keyDownMap.name[key].push(fn);
}


const onKeyDown = onKeyNameDown;


function onKeyCodeDown(code, fn) {
    if (typeof keyDownMap.code[code] === "undefined") {
        keyDownMap.code[code] = [];
    }

    keyDownMap.code[code].push(fn);
}


function onKeyNameUp(key, fn) {
    if (typeof keyUpMap.name[key] === "undefined") {
        keyUpMap.name[key] = [];
    }

    keyUpMap.name[key].push(fn);
}


const onKeyUp = onKeyNameUp;


function onKeyCodeUp(code, fn) {
    if (typeof keyUpMap.code[code] === "undefined") {
        keyUpMap.code[code] = [];
    }

    keyUpMap.code[code].push(fn);
}


//#-----------------------------------------------------------------------------
//# HTML elements
function createButton(text, x, y, w, h, id, fn) {
    if (arguments.length === 1 && typeof text === "object") {
        return createButton(
            text.text ?? "Knapp",
            text.x,
            text.y,
            text.w ?? text.width,
            text.h ?? text.height,
            text.id ?? `input-button${Math.floor(Math.random()*1000000 + 1)}`, text.click ?? function () { /* empty */ }
        )
    }
    else {
        const button = document.createElement("input");

        button.setAttribute("id", id);
        button.setAttribute("type", "button");
        button.setAttribute("value", text);
        button.setAttribute("style", `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            width: ${w}px;
            height: ${h}px;
            z-index: 1;
        `);

        button.onclick = function (evt) {
            evt.stopPropagation();
            fn.apply(button, [evt]);
        }

        document.body.appendChild(button);

        return button;
    }
}


function createButtonCentered(text, x, y, w, h, id, fn) {
    return createButton(text, x - w/2, y - h/2, w, h, id, fn);
}


function createTextInput(x, y, w, h, id, fn) {
    const input = document.createElement("input");

    input.setAttribute("id", id);
    input.setAttribute("type", "text");
    input.setAttribute("style", `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        width: ${w}px;
        height: ${h}px;
        z-index: 1;
    `);

    input.onkeydown = function (evt) {
        evt.stopPropagation();

        if (evt.key === "Enter") {
            fn.apply(input, [evt]);
        }
    };

    document.body.appendChild(input);

    return input;
}

function createSearchInput(x, y, w, h, id, ac, fn) {
    const input = document.createElement("input");

    input.setAttribute("id", id);
    input.setAttribute("type", "search");
    input.setAttribute("list", `${id}-list`);
    input.setAttribute("style", `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        width: ${w}px;
        height: ${h}px;
        z-index: 1;
    `);

    input.onkeydown = function (evt) {
        evt.stopPropagation();

        if (evt.key === "Enter") {
            fn.apply(input, [evt]);
        }
    };

    const list = document.createElement("datalist");

    list.setAttribute("id", `${id}-list`);

    for (let i = 0; i < ac.length; i ++) {
        const option = document.createElement("option");

        option.setAttribute("value", ac[i]);

        list.appendChild(option);
    }

    document.body.appendChild(input);
    document.body.appendChild(list);

    return input;
}


function createTextInputCentered(x, y, w, h, id, fn) {
    return createTextInput(x - w/2, y - h/2, w, h, id, fn);
}

function createSearchInputCentered(x, y, w, h, id, ac, fn) {
    return createSearchInput(x - w/2, y - h/2, w, h, id, ac, fn);
}

//#-----------------------------------------------------------------------------
// Create point given coordinates
function point(x, y) {
    const point = Object.create(null);

    point.x = x;
    point.y = y;

    return point;
}


function pointMiddle() {
    return point(width()/2, height()/2);
}


//#-----------------------------------------------------------------------------
//# Draw
//## Lines
function line() {
    if (arguments.length == 2) {
        lines(arguments[0].x, arguments[0].y, arguments[1].x, arguments[1].y);
    }
    else if (arguments.length == 4) {
        lines(arguments[0], arguments[1], arguments[2], arguments[3]);
    }
}


function __linesPath(points) {
    inject(canvas.context(), function () {
        this.beginPath();
        this.moveTo(points[0], points[1]);

        for (let i = 2; i < points.length; i += 2) {
            this.lineTo(points[i], points[i + 1]);
        }
    });
}


function lines(...coordinates) {
    __linesPath(coordinates);

    canvas.context().stroke();
}


function setLineWidth(width) {
    canvas.context().lineWidth = width;
}


//## Arrow
// TODO: arrow customization
function arrow() {
    let x1;
    let y1;

    let x2;
    let y2;

    if (arguments.length == 2) {
        x1 = arguments[0].x;
        y1 = arguments[0].y;

        x2 = arguments[1].x;
        y2 = arguments[1].y;
    }
    else if (arguments.length == 4) {
        x1 = arguments[0];
        y1 = arguments[1];

        x2 = arguments[2];
        y2 = arguments[3];
    }
    else {
        return;
    }

    line(x1, y1, x2, y2);

    let angle = getAngle(x1, y1, x2, y2);

    lines(
        x2, y2,
        x2 - 16*Math.cos(angle - Math.PI/12),
        y2 - 16*Math.sin(angle - Math.PI/12),
        x2 - 16*Math.cos(angle - Math.PI/12),
        y2 - 16*Math.sin(angle - Math.PI/12),
        x2 - 16*Math.cos(angle + Math.PI/12),
        y2 - 16*Math.sin(angle + Math.PI/12),
        x2 - 16*Math.cos(angle + Math.PI/12),
        y2 - 16*Math.sin(angle + Math.PI/12),
        x2, y2
    );

    canvas.context().fill();
}

//## Cross
function cross() {
    let x;
    let y;
    let r;

    if (arguments.length == 3) {
        x = arguments[0];
        y = arguments[1];
        r = arguments[2];
    }
    else if (arguments.length == 2) {
        x = arguments[0].x;
        y = arguments[0].y;
        r = arguments[1];
    }
    else {
        return;
    }

    let angle = Math.PI/4;

    line(
        x - Math.cos(angle)*r,
        y - Math.sin(angle)*r,

        x - Math.cos(angle + Math.PI)*r,
        y - Math.sin(angle + Math.PI)*r
    );

    line(
        x - Math.cos(angle + (Math.PI/2)*r),
        y - Math.sin(angle + (Math.PI/2)*r),

        x - Math.cos(angle - (Math.PI/2)*r),
        y - Math.sin(angle - (Math.PI/2)*r)
    );
}



//## Rectangle
function rectangle() {
    let x;
    let y;
    let width;
    let height;

    if (arguments.length == 3) {
        x = arguments[0].x;
        y = arguments[0].y;
        width = arguments[1];
        height = arguments[2];
    }
    else if (arguments.length == 4) {
        x = arguments[0];
        y = arguments[1];
        width = arguments[2];
        height = arguments[3];
    }
    else {
        return;
    }

    lines(
        x, y,
        x + width, y,
        x + width, y + height,
        x, y + height,
        x, y
    );
}


function rectangleCentered() {
    if (arguments.length == 2) {
        rectangle(
            arguments[0].x - arguments[1]/2,
            arguments[0].y - arguments[1]/2,
            arguments[1],
            arguments[2]
        );
    }
    else if (arguments.length == 4) {
        rectangle(
            arguments[0] - arguments[2]/2,
            arguments[1] - arguments[2]/2,
            arguments[2],
            arguments[3]
        );
    }
}


function rectangleFilled() {
    if (arguments.length == 3) {
        rectangle(arguments[0].x, arguments[0].y, arguments[1], arguments[2]);
    }
    else if (arguments.length == 4) {
        rectangle(arguments[0], arguments[1], arguments[2], arguments[3]);
    }
    else {
        return;
    }

    canvas.context().fill();
}


function rectangleRotated() {
    let x;
    let y;
    let w;
    let h;
    let r;

    if (arguments.length == 3) {
        x = arguments[0].x;
        y = arguments[0].y;
        w = arguments[1];
        h = arguments[2];
        r = arguments[3];
    }
    else if (arguments.length == 5) {
        x = arguments[0];
        y = arguments[1];
        w = arguments[2];
        h = arguments[3];
        r = arguments[4];
    }
    else {
        return;
    }

    let cx = x + w/2;
    let cy = y + h/2;

    let [ x1, y1 ] = rotateAround(x,     y,     r, cx, cy);
    let [ x2, y2 ] = rotateAround(x + w, y,     r, cx, cy);
    let [ x3, y3 ] = rotateAround(x + w, y + h, r, cx, cy);
    let [ x4, y4 ] = rotateAround(x,     y + h, r, cx, cy);

    lines(x1, y1, x2, y2, x3, y3, x4, y4, x1, y1);
}


function rectangleCenteredFilled() {
    if (arguments.length == 3) {
        rectangleCentered(
            arguments[0].x, arguments[0].y, arguments[1], arguments[2]
        );
    }
    else if (arguments.length == 4) {
        rectangleCentered(
            arguments[0], arguments[1], arguments[2], arguments[3]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}

const rectangleFilledCentered = rectangleCenteredFilled;


function rectangleFilledRotated() {
    if (arguments.length == 4) {
        rectangleRotated(
            arguments[0].x,
            arguments[0].y,
            arguments[1],
            arguments[2],
            arguments[3]
        );
    }
    else if (arguments.length == 5) {
        rectangleRotated(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[3],
            arguments[4]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}

const rectangleRotatedFilled = rectangleFilledRotated;


function rectangleCenteredRotated() {
    if (arguments.length == 4) {
        rectangleRotated(
            arguments[0].x - arguments[1]/2,
            arguments[0].y - arguments[2]/2,
            arguments[1],
            arguments[2],
            arguments[3]
        );
    }
    else if (arguments.length == 5) {
        rectangleRotated(
            arguments[0] - arguments[2]/2,
            arguments[1] - arguments[3]/2,
            arguments[2],
            arguments[3],
            arguments[4]
        );
    }
}

const rectangleRotatedCentered = rectangleCenteredRotated;


function rectangleCenteredFilledRotated() {
    if (arguments.length == 4) {
        rectangleCenteredRotated(
            arguments[0].x,
            arguments[0].y,
            arguments[1],
            arguments[2],
            arguments[3]
        );
    }
    else if (arguments.length == 5) {
        rectangleCenteredRotated(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[3],
            arguments[4]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}

const rectangleCenteredRotatedFilled = rectangleCenteredFilledRotated;

const rectangleFilledCenteredRotated = rectangleCenteredFilledRotated;
const rectangleFilledRotatedCentered = rectangleCenteredFilledRotated;

const rectangleRotatedCenteredFilled = rectangleCenteredFilledRotated;
const rectangleRotatedFilledCentered = rectangleCenteredFilledRotated;


//## Square
function square() {
    if (arguments.length == 2) {
        rectangle(
            arguments[0].x, arguments[0].y, arguments[1], arguments[1]
        );
    }
    else if (arguments.length == 3) {
        rectangle(
            arguments[0], arguments[1], arguments[2], arguments[2]
        );
    }
}


function squareCentered() {
    if (arguments.length == 2) {
        rectangleCentered(
            arguments[0].x, arguments[0].y, arguments[1], arguments[1]
        );
    }
    else if (arguments.length == 3) {
        rectangleCentered(
            arguments[0], arguments[1], arguments[2], arguments[2]
        );
    }
}


function squareFilled() {
    if (arguments.length == 2) {
        rectangle(
            arguments[0].x, arguments[0].y, arguments[1], arguments[1]
        );
    }
    else if (arguments.length == 3) {
        rectangle(
            arguments[0], arguments[1], arguments[2], arguments[2]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}


function squareRotated() {
    if (arguments.length == 3) {
        rectangleRotated(
            arguments[0].x,
            arguments[0].y,
            arguments[1],
            arguments[1],
            arguments[2]
        );
    }
    else if (arguments.length == 4) {
        rectangleRotated(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[2],
            arguments[3]
        );
    }
}


function squareCenteredFilled() {
    if (arguments.length == 2) {
        rectangleCentered(
            arguments[0].x, arguments[0].y, arguments[1], arguments[1]
        );
    }
    else if (arguments.length == 3) {
        rectangleCentered(
            arguments[0], arguments[1], arguments[2], arguments[2]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}

const squareFilledCentered = squareCenteredFilled;


function squareFilledRotated() {
    if (arguments.length == 3) {
        rectangleRotated(
            arguments[0].x,
            arguments[0].y,
            arguments[1],
            arguments[1],
            arguments[2]
        );
    }
    else if (arguments.length == 4) {
        rectangleRotated(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[2],
            arguments[3]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}

const squareRotatedFilled = squareFilledRotated;


function squareCenteredRotated() {
    if (arguments.length == 3) {
        rectangleRotated(
            arguments[0].x - arguments[1]/2,
            arguments[0].y - arguments[1]/2,
            arguments[1],
            arguments[1],
            arguments[2]
        );
    }
    else if (arguments.length == 4) {
        rectangleRotated(
            arguments[0] - arguments[2]/2,
            arguments[1] - arguments[2]/2,
            arguments[2],
            arguments[2],
            arguments[3]
        );
    }
}

const squareRotatedCentered = squareCenteredRotated;


function squareCenteredFilledRotated() {
    if (arguments.length == 3) {
        rectangleCenteredRotated(
            arguments[0].x,
            arguments[0].y,
            arguments[1],
            arguments[1],
            arguments[2]
        );
    }
    else if (arguments.length == 4) {
        rectangleCenteredRotated(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[2],
            arguments[3]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}

const squareCenteredRotatedFilled = squareCenteredFilledRotated;

const squareFilledCenteredRotated = squareCenteredFilledRotated;
const squareFilledRotatedCentered = squareCenteredFilledRotated;

const squareRotatedCenteredFilled = squareCenteredFilledRotated;
const squareRotatedFilledCentered = squareCenteredFilledRotated;


//## Circle
// TODO: circle arc given start and end angle
function circle() {
    if (arguments.length == 2) {
        canvas.context().beginPath();
        canvas.context().arc(
            arguments[0].x,
            arguments[0].y,
            arguments[1],
            0,
            Math.PI*2
        );
        canvas.context().stroke();
    }
    else if (arguments.length == 3) {
        canvas.context().beginPath();
        canvas.context().arc(
            arguments[0],
            arguments[1],
            arguments[2],
            0,
            Math.PI*2
        );
        canvas.context().stroke();
    }
}

function circleCentered() {
    if (arguments.length == 2) {
        circle(
            arguments[0].x - arguments[1]/2,
            arguments[0].y - arguments[1]/2,
            arguments[1]
        );
    }
    else if (arguments.length == 3) {
        circle(
            arguments[0] - arguments[2]/2,
            arguments[1] - arguments[2]/2,
            arguments[2]
        );
    }
}


function circleFilled() {
    if (arguments.length == 2) {
        circle(
            arguments[0].x - arguments[1]/2,
            arguments[0].y - arguments[1]/2,
            arguments[1]
        );
    }
    else if (arguments.length == 3) {
        circle(
            arguments[0] - arguments[2]/2,
            arguments[1] - arguments[2]/2,
            arguments[2]
        );
    }
    else {
        return;
    }

    canvas.context().fill();
}


function circleCenteredFilled(x, y, radius) {
    if (arguments.length == 2) {
        circleCentered(arguments[0].x, arguments[0].y, arguments[1]);
    }
    else if (arguments.length == 3) {
        circleCentered(arguments[0], arguments[1], arguments[2]);
    }
    else {
        return;
    }

    canvas.context().fill();
}


// Ellipse
// TODO: ellipse rotation
// TODO: ellipse arc given start and end angle
function ellipse() {
    let x;
    let y;
    let width;
    let height;

    if (arguments.length == 3) {
        x = arguments[0].x;
        y = arguments[0].y;
        width = arguments[1];
        height = arguments[2];
    }
    else if (arguments.length == 4) {
        x = arguments[0];
        y = arguments[1];
        width = arguments[2];
        height = arguments[3];
    }
    else {
        return;
    }

    canvas.context().beginPath();
    canvas.context().ellipse(x, y, width, height, 0, 0, 2*Math.PI)
    canvas.context().stroke();
}


function ellipseCentered() {
    if (arguments.length == 3) {
        ellipse(
            arguments[0].x - arguments[1]/2,
            arguments[0].y - arguments[2]/2,
            arguments[1],
            arguments[2]
        );
    }
    else if (arguments.length == 4) {
        ellipse(
            arguments[0] - arguments[2]/2,
            arguments[1] - arguments[3]/2,
            arguments[2],
            arguments[3]
        );
    }
}


function ellipseFilled() {
    if (arguments.length == 3) {
        ellipse(arguments[0].x, arguments[0].y, arguments[1], arguments[2]);
    }
    else if (arguments.length == 4) {
        ellipse(arguments[0], arguments[1], arguments[2], arguments[3]);
    }
    else {
        return;
    }

    canvas.context().fill();
}


function ellipseCenteredFilled() {
    if (arguments.length == 3) {
        ellipseCentered(arguments[0].x, arguments[0].y, arguments[1], arguments[2]);
    }
    else if (arguments.length == 4) {
        ellipseCentered(arguments[0], arguments[1], arguments[2], arguments[3]);
    }
    else {
        return;
    }

    canvas.context().fill();
}


// Triangle
function triangle() {
    if (arguments.length == 3) {
        lines(
            arguments[0].x, arguments[0].y,
            arguments[1].x, arguments[1].y,
            arguments[2].x, arguments[2].y,
            arguments[0].x, arguments[0].y
        );
    }
    else if (arguments.length == 6) {
        lines(
            arguments[0], arguments[1],
            arguments[2], arguments[3],
            arguments[4], arguments[5],
            arguments[0], arguments[1]
        )
    }
}


function triangleFilled() {
    if (arguments.length === 3) {
        triangle(arguments[0], arguments[1], arguments[2]);
    }
    else if (arguments.length === 6) {
        triangle(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5])
    }
    else {
        return;
    }

    canvas.context().fill();
}


//# Images

// cache
const __images = Object.create(null);
const __images_processing = new Set();


// helper function to handle caching of images and getting cached images
function __image(file, fn)
{
    if (typeof __images[file] === "undefined") {
        if (!__images_processing.has(file)) {

            __images_processing.add(file);

            let image = new Image();
            

            image.onload = function () {
                __images_processing.delete(file);
                __images[file] = image;

                fn(__images[file]);
            };

            image.src = file;

            __images_processing.add(file);
        }
    }
    else if (!__images_processing.has(file)) {
        fn(__images[file]);
    }
}


//## Image
function image() {
    if (arguments.length == 3) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(image, arguments[1], arguments[2]);
        });
    }
    else if (arguments.length == 2) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(image, arguments[1].x, arguments[1].y);
        })
    }
}


function imageCentered() {
    if (arguments.length == 3) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                arguments[1] - image.width/2,
                arguments[2] - image.height/2
            );
        });
    }
    else if (arguments.length == 2) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                arguments[1].x - image.width/2,
                arguments[1].y - image.height/2
            );
        });
    }
}


function imagePart() {
    // file, sp, width, height, tp
    if (arguments.length == 5) {
        imagePartScale(
            arguments[0],
            arguments[1], arguments[2],
            arguments[3], arguments[4],
            arguments[2], arguments[3]
        );
    }
    // file, sx, sy, width, height, tx, ty
    else if (arguments.length == 7) {
        imagePartScale(
            arguments[0],
            arguments[1], arguments[2],
            arguments[3], arguments[4],
            arguments[5], arguments[6],
            arguments[3], arguments[4]
        );
    }
}

function imagePartCentered(file, sx, sy, width, height, tx, ty) {
    // file, sp, width, height, tp
    if (arguments.length == 5) {
        imagePartScaleCentered(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[3],
            arguments[4],
            arguments[2],
            arguments[3]
        );
    }
    // file, sx, sy, width, height, tx, ty
    else if (arguments.length == 7) {
        imagePartScaleCentered(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[3],
            arguments[4],
            arguments[5],
            arguments[6],
            arguments[3],
            arguments[4]
        );
    }
}

function imagePartScale() {
    if (arguments.length == 9) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                arguments[1], arguments[2],
                arguments[3], arguments[4],
                arguments[5], arguments[6],
                arguments[7], arguments[8]
            );
        });
    }
    else if (arguments.length == 7) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                arguments[1].x, arguments[1].y,
                arguments[2],   arguments[3],
                arguments[4].x, arguments[4].y,
                arguments[5],   arguments[6]
            );
        });
    }
}


function imagePartScaleCentered(file, sx, sy, w1, h1, tx, ty, w2, h2) {
    if (arguments.length == 9) {
        imagePartScale(
            arguments[0],
            arguments[1],  arguments[2],
            arguments[3],  arguments[4],

            arguments[5] - arguments[7]/2,
            arguments[6] - arguments[8]/2,

            arguments[7],  arguments[8]
        );
    }
    else if (arguments.length == 7) {
        imagePartScale(
            arguments[0],
            arguments[1].x,  arguments[1].y,
            arguments[2],    arguments[3],

            arguments[4].x - arguments[5]/2,
            arguments[4].y - arguments[6]/2,

            arguments[5],    arguments[6]
        );
    }
}


function icon() {
    if (arguments.length == 4) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                0, 0,
                image.width, image.height,
                arguments[1].x, arguments[1].y,
                arguments[2], arguments[3]
            );
        });
    }
    else if (arguments.length == 5) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                0, 0,
                image.width, image.height,
                arguments[1], arguments[2],
                arguments[3], arguments[4]
            );
        });
    }
}


function iconCentered() {
    if (arguments.length == 4) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                0, 0,
                image.width, image.height,
                arguments[1].x - image.width/2,
                arguments[1].y - image.height/2,
                arguments[2], arguments[3]
            );
        });
    }
    else if (arguments.length == 5) {
        __image(arguments[0], (image) => {
            canvas.context().drawImage(
                image,
                0, 0,
                image.width, image.height,
                arguments[1] - image.width/2,
                arguments[2] - image.height/2,
                arguments[3], arguments[4]
            );
        });
    }
}


//# Text
function __updateTextFont() {
    canvas.context().font = `${__FONT__.size} ${__FONT__.name}`;
}

function setTextFont(font, size = __FONT__.size) {
    __FONT__.name = font;
    __FONT__.size = size;

    __updateTextFont();
}

function setTextFontSize(size) {
    setTextFont(__FONT__.name, size);
}

function setTextFontColor(color) {
    __FONT__.color = color;
}

function setTextAlignment(value) {
    canvas.context().textAlign = value;
}

function setTextBaseline(value) {
    canvas.context().setTextBaseline = value;
}


function text(message, x, y) {
    inject(canvas.context(), function () {
        let oldFillStyle = this.fillStyle;

        this.fillStyle = __FONT__.color;
        this.fillText(message, x, y);

        this.filleStyle = oldFillStyle;
    });
}


function textOutline(message, x, y) {
    canvas.context().strokeText(message, x, y);
}


function textCentered(message, x, y) {
    let measure = canvas.context().measureText(message);

    text(message, x - measure.width/2, y + measure.actualBoundingBoxAscent/2);
}


function textCenteredOutline(message, x, y) {
    let measure = canvas.context().measureText(message);

    textOutline(message, x - measure.width/2, y);
}

//#-----------------------------------------------------------------------------
//# Loops
function resetLoopLimit() {
    __loopLimit = 1_000_000;
}


function getLoopLimit() {
    return __loopLimit;
}


function setLoopLimit(value) {
    __loopLimit = Math.min(value, __loopLimit);
}

function resetLoopLimit() {
    __loopLimit = 1_000_000;
}


//# Loop
function loop(wait, fn, TTL = undefined) {
    let count = (TTL ?? getLoopLimit()) - 1;

    const timer = setInterval(function () {
        fn();

        if ((count --) <= 0) {
            clearInterval(timer);
        }
    }, wait);
}


//#-----------------------------------------------------------------------------
//# Helper functions

// Cache a function return value and return cached value when called
function memoize(getter) {
    const value = getter();

    return function () {
        return value;
    }
}


// Binds a this-value to a given function and returns the function called
function context(context, fn) {
    return fn.bind(context)();
}


// Calls the given function with a specifc this-context with the given parameters (which is a list)
function inject(context, fn, parameters) {
    return fn.apply(context, parameters);
}

// if called again before the time limit given, the timer is reset,
// useful for events that update very quickly in rapid succession,
// for example resizing the browser window
function debounce(fn, context = null, TTL = 500) {
    let timer;

    return (...parameters) => {
        clearTimeout(timer);

        timer = setTimeout(
            function () {
                inject(context, fn, parameters);
            },
            TTL
        );
    };
}


// delay fn call until after DOM is ready
function whenReadyRun(fn) {
    document.addEventListener("DOMContentLoaded", fn);
}


// Format double digits by left padding 0 if needed when single digit
function formatDoubleDigit(input) {
    return parseInt(input).toString().length === 1 ? "0" + input : input;
}


// get ISO 8601 Date
function date() {
    let time = new Date();

    let YYYY = time.getFullYear();
    let MM = formatDoubleDigit(time.getMonth());
    let DD = formatDoubleDigit(time.getDay());

    return `${YYYY}-${MM}-${DD}`;
}


// Log current date to console
function dateLog() {
    console.log(date());
}


// Get timestamp HH:MM:SS[:MS]
function timestamp() {
    let time = new Date();

    let HH = formatDoubleDigit(time.getHours());
    let MM = formatDoubleDigit(time.getMinutes());
    let SS = formatDoubleDigit(time.getSeconds());

    return `${HH}:${MM}:${SS}[:${time.getUTCMilliseconds()}]`;
}

//#-----------------------------------------------------------------------------
//# Helper math functions

function __getAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1)
}


// angle = radians
function getAngle() {
    // between two points
    if (arguments.length == 2) {
        return __getAngle(
            arguments[0].x, arguments[0].y,
            arguments[1].x, arguments[1].y
        );
    }
    // between two x,y coordinates
    else if (arguments.length == 4) {
        return __getAngle(
            arguments[0], arguments[1],
            arguments[2], arguments[3]
        );
    }

    return 0;
}


function distanceSquared() {
    if (arguments.length == 2) {
        return (
            (arguments[1].x - arguments[0].x)**2
          + (arguments[1]-y - arguments[0].y)**2
        );
    }
    else if (arguments.length == 4) {
        return (
            (arguments[2] - arguments[0])**2
          + (arguments[3] - arguments[1])**2
        );
    }

    return 0;
}


function distance() {
    if (arguments.length == 2) {
        return Math.sqrt(distanceSquared(arguments[0], arguments[1]));
    }
    else if (arguments.length == 4) {
        return Math.sqrt(
            distanceSquared(
                arguments[0], arguments[1], arguments[2], arguments[3]
            )
        );
    }

    return 0;
}


function rotateAround(x, y, rotation, cx, cy) {
    const magnitude = distance(x, y, cx, cy);
    const angle = getAngle(x, y, cx, cy) + rotation;

    return [
        cx + Math.cos(angle)*magnitude - Math.sin(angle)*magnitude,
        cy + Math.sin(angle)*magnitude + Math.cos(angle)*magnitude,
    ];
}


// Clamps a given x value to be between min and max, as in,
// the value return cannot be below min or above max
function clamp(min, x, max) {
    return Math.max(min, Math.min(x, max));
}