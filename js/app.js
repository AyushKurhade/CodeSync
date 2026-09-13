// Entry point for CodeSync frontend logic.
// This file will grow as we build each feature step by step.

console.log("CodeSync app.js loaded");

const runButton = document.getElementById("run-btn");
const outputPanel = document.getElementById("output");

function appendToOutput(text, isError = false) {
  const line = document.createElement("div");
  line.textContent = text;
  if (isError) {
    line.classList.add("text-red-400");
  }
  outputPanel.appendChild(line);
}

function runUserCode() {
  outputPanel.innerHTML = ""; // clear previous output

  const userCode = codeEditor.getValue();

  // Temporarily override console.log so we can capture its output
  // instead of only seeing it in the browser's DevTools console.
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    appendToOutput(args.join(" "));
    originalConsoleLog(...args); // still log normally too, for our own debugging
  };

  try {
    // Function() runs code in a scope separate from our own variables,
    // which is safer and cleaner than eval().
    const userFunction = new Function(userCode);
    userFunction();
  } catch (error) {
    appendToOutput(error.message, true);
  } finally {
    // Always restore the real console.log, even if the code threw an error
    console.log = originalConsoleLog;
  }
}

runButton.addEventListener("click", runUserCode);