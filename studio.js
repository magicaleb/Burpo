import { generatePhrase, getWordFamilies, gridCenter } from "./src/trace-engine.js";

const families = getWordFamilies();
const memoryMap = document.querySelector("#memory-map");
const drillPhrase = document.querySelector("#drill-phrase");
const answerLine = document.querySelector("#answer-line");
const answerDots = document.querySelector("#answer-dots");
const answerLabel = document.querySelector("#answer-label");
const showAnswerButton = document.querySelector("#show-answer");
const drillAnswer = document.querySelector("#drill-answer");

let currentRoute = [];
let answerVisible = false;

families.forEach((family, index) => {
  const cell = document.createElement("div");
  cell.className = `map-cell map-cell-${family.id}`;
  cell.innerHTML = `
    <span class="map-number">${index + 1}</span>
    <span class="map-symbol" aria-hidden="true">${symbolFor(family.id)}</span>
    <strong>${family.anchor}</strong>
    <small>${family.words.slice(0, 3).join(" · ")}</small>
  `;
  memoryMap.appendChild(cell);
});

document.querySelector("#new-drill").addEventListener("click", newDrill);
showAnswerButton.addEventListener("click", toggleAnswer);

newDrill();

function newDrill() {
  const length = 4 + Math.floor(Math.random() * 4);
  currentRoute = [];
  while (currentRoute.length < length) {
    const next = Math.floor(Math.random() * 9);
    if (next !== currentRoute[currentRoute.length - 1]) currentRoute.push(next);
  }

  drillPhrase.textContent = `“${generatePhrase(currentRoute).phrase}”`;
  answerVisible = false;
  renderAnswer();
}

function toggleAnswer() {
  answerVisible = !answerVisible;
  renderAnswer();
}

function renderAnswer() {
  const points = currentRoute.map((cell) => {
    const point = gridCenter(cell, 300);
    return `${point.x},${point.y}`;
  });
  answerLine.setAttribute("points", answerVisible ? points.join(" ") : "");
  answerDots.replaceChildren();

  if (answerVisible) {
    currentRoute.forEach((cell, index) => {
      const point = gridCenter(cell, 300);
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", "13");
      label.setAttribute("x", point.x);
      label.setAttribute("y", point.y + 5);
      label.setAttribute("text-anchor", "middle");
      label.textContent = index + 1;
      group.append(circle, label);
      answerDots.appendChild(group);
    });
  }

  drillAnswer.classList.toggle("answer-visible", answerVisible);
  answerLabel.textContent = answerVisible
    ? currentRoute.map((cell) => families[cell].anchor).join(" → ")
    : "Answer hidden";
  showAnswerButton.textContent = answerVisible ? "Hide route" : "Show route";
}

function symbolFor(id) {
  return {
    weather: "☁",
    light: "☀",
    space: "✦",
    plants: "♧",
    mind: "◉",
    birds: "⌁",
    stone: "◆",
    water: "≈",
    fire: "♨",
  }[id];
}
