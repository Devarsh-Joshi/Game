import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';

export default function WaitingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);

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

    const handleGameStarted = () => {
      navigate(`/game/${roomId}`, { state: { isHost: false } });
    };

    const handleHostDisconnected = () => {
      alert("The host disconnected. The session has ended.");
      navigate('/');
    };

    socket.on('players-updated', handlePlayerListUpdate);
    socket.on('game-started', handleGameStarted);
    socket.on('host-disconnected', handleHostDisconnected);
    socket.on('game-ended', handleHostDisconnected); // same behavior

    return () => {
      socket.off('players-updated', handlePlayerListUpdate);
      socket.off('game-started', handleGameStarted);
      socket.off('host-disconnected', handleHostDisconnected);
      socket.off('game-ended', handleHostDisconnected);
    };
  }, [navigate, roomId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="game-panel p-10 max-w-lg w-full text-center relative z-10 animate-fade-in flex flex-col max-h-[90vh] border-[var(--primary)] shadow-[8px_8px_0_#ff007f]">
        <div className="relative inline-block mb-8 mx-auto animate-float">
          <div className="w-24 h-24 bg-[var(--primary)] rounded-2xl border-4 border-[var(--surface-border)] flex items-center justify-center relative z-10 transform rotate-6 shadow-inner">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter drop-shadow-[0_2px_0_#ff007f]">You're In!</h1>
        <p className="text-[#a890c2] mb-6 text-lg font-medium">
          Waiting for the host to start the session in room <br/><strong className="text-[var(--accent)] font-black text-3xl tracking-widest mt-2 inline-block bg-[#150722] px-4 py-2 rounded-xl border-2 border-[var(--surface-border)] break-all">{roomId}</strong>
        </p>

        <div className="bg-[#150722] rounded-xl p-4 border-2 border-[var(--surface-border)] mb-6 flex-1 overflow-y-auto shadow-inner min-h-0">
          <h3 className="text-sm font-bold text-[var(--secondary)] text-left mb-3 uppercase tracking-wider">
            Connected Players ({players.length})
          </h3>
          {isSyncing ? (
            <div className="flex flex-col items-center justify-center py-6 text-[#a890c2]">
              <svg className="animate-spin h-8 w-8 mb-3 text-[var(--secondary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="text-sm font-bold uppercase tracking-widest">Syncing players...</div>
            </div>
          ) : players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-[#a890c2]">
              <div className="text-sm font-bold uppercase tracking-widest">No players yet.</div>
            </div>
          ) : (
            <ul className="space-y-3 text-left">
              {players.map((p, i) => (
                <li key={i} className="flex items-center gap-3 text-white bg-[var(--surface)] p-2 rounded-lg border border-[var(--surface-border)] shadow-sm animate-bounce-in max-w-full" style={{animationDelay: `${i * 0.05}s`}}>
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-sm font-black text-white shadow-inner transform -rotate-2 flex-shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate font-bold text-lg flex-1 min-w-0">{p.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#150722] rounded-xl p-4 border-2 border-[var(--surface-border)] shadow-inner">
          <div className="flex items-center gap-3 text-left justify-center">
            <div className="w-3 h-3 rounded-full bg-[var(--secondary)] animate-pulse shadow-[0_0_10px_var(--secondary)]"></div>
            <span className="text-[var(--secondary)] font-bold text-sm uppercase tracking-widest">Connected to server</span>
          </div>
        </div>
      </div>
    </div>
  );
}
