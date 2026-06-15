import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [totalRounds, setTotalRounds] = useState(15);
  const [roundDuration, setRoundDuration] = useState(15);

  const [isEditingRounds, setIsEditingRounds] = useState(false);

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
  }, [navigate]);

  const handleCreateRoom = () => {
    setIsCreating(true);
    setError('');
    
    socket.emit('create-room', { totalRounds: Number(totalRounds), roundDuration }, (response) => {
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

      <div className="w-full max-w-xl mx-auto relative z-10 animate-fade-in">
        
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
            <div className="flex items-center gap-4 bg-[#150722] p-2 rounded-2xl border-4 border-[var(--surface-border)] shadow-inner transform rotate-1 mb-6">
              <button 
                type="button"
                className="w-12 h-12 bg-[var(--primary)] text-white rounded-xl font-black text-2xl flex items-center justify-center hover:bg-[#ff007f] hover:-translate-y-1 transition-transform shadow-[0_4px_0_#99004d] active:translate-y-0 active:shadow-none"
                onClick={() => setTotalRounds(prev => Math.max(1, Number(prev) - 1))}
              >
                -
              </button>
              {isEditingRounds ? (
                <input
                  type="number"
                  value={totalRounds}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setTotalRounds('');
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        setTotalRounds(num);
                      }
                    }
                  }}
                  onBlur={() => {
                    const num = parseInt(totalRounds, 10);
                    if (isNaN(num) || num < 1) {
                      setTotalRounds(1);
                    } else if (num > 15) {
                      setTotalRounds(15);
                    } else {
                      setTotalRounds(num);
                    }
                    setIsEditingRounds(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.target.blur();
                    }
                  }}
                  autoFocus
                  className="w-20 text-center font-black text-4xl text-[var(--accent)] bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              ) : (
                <div 
                  onClick={() => setIsEditingRounds(true)}
                  className="w-20 text-center font-black text-4xl text-[var(--accent)] drop-shadow-[0_2px_0_#ff3399] cursor-pointer hover:scale-110 transition-transform"
                >
                  {totalRounds}
                </div>
              )}
              <button 
                type="button"
                className="w-12 h-12 bg-[var(--secondary)] text-slate-900 rounded-xl font-black text-2xl flex items-center justify-center hover:bg-[#00e5ff] hover:-translate-y-1 transition-transform shadow-[0_4px_0_#008b99] active:translate-y-0 active:shadow-none"
                onClick={() => setTotalRounds(prev => Math.min(15, Number(prev) + 1))}
              >
                +
              </button>
            </div>
            
            <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-3">Round Duration</label>
            <div className="w-full relative mb-6">
              <select 
                value={roundDuration}
                onChange={(e) => setRoundDuration(Number(e.target.value))}
                className="w-full appearance-none bg-[#150722] text-[var(--accent)] font-black text-2xl text-center p-4 rounded-2xl border-4 border-[var(--surface-border)] shadow-inner cursor-pointer hover:border-[var(--secondary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value={10}>10 Seconds</option>
                <option value={15}>15 Seconds</option>
                <option value={20}>20 Seconds</option>
                <option value={30}>30 Seconds</option>
                <option value={45}>45 Seconds</option>
                <option value={60}>60 Seconds</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-[var(--accent)]">
                <svg className="fill-current h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-[var(--primary)] text-white font-bold px-4 py-3 rounded-xl mb-6 text-center border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,0.4)] animate-bounce-in">
              {error}
            </div>
          )}
          
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
      </div>
    </div>
  );
}
