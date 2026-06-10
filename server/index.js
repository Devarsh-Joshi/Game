const express = require('express');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const { generateLetter } = require('./services/letterGenerator');
const { validateRoundSubmissions, validationCache } = require('./services/validationService');

function isValidCompanyEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith("@petpooja.com");
}

function isValidForLetter(answer, currentLetter) {
  if (!answer || typeof answer !== 'string') return false;
  const trimmed = answer.trim().toLowerCase();
  if (trimmed.length === 0) return false;
  return trimmed.startsWith(currentLetter.toLowerCase());
}

function calculateCategoryScores(submissions, category, validatedAnswers) {
  const counts = {};
  const results = [];

  for (const [playerId, sub] of Object.entries(submissions)) {
    const rawAns = sub.answers ? sub.answers[category] : undefined;
    const isValid = validatedAnswers && validatedAnswers[playerId] && validatedAnswers[playerId][category] && validatedAnswers[playerId][category].valid;
    
    if (isValid) {
      const lowerAns = rawAns.trim().toLowerCase();
      if (!counts[lowerAns]) counts[lowerAns] = [];
      counts[lowerAns].push({ playerId, rawAns });
    } else {
      const isBlank = !rawAns || (typeof rawAns === 'string' && rawAns.trim().length === 0);
      results.push({ 
        playerId, 
        rawAns: rawAns || '', 
        points: 0, 
        isUnique: false,
        invalid: !isBlank
      });
    }
  }

  for (const group of Object.values(counts)) {
    const isUnique = group.length === 1;
    const points = isUnique ? 10 : 5;
    group.forEach(sub => {
      results.push({
        playerId: sub.playerId,
        rawAns: sub.rawAns,
        points,
        isUnique
      });
    });
  }

  return results;
}

const app = express();
app.use(cors());

const server = http.createServer(app);

// REST APIs for monitoring
app.get('/', (req, res) => {
  res.send('Think & Type Backend Running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', server: 'Think & Type' });
});

app.get('/rooms', (req, res) => {
  const roomsData = [];
  for (const [roomCode, room] of rooms.entries()) {
    roomsData.push({
      roomCode,
      status: room.status,
      roundStatus: room.roundStatus,
      currentRound: room.currentRound,
      playerCount: room.players.length
    });
  }
  res.json({ rooms: roomsData });
});

