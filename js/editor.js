// editor.js
// Responsible for creating and configuring the Monaco Editor instance.

// This will hold the actual Monaco editor object once it's ready.
// Other files (like app.js) will read/write code through this variable.
let codeEditor;

// Tell Monaco's loader where to fetch its files from (same CDN version as the loader script)
require.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs",
  },
});

// Monaco loads asynchronously — this callback runs once it's ready
require(["vs/editor/editor.main"], function () {
  codeEditor = monaco.editor.create(document.getElementById("editor-container"), {
    value: files[activeFile],
    language: getLanguageForFile(activeFile),
    theme: "vs-dark",
    fontSize: 14,
    automaticLayout: true, // re-fits the editor when the container resizes
    minimap: { enabled: false },
  });

  updateActiveFileHighlight();
  console.log("Monaco editor ready");
});