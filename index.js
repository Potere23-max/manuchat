const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 5e6, // Limite sicurezza 5MB per pacchetto
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

const stanze = {
  "Pausa Caffè": {
    pubblica: true,
    max: 20,
    utenti: 0,
    codiceInvito: generaCodiceInvito(),
  },
};

const timerEliminazioneStanze = {};
function generaCodiceInvito() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  socket.on("entraConInvito", ({ codice }) => {
    const room = Object.keys(stanze).find(
      (nome) => stanze[nome].codiceInvito === codice
    );

    if (!room) {
      socket.emit("stanzaNonEsiste");
      return;
    }

    if (stanze[room].utenti >= stanze[room].max) {
      socket.emit("stanzaPiena");
      return;
    }

    socket.emit("invitoValido", room);
  });

  socket.on("richiediInvito", () => {
    const room = socket.data.room;

    if (room && stanze[room]) {
      socket.emit("linkInvito", {
        codice: stanze[room].codiceInvito,
      });
    }
  });

  socket.on("richiediStanze", () => {
    aggiornaListaStanze(socket);
  });

  socket.on("joinRoom", ({ username, room, password, crea }) => {
    if (!stanze[room]) {
      if (!crea) {
        socket.emit("stanzaNonEsiste");

        return;
      }

      stanze[room] = {
        pubblica: false,

        password: password || "",

        max: 20,

        utenti: 0,

        codiceInvito: generaCodiceInvito(),
      };
    }

    if (!stanze[room].pubblica) {
      const passwordStanza = stanze[room].password || "";

      const accessoDaInvito = password === "__INVITO__";

      if (!accessoDaInvito && passwordStanza !== password) {
        socket.emit("passwordErrata");

        return;
      }
    }

    if (stanze[room].utenti >= stanze[room].max) {
      socket.emit("stanzaPiena");

      return;
    }

    socket.join(room);

    socket.data.username = username;
    socket.data.room = room;

    if (timerEliminazioneStanze[room]) {
      clearTimeout(timerEliminazioneStanze[room]);

      delete timerEliminazioneStanze[room];
    }

    stanze[room].utenti++;

    io.to(room).emit("newMessage", {
      user: "Sistema",
      text: `👋 ${username} è entrato in stanza!`,
    });

    aggiornaTutteLeStanze();

    aggiornaUtentiStanza(room);
  });

  socket.on("leaveRoom", () => {
    const room = socket.data.room;

    if (room && stanze[room]) {
      socket.leave(room);

      stanze[room].utenti--;

      if (stanze[room].utenti < 0) {
        stanze[room].utenti = 0;
      }

      if (stanze[room].utenti === 0 && !stanze[room].pubblica) {
        timerEliminazioneStanze[room] = setTimeout(() => {
          if (stanze[room] && stanze[room].utenti === 0) {
            delete stanze[room];

            console.log(`🗑️ Stanza privata eliminata: ${room}`);
          }

          delete timerEliminazioneStanze[room];

          aggiornaTutteLeStanze();
        }, 30 * 60 * 1000);
      }

      socket.data.room = null;

      aggiornaTutteLeStanze();

      aggiornaUtentiStanza(room);
    }
  });

  socket.on("sendMessage", (data) => {
    const room = socket.data.room;
    const username = socket.data.username || "Anonimo";

    if (room) {
      const messaggio = {
        id: Date.now().toString(),
        user: username,
        text: data.text,
        image: data.image,
      };

      io.to(room).emit("newMessage", messaggio);
    }
  });

  socket.on("deleteMessage", (id) => {
    const room = socket.data.room;

    if (room) {
      io.to(room).emit("messageDeleted", id);
    }
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;

    if (room && stanze[room]) {
      stanze[room].utenti--;

      if (stanze[room].utenti < 0) {
        stanze[room].utenti = 0;
      }

      if (stanze[room].utenti === 0 && !stanze[room].pubblica) {
        timerEliminazioneStanze[room] = setTimeout(() => {
          if (stanze[room] && stanze[room].utenti === 0) {
            delete stanze[room];

            console.log(`🗑️ Stanza privata eliminata: ${room}`);
          }

          delete timerEliminazioneStanze[room];

          aggiornaTutteLeStanze();
        }, 30 * 60 * 1000);
      }

      aggiornaTutteLeStanze();

      aggiornaUtentiStanza(room);
    }
  });
});

function aggiornaUtentiStanza(room) {
  if (!stanze[room]) {
    return;
  }

  const utenti = [];

  for (const id of io.sockets.adapter.rooms.get(room) || []) {
    const client = io.sockets.sockets.get(id);

    if (client && client.data.username) {
      utenti.push(client.data.username);
    }
  }

  io.to(room).emit("utentiPresenti", utenti);
}

function aggiornaListaStanze(socket) {
  const lista = Object.keys(stanze)
    .filter((nome) => stanze[nome].pubblica)
    .map((nome) => {
      return {
        nome: nome,
        utenti: stanze[nome].utenti,
        max: stanze[nome].max,
      };
    });

  socket.emit("listaStanze", lista);
}

function aggiornaTutteLeStanze() {
  const lista = Object.keys(stanze)
    .filter((nome) => stanze[nome].pubblica)
    .map((nome) => {
      return {
        nome: nome,
        utenti: stanze[nome].utenti,
        max: stanze[nome].max,
      };
    });

  io.emit("listaStanze", lista);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server in ascolto sulla porta ${PORT}`);
});
