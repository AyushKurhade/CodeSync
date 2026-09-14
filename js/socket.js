// socket.js
// Handles:
// - room create / join
// - user name
// - host information
// - edit permissions
// - online users
// - realtime code synchronization
// - realtime file synchronization


// ==================================================
// ROOM INFORMATION
// ==================================================

let roomId = null;

let userName = "";


// ==================================================
// SOCKET CONNECTION
// ==================================================

const socket = io();


// ==================================================
// ROOM PERMISSION STATE
// ==================================================

let isRoomHost = false;

let roomHostId = null;

let canEditRoom = true;


// ==================================================
// REMOTE CHANGE PROTECTION
// ==================================================

let isApplyingRemoteChange = false;


// ==================================================
// USER NAME
// ==================================================

function getUserName() {

  if (
    typeof window.codeSyncUserName === "string" &&
    window.codeSyncUserName.trim()
  ) {
    return window.codeSyncUserName.trim();
  }

  return "Anonymous";
}


// ==================================================
// JOIN / CREATE ROOM
// ==================================================

window.codeSyncJoinRoom = function (requestedRoomId) {

  if (!requestedRoomId) {
    console.log("Room code is missing.");
    return;
  }

  roomId = requestedRoomId
    .trim()
    .toUpperCase();

  userName = getUserName();


  if (!userName) {
    console.log("User name is missing.");
    return;
  }


  console.log(
    `Joining room ${roomId} as ${userName}`
  );


  if (!socket.connected) {

    socket.once("connect", () => {

      socket.emit(
        "join-room",
        {
          roomId,
          name: userName
        }
      );

    });

    return;
  }


  socket.emit(
    "join-room",
    {
      roomId,
      name: userName
    }
  );

};


// ==================================================
// UPDATE ROOM CODE UI
// ==================================================

function updateRoomCodeUI() {

  const roomCodeElement =
    document.getElementById("room-code");


  if (roomCodeElement && roomId) {

    roomCodeElement.textContent =
      roomId;

  }

}


// ==================================================
// CHECK PROJECT EDIT PERMISSION
// ==================================================

function userCanModifyProject() {

  return (
    isRoomHost ||
    canEditRoom
  );

}


// Make this available to files.js.

window.codeSyncCanEditProject =
  userCanModifyProject;


// ==================================================
// UPDATE FILE BUTTONS
// ==================================================

function updateProjectButtons() {

  const buttons = [

    document.getElementById(
      "new-file-btn"
    ),

    document.getElementById(
      "rename-file-btn"
    ),

    document.getElementById(
      "delete-file-btn"
    )

  ];


  const canModify =
    userCanModifyProject();


  buttons.forEach(
    (button) => {

      if (!button) {
        return;
      }


      button.disabled =
        !canModify;


      button.classList.toggle(
        "opacity-40",
        !canModify
      );


      button.classList.toggle(
        "cursor-not-allowed",
        !canModify
      );

    }
  );

}


// Make available to files.js.

window.codeSyncUpdateProjectButtons =
  updateProjectButtons;


// ==================================================
// UPDATE EDITOR PERMISSION
// ==================================================

function updateEditorEditAccess() {

  if (
    typeof codeEditor === "undefined" ||
    !codeEditor
  ) {
    return;
  }


  const editorIsReadOnly =
    !isRoomHost &&
    !canEditRoom;


  codeEditor.updateOptions({

    readOnly:
      editorIsReadOnly

  });


  const editStatus =
    document.getElementById(
      "edit-status"
    );


  if (editStatus) {

    if (isRoomHost) {

      editStatus.textContent =
        canEditRoom
          ? "Edit Access: ON"
          : "Edit Access: OFF";

    } else {

      editStatus.textContent =
        editorIsReadOnly
          ? "View Only"
          : "Editing Enabled";

    }

  }


  updateProjectButtons();

}


// ==================================================
// UPDATE HOST CONTROL
// ==================================================

