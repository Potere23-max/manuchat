let socket;
let mioNome = "";
let stanzaCorrente = "";
const suonoNotifica = new Audio("/notification.mp3");

const avatars = ["🧔", "👨", "👩", "👱‍♀️", "🧑", "🧑‍🦱"];

function assegnaAvatar(nome) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  const indice = Math.abs(hash) % avatars.length;
  return avatars[indice];
}

// Inizializzazione unica del socket con l'URL del backend Render
function ottieniSocket() {
  if (!socket) {
    socket = io("https://manuchat.onrender.com");
  }
  return socket;
}

function mostraToast(messaggio, tipo = "error") {
  clearTimeout(window.toastTimer);
  clearTimeout(window.toastShowTimer);

  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.className = "toast";

  if (tipo === "warning") {
    toast.classList.add("toast-warning");
  } else if (tipo === "success") {
    toast.classList.add("toast-success");
  } else {
    toast.classList.add("toast-error");
  }

  toast.innerText = messaggio;

  window.toastShowTimer = setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 5000);
}

function mostraStanze() {
  const nome = document.getElementById("username").value.trim();

  if (!nome) {
    mostraToast("Inserisci il tuo nome!", "warning");
    return;
  }

  mioNome = nome;
  localStorage.setItem("nome", nome);

  const params = new URLSearchParams(window.location.search);
  const codiceInvito = params.get("invito");

  if (codiceInvito) {
    localStorage.setItem("invito", codiceInvito);

    const urlPulito = window.location.origin + window.location.pathname;

    window.history.replaceState({}, document.title, urlPulito);
  }

  document.getElementById("login").style.display = "none";
  document.getElementById("stanze").style.display = "flex";

  if (!socket) {
    socket = io("https://manuchat.onrender.com");

    socket.on("messageDeleted", (id) => {
      const elemento = document.getElementById("msg-" + id);

      if (elemento) {
        elemento.remove();
      }
    });

    socket.on("linkInvito", (data) => {
      const box = document.getElementById("invito-box");

      if (!box) {
        return;
      }

      const link = window.location.origin + "/?invito=" + data.codice;

      box.style.display = "block";

      box.innerHTML = `
<strong>🔗 Link invito:</strong><br>
<small>${link}</small>
<br>
<button onclick="copiaInvito('${link}')">
📤 Condividi
</button>

<button 
onclick="chiudiInvito()"
style="background:#c1121f; margin-left:5px"
>
✖ Chiudi
</button>
`;
    });

    socket.on("invitoValido", (stanza) => {
      localStorage.removeItem("invito");

      window.history.replaceState({}, document.title, "/");

      entraStanza(stanza, false, "__INVITO__");
    });

    socket.on("stanzaPiena", () => {
      mostraToast("⚠️ Questa stanza è piena (massimo 20 persone)", "warning");

      document.getElementById("azione").style.display = "none";
      document.getElementById("stanze").style.display = "flex";

      socket.emit("richiediStanze");
    });

    socket.on("utentiPresenti", (utenti) => {
      const box = document.getElementById("lista-utenti-box");

      if (!box) {
        return;
      }

      if (utenti.length === 0) {
        box.innerHTML = "Nessun partecipante presente";
        return;
      }

      box.innerHTML = `
        <strong>👥 Partecipanti:</strong><br>
        ${utenti.map((utente) => "☕ " + utente).join("<br>")}
      `;
    });

    socket.on("listaStanze", (stanze) => {
      const box = document.getElementById("lista-stanze");

      box.innerHTML = "";

      stanze.forEach((stanza) => {
        if (stanza.utenti >= stanza.max) {
          box.innerHTML += `
                <div class="stanza-card" style="opacity:0.6">
                  <div class="stanza-info">
                    <div class="stanza-nome">🚫 ${stanza.nome}</div>
                    <div class="stanza-utenti">
                      ${stanza.utenti}/${stanza.max} utenti
                    </div>
                  </div>
                </div>
              `;
        } else {
          box.innerHTML += `
                <div class="stanza-card" onclick="entraStanza('${stanza.nome}')">
                  <div class="stanza-info">
                    <div class="stanza-nome">☕ ${stanza.nome}</div>
                    <div class="stanza-utenti">
                      ${stanza.utenti}/${stanza.max} utenti
                    </div>
                  </div>

                  <div class="stanza-entra">
                    Entra
                  </div>
                </div>
              `;
        }
      });
    });
  }

  const invitoSalvato = localStorage.getItem("invito");

  if (invitoSalvato) {
    socket.emit("entraConInvito", {
      username: mioNome,
      codice: invitoSalvato,
    });
  }

  socket.emit("richiediStanze");
}

