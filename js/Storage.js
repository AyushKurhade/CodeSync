// storage.js
// Persists the project (files + active file) to localStorage,
// and restores it when the page loads.

const STORAGE_KEY = "codesync-project";

// Saves the current project state to localStorage.
function saveProjectToStorage() {
  saveActiveFileContent(); // make sure in-progress edits are included

  const projectState = {
    files,
    activeFile,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectState));
  } catch (error) {
    // localStorage can fail (e.g. private browsing, storage full) — don't crash the app over it
    console.error("Failed to save project:", error);
  }
}

// Loads a saved project from localStorage, if one exists.
// Returns true if something was restored, false if there was nothing to restore.
function loadProjectFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;

  try {
    const projectState = JSON.parse(saved);

    // Replace the contents of `files` in place (keeps it a `const` while updating its data)
    Object.keys(files).forEach((key) => delete files[key]);
    Object.assign(files, projectState.files);

    activeFile = projectState.activeFile in files
      ? projectState.activeFile
      : Object.keys(files)[0];

    return true;
  } catch (error) {
    console.error("Failed to load saved project:", error);
    return false;
  }
}

// Save automatically whenever the user leaves/refreshes the page.
window.addEventListener("beforeunload", saveProjectToStorage);