function updateHostEditControl() {

  const editAccessControl =
    document.getElementById(
      "edit-access-control"
    );


  if (!editAccessControl) {
    return;
  }


  editAccessControl.classList.toggle(
    "hidden",
    !isRoomHost
  );


  const editAccessButton =
    document.getElementById(
      "edit-access-btn"
    );


  if (!editAccessButton) {
    return;
  }


  editAccessButton.textContent =
    canEditRoom
      ? "Edit Access: ON"
      : "Edit Access: OFF";


  editAccessButton.classList.toggle(
    "bg-green-700",
    canEditRoom
  );


  editAccessButton.classList.toggle(
    "hover:bg-green-600",
    canEditRoom
  );


  editAccessButton.classList.toggle(
    "bg-red-700",
    !canEditRoom
  );


  editAccessButton.classList.toggle(
    "hover:bg-red-600",
    !canEditRoom
  );

}


// ==================================================
// SEND FILE OPERATION
// ==================================================

window.codeSyncSendFileOperation =
  function (
    operation,
    data
  ) {

    if (!roomId) {
      return;
    }


    if (!userCanModifyProject()) {

      console.log(
        "File operation blocked because edit access is OFF."
      );

      return;

    }


    if (
      operation === "create"
    ) {

      socket.emit(
        "file-create",
        {

          roomId,

          filename:
            data.filename,

          content:
            data.content || ""

        }
      );

    }


    if (
      operation === "rename"
    ) {

      socket.emit(
        "file-rename",
        {

          roomId,

          oldFilename:
            data.oldFilename,

          newFilename:
            data.newFilename

        }
      );

    }


    if (
      operation === "delete"
    ) {

      socket.emit(
        "file-delete",
        {

          roomId,

          filename:
            data.filename

        }
      );

    }

  };


// ==================================================
// SOCKET CONNECT
// ==================================================

socket.on(
  "connect",
  () => {

    console.log(
      `Connected to server as ${socket.id}`
    );


    /*
      IMPORTANT:

      We DO NOT automatically join a room here.

      The user must first enter their name
      and select Create Room / Join Room.
    */


    updateRoomCodeUI();

  }
);


// ==================================================
// ROOM JOINED
// ==================================================

socket.on(
  "room-joined",
  (data) => {

    if (!data) {
      return;
    }


    if (data.roomId) {

      roomId =
        data.roomId;

    }


    if (data.name) {

      userName =
        data.name;

    }


    updateRoomCodeUI();


    console.log(
      `Joined room ${roomId} as ${userName}`
    );

  }
);


// ==================================================
// ROOM ERROR
// ==================================================

socket.on(
  "room-error",
  (message) => {

    console.log(
      "Room error:",
      message
    );


    const event =
      new CustomEvent(
        "codeSyncRoomError",
        {
          detail: message
        }
      );


    window.dispatchEvent(event);

  }
);


// ==================================================
// ROOM STATE
// ==================================================

socket.on(
  "room-state",
  (roomState) => {

    if (!roomState) {
      return;
    }


    roomHostId =
      roomState.hostId;


    canEditRoom =
      roomState.canEdit;


    isRoomHost =
      socket.id ===
      roomHostId;


    console.log(
      `Room Host ID: ${roomHostId}`
    );


    console.log(
      `Am I Host? ${isRoomHost}`
    );


    console.log(
      `Edit Access: ${
        canEditRoom
          ? "ON"
          : "OFF"
      }`
    );


    updateHostEditControl();

    updateEditorEditAccess();


    /*
      Only send our local project when
      the server doesn't already have one.
    */

    if (
      isRoomHost &&
      roomState.hasProject === false
    ) {

      socket.emit(
        "project-state",
        {

          roomId,

          files: {
            ...files
          }

        }
      );


      console.log(
        "Host sent initial project state to server."
      );

    }

  }
);


// ==================================================
// HOST REQUESTED TO SEND PROJECT
// ==================================================

socket.on(
  "request-project-state",
  (targetSocketId) => {

    if (!isRoomHost) {
      return;
    }


    socket.emit(
      "project-state",
      {

        roomId,

        files: {
          ...files
        },

        targetSocketId

      }
    );


    console.log(
      `Sent project state to new user ${targetSocketId}`
    );

  }
);


