
//Files JS
// files.js
// Owns the in-memory project structure: which files exist and what code each contains.
 
// The project's files, keyed by filename.
// This is the single source of truth for file content —
// NOT Monaco. Monaco only ever shows whichever file is currently active.
const files = {
  "index.html": "<h1>Hello CodeSync</h1>",
  "style.css": "body {\n  background: black;\n}",
  "script.js": 'console.log("Hello from script.js");',
};
 
// Tracks which file is currently open in the editor.
let activeFile = "index.html";
 
const fileListEl = document.getElementById("file-list");
 
// Detects the correct Monaco language mode from a filename's extension.
function getLanguageForFile(filename) {
  if (filename.endsWith(".html")) return "html";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".js")) return "javascript";
  return "plaintext";
}
 
// Saves whatever is currently in the editor back into the `files` object,
// under whichever file was active BEFORE switching.
function saveActiveFileContent() {
  files[activeFile] = codeEditor.getValue();
}
 
// Switches the editor to show a different file's content.
function openFile(filename) {
  if (filename === activeFile) return; // already open, nothing to do
 
  saveActiveFileContent(); // don't lose edits to the file we're leaving
 
  activeFile = filename;
  codeEditor.setValue(files[filename]);
  monaco.editor.setModelLanguage(codeEditor.getModel(), getLanguageForFile(filename));
 
  updateActiveFileHighlight();
}
 
// Rebuilds the entire sidebar list from the `files` object.
// We call this any time a file is added, renamed, or deleted.
function renderFileList() {
  fileListEl.innerHTML = "";
 
  Object.keys(files).forEach((filename) => {
    const li = document.createElement("li");
    li.textContent = filename;
    li.dataset.filename = filename;
    li.className = "file-item px-2 py-1 rounded hover:bg-gray-800 cursor-pointer";
    li.addEventListener("click", () => openFile(filename));
    fileListEl.appendChild(li);
  });
 
  updateActiveFileHighlight();
}
 
// Updates the sidebar so the active file is visually highlighted.
function updateActiveFileHighlight() {
  document.querySelectorAll(".file-item").forEach((item) => {
    item.classList.toggle("bg-gray-800", item.dataset.filename === activeFile);
  });
}
 
// Creates a new empty file. Asks the user for a name and guards against duplicates.
function createNewFile() {
  const filename = prompt("New file name (e.g. utils.js):");
  if (!filename) return; // user cancelled or typed nothing
 
  if (files[filename]) {
    alert("A file with that name already exists.");
    return;
  }
 
  saveActiveFileContent(); // don't lose current edits before switching
  files[filename] = "";
  renderFileList();
  openFile(filename);
}
 
// Renames the currently active file.
function renameActiveFile() {
  const newName = prompt("Rename to:", activeFile);
  if (!newName || newName === activeFile) return;
 
  if (files[newName]) {
    alert("A file with that name already exists.");
    return;
  }
 
  saveActiveFileContent();
  files[newName] = files[activeFile];
  delete files[activeFile];
  activeFile = newName;
 
  renderFileList();
  codeEditor.setValue(files[activeFile]);
  monaco.editor.setModelLanguage(codeEditor.getModel(), getLanguageForFile(activeFile));
}
 
// Deletes the currently active file, as long as it's not the last one left.
function deleteActiveFile() {
  const filenames = Object.keys(files);
  if (filenames.length === 1) {
    alert("You can't delete the last remaining file.");
    return;
  }
 
  if (!confirm(`Delete "${activeFile}"? This cannot be undone.`)) return;
 
  delete files[activeFile];
 
  // Open whichever file is now first in the list.
  activeFile = Object.keys(files)[0];
  codeEditor.setValue(files[activeFile]);
  monaco.editor.setModelLanguage(codeEditor.getModel(), getLanguageForFile(activeFile));
 
  renderFileList();
}
 
document.getElementById("new-file-btn").addEventListener("click", createNewFile);
document.getElementById("rename-file-btn").addEventListener("click", renameActiveFile);
document.getElementById("delete-file-btn").addEventListener("click", deleteActiveFile);
 
loadProjectFromStorage(); // restore previous session, if one exists
renderFileList();
 
