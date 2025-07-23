const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // za razvoj može, kasnije preciznije
    methods: ['GET', 'POST']
  }
});

// Čuvamo korisnike i njihove javne ključeve u memoriji
// Format: { socketId: { username, publicKey } }
const users = {};

io.on('connection', (socket) => {
  console.log('Novi korisnik povezan:', socket.id);

  emitUsers(); // Dodaj ovo ovde

  // Kad se korisnik registruje, čuvaj bar username (publicKey može doći kasnije)
  socket.on('register-user', (username) => {
    users[socket.id] = { username, publicKey: null };
    console.log('Register:', users);
    emitUsers(); // šalje svim korisnicima
  });

  // Kad korisnik uloguje (pošalje i javni ključ)
  socket.on('login', ({ username, publicKey }) => {
    users[socket.id] = { username, publicKey };
    console.log('Login:', users);
    emitUsers(); // šalje svim korisnicima
    io.emit('user-joined', { username });
  });

  // Funkcija za emitovanje korisnika sa socketId u objektu
  function emitUsers() {
    const usersWithSocketIds = Object.entries(users)
      .map(([socketId, user]) => ({
        socketId,
        username: user.username,
        publicKey: user.publicKey,
      }));
    console.log('Emitujem korisnike:', usersWithSocketIds); // Dodaj ovaj log
    io.emit('users', usersWithSocketIds);
    io.emit('active-users', usersWithSocketIds.reduce((acc, u) => {
      acc[u.socketId] = u.username;
      return acc;
    }, {}));
  }

  // Kad korisnik šalje šifrovanu poruku
  socket.on('send-message', (data) => {
    const { encryptedMessages, fromUsername, timestamp } = data;

    if (!encryptedMessages) return;

    Object.entries(encryptedMessages).forEach(([socketId, encryptedMessage]) => {
      console.log(`Šaljem poruku korisniku ${socketId} od ${fromUsername}`);
      io.to(socketId).emit('receive-message', {
        encryptedMessage,
        fromUsername,
        timestamp,
      });
    });
  });

  socket.on('request-users', () => {
    const usersWithSocketIds = Object.entries(users)
      .map(([socketId, user]) => ({
        socketId,
        username: user.username,
        publicKey: user.publicKey,
      }));
    socket.emit('users', usersWithSocketIds);
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      console.log(`Korisnik ${users[socket.id].username} se diskonektovao`);
      const username = users[socket.id].username;
      delete users[socket.id];
      io.emit('user-left', { username });
      emitUsers(); // šalje svim korisnicima novu listu
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server sluša na http://localhost:${PORT}`);
});
