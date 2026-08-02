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
