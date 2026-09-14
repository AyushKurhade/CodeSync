// editor.js
// Responsible for creating and configuring the Monaco Editor instance.


// This will hold the actual Monaco editor object once it's ready.
let codeEditor;


// --------------------------------------------------
// MONACO CONFIGURATION
// --------------------------------------------------

require.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs",
  },
});


// --------------------------------------------------
// CREATE MONACO EDITOR
// --------------------------------------------------

// Monaco loads asynchronously.

require(
  ["vs/editor/editor.main"],
  function () {

    codeEditor =
      monaco.editor.create(
        document.getElementById(
          "editor-container"
        ),
        {

          // Current file content.
          value: files[activeFile],

          // Detect language from filename.
          language:
            getLanguageForFile(
              activeFile
            ),

          // Dark theme.
          theme: "vs-dark",

          // Editor font size.
          fontSize: 14,

          // Automatically resize editor.
          automaticLayout: true,

          // Disable minimap.
          minimap: {
            enabled: false,
          },


          /*
            IMPORTANT:

            Host:
              readOnly = false

            Other user + Edit Access ON:
              readOnly = false

            Other user + Edit Access OFF:
              readOnly = true
          */

          readOnly:
            !isRoomHost &&
            !canEditRoom,

        }
      );


    // Highlight active file.
    updateActiveFileHighlight();


    // Start real-time code synchronization.
    setupCodeSync();


    /*
      Apply the latest permission state
      received from the server.

      This is important because the room-state
      event may have arrived before Monaco
      finished loading.
    */

    updateEditorEditAccess();


    console.log(
      "Monaco editor ready"
    );

  }
);