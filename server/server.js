// server.js
// Express server + Socket.IO real-time layer.

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

// --------------------------------------------------
// SERVE FRONTEND
// --------------------------------------------------

app.use(
  express.static(
    path.join(__dirname, "..")
  )
);

// --------------------------------------------------
// ROOM STORAGE
// --------------------------------------------------

/*
  Example:

  rooms = {
    ABC123: {
      hostId: "socket-id",
      canEdit: true,

      users: [
        {
          id: "socket-id",
          label: "Ayush"
        }
      ],

      files: {
        "index.html": "...",
        "style.css": "...",
        "script.js": "..."
      }
    }
  }
*/

const rooms = {};

// --------------------------------------------------
// HELPER — CHECK EDIT PERMISSION
// --------------------------------------------------

function userCanEdit(room, socket) {
  return (
    socket.id === room.hostId ||
    room.canEdit === true
  );
}

// --------------------------------------------------
// HELPER — SEND ROOM STATE
// --------------------------------------------------

function broadcastRoomState(roomId) {
  const room = rooms[roomId];

  if (!room) {
    return;
  }

  io.to(roomId).emit(
    "room-state",
    {
      hostId: room.hostId,
      canEdit: room.canEdit,
      hasProject: room.files !== null,
    }
  );
}

// --------------------------------------------------
// HELPER — SEND USER LIST
// --------------------------------------------------

function broadcastUserList(roomId) {
  const room = rooms[roomId];

  if (!room) {
    return;
  }

  io.to(roomId).emit(
    "user-list",
    room.users
  );
}

// --------------------------------------------------
// HELPER — CLEAN USER NAME
// --------------------------------------------------

function cleanUserName(name) {
  if (typeof name !== "string") {
    return "";
  }

  return name
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 30);
}

// --------------------------------------------------
// CONNECTION
// --------------------------------------------------

