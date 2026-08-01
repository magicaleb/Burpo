import {
  generatePhrase,
  normalizeTrace,
  routeComplexity,
  routeSignature,
  traceToRoute,
} from "./src/trace-engine.js";

const stages = {
  intro: document.querySelector("#stage-intro"),
  draw: document.querySelector("#stage-draw"),
  phrase: document.querySelector("#stage-phrase"),
  sealed: document.querySelector("#stage-sealed"),
  reveal: document.querySelector("#stage-reveal"),
};

const traceCanvas = document.querySelector("#trace-canvas");
const revealCanvas = document.querySelector("#reveal-canvas");
const traceContext = traceCanvas.getContext("2d");
const revealContext = revealCanvas.getContext("2d");
const sealButton = document.querySelector("#seal-button");
const clearButton = document.querySelector("#clear-button");
const drawFeedback = document.querySelector("#draw-feedback");
const canvasPrompt = document.querySelector("#canvas-prompt");

let trace = [];
let route = [];
let sealedTrace = [];
let drawing = false;
let activePointer = null;

setupCanvas(traceCanvas, traceContext);

document.querySelector("#begin-button").addEventListener("click", () => {
  showStage("draw");
  requestAnimationFrame(() => setupCanvas(traceCanvas, traceContext));
});

clearButton.addEventListener("click", resetDrawing);
sealButton.addEventListener("click", sealTrace);
document.querySelector("#phrase-done-button").addEventListener("click", () => showStage("sealed"));
document.querySelector("#compare-button").addEventListener("click", revealTrace);
document.querySelector("#erase-button").addEventListener("click", eraseTrace);

traceCanvas.addEventListener("pointerdown", startDrawing);
traceCanvas.addEventListener("pointermove", continueDrawing);
traceCanvas.addEventListener("pointerup", endDrawing);
traceCanvas.addEventListener("pointercancel", endDrawing);
window.addEventListener("resize", handleResize);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

function startDrawing(event) {
  if (trace.length) resetDrawing();
  drawing = true;
  activePointer = event.pointerId;
  traceCanvas.setPointerCapture(event.pointerId);
  trace = [eventPoint(event)];
  canvasPrompt.classList.add("is-hidden");
  drawFeedback.textContent = "Keep the line continuous…";
  sealButton.disabled = true;
  drawDot(traceContext, trace[0]);
}

function continueDrawing(event) {
  if (!drawing || event.pointerId !== activePointer) return;
  const point = eventPoint(event);
  const previous = trace[trace.length - 1];
  if (Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return;
  trace.push(point);
  drawSegment(traceContext, previous, point);
}

function endDrawing(event) {
  if (!drawing || event.pointerId !== activePointer) return;
  drawing = false;
  activePointer = null;
  route = traceToRoute(trace);

  if (trace.length < 12 || route.length < 4) {
    drawFeedback.textContent = "Give the line a little more shape—use more of the square and add a few clear turns.";
    sealButton.disabled = true;
    return;
  }

  drawFeedback.textContent = `${route.length} major turns detected. Keep it, or draw again.`;
  sealButton.disabled = false;
}

function sealTrace() {
  route = traceToRoute(trace);
  if (route.length < 4) return;

  sealedTrace = normalizeTrace(trace);
  const generated = generatePhrase(route);
  document.querySelector("#memory-phrase").textContent = generated.phrase;
  document.querySelector("#trace-id").textContent = `Session ${routeSignature(route)}`;
  document.querySelector("#result-points").textContent = `${routeComplexity(route)} movement index`;

  traceContext.clearRect(0, 0, traceCanvas.width, traceCanvas.height);
  trace = [];
  showStage("phrase");
}

function revealTrace() {
  showStage("reveal");
  requestAnimationFrame(() => {
    setupCanvas(revealCanvas, revealContext, true);
    drawNormalizedTrace(revealContext, revealCanvas, sealedTrace);
  });
}

function eraseTrace() {
  sealedTrace = [];
  route = [];
  revealContext.clearRect(0, 0, revealCanvas.width, revealCanvas.height);
  showStage("intro");
  resetDrawing();
}

function resetDrawing() {
  trace = [];
  route = [];
  drawing = false;
  activePointer = null;
  traceContext.clearRect(0, 0, traceCanvas.width, traceCanvas.height);
  canvasPrompt.classList.remove("is-hidden");
  drawFeedback.textContent = "";
  sealButton.disabled = true;
}

function showStage(name) {
  for (const [stageName, element] of Object.entries(stages)) {
    const active = stageName === name;
    element.hidden = !active;
    element.classList.toggle("stage-active", active);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupCanvas(canvas, context, reveal = false) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = reveal ? 5 : 4;
  context.strokeStyle = reveal ? "#f15f4b" : "#f3e8cf";
  context.fillStyle = context.strokeStyle;
}

function handleResize() {
  if (!stages.draw.hidden) {
    setupCanvas(traceCanvas, traceContext);
    if (trace.length) drawRawTrace(traceContext, trace);
  }
  if (!stages.reveal.hidden) {
    setupCanvas(revealCanvas, revealContext, true);
    drawNormalizedTrace(revealContext, revealCanvas, sealedTrace);
  }
}

function eventPoint(event) {
  const rect = traceCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function drawDot(context, point) {
  context.beginPath();
  context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
  context.fill();
}

function drawSegment(context, from, to) {
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

function drawRawTrace(context, points) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.stroke();
}

function drawNormalizedTrace(context, canvas, points) {
  if (points.length < 2) return;
  const rect = canvas.getBoundingClientRect();
  const padding = Math.min(rect.width, rect.height) * 0.12;
  const width = rect.width - padding * 2;
  const height = rect.height - padding * 2;
  context.beginPath();
  context.moveTo(padding + points[0].x * width, padding + points[0].y * height);
  for (const point of points.slice(1)) {
    context.lineTo(padding + point.x * width, padding + point.y * height);
  }
  context.stroke();
}