// ==================================================
// RECEIVE PROJECT STATE
// ==================================================

socket.on(
  "project-state",
  (projectState) => {

    if (
      !projectState ||
      !projectState.files
    ) {
      return;
    }


    /*
      Replace local project
      with shared project.
    */

    Object.keys(files).forEach(
      (filename) => {

        delete files[filename];

      }
    );


    Object.assign(
      files,
      projectState.files
    );


    /*
      If active file no longer exists,
      choose first available file.
    */

    if (
      !Object.prototype.hasOwnProperty.call(
        files,
        activeFile
      )
    ) {

      const filenames =
        Object.keys(files);


      if (filenames.length > 0) {

        activeFile =
          filenames[0];

      }

    }


    renderFileList();


    /*
      Update Monaco if ready.
    */

    if (
      typeof codeEditor !== "undefined" &&
      codeEditor
    ) {

      isApplyingRemoteChange =
        true;


      codeEditor.setValue(
        files[activeFile]
      );


      monaco.editor.setModelLanguage(
        codeEditor.getModel(),
        getLanguageForFile(
          activeFile
        )
      );


      isApplyingRemoteChange =
        false;

    }


    if (
      typeof saveProjectToStorage ===
      "function"
    ) {

      saveProjectToStorage();

    }


    console.log(
      "Shared project received."
    );

  }
);


// ==================================================
// HOST EDIT ACCESS BUTTON
// ==================================================

const editAccessButton =
  document.getElementById(
    "edit-access-btn"
  );


if (editAccessButton) {

  editAccessButton.addEventListener(
    "click",
    () => {

      if (!isRoomHost) {
        return;
      }


      if (!roomId) {
        return;
      }


      socket.emit(
        "toggle-edit-access",
        roomId
      );

    }
  );

}


// ==================================================
// ONLINE USERS
// ==================================================

socket.on(
  "user-list",
  (users) => {

    if (!Array.isArray(users)) {
      return;
    }


    const count =
      users.length;


    const countLabel =
      count === 1
        ? "1 User"
        : `${count} Users`;


    const countElement =
      document.getElementById(
        "user-count"
      );


    if (countElement) {

      countElement.textContent =
        countLabel;

    }


    const onlineList =
      document.getElementById(
        "online-list"
      );


    if (!onlineList) {
      return;
    }


    onlineList.innerHTML =
      "";


    users.forEach(
      (user) => {

        const li =
          document.createElement(
            "li"
          );


        const isMe =
          user.id ===
          socket.id;


        const isHost =
          user.id ===
          roomHostId;


        const displayName =
          user.label ||
          user.name ||
          "Anonymous";


        if (
          isMe &&
          isHost
        ) {

          li.textContent =
            `🟢 ${displayName} 👑 Host`;

        } else if (
          isMe
        ) {

          li.textContent =
            `🟢 ${displayName} (You)`;

        } else if (
          isHost
        ) {

          li.textContent =
            `🟢 ${displayName} 👑 Host`;

        } else {

          li.textContent =
            `🟢 ${displayName}`;

        }


        onlineList.appendChild(
          li
        );

      }
    );

  }
);


// ==================================================
// SHARE ROOM
// ==================================================

const shareButton =
  document.getElementById(
    "share-btn"
  );


if (shareButton) {

  shareButton.addEventListener(
    "click",
    async () => {

      if (!roomId) {
        return;
      }


      const shareLink =
        `${window.location.origin}/?room=${roomId}`;


      try {

        await navigator.clipboard.writeText(
          shareLink
        );


        const originalText =
          shareButton.textContent;


        shareButton.textContent =
          "Copied!";


        setTimeout(
          () => {

            shareButton.textContent =
              originalText;

          },
          1500
        );


      } catch (error) {

        alert(
          `Couldn't copy automatically. Here's the link:\n${shareLink}`
        );

      }

    }
  );

}


// ==================================================
// REAL-TIME CODE SYNC
// ==================================================