io.on("connection", (socket) => {
  console.log(
    `Socket connected: ${socket.id}`
  );

  // ==================================================
  // JOIN ROOM
  // ==================================================

  /*
    Frontend sends:

    socket.emit("join-room", {
      roomId: "ABC123",
      name: "Ayush"
    });
  */

  socket.on(
    "join-room",
    (data) => {
      // ----------------------------------------------
      // READ ROOM ID + USER NAME
      // ----------------------------------------------

      let roomId;
      let userName;

      /*
        Support both formats:

        Old:
        join-room("ABC123")

        New:
        join-room({
          roomId: "ABC123",
          name: "Ayush"
        })
      */

      if (typeof data === "string") {
        roomId = data.trim().toUpperCase();
        userName = "";
      } else if (
        data &&
        typeof data === "object"
      ) {
        roomId =
          typeof data.roomId === "string"
            ? data.roomId.trim().toUpperCase()
            : "";

        userName =
          cleanUserName(data.name);
      }

      // ----------------------------------------------
      // VALIDATE ROOM ID
      // ----------------------------------------------

      if (!roomId) {
        socket.emit(
          "room-error",
          "Room code is required."
        );

        return;
      }

      // ----------------------------------------------
      // VALIDATE USER NAME
      // ----------------------------------------------

      if (!userName) {
        socket.emit(
          "room-error",
          "Please enter your name first."
        );

        return;
      }

      // ----------------------------------------------
      // CREATE ROOM IF IT DOES NOT EXIST
      // ----------------------------------------------

      if (!rooms[roomId]) {
        rooms[roomId] = {
          hostId: socket.id,

          canEdit: true,

          users: [],

          /*
            null means the server does not
            have the project yet.

            The first host will send it.
          */
          files: null,
        };

        console.log(
          `Room ${roomId} created by ${userName} (${socket.id})`
        );
      }

      const room = rooms[roomId];

      // ----------------------------------------------
      // PREVENT SAME SOCKET FROM JOINING TWICE
      // ----------------------------------------------

      const alreadyJoined =
        room.users.some(
          (user) =>
            user.id === socket.id
        );

      if (alreadyJoined) {
        socket.emit(
          "room-joined",
          {
            roomId,
            hostId: room.hostId,
            canEdit: room.canEdit,
            userName,
          }
        );

        return;
      }

      // ----------------------------------------------
      // JOIN SOCKET.IO ROOM
      // ----------------------------------------------

      socket.join(roomId);

      socket.data.roomId = roomId;

      socket.data.userName = userName;

      // ----------------------------------------------
      // STORE REAL USER NAME
      // ----------------------------------------------

      room.users.push({
        id: socket.id,
        label: userName,
      });

      console.log(
        `Socket ${socket.id} joined room ${roomId} as ${userName} (${room.users.length} users now)`
      );

      // ----------------------------------------------
      // TELL CLIENT JOIN WAS SUCCESSFUL
      // ----------------------------------------------

      socket.emit(
        "room-joined",
        {
          roomId,
          hostId: room.hostId,
          canEdit: room.canEdit,
          userName,
        }
      );

      // ----------------------------------------------
      // SEND ROOM STATE
      // ----------------------------------------------

      broadcastRoomState(roomId);

      // ----------------------------------------------
      // SEND ONLINE USERS
      // ----------------------------------------------

      broadcastUserList(roomId);

      // ----------------------------------------------
      // SEND EXISTING PROJECT
      // ----------------------------------------------

      if (room.files !== null) {
        /*
          Server already knows the project.

          Send it directly to the new user.
        */

        socket.emit(
          "project-state",
          {
            files: room.files,
          }
        );
      } else if (
        room.users.length > 1
      ) {
        /*
          Server doesn't have the project yet.

          Ask the HOST to send it.

          We send the new user's socket ID
          so the host's response can be delivered
          specifically to that user.
        */

        io.to(room.hostId).emit(
          "request-project-state",
          socket.id
        );
      }
    }
  );

  // ==================================================
  // RECEIVE PROJECT FROM HOST
  // ==================================================

  socket.on(
    "project-state",
    ({
      roomId,
      files,
      targetSocketId = null,
    }) => {
      const room = rooms[roomId];

      if (
        !room ||
        socket.data.roomId !== roomId
      ) {
        return;
      }

      /*
        ONLY HOST CAN SEND THE
        AUTHORITATIVE PROJECT STATE.
      */

      if (
        socket.id !== room.hostId
      ) {
        console.log(
          `Blocked unauthorized project-state from ${socket.id}`
        );

        return;
      }

      if (
        !files ||
        typeof files !== "object"
      ) {
        return;
      }

      // Store project on server.
      room.files = {
        ...files,
      };

      console.log(
        `Project state stored for room ${roomId}`
      );

      // ----------------------------------------------
      // SEND TO SPECIFIC NEW USER
      // ----------------------------------------------

      if (targetSocketId) {
        const targetExists =
          room.users.some(
            (user) =>
              user.id === targetSocketId
          );

        if (targetExists) {
          io.to(targetSocketId).emit(
            "project-state",
            {
              files: room.files,
            }
          );
        }

        return;
      }

      /*
        No target means this is the first
        project initialization.

        We don't need to broadcast it because
        the host already has the project.
      */
    }
  );

  // ==================================================
  // TOGGLE EDIT ACCESS
  // ==================================================

  socket.on(
    "toggle-edit-access",
    (roomId) => {
      const room = rooms[roomId];

      if (
        !room ||
        socket.data.roomId !== roomId
      ) {
        return;
      }

      // Only host can toggle permission.
      if (
        socket.id !== room.hostId
      ) {
        console.log(
          `Unauthorized edit-access toggle attempt by ${socket.id}`
        );

        return;
      }

      room.canEdit =
        !room.canEdit;

      console.log(
        `Room ${roomId} edit access: ${
          room.canEdit
            ? "ON"
            : "OFF"
        }`
      );

      broadcastRoomState(roomId);
    }
  );

  // ==================================================
  // CODE CHANGE
  // ==================================================

  socket.on(
    "code-change",
    ({
      roomId,
      filename,
      content,
    }) => {
      const room = rooms[roomId];

      if (
        !room ||
        socket.data.roomId !== roomId
      ) {
        return;
      }

      // Check permission.
      if (
        !userCanEdit(
          room,
          socket
        )
      ) {
        console.log(
          `Blocked code change from ${socket.id} because edit access is OFF`
        );

        return;
      }

      if (
        typeof filename !== "string" ||
        typeof content !== "string"
      ) {
        return;
      }

      /*
        Keep the server's copy updated.

        This allows new users to receive
        the latest project.
      */

      if (room.files === null) {
        room.files = {};
      }

      room.files[filename] =
        content;

      // Send change to everyone else.
      socket
        .to(roomId)
        .emit(
          "code-change",
          {
            filename,
            content,
          }
        );
    }
  );

  // ==================================================
  // CREATE FILE
  // ==================================================

  socket.on(
    "file-create",
    ({
      roomId,
      filename,
      content = "",
    }) => {
      const room = rooms[roomId];

      if (
        !room ||
        socket.data.roomId !== roomId
      ) {
        return;
      }

      if (
        !userCanEdit(
          room,
          socket
        )
      ) {
        console.log(
          `Blocked file creation from ${socket.id}`
        );

        return;
      }

      if (
        typeof filename !== "string" ||
        !filename.trim()
      ) {
        return;
      }

      if (
        typeof content !== "string"
      ) {
        content = "";
      }

      if (room.files === null) {
        room.files = {};
      }

      // Don't overwrite an existing file.
      if (
        Object.prototype.hasOwnProperty.call(
          room.files,
          filename
        )
      ) {
        return;
      }

      room.files[filename] =
        content;

      console.log(
        `${filename} created in room ${roomId}`
      );

      // Send to everyone except sender.
      socket
        .to(roomId)
        .emit(
          "file-create",
          {
            filename,
            content,
          }
        );
    }
  );

  // ==================================================
  // RENAME FILE
  // ==================================================

  socket.on(
    "file-rename",
    ({
      roomId,
      oldFilename,
      newFilename,
    }) => {
      const room = rooms[roomId];

      if (
        !room ||
        socket.data.roomId !== roomId
      ) {
        return;
      }

      if (
        !userCanEdit(
          room,
          socket
        )
      ) {
        console.log(
          `Blocked file rename from ${socket.id}`
        );

        return;
      }

      if (
        typeof oldFilename !== "string" ||
        typeof newFilename !== "string" ||
        !newFilename.trim()
      ) {
        return;
      }

      if (
        room.files === null
      ) {
        return;
      }

      // Old file must exist.
      if (
        !Object.prototype.hasOwnProperty.call(
          room.files,
          oldFilename
        )
      ) {
        return;
      }

      // New filename must not already exist.
      if (
        Object.prototype.hasOwnProperty.call(
          room.files,
          newFilename
        )
      ) {
        return;
      }

      room.files[newFilename] =
        room.files[oldFilename];

      delete room.files[
        oldFilename
      ];

      console.log(
        `${oldFilename} renamed to ${newFilename} in room ${roomId}`
      );

      socket
        .to(roomId)
        .emit(
          "file-rename",
          {
            oldFilename,
            newFilename,
          }
        );
    }
  );

  // ==================================================
  // DELETE FILE
  // ==================================================

  socket.on(
    "file-delete",
    ({
      roomId,
      filename,
    }) => {
      const room = rooms[roomId];

      if (
        !room ||
        socket.data.roomId !== roomId
      ) {
        return;
      }

      if (
        !userCanEdit(
          room,
          socket
        )
      ) {
        console.log(
          `Blocked file deletion from ${socket.id}`
        );

        return;
      }

      if (
        room.files === null
      ) {
        return;
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          room.files,
          filename
        )
      ) {
        return;
      }

      /*
        Don't allow the shared project
        to have zero files.
      */

      if (
        Object.keys(room.files).length <= 1
      ) {
        console.log(
          `Blocked deletion of last file in room ${roomId}`
        );

        return;
      }

      delete room.files[filename];

      console.log(
        `${filename} deleted from room ${roomId}`
      );

      socket
        .to(roomId)
        .emit(
          "file-delete",
          {
            filename,
          }
        );
    }
  );

  // ==================================================
  // DISCONNECT
  // ==================================================

  socket.on(
    "disconnect",
    () => {
      const roomId =
        socket.data.roomId;

      if (
        !roomId ||
        !rooms[roomId]
      ) {
        return;
      }

      const room =
        rooms[roomId];

      const wasHost =
        socket.id === room.hostId;

      // ----------------------------------------------
      // REMOVE USER
      // ----------------------------------------------

      room.users =
        room.users.filter(
          (user) =>
            user.id !== socket.id
        );

      console.log(
        `Socket ${socket.id} (${socket.data.userName || "Unknown"}) left room ${roomId} (${room.users.length} users left)`
      );

      // ----------------------------------------------
      // HOST TRANSFER
      // ----------------------------------------------

      if (
        wasHost &&
        room.users.length > 0
      ) {
        const newHost =
          room.users[0];

        room.hostId =
          newHost.id;

        console.log(
          `Host left room ${roomId}. New host: ${newHost.id} (${newHost.label})`
        );
      }

      // ----------------------------------------------
      // DELETE EMPTY ROOM
      // ----------------------------------------------

      if (
        room.users.length === 0
      ) {
        delete rooms[roomId];

        console.log(
          `Room ${roomId} deleted because it is empty`
        );

        return;
      }

      // ----------------------------------------------
      // UPDATE REMAINING USERS
      // ----------------------------------------------

      broadcastUserList(roomId);
      broadcastRoomState(roomId);

      /*
        If the new host took over and the server
        already has the project, send it to the
        new host so its local project is aligned.
      */

      if (
        room.files !== null
      ) {
        io.to(room.hostId).emit(
          "project-state",
          {
            files: room.files,
          }
        );
      }
    }
  );
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

httpServer.listen(
  PORT,
  () => {
    console.log(
      `CodeSync server running at http://localhost:${PORT}`
    );
  }
);