function mostraCreaStanza() {
  document.getElementById("scelta-privata").style.display = "none";

  document.getElementById("crea-stanza-box").style.display = "block";
}

function mostraUniscitiStanza() {
  document.getElementById("scelta-privata").style.display = "none";

  document.getElementById("unisciti-stanza-box").style.display = "block";
}

function tornaSceltaPrivata() {
  document.getElementById("scelta-privata").style.display = "block";

  document.getElementById("crea-stanza-box").style.display = "none";

  document.getElementById("unisciti-stanza-box").style.display = "none";
}

function uniscitiStanza() {
  const stanza = document.getElementById("join-room").value.trim();

  const password = document.getElementById("join-password").value.trim();

  if (!stanza) {
    mostraToast("Inserisci il tuo nome!", "warning");
    return;
  }

  entraStanza(stanza, false, password);
}

function creaStanza() {
  const stanza = document.getElementById("room").value.trim();

  const password = document.getElementById("room-password").value.trim();

  if (!stanza) {
    mostraToast("Inserisci il tuo nome!", "warning");
    return;
  }

  entraStanza(stanza, true, password);
}

function entraStanza(stanzaPubblica = null, crea = false, password = "") {
  const nome = mioNome;

  const stanza = stanzaPubblica || document.getElementById("room").value.trim();
  stanzaCorrente = stanza;

  if (password === "") {
    password = document.getElementById("room-password").value.trim();
  }

  if (!stanza) {
    mostraToast("Inserisci il tuo nome!", "warning");
    return;
  }

  if (!socket) {
    socket = io("https://manuchat.onrender.com");
  }

  document.getElementById("stanze").style.display = "none";
  document.getElementById("azione").style.display = "flex";
  document.getElementById("chat-box").innerHTML = "";

  document.getElementById(
    "benvenuto"
  ).innerText = `Stanza: ${stanza} (${nome})`;

  socket.off("stanzaNonEsiste");

  socket.on("stanzaNonEsiste", () => {
    mostraToast("❌ Questa stanza privata non esiste", "error");

    document.getElementById("azione").style.display = "none";
    document.getElementById("stanze").style.display = "flex";

    socket.emit("richiediStanze");
  });

  socket.off("passwordErrata");

  socket.on("passwordErrata", () => {
    mostraToast("🔒 Password stanza errata", "error");

    document.getElementById("azione").style.display = "none";
    document.getElementById("stanze").style.display = "flex";
  });

  socket.off("newMessage");

  socket.on("newMessage", (data) => {
    const box = document.getElementById("chat-box");

    if (!box) {
      return;
    }

    if (data.user !== mioNome) {
      suonoNotifica.play().catch(() => {});
    }

    if (!data.user) {
      data.user = "Sistema";
    }

    let classe = "msg-other";

    if (data.user === "Sistema") {
      classe = "msg-system";
    } else if (data.user === mioNome) {
      classe = "msg-me";
    }

    if (data.id && document.getElementById("msg-" + data.id)) {
      return;
    }

    const idMessaggio = data.id
      ? `msg-${data.id}`
      : `msg-${Date.now()}-${Math.random()}`;

    let contenuto = `<div id="${idMessaggio}" class="msg ${classe}">`;

    if (data.user !== "Sistema") {
      const avatar = assegnaAvatar(data.user);
      contenuto += `<div class="msg-user">${avatar} ${data.user}</div>`;
    }

    if (data.text) {
      contenuto += `<div>${escapeHTML(data.text)}</div>`;
    }

    if (data.image) {
      contenuto += `<img class="msg-img" src="${data.image}" />`;
    }

    if (data.user === mioNome) {
      contenuto += `
  <button onclick="eliminaMessaggio('${data.id}')">
    🗑️
  </button>
`;
    }

    contenuto += `</div>`;

    box.innerHTML = contenuto + box.innerHTML;
  });
  socket.emit("joinRoom", {
    username: nome,
    room: stanza,
    password: password,
    crea: crea,
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function apriUtenti() {
  const box = document.getElementById("lista-utenti-box");
  const titolo = document.getElementById("utenti-presenti");

  if (!box || !titolo) {
    return;
  }

  if (box.style.display === "none") {
    box.style.display = "block";
    titolo.innerText = "❌ Nascondi partecipanti";
  } else {
    box.style.display = "none";
    titolo.innerText = "👥 Mostra partecipanti";
  }
}

function eliminaMessaggio(id) {
  socket.emit("deleteMessage", id);
}

function esciStanza() {
  stanzaCorrente = "";

  localStorage.removeItem("invito");

  document.getElementById("lista-utenti-box").innerHTML = "";

  socket.emit("leaveRoom");

  socket.off("newMessage");
  socket.off("stanzaNonEsiste");
  socket.off("passwordErrata");

  document.getElementById("azione").style.display = "none";
  document.getElementById("stanze").style.display = "flex";

  document.getElementById("chat-box").innerHTML = "";

  socket.emit("richiediStanze");
}

function chiediCaffe() {
  socket.emit("sendMessage", { text: "📢 Hey! Chi si fa un caffè? ☕" });
}

function inviaMessaggio() {
  const input = document.getElementById("messageInput");
  const testo = input.value.trim();
  if (testo) {
    socket.emit("sendMessage", { text: testo });
    input.value = "";
  }
}

// Funzione unica e verificata per fotocamera e galleria
function processaEInviaFoto(fileInput) {
  const file = fileInput.files[0];

  if (!file) return;

  if (file.type === "image/gif") {
    const reader = new FileReader();

    reader.onload = function (e) {
      socket.emit("sendMessage", {
        image: e.target.result,
      });

      fileInput.value = "";
    };

    reader.readAsDataURL(file);

    return;
  }

  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const maxDimension = 800; // Ridimensione a risoluzione ottimale
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Compressione leggera al 70% per caricamento rapido
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);

      socket.emit("sendMessage", {
        image: compressedDataUrl,
      });

      fileInput.value = ""; // Reset dell'input
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function mostraInvito() {
  socket.emit("richiediInvito");
}

function chiudiInvito() {
  const box = document.getElementById("invito-box");

  if (!box) {
    return;
  }

  box.style.display = "none";
  box.innerHTML = "";
}

async function copiaInvito(link) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Pausa Caffè ☕",
        text: "Unisciti alla mia stanza!",
        url: link,
      });

      return;
    } catch (err) {
      // Utente ha annullato o share non riuscita
    }
  }

  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        mostraToast("✅ Link copiato!", "success");
      })
      .catch(() => {
        mostraToast("❌ Copia non riuscita", "error");
      });

    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = link;

  document.body.appendChild(textarea);

  textarea.select();

  document.execCommand("copy");

  textarea.remove();

  mostraToast("✅ Link copiato!", "success");
}

function controllaInvito() {
  const params = new URLSearchParams(window.location.search);

  const codice = params.get("invito");

  if (!codice) {
    return;
  }

  const nomeSalvato = localStorage.getItem("nome");

  if (!nomeSalvato) {
    return;
  }

  if (!socket) {
    socket = io("https://manuchat.onrender.com");
  }

  socket.emit("entraConInvito", {
    username: nomeSalvato,
    codice: codice,
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js");
  });
}