function setupCodeSync() {

  if (
    typeof codeEditor === "undefined" ||
    !codeEditor
  ) {
    return;
  }


  codeEditor.onDidChangeModelContent(
    () => {

      if (
        isApplyingRemoteChange
      ) {
        return;
      }


      if (!roomId) {
        return;
      }


      /*
        Keep local files object updated.
      */

      files[activeFile] =
        codeEditor.getValue();


      /*
        Keep LocalStorage updated.
      */

      if (
        typeof saveProjectToStorage ===
        "function"
      ) {

        saveProjectToStorage();

      }


      socket.emit(
        "code-change",
        {

          roomId,

          filename:
            activeFile,

          content:
            codeEditor.getValue()

        }
      );

    }
  );

}


// ==================================================
// RECEIVE CODE CHANGE
// ==================================================

socket.on(
  "code-change",
  ({
    filename,
    content
  }) => {

    files[filename] =
      content;


    if (
      filename ===
      activeFile
    ) {

      isApplyingRemoteChange =
        true;


      const position =
        codeEditor.getPosition();


      codeEditor.setValue(
        content
      );


      if (position) {

        codeEditor.setPosition(
          position
        );

      }


      isApplyingRemoteChange =
        false;

    }


    if (
      typeof saveProjectToStorage ===
      "function"
    ) {

      saveProjectToStorage();

    }

  }
);


// ==================================================
// RECEIVE NEW FILE
// ==================================================

socket.on(
  "file-create",
  ({
    filename,
    content
  }) => {

    if (
      Object.prototype.hasOwnProperty.call(
        files,
        filename
      )
    ) {
      return;
    }


    files[filename] =
      content || "";


    renderFileList();

    saveProjectToStorage();


    console.log(
      `New shared file received: ${filename}`
    );

  }
);


// ==================================================
// RECEIVE FILE RENAME
// ==================================================

socket.on(
  "file-rename",
  ({
    oldFilename,
    newFilename
  }) => {

    if (
      !Object.prototype.hasOwnProperty.call(
        files,
        oldFilename
      )
    ) {
      return;
    }


    if (
      Object.prototype.hasOwnProperty.call(
        files,
        newFilename
      )
    ) {
      return;
    }


    files[newFilename] =
      files[oldFilename];


    delete files[
      oldFilename
    ];


    /*
      If renamed file is currently open,
      update activeFile.
    */

    if (
      activeFile ===
      oldFilename
    ) {

      activeFile =
        newFilename;


      if (
        typeof codeEditor !== "undefined" &&
        codeEditor
      ) {

        monaco.editor.setModelLanguage(
          codeEditor.getModel(),
          getLanguageForFile(
            newFilename
          )
        );

      }

    }


    renderFileList();

    saveProjectToStorage();


    console.log(
      `Shared file renamed: ${oldFilename} → ${newFilename}`
    );

  }
);


// ==================================================
// RECEIVE FILE DELETE
// ==================================================

socket.on(
  "file-delete",
  ({
    filename
  }) => {

    if (
      !Object.prototype.hasOwnProperty.call(
        files,
        filename
      )
    ) {
      return;
    }


    delete files[
      filename
    ];


    /*
      If deleted file was active,
      switch to another file.
    */

    if (
      activeFile ===
      filename
    ) {

      const remainingFiles =
        Object.keys(files);


      if (
        remainingFiles.length > 0
      ) {

        activeFile =
          remainingFiles[0];


        if (
          typeof codeEditor !== "undefined" &&
          codeEditor
        ) {

          isApplyingRemoteChange =
            true;


          codeEditor.setValue(
            files[activeFile]
          );


          monaco.editor.setModelLanguage(
            codeEditor.getModel(),
            getLanguageForFile(
              activeFile
            )
          );


          isApplyingRemoteChange =
            false;

        }

      }

    }


    renderFileList();

    saveProjectToStorage();


    console.log(
      `Shared file deleted: ${filename}`
    );

  }
);


// ==================================================
// DISCONNECT
// ==================================================

socket.on(
  "disconnect",
  () => {

    console.log(
      "Disconnected from server"
    );

  }
);