app.get('/room/:roomId', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  if (rooms.has(roomId)) {
    const room = rooms.get(roomId);
    res.json({
      roomCode: roomId,
      status: room.status,
      roundStatus: room.roundStatus,
      currentRound: room.currentRound,
      players: room.players.map(p => ({ name: p.name, id: p.id })),
      leaderboard: room.players.map(p => ({
        name: p.name,
        totalScore: room.scores[p.id] || 0
      }))
    });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// Simple logger
function logInfo(tag, message) {
  console.log(`[${new Date().toISOString()}] [INFO] [${tag}] ${message}`);
}
function logError(tag, message, err) {
  console.error(`[${new Date().toISOString()}] [ERROR] [${tag}] ${message}`, err || '');
}

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory room storage
const rooms = new Map();

io.on('connection', (socket) => {
  logInfo('SYSTEM', `A user connected: ${socket.id}`);

  socket.on('create-room', (options, callback) => {
    try {
    let opts = options || {};
    let cb = callback;
    if (typeof options === 'function') {
      cb = options;
      opts = {};
    }
    const totalRounds = Math.min(Math.max(Number(opts.totalRounds) || 15, 1), 50);
    // Generate a simple 6-character room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayerId = crypto.randomUUID();
    
    rooms.set(roomCode, {
      hostPlayerId,
      status: 'waiting', // can be 'waiting', 'playing', 'ended'
      players: [],
      usedLetters: [],
      currentRound: 0,
      totalRounds: totalRounds,
      currentLetter: '',
      timerInterval: null,
      roundStatus: 'waiting',
      submissions: {},
      validatedAnswers: {},
      scores: {}, // playerId -> total score
      roundHistory: {}, // playerId -> [round1Score, round2Score, ...]
      uniqueAnswersCount: {},
      totalSubmissionTime: {},
      validSubmissionsCount: {},
      roundStartTime: null
    });

    socket.join(roomCode);
    logInfo(`ROOM:${roomCode}`, `Room created by ${socket.id}`);
    
    // Return the room code to the host
    if (typeof cb === 'function') {
      cb({ success: true, roomCode, totalRounds, playerId: hostPlayerId });
    }
    } catch (err) {
      logError('CREATE', 'Error creating room', err);
      if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
    }
  });

  socket.on('join-room', ({ roomCode, name, email }, callback) => {
    try {
      if (!name || typeof name !== 'string' || name.trim() === '') {
        if (typeof callback === 'function') callback({ success: false, error: 'Name is required' });
        return;
      }
      
      if (!isValidCompanyEmail(email)) {
        if (typeof callback === 'function') callback({ success: false, error: 'Only Petpooja email addresses are allowed.' });
        return;
      }
      
      roomCode = roomCode.toUpperCase();
    
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      
      if (room.status !== 'waiting') {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Game has already started or ended.' });
        }
        return;
      }
      
      const normalizedEmail = email.trim().toLowerCase();
      
      const emailExists = room.players.some(p => p.email.trim().toLowerCase() === normalizedEmail);
      if (emailExists) {
        socket.emit('join-error', { message: 'This email has already joined this room.' });
        if (typeof callback === 'function') {
          callback({ success: false, error: 'This email has already joined this room.' });
        }
        return;
      }
      
      const playerId = crypto.randomUUID();
      const newPlayer = {
        id: socket.id, // current socket connection
        playerId,      // permanent identifier
        name,
        email: normalizedEmail
      };
      
      room.players.push(newPlayer);
      if (!(playerId in room.scores)) {
        room.scores[playerId] = 0;
        room.roundHistory[playerId] = [];
        room.uniqueAnswersCount[playerId] = 0;
        room.totalSubmissionTime[playerId] = 0;
        room.validSubmissionsCount[playerId] = 0;
      }
      socket.join(roomCode);
      
      logInfo(`ROOM:${roomCode}`, `${name} joined.`);
      
      console.log(`Room: ${roomCode}`);
      console.log(`Players Count: ${room.players.length}`);
      
      // Notify everyone in the room (including host) about the updated player list
      io.to(roomCode).emit('players-updated', { players: room.players });
      
      if (typeof callback === 'function') {
        callback({ success: true, roomCode, players: room.players, totalRounds: room.totalRounds, playerId });
      }
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Room not found' });
      }
    }
    } catch (err) {
      logError('JOIN', 'Error joining room', err);
      if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
    }
  });

  socket.on('reconnect-player', ({ roomCode, playerId }, callback) => {
    try {
      if (!roomCode || !playerId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Missing parameters' });
        return;
      }
      roomCode = roomCode.toUpperCase();
      
      if (rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        
        let isHost = false;
        let isPlayer = false;
        
        // Check if it's the host
        if (room.hostPlayerId === playerId) {
          room.hostId = socket.id; // Update host socket ID
          isHost = true;
        }
        
        // Check if it's a player
        const playerIndex = room.players.findIndex(p => p.playerId === playerId);
        if (playerIndex !== -1) {
          room.players[playerIndex].id = socket.id; // Update player socket ID
          isPlayer = true;
        }
        
        if (isHost || isPlayer) {
          socket.join(roomCode);
          logInfo(`ROOM:${roomCode}`, `Player ${playerId} reconnected as ${socket.id}`);
          
          // Send back the full state
          if (typeof callback === 'function') {
            callback({
              success: true,
              isHost,
              roomCode,
              players: room.players,
              totalRounds: room.totalRounds,
              currentRound: room.currentRound,
              status: room.status,
              roundStatus: room.roundStatus,
              currentLetter: room.currentLetter,
              displayAnswers: room.latestDisplayAnswers,
              leaderboard: room.latestLeaderboard,
              winners: room.winners
            });
          }
          
          // Notify others about updated socket IDs implicitly by broadcasting players-updated
          io.to(roomCode).emit('players-updated', { players: room.players });
          return;
        }
        
        if (typeof callback === 'function') callback({ success: false, error: 'Player not found in room' });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      }
    } catch (err) {
      logError('RECONNECT', 'Error reconnecting', err);
      if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
    }
  });

  socket.on('request-room-state', (roomCode) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      socket.emit('players-updated', { players: room.players });
    }
  });

  socket.on('start-game', (roomCode, callback) => {
    try {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      if (room.hostId === socket.id) {
        room.status = 'playing';
        io.to(roomCode).emit('game-started');
        if (typeof callback === 'function') callback({ success: true });
        logInfo(`ROOM:${roomCode}`, `Game started`);
      } else {
        if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized' });
      }
    }
    } catch (err) {
      logError('START-GAME', 'Error', err);
    }
  });

  socket.on('start-round', (roomCode, callback) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      
      if (room.hostId !== socket.id) {
        if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized' });
        return;
      }

      if (room.timerInterval) {
        clearInterval(room.timerInterval);
      }

      room.currentRound += 1;
      room.currentLetter = generateLetter(room.usedLetters);
      room.roundStatus = 'active';
      room.submissions = {}; // Clear old submissions

      io.to(roomCode).emit('round-started', {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        letter: room.currentLetter
      });
      io.to(roomCode).emit('submission-progress', { received: 0, total: room.players.length });

      logInfo(`ROOM:${roomCode}`, `Round ${room.currentRound} started with letter ${room.currentLetter}`);

      room.roundStartTime = Date.now();
      let timeLeft = 15; // 15 seconds
      
      io.to(roomCode).emit('timer-update', timeLeft);

      room.timerInterval = setInterval(() => {
        timeLeft -= 1;
        io.to(roomCode).emit('timer-update', timeLeft);

        if (timeLeft <= 0) {
          clearInterval(room.timerInterval);
          room.timerInterval = null;
          room.roundStatus = 'ended';
          io.to(roomCode).emit('round-ended');
          logInfo(`ROOM:${roomCode}`, `Round ${room.currentRound} ended`);
          
          // Grace period for late auto-submissions
          setTimeout(async () => {
            logInfo(`ROOM:${roomCode}`, `Running AI Validation...`);
            io.to(roomCode).emit('validation-started'); // Optional, to show UI progress
            const validatedAnswers = await validateRoundSubmissions(room.submissions, room.currentLetter);
            room.validatedAnswers = validatedAnswers;
            calculateScores(roomCode, room);
          }, 1500);
        }
      }, 1000);

      if (typeof callback === 'function') callback({ success: true });
    }
  });

  // Host override for AI validation
  socket.on('override-validation', ({ roomCode, playerId, category, isValid }, callback) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      if (room.hostId !== socket.id) return;
      if (room.roundStatus !== 'ended') return;

      if (room.validatedAnswers && room.validatedAnswers[playerId] && room.validatedAnswers[playerId][category]) {
        // Manually update the answer's validity flag
        room.validatedAnswers[playerId][category].valid = isValid;
        room.validatedAnswers[playerId][category].mode = 'override';
        
        // Push to cache if you want, but updating validatedAnswers is enough for score recalculation.
        const rawAns = room.submissions[playerId]?.answers[category];
        if (rawAns) {
           const cleanAns = rawAns.trim().toLowerCase();
           validationCache.set(`${category}:${cleanAns}`, isValid);
        }

        // Recalculate everything for this round
        calculateScores(roomCode, room);
        if (typeof callback === 'function') callback({ success: true });
      }
    }
  });

  socket.on('submit-answers', ({ roomCode, answers, submissionType }, callback) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      
      if (room.roundStatus !== 'active' && room.roundStatus !== 'ended') {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Round is not active.' });
        }
        return;
      }

      // Check if player is in the room
      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'You are not in this room.' });
        }
        return;
      }
      
      const playerId = player.playerId;

      // Save submission
      const now = Date.now();
      room.submissions[playerId] = {
        answers,
        timestamp: now,
        submissionType: submissionType || 'manual'
      };

      const timeTaken = now - (room.roundStartTime || now);
      room.totalSubmissionTime[playerId] += timeTaken;
      room.validSubmissionsCount[playerId] += 1;

      // Broadcast progress to the host (and optionally players)
      const received = Object.keys(room.submissions).length;
      io.to(roomCode).emit('submission-progress', {
        received,
        total: room.players.length
      });

      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found.' });
    }
  });

  function calculateScores(roomCode, room) {
    const categories = ['name', 'place', 'animal', 'thing'];
    const roundScores = {};

    room.players.forEach(p => { roundScores[p.playerId] = 0; });

    const displayAnswers = { name: [], place: [], animal: [], thing: [] };

    console.log(`[SCORING] Calculating scores for room ${roomCode}...`);

    categories.forEach(cat => {
      const catResults = calculateCategoryScores(room.submissions, cat, room.validatedAnswers);
      
      catResults.forEach(res => {
        if (!roundScores.hasOwnProperty(res.playerId)) return; // skip disconnected players
        
        roundScores[res.playerId] += res.points;
        
        if (res.isUnique) {
          room.uniqueAnswersCount[res.playerId] += 1;
        }

        // Only add non-blank answers to display
        if (res.rawAns && res.rawAns.trim().length > 0) {
          const playerInfo = room.players.find(p => p.playerId === res.playerId);
          displayAnswers[cat].push({
            playerName: playerInfo ? playerInfo.name : 'Unknown',
            playerId: res.playerId,
            answer: res.rawAns,
            points: res.points,
            invalid: res.invalid
          });
          console.log(`[SCORING] ${playerInfo?.name || 'Unknown'} - Category: ${cat} - Answer: "${res.rawAns}" - Points: ${res.points} (Unique: ${res.isUnique})`);
        } else {
          const playerInfo = room.players.find(p => p.playerId === res.playerId);
          console.log(`[SCORING] ${playerInfo?.name || 'Unknown'} - Category: ${cat} - Answer: [BLANK] - Points: 0`);
        }
      });
    });

    // Update totals
    for (const playerId in roundScores) {
      if (room.scores.hasOwnProperty(playerId)) {
        room.scores[playerId] += roundScores[playerId];
        room.roundHistory[playerId].push(roundScores[playerId]);
      }
    }

    // Generate leaderboard
    const leaderboard = room.players.map(p => {
      const pid = p.playerId;
      const avgTime = room.validSubmissionsCount[pid] > 0 
        ? room.totalSubmissionTime[pid] / room.validSubmissionsCount[pid] 
        : Infinity;
        
      return {
        playerId: pid,
        socketId: p.id,
        name: p.name,
        email: p.email,
        totalScore: room.scores[pid] || 0,
        roundScores: room.roundHistory[pid] || [],
        roundScore: roundScores[pid] || 0,
        uniqueAnswers: room.uniqueAnswersCount[pid] || 0,
        avgSubmissionTime: avgTime
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    room.latestDisplayAnswers = displayAnswers;
    room.latestLeaderboard = leaderboard;

    io.to(roomCode).emit('round-results', {
      displayAnswers,
      leaderboard
    });

    // Check if max rounds reached
    if (room.currentRound >= room.totalRounds) {
      room.status = 'ended';
      
      // Final leaderboard sort: 1. Total Score (Desc), 2. Unique Answers (Desc), 3. Avg Time (Asc)
      const finalLeaderboard = [...leaderboard].sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.uniqueAnswers !== a.uniqueAnswers) return b.uniqueAnswers - a.uniqueAnswers;
        return a.avgSubmissionTime - b.avgSubmissionTime;
      });

      const winners = finalLeaderboard.slice(0, 2);
      room.winners = winners;
      
      io.to(roomCode).emit('winner-announced', {
        winners,
        finalLeaderboard
      });
      logInfo(`ROOM:${roomCode}`, `Game ended after ${room.currentRound} rounds. Winner: ${winners[0]?.name}`);
    }
  }

  socket.on('end-game', (roomCode) => {
    try {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      if (room.hostId === socket.id) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        room.status = 'ended';
        io.to(roomCode).emit('game-ended');
        logInfo(`ROOM:${roomCode}`, `Game manually ended by host`);
      }
    }
    } catch (err) {
      logError('END-GAME', 'Error', err);
    }
  });

  socket.on('disconnect', () => {
    logInfo('SYSTEM', `User disconnected: ${socket.id}`);
    // Find if the user was in any room
    for (const [roomCode, room] of rooms.entries()) {
      if (room.hostId === socket.id) {
        // Host disconnected - notify everyone and delete room
        io.to(roomCode).emit('host-disconnected');
        rooms.delete(roomCode);
        logInfo(`ROOM:${roomCode}`, `Host disconnected. Room deleted.`);
      } else {
        // Check if a player disconnected
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const removedPlayer = room.players.splice(playerIndex, 1)[0];
          logInfo(`ROOM:${roomCode}`, `Player ${removedPlayer.name} disconnected.`);
          // Notify remaining users
          io.to(roomCode).emit('player-list-update', room.players);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = { calculateCategoryScores };
