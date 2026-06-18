import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';

export default function HostDashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [copySuccess, setCopySuccess] = useState('');
  
  const inviteLink = `${window.location.origin}/join/${roomId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Think & Type Game',
        url: inviteLink,
      }).catch(console.error);
    } else {
      handleCopyLink();
    }
  };

  useEffect(() => {
    if (!socket.connected) {
      navigate('/');
      return;
    }
    // Request initial state on mount/reconnect
    socket.emit('request-room-state', roomId);

    const handlePlayerListUpdate = (data) => {
      setPlayers(data.players);
      setIsSyncing(false);
    };

    const handleGameStarted = (data) => {
      const settings = data || {};
      navigate(`/game/${roomId}`, {
        state: {
          isHost: true,
          roundDuration: settings.roundDuration,
          totalRounds: settings.totalRounds
        }
      });
    };

    socket.on('players-updated', handlePlayerListUpdate);
    socket.on('game-started', handleGameStarted);

    return () => {
      socket.off('players-updated', handlePlayerListUpdate);
      socket.off('game-started', handleGameStarted);
    };
  }, [navigate, roomId]);

  const handleStartGame = () => {
    socket.emit('start-game', roomId, (response) => {
      if (response.success) {
        navigate(`/game/${roomId}`, { state: { isHost: true } });
      } else {
        console.error('Failed to start game:', response.error);
      }
    });
  };

  const handleEndGame = () => {
    socket.emit('end-game', roomId);
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen p-8 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Background handled globally */}
      </div>

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 game-panel p-6 border-[var(--primary)] shadow-[8px_8px_0_#ff007f]">
          <div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Host Dashboard</h1>
            <p className="text-[#a890c2] font-bold mt-1">Manage your interactive session</p>
          </div>
          
          <div className="mt-6 md:mt-0 flex flex-wrap items-center justify-center md:justify-end gap-4">
            <button onClick={handleEndGame} className="px-6 py-3 w-full sm:w-auto font-bold border-4 border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white rounded-xl transition-all uppercase tracking-widest shadow-[0_4px_0_#ff007f] hover:shadow-[0_6px_0_#99004d] hover:-translate-y-1 active:translate-y-0 active:shadow-[0_2px_0_#99004d]">
              End Session
            </button>
            <div className="bg-[#150722] px-6 md:px-8 py-4 rounded-2xl border-4 border-[var(--surface-border)] flex flex-col sm:flex-row items-center gap-2 sm:gap-6 shadow-inner transform rotate-1 w-full sm:w-auto justify-center">
              <span className="text-sm font-bold text-[#a890c2] uppercase tracking-widest text-center">Room Code:</span>
              <span className="text-4xl md:text-5xl font-black tracking-[0.2em] text-[var(--accent)] drop-shadow-[0_2px_0_#ff3399] break-all text-center">{roomId}</span>
            </div>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 game-panel p-8 md:p-12 min-h-[400px] flex flex-col items-center justify-center text-center border-[var(--secondary)] shadow-[8px_8px_0_#00e5ff]">
            <div className="w-24 h-24 bg-[var(--secondary)] rounded-2xl flex items-center justify-center mb-8 shadow-inner transform -rotate-3 animate-float">
              <svg className="w-12 h-12 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter drop-shadow-[0_2px_0_#008b99]">Ready to Start</h2>
            <p className="text-[#a890c2] max-w-md mx-auto font-medium text-lg mb-8">
              Share the invite link with your players. 
              Once everyone has joined, you can begin the session.
            </p>
            
            <div className="bg-[#150722] p-6 rounded-2xl border-4 border-[var(--surface-border)] shadow-inner w-full max-w-full overflow-hidden flex flex-col gap-4">
              <div className="text-sm font-bold text-[#ff007f] uppercase tracking-widest text-left">Invite Link</div>
              <div className="bg-[#0a0212] p-4 rounded-xl border-2 border-[var(--primary)] text-[var(--secondary)] font-mono text-sm sm:text-lg break-all truncate">
                {inviteLink}
              </div>
              <div className="flex flex-col md:flex-row gap-3 mt-2 w-full">
                <button onClick={handleCopyLink} className="w-full md:flex-1 btn-secondary py-3 text-sm flex justify-center items-center gap-2 relative">
                  {copySuccess ? '✓ Copied' : '📋 Copy Link'}
                </button>
                <button onClick={handleShareLink} className="w-full md:flex-1 btn-primary py-3 text-sm flex justify-center items-center gap-2 bg-[#008b99] hover:bg-[#007080] shadow-[0_4px_0_#004c59]">
                  🔗 Share
                </button>
              </div>
            </div>
            
            <button 
              onClick={handleStartGame}
              disabled={players.length === 0}
              className={`btn-secondary mt-10 px-12 py-5 text-2xl ${players.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Start Game
            </button>
          </div>

          <div className="game-panel p-6 flex flex-col border-[var(--accent)] shadow-[8px_8px_0_#998d00]">
            <h3 className="text-2xl font-black text-white mb-6 flex justify-between items-center uppercase tracking-tighter">
              Players
              <span className="bg-[var(--accent)] text-slate-900 text-sm font-bold px-3 py-1 rounded-lg border-2 border-slate-900 shadow-[2px_2px_0_#000] transform rotate-3">
                {players.length}
              </span>
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {isSyncing ? (
                <div className="flex flex-col items-center justify-center text-center text-[#a890c2] py-12 h-full">
                  <svg className="animate-spin h-12 w-12 mb-4 text-[var(--secondary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Syncing players...</p>
                </div>
              ) : players.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-[#a890c2] py-12 h-full">
                  <svg className="w-20 h-20 mb-4 opacity-50 transform -rotate-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-xl font-bold text-white mb-2">No players yet</p>
                  <p className="text-sm font-medium">Share the room code above</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {players.map((player, index) => (
                    <li key={index} className="bg-[#150722] border-2 border-[var(--surface-border)] rounded-xl p-4 flex items-center gap-4 animate-bounce-in shadow-inner" style={{animationDelay: `${index * 0.05}s`}}>
                      <div className="w-12 h-12 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white font-black text-xl shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)] transform -rotate-3">
                        {player.fullName ? player.fullName.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-lg truncate">{player.fullName}</div>
                        <div className="text-xs font-medium text-[var(--secondary)] truncate uppercase tracking-widest">{player.employeeId}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
