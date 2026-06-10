import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';

function isValidCompanyEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith("@petpooja.com");
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [totalRounds, setTotalRounds] = useState(15);

  // Player state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    socket.connect();
    
    // Auto reconnect logic
    const savedRoomId = localStorage.getItem('roomId');
    const savedPlayerId = localStorage.getItem('playerId');
    const savedIsHost = localStorage.getItem('isHost') === 'true';

    if (savedRoomId && savedPlayerId) {
      socket.emit('reconnect-player', { roomCode: savedRoomId, playerId: savedPlayerId }, (response) => {
        if (response.success) {
          console.log("Successfully reconnected!");
          // Restore user to appropriate screen
          if (response.status === 'playing') {
             navigate(`/game/${savedRoomId}`, { state: { isHost: response.isHost, reconnectState: response } });
          } else if (response.status === 'ended') {
             navigate(`/game/${savedRoomId}`, { state: { isHost: response.isHost, reconnectState: response } });
          } else {
             if (savedIsHost) {
               navigate(`/host/${savedRoomId}`);
             } else {
               navigate(`/room/${savedRoomId}`);
             }
          }
        } else {
          // Reconnect failed, clear invalid state
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
  }, [navigate]);

  const handleCreateRoom = () => {
    setIsCreating(true);
    setError('');
    
    socket.emit('create-room', { totalRounds }, (response) => {
      setIsCreating(false);
      if (response.success) {
        localStorage.setItem('roomId', response.roomCode);
        localStorage.setItem('playerId', response.playerId);
        localStorage.setItem('isHost', 'true');
        navigate(`/host/${response.roomCode}`);
      } else {
        setError('Failed to create room. Please try again.');
      }
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!name || !email || !roomCode) {
      setError('Please fill in all fields to join a room.');
      return;
    }

    if (!isValidCompanyEmail(email)) {
      setError('Only Petpooja email addresses are allowed.');
      return;
    }

    setIsJoining(true);
    setError('');

    socket.emit('join-room', { roomCode, name, email }, (response) => {
      setIsJoining(false);
      if (response.success) {
        localStorage.setItem('roomId', response.roomCode);
        localStorage.setItem('playerId', response.playerId);
        localStorage.setItem('isHost', 'false');
        navigate(`/room/${response.roomCode}`);
      } else {
        setError(response.error || 'Failed to join room.');
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Background decoration handled by CSS body background now */}
      
      <div className="text-center mb-6 animate-bounce-in mt-4 md:mt-0">
        <div className="inline-block relative">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-1 uppercase tracking-tighter drop-shadow-[0_4px_0_#ff007f] transform -rotate-2">
            Think & <span className="text-[var(--accent)] drop-shadow-[0_4px_0_#ff3399]">Type</span>
          </h1>
          <div className="absolute -top-6 -right-8 text-3xl animate-float">🎮</div>
          <div className="absolute -bottom-2 -left-4 text-2xl animate-float" style={{ animationDelay: '1s' }}>⏱️</div>
        </div>
        <p className="text-[var(--secondary)] font-bold text-lg uppercase tracking-widest mt-3">The ultimate quick-thinking party game</p>
      </div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 relative z-10 animate-fade-in">
        
        {/* Host Section */}
        <div className="game-panel p-6 md:p-8 flex flex-col justify-center text-center h-full min-h-[350px] border-[var(--primary)] shadow-[8px_8px_0_#ff007f]">
          <div className="w-16 h-16 bg-[var(--primary)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner transform rotate-3">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">Host a Game</h2>
          <p className="text-[#a890c2] font-medium mb-6 text-base">Create a room and invite your friends to play.</p>
          
          <div className="mb-6 flex flex-col items-center">
            <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-3">Number of Rounds</label>
            <div className="flex items-center gap-4 bg-[#150722] p-2 rounded-2xl border-4 border-[var(--surface-border)] shadow-inner transform rotate-1">
              <button 
                type="button"
                className="w-12 h-12 bg-[var(--primary)] text-white rounded-xl font-black text-2xl flex items-center justify-center hover:bg-[#ff007f] hover:-translate-y-1 transition-transform shadow-[0_4px_0_#99004d] active:translate-y-0 active:shadow-none"
                onClick={() => setTotalRounds(prev => Math.max(1, Number(prev) - 1))}
              >
                -
              </button>
              <div className="w-20 text-center font-black text-4xl text-[var(--accent)] drop-shadow-[0_2px_0_#ff3399]">
                {totalRounds}
              </div>
              <button 
                type="button"
                className="w-12 h-12 bg-[var(--secondary)] text-slate-900 rounded-xl font-black text-2xl flex items-center justify-center hover:bg-[#00e5ff] hover:-translate-y-1 transition-transform shadow-[0_4px_0_#008b99] active:translate-y-0 active:shadow-none"
                onClick={() => setTotalRounds(prev => Math.min(50, Number(prev) + 1))}
              >
                +
              </button>
            </div>
          </div>
          
          <button 
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="btn-primary w-full py-4 text-lg flex justify-center items-center gap-2"
          >
            {isCreating ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Room...
              </>
            ) : 'Create Room'}
          </button>
        </div>

        {/* Player Section */}
        <div className="game-panel p-6 md:p-8 h-full min-h-[350px] border-[var(--secondary)] shadow-[8px_8px_0_#00e5ff]">
          <div className="w-16 h-16 bg-[var(--secondary)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner transform -rotate-3">
            <svg className="w-10 h-10 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </div>
          <h2 className="text-2xl font-black mb-4 text-white text-center uppercase tracking-tight">Join Game</h2>
          
          <form onSubmit={handleJoinRoom} className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-[#00e5ff] uppercase tracking-wider mb-2">Your Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your nickname"
                className="input-field"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#00e5ff] uppercase tracking-wider mb-2">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@petpooja.com"
                className={`input-field ${email.length > 0 && !isValidCompanyEmail(email) ? 'border-[var(--primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)] text-[var(--primary)]' : ''}`}
                required
              />
              {email.length > 0 && !isValidCompanyEmail(email) && (
                <p className="text-[var(--primary)] font-bold text-sm mt-2 pl-1 animate-bounce-in">⚠️ Petpooja email required.</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#00e5ff] uppercase tracking-wider mb-1">Room Code</label>
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                className="input-field text-center tracking-[0.5em] font-black text-xl uppercase py-3"
                required
              />
            </div>

            {error && (
              <div className="bg-[var(--primary)] text-white font-bold px-4 py-3 rounded-xl text-center border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,0.4)] animate-bounce-in">
                {error}
              </div>
            )}

            <div className="pt-4">
              <button 
                type="submit"
                disabled={isJoining || (email.length > 0 && !isValidCompanyEmail(email))}
                className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isJoining ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Joining...
                  </>
                ) : 'Join Room'}
              </button>
            </div>
          </form>
        </div>
        
      </div>
    </div>
  );
}
