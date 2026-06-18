import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';

export default function JoinRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  // Player state
  const [employeeId, setEmployeeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    socket.connect();

    // --- RECONNECT CHECK ---
    // If the user already joined this room and just refreshed/reopened the link,
    // silently reconnect them instead of forcing them to fill the form again.
    const savedRoomId = localStorage.getItem('roomId');
    const savedPlayerId = localStorage.getItem('playerId');
    const savedIsHost = localStorage.getItem('isHost') === 'true';

    if (savedRoomId && savedRoomId.toUpperCase() === roomId?.toUpperCase() && savedPlayerId && !savedIsHost) {
      socket.emit('reconnect-player', { roomCode: savedRoomId, playerId: savedPlayerId }, (response) => {
        if (response && response.success) {
          console.log('Auto-reconnected to room', savedRoomId);
          if (response.status === 'playing' || response.status === 'ended') {
            navigate(`/game/${savedRoomId}`, { state: { isHost: false, reconnectState: response } });
          } else {
            navigate(`/room/${savedRoomId}`);
          }
        } else {
          // Session expired or invalid — clear stale data and show the form
          localStorage.removeItem('roomId');
          localStorage.removeItem('playerId');
          localStorage.removeItem('isHost');
        }
      });
    }

    const handleJoinError = (data) => {
      setError(data.message);
      setIsJoining(false);
    };
    
    socket.on('join-error', handleJoinError);
    
    return () => {
      socket.off('join-error', handleJoinError);
    };
  }, [navigate, roomId]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!employeeId || !firstName || !lastName) {
      setError('Please fill in all fields to join a room.');
      return;
    }

    if (!/^[A-Za-z0-9]{3,20}$/.test(employeeId.trim())) {
      setError('Employee ID must be 3-20 alphanumeric characters.');
      return;
    }

    if (!/^[A-Za-z]+$/.test(firstName.trim())) {
      setError('First Name must contain only letters.');
      return;
    }

    if (!/^[A-Za-z]+$/.test(lastName.trim())) {
      setError('Last Name must contain only letters.');
      return;
    }

    setIsJoining(true);
    setError('');

    let joinTimeout = setTimeout(() => {
      setIsJoining(false);
      setError("Unable to connect to server.");
    }, 10000);

    socket.emit('join-room', { roomCode: roomId, employeeId, firstName, lastName }, (response) => {
      clearTimeout(joinTimeout);
      setIsJoining(false);
      if (response.success) {
        localStorage.setItem('roomId', response.roomCode);
        localStorage.setItem('playerId', response.playerId);
        localStorage.setItem('isHost', 'false');
        localStorage.setItem('roundDuration', String(response.roundDuration || 15));
        localStorage.setItem('totalRounds', String(response.totalRounds || 15));
        navigate(`/room/${response.roomCode}`);
      } else {
        setError(response.error || 'Failed to join room.');
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Background handled by global css */}
      </div>

      <div className="game-panel p-8 md:p-12 max-w-md w-full relative z-10 animate-fade-in border-[var(--primary)] shadow-[8px_8px_0_#ff007f]">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter drop-shadow-[0_4px_0_#ff3399]">Join Game</h2>
          <p className="text-[#a890c2] font-bold mt-2">Room: {roomId}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border-2 border-red-500 text-red-500 px-4 py-3 rounded-xl mb-6 text-sm font-bold animate-bounce-in text-center shadow-inner">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinRoom} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-[#00e5ff] uppercase tracking-wider mb-2">Employee ID</label>
            <input 
              type="text" 
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
              className="input-field uppercase"
              placeholder="e.g. EMP1023"
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-2">First Name</label>
            <input 
              type="text" 
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input-field"
              placeholder="e.g. Rahul"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--accent)] uppercase tracking-wider mb-2">Last Name</label>
            <input 
              type="text" 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input-field"
              placeholder="e.g. Patel"
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isJoining}
              className={`w-full py-4 text-xl font-black uppercase tracking-widest ${isJoining ? 'bg-[#3d1a5c] text-gray-400 border-[#2a1142] cursor-not-allowed shadow-none translate-y-2' : 'btn-primary'}`}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
