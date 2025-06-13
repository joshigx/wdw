// Deno WebSocket Server
const PORT = 8080;
const clients = new Map(); // websocket -> { id, name, lobbyId }
const lobbies = new Map(); // lobbyId -> { id, creator, players, started, words }

// Generiere zufällige Lobby ID
function generateLobbyId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id;
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (lobbies.has(id));
  return id;
}

// Sende Nachricht an einen Client
function sendToClient(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Sende Nachricht an alle Clients in einer Lobby
function sendToLobby(lobbyId, data, excludeWs = null) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  lobby.players.forEach(player => {
    if (player.ws !== excludeWs) {
      sendToClient(player.ws, data);
    }
  });
}

// Entferne Spieler aus Lobby
function removePlayerFromLobby(ws) {
  const client = clients.get(ws);
  if (!client || !client.lobbyId) return;

  const lobby = lobbies.get(client.lobbyId);
  if (!lobby) return;

  // Entferne Spieler aus der Liste
  lobby.players = lobby.players.filter(p => p.ws !== ws);

  // Wenn Lobby leer ist, lösche sie
  if (lobby.players.length === 0) {
    lobbies.delete(client.lobbyId);
  } else {
    // Wenn der Creator die Lobby verlässt, setze neuen Creator
    if (lobby.creator === client.id) {
      lobby.creator = lobby.players[0].id;
    }

    // Informiere andere Spieler
    sendToLobby(client.lobbyId, {
      type: 'playerLeft',
      playerId: client.id,
      players: lobby.players.map(p => ({ id: p.id, name: p.name })),
      creator: lobby.creator
    });
  }

  client.lobbyId = null;
}

// WebSocket Handler
async function handleWebSocket(ws) {
  const clientId = crypto.randomUUID();

  ws.onopen = () => {
    console.log(`Client ${clientId} connected`);
    sendToClient(ws, { type: 'connected', clientId });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`Received from ${clientId}:`, data);

      switch (data.type) {
        case 'setName': {
          clients.set(ws, { id: clientId, name: data.name, ws });
          sendToClient(ws, { type: 'nameSet', success: true });
          break;
        }

        case 'createLobby': {
          const client = clients.get(ws);
          if (!client) return;

          const lobbyId = generateLobbyId();
          const lobby = {
            id: lobbyId,
            creator: clientId,
            players: [client],
            started: false,
            words: new Map()
          };

          lobbies.set(lobbyId, lobby);
          client.lobbyId = lobbyId;

          sendToClient(ws, {
            type: 'lobbyCreated',
            lobbyId,
            isCreator: true,
            players: [{ id: client.id, name: client.name }]
          });
          break;
        }

        case 'joinLobby': {
          const client = clients.get(ws);
          if (!client) return;

          const lobby = lobbies.get(data.lobbyId);
          if (!lobby) {
            sendToClient(ws, { type: 'joinError', message: 'Code ungültig' });
            return;
          }

          if (lobby.started) {
            sendToClient(ws, { type: 'joinError', message: 'Spiel bereits gestartet' });
            return;
          }

          // Füge Spieler zur Lobby hinzu
          lobby.players.push(client);
          client.lobbyId = data.lobbyId;

          // Sende Info an neuen Spieler
          sendToClient(ws, {
            type: 'lobbyJoined',
            lobbyId: data.lobbyId,
            isCreator: false,
            players: lobby.players.map(p => ({ id: p.id, name: p.name })),
            creator: lobby.creator
          });

          // Informiere andere Spieler
          sendToLobby(data.lobbyId, {
            type: 'playerJoined',
            player: { id: client.id, name: client.name },
            players: lobby.players.map(p => ({ id: p.id, name: p.name }))
          }, ws);
          break;
        }

        case 'startGame': {
          const client = clients.get(ws);
          if (!client || !client.lobbyId) return;

          const lobby = lobbies.get(client.lobbyId);
          if (!lobby || lobby.creator !== clientId) return;

          lobby.started = true;
          lobby.words.clear();

          sendToLobby(client.lobbyId, { type: 'gameStarted' });
          break;
        }

        case 'submitWord': {
          const client = clients.get(ws);
          if (!client || !client.lobbyId) return;

          const lobby = lobbies.get(client.lobbyId);
          if (!lobby) return;

          lobby.words.set(clientId, data.word);

          // Prüfe ob alle Spieler ihr Wort abgegeben haben
          const submittedCount = lobby.words.size;
          const totalPlayers = lobby.players.length;

          // Informiere alle über den Fortschritt
          sendToLobby(client.lobbyId, {
            type: 'wordSubmitted',
            submittedCount,
            totalPlayers
          });

          if (submittedCount === totalPlayers) {
            // Alle haben abgegeben - starte Zuordnungsphase
            const wordsArray = Array.from(lobby.words.entries()).map(([playerId, word]) => ({
              playerId,
              word
            }));

            sendToLobby(client.lobbyId, {
              type: 'allWordsSubmitted',
              words: wordsArray,
              players: lobby.players.map(p => ({ id: p.id, name: p.name }))
            });
          }
          break;
        }

        case 'restartGame': {
          const client = clients.get(ws);
          if (!client || !client.lobbyId) return;

          const lobby = lobbies.get(client.lobbyId);
          if (!lobby || lobby.creator !== clientId) return;

          lobby.words.clear();
          sendToLobby(client.lobbyId, { type: 'gameRestarted' });
          break;
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  ws.onclose = () => {
    console.log(`Client ${clientId} disconnected`);
    removePlayerFromLobby(ws);
    clients.delete(ws);
  };

  ws.onerror = (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  };
}

// HTTP Server
async function handler(req) {
  // Upgrade WebSocket connections
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleWebSocket(socket);
    return response;
  }

  // Für normale HTTP Requests
  return new Response("WebSocket Server läuft", { status: 200 });
}

console.log(`WebSocket Server läuft auf Port ${PORT}`);
console.log(`Verbinde dich mit ws://localhost:${PORT}`);

// Starte Server
Deno.serve({ port: PORT }, handler);