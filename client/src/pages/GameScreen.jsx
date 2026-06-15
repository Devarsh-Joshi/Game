import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket';
import * as XLSX from 'xlsx';

export default function GameScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isHost = location.state?.isHost || false;

  const reconnectState = location.state?.reconnectState;
  const myPlayerId = localStorage.getItem('playerId');

  const [roundStatus, setRoundStatus] = useState(reconnectState?.roundStatus || 'waiting'); // waiting, active, ended, results, finished
  const [currentRound, setCurrentRound] = useState(reconnectState?.currentRound || 0);
  const [totalRounds, setTotalRounds] = useState(reconnectState?.totalRounds || 15);
  const [roundDuration, setRoundDuration] = useState(reconnectState?.roundDuration || 15);
  const [currentLetter, setCurrentLetter] = useState(reconnectState?.currentLetter || '?');
  const [timeLeft, setTimeLeft] = useState(reconnectState?.roundDuration || 15);

  const [inputs, setInputs] = useState({
    name: '',
    place: '',
    animal: '',
    thing: ''
  });
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [restartSettings, setRestartSettings] = useState({ totalRounds: reconnectState?.totalRounds || 15, roundDuration: reconnectState?.roundDuration || 15 });
  const [isEditingRestartRounds, setIsEditingRestartRounds] = useState(false);

  // Play Again Voting State
  const [votingActive, setVotingActive] = useState(false);
  const [voteTimeLeft, setVoteTimeLeft] = useState(10);
  const [voteStats, setVoteStats] = useState({ yesCount: 0, noCount: 0, totalCount: 0 });
  const [hasVoted, setHasVoted] = useState(false);

  const [showPlayAgainSettings, setShowPlayAgainSettings] = useState(false);
  const [playAgainSettingsMode, setPlayAgainSettingsMode] = useState('confirm'); // 'confirm' or 'edit'
  const [waitingForHostSettings, setWaitingForHostSettings] = useState(false);

  const [highlightLetter, setHighlightLetter] = useState(false);

  const [isReady, setIsReady] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState({ received: 0, total: 0 });
  const [results, setResults] = useState(reconnectState?.displayAnswers ? {
    displayAnswers: reconnectState.displayAnswers,
    leaderboard: reconnectState.leaderboard
  } : null);

  const [finalWinners, setFinalWinners] = useState(reconnectState?.winners ? {
    winners: reconnectState.winners,
    finalLeaderboard: reconnectState.leaderboard
  } : null);

  const [editingScoreFor, setEditingScoreFor] = useState(null);
  const [leaderboardSortMode, setLeaderboardSortMode] = useState('score');
  const [activeReviewTab, setActiveReviewTab] = useState('name');

  const inputsRef = useRef(inputs);
  const isReadyRef = useRef(isReady);

  useEffect(() => {
    inputsRef.current = inputs;
  }, [inputs]);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  // Auto scroll to top and pulse letter when a new round starts
  useEffect(() => {
    if (currentRound > 0 && roundStatus === 'active') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setHighlightLetter(true);
      const timer = setTimeout(() => setHighlightLetter(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentRound, roundStatus]);

  useEffect(() => {
    const handleSocketConnect = () => {
      console.log("Socket reconnected. Attempting to rejoin room...");
      const playerId = localStorage.getItem('playerId');
      if (playerId) {
        socket.emit('reconnect-player', { roomCode: roomId, playerId }, (res) => {
          if (res.success) {
            setIsHost(res.isHost);
            setTotalRounds(res.totalRounds);
            setRoundDuration(res.roundDuration);
            setCurrentRound(res.currentRound);
            setTimeLeft(res.timeLeft || res.roundDuration);
            setCurrentLetter(res.currentLetter);
            setRoundStatus(res.roundStatus);
            if (res.displayAnswers && res.leaderboard) {
              setResults({ displayAnswers: res.displayAnswers, leaderboard: res.leaderboard });
            }
            if (res.winners) setFinalWinners(res.winners);
          } else {
            console.error("Reconnection failed:", res.error);
            localStorage.clear();
            navigate('/');
          }
        });
      }
    };

    const handleGameEnded = () => {
      alert("The session has ended.");
      navigate('/');
    };

    const handleRoundStarted = (data) => {
      console.log("Round Started Event Received");
      setCurrentRound(data.round);
      if (data.totalRounds) setTotalRounds(data.totalRounds);
      if (data.roundDuration) {
        setRoundDuration(data.roundDuration);
        setRestartSettings(prev => ({ ...prev, roundDuration: data.roundDuration }));
      }
      setCurrentLetter(data.letter);
      setRoundStatus('active');
      setTimeLeft(data.roundDuration || 15);
      setInputs({ name: '', place: '', animal: '', thing: '' });
      setIsReady(false);
      setSubmissionProgress({ received: 0, total: 0 });
    };

    const handleTimerUpdate = (time) => {
      setTimeLeft(time);
    };

    const handleRoundEnded = () => {
      setRoundStatus('ended');
      if (!isHost) {
        console.log("Round Ended Event Received. Auto-submitting latest inputs...");
        socket.emit('submit-answers', { roomCode: roomId, answers: inputsRef.current, submissionType: 'auto' }, (res) => {
          setIsReady(true);
        });
      }
    };

    const handleSubmissionProgress = (data) => {
      setSubmissionProgress(data);
    };

    const handleRoundResults = (data) => {
      setResults(data);
      setRoundStatus('review');
    };

    const handleScoreUpdated = (data) => {
      setResults(prev => ({
        ...prev,
        displayAnswers: data.displayAnswers,
        leaderboard: data.leaderboard
      }));
    };

    const handleRoundFinalized = () => {
      setRoundStatus('finalized');
    };

    const handleWinnerAnnounced = (data) => {
      setRoundStatus('finished');
      setFinalWinners(data);
    };

    const handleGameRestarted = () => {
      setRoundStatus('waiting');
      setCurrentRound(0);
      setCurrentLetter('?');
      setTimeLeft(roundDuration || 15);
      setResults(null);
      setFinalWinners(null);
      setInputs({ name: '', place: '', animal: '', thing: '' });
      setIsReady(false);
      setShowRestartModal(false);
      setShowEndModal(false);
      setVotingActive(false);
      setHasVoted(false);
      setShowPlayAgainSettings(false);
      setWaitingForHostSettings(false);
    };

    const handlePlayAgainVoteStarted = () => {
      console.log("PLAYER: Vote event received");
      console.log("PLAYER: Opening vote modal");
      setVotingActive(true);
      setVoteTimeLeft(10);
      setVoteStats({ yesCount: isHost ? 1 : 0, noCount: 0, totalCount: 0 });
      setHasVoted(isHost); // Host automatically voted YES
    };

    const handlePlayAgainVoteUpdate = (data) => {
      setVoteTimeLeft(data.timeLeft);
      setVoteStats({ yesCount: data.yesCount, noCount: data.noCount, totalCount: data.totalCount });
    };

    const handlePlayAgainVoteEnded = (data) => {
      const myPlayerId = localStorage.getItem('playerId');
      if (data.yesPlayers.includes(myPlayerId)) {
        setVotingActive(false);
        // I voted yes, reset game state and stay in room
        if (isHost) {
          setRestartSettings({ totalRounds: data.totalRounds || 15, roundDuration: data.roundDuration || 15 });
          setPlayAgainSettingsMode('confirm');
          setShowPlayAgainSettings(true);
        } else {
          setWaitingForHostSettings(true);
        }
      } else {
        // I voted no or didn't vote
        localStorage.clear();
        window.location.href = '/';
      }
    };

    socket.on('connect', handleSocketConnect);
    socket.on('game-ended', handleGameEnded);
    socket.on('host-disconnected', handleGameEnded);
    socket.on('round-started', handleRoundStarted);
    socket.on('next-round', handleRoundStarted);
    socket.on('game-state-updated', handleRoundStarted);
    socket.on('timer-update', handleTimerUpdate);
    socket.on('round-ended', handleRoundEnded);
    socket.on('submission-progress', handleSubmissionProgress);
    socket.on('round-results', handleRoundResults);
    socket.on('score-updated', handleScoreUpdated);
    socket.on('round-finalized', handleRoundFinalized);
    socket.on('winner-announced', handleWinnerAnnounced);
    socket.on('game-restarted', handleGameRestarted);
    socket.on('play-again-vote-started', handlePlayAgainVoteStarted);
    socket.on('play-again-vote-update', handlePlayAgainVoteUpdate);
    socket.on('play-again-vote-ended', handlePlayAgainVoteEnded);

    return () => {
      socket.off('connect', handleSocketConnect);
      socket.off('game-ended', handleGameEnded);
      socket.off('host-disconnected', handleGameEnded);
      socket.off('round-started', handleRoundStarted);
      socket.off('next-round', handleRoundStarted);
      socket.off('game-state-updated', handleRoundStarted);
      socket.off('timer-update', handleTimerUpdate);
      socket.off('round-ended', handleRoundEnded);
      socket.off('submission-progress', handleSubmissionProgress);
      socket.off('round-results', handleRoundResults);
      socket.off('score-updated', handleScoreUpdated);
      socket.off('round-finalized', handleRoundFinalized);
      socket.off('winner-announced', handleWinnerAnnounced);
      socket.off('game-restarted', handleGameRestarted);
      socket.off('play-again-vote-started', handlePlayAgainVoteStarted);
      socket.off('play-again-vote-update', handlePlayAgainVoteUpdate);
      socket.off('play-again-vote-ended', handlePlayAgainVoteEnded);
    };
  }, [navigate, isHost, roomId]);

  const handleStartRound = () => {
    socket.emit('start-round', roomId, (response) => {
      if (!response.success) {
        console.error('Failed to start round:', response.error);
      }
    });
  };

  const handleRestartGame = () => {
    socket.emit('restart-game', { roomCode: roomId, playerId: localStorage.getItem('playerId'), totalRounds: restartSettings.totalRounds, roundDuration: restartSettings.roundDuration });
    setShowRestartModal(false);
  };

  const handleEndGame = () => {
    socket.emit('end-game', roomId);
    setShowEndModal(false);
  };

  const handleUpdateScore = (playerId, category, newScore) => {
    socket.emit('update-score', { roomCode: roomId, playerId, category, newScore });
  };

  const handleFinalizeRound = () => {
    socket.emit('finalize-round', roomId);
  };

  const handleStartPlayAgainVote = () => {
    console.log("HOST: Play Again clicked");
    console.log("HOST: Emitting start-play-again-vote");
    socket.emit('start-play-again-vote', { roomCode: roomId, playerId: localStorage.getItem('playerId') });
  };

  const handleCastVote = () => {
    setHasVoted(true);
    socket.emit('play-again-vote', { roomCode: roomId, vote: 'yes', playerId: localStorage.getItem('playerId') });
  };

  const handleFinalizePlayAgain = () => {
    socket.emit('finalize-play-again', {
      roomCode: roomId,
      playerId: localStorage.getItem('playerId'),
      totalRounds: restartSettings.totalRounds,
      roundDuration: restartSettings.roundDuration
    });
    setShowPlayAgainSettings(false);
  };

  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (roundStatus !== 'active' || isReady) return;

    socket.emit('submit-answers', { roomCode: roomId, answers: inputs, submissionType: 'manual' }, (response) => {
      if (response.success) {
        setIsReady(true);
      } else {
        console.error('Submission failed:', response.error);
      }
    });
  };

  const handleDownloadExcel = () => {
    if (!finalWinners || !finalWinners.finalLeaderboard) return;

    const data = finalWinners.finalLeaderboard.map((player, index) => {
      const row = {
        'Rank': index + 1,
        'Employee ID': player.employeeId,
        'First Name': player.firstName,
        'Last Name': player.lastName,
        'Full Name': player.fullName,
        'Total Score': player.totalScore,
      };

      if (player.roundScores && Array.isArray(player.roundScores)) {
        player.roundScores.forEach((score, roundIdx) => {
          row[`Round ${roundIdx + 1} Score`] = score;
        });
      }

      row['Total Unique Answers'] = player.uniqueAnswers;
      row['Average Submission Time'] = player.avgSubmissionTime === Infinity ? 'N/A' : (player.avgSubmissionTime / 1000).toFixed(1) + 's';

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaderboard');

    const date = new Date().toISOString().split('T')[0];
    const fileName = `ThinkAndType_Results_${date}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg font-bold shadow-[0_4px_0_#006600] z-50 animate-bounce-in border-4 border-white';
    toast.innerText = 'Results downloaded successfully';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  let currentUserIndex = -1;
  let currentUserFinalRank = null;
  let totalPlayers = 0;
  let sortedLeaderboard = [];

  if (roundStatus === 'finished' && finalWinners) {
    sortedLeaderboard = [...finalWinners.finalLeaderboard].sort((a, b) => {
      if (leaderboardSortMode === 'score') {
        return b.totalScore - a.totalScore;
      } else {
        return a.avgSubmissionTime - b.avgSubmissionTime;
      }
    });
    currentUserIndex = sortedLeaderboard.findIndex(p => p.playerId === myPlayerId);
    currentUserFinalRank = currentUserIndex !== -1 ? currentUserIndex + 1 : null;
    totalPlayers = sortedLeaderboard.length;
  }

  return (
    <>
      {roundStatus === 'finished' && finalWinners ? (
        <div className="min-h-screen flex flex-col p-4 md:p-8 relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {/* Background handled globally */}
        </div>

        {/* Header */}
        <div className="flex flex-col items-center flex-shrink-0 mb-4 animate-fade-in">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 uppercase tracking-tighter drop-shadow-[0_4px_0_var(--accent)] transform -rotate-1">
            🏆 Think & Type - Final Results
          </h1>

          {!isHost && currentUserFinalRank && (
            <div className="bg-[#150722] border-4 border-[var(--primary)] px-6 py-3 rounded-2xl shadow-[0_4px_0_#ff007f] transform rotate-1 mb-6 animate-bounce-in flex items-center justify-center flex-wrap gap-4 text-center">
              <div>
                <span className="text-[#a890c2] font-bold uppercase tracking-widest text-sm block mb-1">Your Final Rank</span>
                <span className="text-4xl font-black text-white drop-shadow-[0_2px_0_#ff3399]">#{currentUserFinalRank} <span className="text-2xl text-[var(--secondary)]">/ {totalPlayers} Players</span></span>
              </div>
              <div className="w-1 h-12 bg-[var(--surface-border)] hidden sm:block mx-2"></div>
              <div>
                <span className="text-[#a890c2] font-bold uppercase tracking-widest text-sm block mb-1">Total Score</span>
                <span className="text-[var(--accent)] font-black text-4xl drop-shadow-[0_2px_0_#000]">{finalWinners.finalLeaderboard[currentUserIndex].totalScore} pts</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-3xl">
            {finalWinners.winners[0] && (
              <div className="bg-[#150722] p-4 flex-1 rounded-xl border-4 border-[var(--accent)] shadow-[0_6px_0_#998d00] transform scale-105 z-10 text-center">
                <div className="text-4xl mb-1 animate-bounce-in">🏆</div>
                <div className="text-xs text-[var(--accent)] font-black uppercase tracking-[0.2em] mb-1">1st Place</div>
                <div className="text-xl font-black text-white truncate">{finalWinners.winners[0].fullName}</div>
                <div className="text-[var(--accent)] font-bold text-sm truncate mb-2">{finalWinners.winners[0].employeeId || 'N/A'}</div>
                <div className="text-white font-black text-2xl bg-[#0a0212] py-1 rounded-lg border-2 border-[var(--accent)] inline-block px-4">{finalWinners.winners[0].totalScore} pts</div>
              </div>
            )}
            {finalWinners.winners[1] && (
              <div className="bg-[#150722] p-4 flex-1 rounded-xl border-4 border-[var(--secondary)] shadow-[0_6px_0_#008b99] text-center">
                <div className="text-3xl mb-1 animate-bounce-in" style={{ animationDelay: '0.2s' }}>🥈</div>
                <div className="text-xs text-[var(--secondary)] font-black uppercase tracking-[0.2em] mb-1">2nd Place</div>
                <div className="text-lg font-black text-white truncate">{finalWinners.winners[1].fullName}</div>
                <div className="text-[var(--secondary)] font-bold text-xs truncate mb-2">{finalWinners.winners[1].employeeId || 'N/A'}</div>
                <div className="text-white font-black text-xl bg-[#0a0212] py-1 rounded-lg border-2 border-[var(--secondary)] inline-block px-4">{finalWinners.winners[1].totalScore} pts</div>
              </div>
            )}
          </div>
        </div>

        {/* Main Section */}
        <div className="flex-1 flex flex-col md:min-h-0 max-w-4xl w-full mx-auto bg-[#150722] rounded-xl border-4 border-[var(--primary)] shadow-[6px_6px_0_#ff007f] md:overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {/* Header row */}
          <div className="flex justify-end p-2 bg-[#150722] border-b-2 border-[var(--surface-border)]">
            <div className="flex bg-[#0a0212] rounded-lg p-1 border-2 border-[#2a1142]">
              <button
                onClick={() => setLeaderboardSortMode('score')}
                className={`px-4 py-1 text-xs md:text-sm font-bold uppercase tracking-widest rounded-md transition-all ${leaderboardSortMode === 'score' ? 'bg-[var(--primary)] text-white shadow-[0_2px_0_#ff007f]' : 'text-[#a890c2] hover:text-white'}`}
              >
                By Score
              </button>
              <button
                onClick={() => setLeaderboardSortMode('time')}
                className={`px-4 py-1 text-xs md:text-sm font-bold uppercase tracking-widest rounded-md transition-all ${leaderboardSortMode === 'time' ? 'bg-[var(--secondary)] text-black shadow-[0_2px_0_#008b99]' : 'text-[#a890c2] hover:text-white'}`}
              >
                By Speed
              </button>
            </div>
          </div>
          <div className="flex bg-[#2a1142] p-3 font-black text-[#a890c2] uppercase tracking-widest border-b-4 border-[var(--primary)] flex-shrink-0 text-xs md:text-sm">
            <div className="w-12 md:w-16 text-center">Rank</div>
            <div className="flex-1 px-2">Name</div>
            <div className="flex-1 hidden sm:block px-2">Employee ID</div>
            <div className="w-20 md:w-24 text-right pr-2">Score</div>
            <div className="w-24 text-right pr-2 hidden md:block">Avg Time</div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 md:overflow-y-auto md:custom-scrollbar p-2 space-y-2 bg-[#0a0212]">
            {sortedLeaderboard.map((player, idx) => (
              <div key={player.playerId} className="flex items-center bg-[#150722] p-3 rounded-lg border-2 border-[var(--surface-border)] hover:border-[var(--secondary)] transition-colors">
                <div className="w-12 md:w-16 text-center font-black text-[#a890c2] text-lg">{idx + 1}.</div>
                <div className="flex-1 px-2 break-words overflow-hidden">
                  <div className="font-bold text-white text-base md:text-lg">{player.fullName}</div>
                  <div className="sm:hidden text-xs text-[#a890c2] truncate">{player.employeeId || 'N/A'}</div>
                </div>
                <div className="flex-1 hidden sm:block px-2 truncate text-sm text-[#a890c2] font-medium">{player.employeeId || 'N/A'}</div>
                <div className="w-20 md:w-24 text-right pr-2 font-black text-[var(--accent)] text-xl drop-shadow-[0_2px_0_#000]">{player.totalScore}</div>
                <div className="w-24 text-right pr-2 font-bold text-[#a890c2] text-sm hidden md:block">
                  {player.avgSubmissionTime === Infinity ? 'N/A' : (player.avgSubmissionTime / 1000).toFixed(1) + 's'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 mt-4 max-w-4xl w-full mx-auto flex flex-col sm:flex-row justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <button onClick={handleDownloadExcel} className="btn-secondary py-3 px-6 text-sm md:text-base w-full sm:w-auto">Download Results (Excel)</button>
          {isHost && (
            <button onClick={handleStartPlayAgainVote} className="btn-primary py-3 px-6 text-sm md:text-base bg-green-500 hover:bg-green-400 shadow-[0_4px_0_#006600] w-full sm:w-auto">Play Again</button>
          )}
          <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} className="btn-primary py-3 px-6 text-sm md:text-base bg-red-600 hover:bg-red-500 shadow-[0_4px_0_#800000] text-white w-full sm:w-auto">Return Home</button>
        </div>
      </div>
      ) : (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Background handled globally */}
      </div>

      <div className="game-panel p-8 md:p-12 max-w-[1600px] w-full relative z-10 animate-fade-in flex flex-col md:flex-row gap-8 items-start border-[var(--primary)] shadow-[8px_8px_0_#ff007f]">

        {/* Left Column: Game Info */}
        <div className="w-full md:w-1/4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[var(--surface-border)] pb-8 md:pb-0 md:pr-8 text-center sticky top-8">
          <div className="mb-4 text-[#a890c2] font-black uppercase tracking-[0.2em] text-sm">
            {currentRound > 0 ? (isHost ? `Round ${currentRound} / ${totalRounds}` : `Round ${currentRound} of ${totalRounds}`) : 'Waiting to Start'}
          </div>

          {currentRound > 0 && (
            <div className="mb-4 text-[var(--accent)] font-bold text-xs uppercase tracking-widest">
              Time Per Round: {roundDuration}s
            </div>
          )}

          <div className={`w-40 h-40 bg-[#150722] rounded-[2rem] border-4 ${highlightLetter ? 'border-[#ff007f] shadow-[0_0_30px_#ff007f] scale-110' : 'border-[var(--accent)] shadow-inner'} transition-all duration-300 flex items-center justify-center mb-8 transform rotate-2 animate-float`}>
            <span className="text-8xl font-black text-white drop-shadow-[0_4px_0_#ff3399]">
              {currentLetter}
            </span>
          </div>

          {!isHost && roundStatus === 'active' && (
            <div className="flex flex-col items-center animate-bounce-in">
              <div className="text-sm font-bold text-[#00e5ff] uppercase tracking-widest mb-2">Time Remaining</div>
              <div className={`text-6xl font-black tracking-tighter ${timeLeft <= 5 ? 'text-[var(--primary)] animate-pulse drop-shadow-[0_2px_0_#fff]' : 'text-white drop-shadow-[0_4px_0_#008b99]'}`}>
                {timeLeft}s
              </div>
            </div>
          )}

          {isHost && (roundStatus === 'waiting' || (roundStatus === 'finalized' && currentRound < totalRounds)) && (
            <div className="flex flex-col flex-wrap gap-4 w-full mt-4">
              <button
                onClick={handleStartRound}
                className="btn-primary w-full"
              >
                {currentRound === 0 ? 'Start Round' : 'Start Next Round'}
              </button>

              {currentRound > 0 && (
                <div className="flex flex-col 2xl:flex-row gap-4 w-full">
                  <button
                    onClick={() => setShowRestartModal(true)}
                    className="btn-primary flex-1 bg-orange-500 hover:bg-orange-400 shadow-[0_4px_0_#cc6600]"
                  >
                    Restart Game
                  </button>
                  <button
                    onClick={() => setShowEndModal(true)}
                    className="btn-primary flex-1 bg-red-600 hover:bg-red-500 shadow-[0_4px_0_#990000] text-white"
                  >
                    End Game
                  </button>
                </div>
              )}
            </div>
          )}

          {!isHost && (roundStatus === 'waiting' || roundStatus === 'finalized') && (
            <div className="mt-6 text-[#a890c2] font-bold uppercase tracking-widest text-sm text-center">
              Waiting for host to start the next round...
            </div>
          )}

          {!isHost && roundStatus === 'review' && (
            <div className="mt-6 text-[var(--accent)] font-bold uppercase tracking-widest text-sm text-center animate-pulse">
              Waiting for Host Review...
            </div>
          )}

          {isHost && roundStatus === 'review' && (
            <div className="flex flex-col flex-wrap gap-4 w-full mt-4">
              <button
                onClick={handleFinalizeRound}
                className="btn-primary w-full bg-[#008b99] hover:bg-[#007080] shadow-[0_4px_0_#004c59]"
              >
                Finalize Round
              </button>
            </div>
          )}

          {isHost && roundStatus === 'active' && (
            <div className="mt-4 text-[#a890c2] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_10px_var(--primary)]"></div>
              In progress...
            </div>
          )}

          {roundStatus === 'ended' && !isHost && (
            <div className="mt-8 text-[var(--secondary)] font-black uppercase tracking-widest bg-[#150722] px-6 py-4 rounded-xl border-2 border-[var(--secondary)] animate-bounce-in shadow-inner">
              Calculating...

            </div>
          )}

          {waitingForHostSettings && !isHost && (
            <div className="mt-8 text-[#a890c2] font-black uppercase tracking-widest bg-[#150722] px-6 py-4 rounded-xl border-2 border-[var(--surface-border)] animate-pulse shadow-inner text-center">
              Waiting for host to finalize settings...
            </div>
          )}



          {roundStatus === 'finished' && isHost && (
            <div className="flex flex-col 2xl:flex-row gap-4 w-full mt-6">
              <button
                onClick={() => setShowRestartModal(true)}
                className="btn-primary flex-1 bg-orange-500 hover:bg-orange-400 shadow-[0_4px_0_#cc6600]"
              >
                Restart Game
              </button>
              <button
                onClick={() => setShowEndModal(true)}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-500 shadow-[0_4px_0_#990000]"
              >
                End Game
              </button>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="w-full md:w-3/4 md:pl-2">
          {(roundStatus === 'review' || roundStatus === 'finalized') && results ? (
            <div className="space-y-8 animate-fade-in text-left">
              {(() => {
                const leaderboard = results.leaderboard;
                const top5 = leaderboard.slice(0, 5);
                const cuIdx = leaderboard.findIndex(p => p.playerId === myPlayerId);
                let neighbors = [];
                if (cuIdx !== -1) {
                  const startIdx = Math.max(0, cuIdx - 1);
                  const endIdx = Math.min(leaderboard.length - 1, cuIdx + 1);
                  for (let i = startIdx; i <= endIdx; i++) {
                    neighbors.push({
                      ...leaderboard[i],
                      actualRank: i + 1,
                      isMe: i === cuIdx
                    });
                  }
                }

                return (
                  <div className="space-y-8">
                    {/* Insights Row */}
                    <div className="flex flex-col lg:flex-row gap-6">

                      {/* Top Players */}
                      <div className="game-panel p-6 border-[var(--accent)] shadow-[8px_8px_0_#998d00] flex-1">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 border-b-2 border-[#2a1142] pb-2">Top Players</h3>
                        <div className="space-y-2">
                          {top5.map((p, i) => (
                            <div key={p.playerId} className={`flex items-start justify-between p-2 rounded-lg gap-2 ${p.playerId === myPlayerId ? 'bg-[#3d1a5c] border border-[var(--primary)] shadow-[0_0_10px_#ff007f]' : 'bg-[#150722] border border-[var(--surface-border)]'}`}>
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="w-8 text-center font-black text-lg mt-0.5 flex-shrink-0">
                                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-[#a890c2]">#{i + 1}</span>}
                                </span>
                                <div className={`font-bold flex flex-wrap items-center gap-2 ${p.playerId === myPlayerId ? 'text-[var(--primary)]' : 'text-white'} flex-1 min-w-0`}>
                                  <span className="truncate max-w-full">{p.fullName}</span>
                                  {p.playerId === myPlayerId && <span className="text-xs bg-[var(--primary)] text-white px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0">(YOU)</span>}
                                </div>
                              </div>
                              <span className="font-black text-[var(--accent)] flex-shrink-0 mt-0.5">{p.totalScore}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Your Position (Only if not host and found) */}
                      {!isHost && cuIdx !== -1 && (
                        <div className="game-panel p-6 border-[var(--secondary)] shadow-[8px_8px_0_#00e5ff] flex-1 flex flex-col">
                          <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 border-b-2 border-[#2a1142] pb-2">Your Position</h3>
                          <div className="bg-[#150722] border-2 border-[var(--primary)] rounded-xl p-4 text-center mb-4 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] opacity-10"></div>
                            <div className="text-[#a890c2] font-bold uppercase tracking-widest text-xs mb-1">Current Rank</div>
                            <div className="text-5xl font-black text-white drop-shadow-[0_2px_0_#ff3399]">#{cuIdx + 1}</div>
                            <div className="text-[var(--accent)] font-black text-2xl mt-2">{leaderboard[cuIdx].totalScore} pts</div>
                          </div>

                          <div className="space-y-2 mt-auto">
                            <div className="text-xs font-bold text-[#a890c2] uppercase tracking-widest mb-2">Neighbouring Players</div>
                            {neighbors.map((p) => (
                              <div key={p.playerId} className={`flex items-start justify-between p-2 rounded-lg gap-2 ${p.isMe ? 'bg-[#3d1a5c] border border-[var(--primary)] shadow-[0_0_10px_#ff007f]' : 'bg-[#150722] border border-[var(--surface-border)]'}`}>
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <span className="text-[#a890c2] font-black w-8 text-center mt-0.5 flex-shrink-0">#{p.actualRank}</span>
                                  <div className={`font-bold flex flex-wrap items-center gap-2 ${p.isMe ? 'text-[var(--primary)]' : 'text-white'} flex-1 min-w-0`}>
                                    <span className="truncate max-w-full">{p.fullName}</span>
                                    {p.isMe && <span className="text-xs bg-[var(--primary)] text-white px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0">(YOU)</span>}
                                  </div>
                                </div>
                                <span className="font-black text-[var(--accent)] text-sm flex-shrink-0 mt-0.5">{p.totalScore}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Full Leaderboard */}
                    <div className="game-panel p-6 border-[var(--primary)] shadow-[8px_8px_0_#ff007f]">
                      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                          Full Leaderboard
                        </h2>
                        <div className="text-[var(--secondary)] font-bold uppercase tracking-widest text-sm bg-[#150722] px-4 py-2 rounded-xl border-2 border-[var(--surface-border)] shadow-inner">
                          Current Round: {currentRound} | Total Rounds: {totalRounds}
                        </div>
                      </div>

                      {/* Mobile Cards ( < md ) */}
                      <div className="md:hidden space-y-4 pr-2">
                        {leaderboard.map((player, idx) => (
                          <div key={player.playerId} className={`flex flex-col p-4 rounded-xl border-2 shadow-inner ${player.playerId === myPlayerId ? 'bg-[#3d1a5c] border-[var(--primary)] shadow-[0_0_15px_#ff007f]' : 'bg-[#150722] border-[var(--surface-border)]'}`}>
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="text-[#a890c2] font-black text-2xl mt-0.5 flex-shrink-0">#{idx + 1}</span>
                                <div className="flex-1 min-w-0 flex flex-col">
                                  <div className={`font-bold text-xl flex flex-wrap items-center gap-2 ${player.playerId === myPlayerId ? 'text-[var(--primary)]' : 'text-white'}`}>
                                    <span className="truncate max-w-full">{player.fullName}</span>
                                    {player.playerId === myPlayerId && <span className="text-xs bg-[var(--primary)] text-white px-2 py-1 rounded whitespace-nowrap flex-shrink-0">(YOU)</span>}
                                  </div>
                                  <div className="text-xs text-[#a890c2] font-bold uppercase tracking-widest mt-1">{player.employeeId}</div>
                                </div>
                              </div>
                              <span className="flex-shrink-0 text-[var(--primary)] font-black text-sm bg-[#2a1142] px-3 py-1 rounded-lg shadow-inner mt-1">+{player.roundScore}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-[#2a1142] pt-3">
                              <span className="text-xs font-bold text-[#a890c2] uppercase tracking-widest">Total Score</span>
                              <span className="text-3xl font-black text-[var(--accent)] drop-shadow-[0_2px_0_#000]">{player.totalScore}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table ( >= md ) */}
                      <div className="hidden md:block w-full overflow-hidden rounded-xl border-2 border-[var(--surface-border)] shadow-inner bg-[#150722] max-h-[50vh] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[#2a1142] border-b-2 border-[var(--surface-border)] sticky top-0 z-10">
                            <tr>
                              <th className="p-4 text-[#a890c2] font-black uppercase tracking-widest text-xs w-16 text-center">Rank</th>
                              <th className="p-4 text-[#a890c2] font-black uppercase tracking-widest text-xs">Player</th>
                              <th className="p-4 text-[#a890c2] font-black uppercase tracking-widest text-xs text-center w-24">Round</th>
                              <th className="p-4 text-[#a890c2] font-black uppercase tracking-widest text-xs text-right w-32">Total Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--surface-border)]">
                            {leaderboard.map((player, idx) => (
                              <tr key={player.playerId} className={`transition-colors ${player.playerId === myPlayerId ? 'bg-[#3d1a5c] shadow-[inset_4px_0_0_#ff007f]' : 'hover:bg-[#1a0929]'}`}>
                                <td className="p-4 text-center text-[#a890c2] font-black text-lg">#{idx + 1}</td>
                                <td className={`p-4 font-bold text-lg truncate max-w-[200px] ${player.playerId === myPlayerId ? 'text-[var(--primary)]' : 'text-white'}`}>
                                  {player.fullName} <span className="text-[10px] opacity-70 ml-1">({player.employeeId})</span> {player.playerId === myPlayerId && <span className="text-xs bg-[var(--primary)] text-white px-2 py-1 rounded ml-2">(YOU)</span>}
                                </td>
                                <td className="p-4 text-center">
                                  <span className="text-[var(--primary)] font-black text-sm bg-[#2a1142] px-2 py-1 rounded-lg inline-block shadow-inner">+{player.roundScore}</span>
                                </td>
                                <td className="p-4 text-right text-2xl font-black text-[var(--accent)] drop-shadow-[0_2px_0_#000]">{player.totalScore}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tabbed Navigation (Desktop Only) */}
              <div className="hidden md:flex gap-4 mb-6 bg-[#150722] p-2 rounded-xl border-4 border-[var(--surface-border)] shadow-[0_4px_0_#2a1142]">
                {['name', 'place', 'animal', 'thing'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveReviewTab(cat)}
                    className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg font-black text-base uppercase tracking-widest transition-all ${activeReviewTab === cat ? 'bg-[var(--primary)] text-white shadow-[0_4px_0_#ff007f] transform -translate-y-1' : 'bg-transparent text-[#a890c2] hover:bg-[#2a1142] hover:text-white'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Content: Active Tab on Desktop, All Categories stacked on Mobile */}
              <div className="space-y-8 md:space-y-0">
                {['name', 'place', 'animal', 'thing'].map((cat) => (
                  <div key={cat} className={`game-panel p-6 md:p-8 border-[var(--primary)] shadow-[8px_8px_0_#ff007f] md:min-h-[400px] ${activeReviewTab === cat ? 'block' : 'block md:hidden'}`}>
                    <h3 className="text-2xl md:text-3xl font-black text-[var(--accent)] capitalize mb-6 border-b-4 border-[var(--surface-border)] pb-4 uppercase tracking-tighter flex items-center justify-between">
                      <span>{cat} Answers</span>
                      <span className="text-sm font-bold text-[#a890c2] tracking-widest hidden sm:block">{results.displayAnswers[cat].length} Submissions</span>
                    </h3>
                    
                    {results.displayAnswers[cat].length === 0 ? (
                      <div className="text-[#a890c2] text-lg font-bold uppercase tracking-widest bg-[#150722] p-8 md:p-12 rounded-2xl border-4 border-[var(--surface-border)] shadow-inner text-center">
                        No valid answers submitted
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {results.displayAnswers[cat].map((ans, idx) => {
                          const isClickable = isHost && roundStatus === 'review';
                          return (
                            <div
                              key={idx}
                              onClick={() => isClickable ? setEditingScoreFor({ ...ans, category: cat }) : undefined}
                              className={`flex flex-col gap-4 min-h-[160px] bg-[#150722] p-5 rounded-2xl border-4 relative z-10 ${ans.invalid ? 'border-red-900/80 opacity-80' : 'border-[var(--surface-border)]'} ${isClickable ? 'cursor-pointer hover:border-[var(--primary)] hover:shadow-[0_0_20px_rgba(255,0,127,0.4)] transition-all transform hover:-translate-y-1' : ''}`}
                            >
                              {/* Top Row: Player Info & Status */}
                              <div className="flex justify-between items-start gap-2 border-b-2 border-[#2a1142] pb-3">
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-white font-black text-sm uppercase tracking-wider truncate">{ans.fullName || ans.playerName}</span>
                                  {ans.employeeId && <span className="text-[var(--accent)] text-[10px] uppercase tracking-widest truncate">ID: {ans.employeeId}</span>}
                                </div>
                                <div className="flex-shrink-0">
                                  {ans.invalid ? (
                                    <span className="bg-red-950 text-red-500 text-xs px-2 py-1 rounded-md font-black uppercase tracking-widest shadow-inner whitespace-nowrap">✖ Invalid</span>
                                  ) : (
                                    <span className="bg-[#003300] text-green-500 text-xs px-2 py-1 rounded-md font-black uppercase tracking-widest shadow-inner whitespace-nowrap">✔ Valid</span>
                                  )}
                                </div>
                              </div>

                              {/* Middle Row: Answer Text */}
                              <div className={`flex-1 flex flex-col justify-center text-xl sm:text-2xl xl:text-3xl font-black text-white break-words ${ans.invalid ? 'text-gray-500 line-through' : 'drop-shadow-[0_2px_0_#000]'}`}>
                                {ans.answer || '-'}
                              </div>

                              {/* Footer: AI Warning & Score */}
                              <div className="flex items-end justify-between mt-auto pt-2">
                                <div>
                                  {isHost && roundStatus === 'review' && ans.invalid && (
                                    <div className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 bg-red-950/50 px-2 py-1 rounded shadow-inner">
                                      <span>⚠</span> Suspicious
                                    </div>
                                  )}
                                </div>
                                <span className={`font-black text-3xl sm:text-4xl leading-none ${ans.points === 10 ? 'text-[var(--accent)] drop-shadow-[0_3px_0_#000]' : ans.invalid ? 'text-red-500' : 'text-[#a890c2]'}`}>
                                  +{ans.points}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : isHost ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <h2 className="text-4xl font-black text-white mb-8 uppercase tracking-tighter">Host Controls</h2>

              {roundStatus === 'active' && (
                <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xl">
                  <div className="game-panel border-[var(--secondary)] shadow-[8px_8px_0_#00e5ff] p-8 flex-1 transform -rotate-2">
                    <div className="text-sm font-bold text-[#00e5ff] uppercase tracking-widest mb-4">Time Left</div>
                    <div className={`text-7xl font-black tracking-tighter ${timeLeft <= 5 ? 'text-[var(--primary)] animate-pulse' : 'text-white'}`}>
                      {timeLeft}s
                    </div>
                  </div>

                  <div className="game-panel border-[var(--accent)] shadow-[8px_8px_0_#998d00] p-8 flex-1 transform rotate-2">
                    <div className="text-sm font-bold text-[var(--accent)] uppercase tracking-widest mb-4">Submissions</div>
                    <div className="text-6xl font-black text-white flex items-baseline justify-center gap-2">
                      <span className="text-white">{submissionProgress.received}</span>
                      <span className="text-2xl text-[#a890c2]">/ {submissionProgress.total}</span>
                    </div>
                  </div>
                </div>
              )}

              {roundStatus === 'ended' && (
                <div className="game-panel border-[var(--primary)] shadow-[8px_8px_0_#ff007f] p-8 max-w-xl w-full animate-pulse">
                  <div className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Processing Answers</div>
                  <div className="text-[#a890c2] font-bold text-lg">
                    Validating player submissions in real-time...
                  </div>
                  <div className="mt-6 flex justify-center gap-2">
                    <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {roundStatus === 'active' && currentLetter !== '?' && (
                <div className="mb-8 bg-[#150722] border-4 border-[var(--accent)] text-white px-6 py-4 rounded-xl text-center shadow-inner animate-bounce-in transform -rotate-1">
                  <span className="font-bold text-xl uppercase tracking-widest text-[#a890c2]">Words starting with:</span> <span className="text-[var(--accent)] font-black text-4xl ml-2 drop-shadow-[0_2px_0_#000]">{currentLetter}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-[#00e5ff] uppercase tracking-wider mb-2">Name</label>
                  <input
                    type="text"
                    value={inputs.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={roundStatus !== 'active'}
                    className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-2">Place</label>
                  <input
                    type="text"
                    value={inputs.place}
                    onChange={(e) => handleInputChange('place', e.target.value)}
                    disabled={roundStatus !== 'active'}
                    className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter Place"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--accent)] uppercase tracking-wider mb-2">Animal</label>
                  <input
                    type="text"
                    value={inputs.animal}
                    onChange={(e) => handleInputChange('animal', e.target.value)}
                    disabled={roundStatus !== 'active'}
                    className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter Animal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#a890c2] uppercase tracking-wider mb-2">Thing</label>
                  <input
                    type="text"
                    value={inputs.thing}
                    onChange={(e) => handleInputChange('thing', e.target.value)}
                    disabled={roundStatus !== 'active'}
                    className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter Thing"
                  />
                </div>
              </div>

              <div className="pt-6 space-y-4">
                {isReady && (
                  <div className="text-[var(--accent)] font-bold text-center bg-[#150722] py-3 rounded-xl border-2 border-[var(--accent)] shadow-inner animate-bounce-in text-sm">
                    You can still edit your answers until time runs out.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={roundStatus !== 'active' || isReady}
                  className={`w-full ${isReady ? 'bg-green-600 cursor-not-allowed text-white' : 'btn-primary'} py-5 font-black rounded-xl uppercase tracking-widest transition-all`}
                >
                  {roundStatus === 'ended'
                    ? 'Round Over'
                    : isReady
                      ? '✓ Ready'
                      : "✓ I'm Ready"}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
      </div>
      )}

      {/* Modals */}
      {showRestartModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#150722] border-4 border-orange-500 shadow-[8px_8px_0_#cc6600] rounded-xl p-8 max-w-md w-full animate-bounce-in text-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Restart Game?</h2>
            <p className="text-[#a890c2] font-medium text-lg mb-6">
              All scores and round progress will be reset. You can also change the settings for the new game.
            </p>

            <div className="mb-6 bg-[#0a0212] p-4 rounded-xl border-2 border-[var(--surface-border)] text-left">
              <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-2">Number of Rounds</label>
              <div className="flex items-center gap-4 bg-[#150722] p-2 rounded-xl border-2 border-[var(--surface-border)] mb-4">
                <button type="button" className="w-10 h-10 bg-[var(--primary)] text-white rounded-lg font-black text-xl flex items-center justify-center" onClick={() => setRestartSettings(prev => ({ ...prev, totalRounds: Math.max(1, Number(prev.totalRounds) - 1) }))}>-</button>
                {isEditingRestartRounds ? (
                  <input
                    type="number"
                    value={restartSettings.totalRounds}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setRestartSettings(prev => ({ ...prev, totalRounds: '' }));
                      } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) {
                          setRestartSettings(prev => ({ ...prev, totalRounds: num }));
                        }
                      }
                    }}
                    onBlur={() => {
                      const num = parseInt(restartSettings.totalRounds, 10);
                      if (isNaN(num) || num < 1) {
                        setRestartSettings(prev => ({ ...prev, totalRounds: 1 }));
                      } else if (num > 15) {
                        setRestartSettings(prev => ({ ...prev, totalRounds: 15 }));
                      } else {
                        setRestartSettings(prev => ({ ...prev, totalRounds: num }));
                      }
                      setIsEditingRestartRounds(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    autoFocus
                    className="flex-1 text-center font-black text-2xl text-[var(--accent)] bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <div 
                    onClick={() => setIsEditingRestartRounds(true)}
                    className="flex-1 text-center font-black text-2xl text-[var(--accent)] cursor-pointer hover:scale-110 transition-transform"
                  >
                    {restartSettings.totalRounds}
                  </div>
                )}
                <button type="button" className="w-10 h-10 bg-[var(--secondary)] text-slate-900 rounded-lg font-black text-xl flex items-center justify-center" onClick={() => setRestartSettings(prev => ({ ...prev, totalRounds: Math.min(15, Number(prev.totalRounds) + 1) }))}>+</button>
              </div>

              <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-2">Round Duration</label>
              <select
                value={restartSettings.roundDuration}
                onChange={(e) => setRestartSettings(prev => ({ ...prev, roundDuration: Number(e.target.value) }))}
                className="w-full bg-[#150722] text-[var(--accent)] font-black text-xl text-center p-3 rounded-xl border-2 border-[var(--surface-border)] cursor-pointer outline-none"
              >
                <option value={10}>10 Seconds</option>
                <option value={15}>15 Seconds</option>
                <option value={20}>20 Seconds</option>
                <option value={30}>30 Seconds</option>
                <option value={45}>45 Seconds</option>
                <option value={60}>60 Seconds</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setShowRestartModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleRestartGame} className="btn-primary flex-1 bg-orange-500 hover:bg-orange-400 shadow-[0_4px_0_#cc6600]">Restart</button>
            </div>
          </div>
        </div>
      )}

      {showEndModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#150722] border-4 border-red-600 shadow-[8px_8px_0_#990000] rounded-xl p-8 max-w-md w-full animate-bounce-in text-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">End Game?</h2>
            <p className="text-[#a890c2] font-medium text-lg mb-8">
              Are you sure you want to end the game? The leaderboard will be finalized using current scores.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setShowEndModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleEndGame} className="btn-primary flex-1 bg-red-600 hover:bg-red-500 shadow-[0_4px_0_#990000] text-white">End Game</button>
            </div>
          </div>
        </div>
      )}

      {votingActive && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#150722] border-4 border-[var(--primary)] shadow-[8px_8px_0_#ff007f] rounded-xl p-8 max-w-md w-full animate-bounce-in text-center">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Play Again?</h2>

            {isHost ? (
              <>
                <p className="text-[#a890c2] font-medium text-lg mb-6">
                  Waiting for players to vote to continue...
                </p>
                <div className="bg-[#0a0212] rounded-xl p-6 border-2 border-[var(--surface-border)] mb-6">
                  <div className="text-sm font-bold text-[#a890c2] uppercase tracking-widest mb-4">Play Again Votes</div>
                  <div className="flex justify-around items-center">
                    <div className="text-center">
                      <div className="text-green-500 font-black text-4xl mb-1">{voteStats.yesCount}</div>
                      <div className="text-xs uppercase font-bold tracking-widest text-green-500/70">YES</div>
                    </div>
                    <div className="w-1 h-12 bg-[var(--surface-border)]"></div>
                    <div className="text-center">
                      <div className="text-red-500 font-black text-4xl mb-1">{voteStats.noCount}</div>
                      <div className="text-xs uppercase font-bold tracking-widest text-red-500/70">NO</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-[#a890c2] font-medium text-lg mb-8">
                  The host wants to start another game.<br /><br />Do you want to continue?
                </p>

                {hasVoted ? (
                  <div className="bg-green-500/10 border-2 border-green-500 rounded-xl p-4 mb-8 text-green-400 font-bold flex items-center justify-center gap-2">
                    <span className="text-xl">✓</span> Vote Submitted
                  </div>
                ) : (
                  <button
                    onClick={handleCastVote}
                    className="btn-primary w-full py-4 mb-8 bg-green-500 hover:bg-green-400 shadow-[0_4px_0_#006600] font-black uppercase tracking-widest text-lg"
                  >
                    Play Again
                  </button>
                )}
              </>
            )}

            <div className="text-[var(--accent)] font-black text-2xl animate-pulse flex items-center justify-center gap-3">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time Remaining: {voteTimeLeft}s
            </div>
          </div>
        </div>
      )}

      {showPlayAgainSettings && isHost && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#150722] border-4 border-[var(--primary)] shadow-[8px_8px_0_#ff007f] rounded-xl p-8 max-w-md w-full animate-bounce-in text-center">

            {playAgainSettingsMode === 'confirm' ? (
              <>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Reuse Previous Settings?</h2>
                <div className="bg-[#0a0212] p-6 rounded-xl border-2 border-[var(--surface-border)] mb-8 space-y-4">
                  <div className="flex justify-between items-center border-b border-[#2a1142] pb-2">
                    <span className="text-[#a890c2] font-bold uppercase tracking-widest text-sm">Rounds</span>
                    <span className="text-2xl font-black text-[var(--accent)]">{restartSettings.totalRounds}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#a890c2] font-bold uppercase tracking-widest text-sm">Duration</span>
                    <span className="text-2xl font-black text-[var(--accent)]">{restartSettings.roundDuration}s</span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button onClick={handleFinalizePlayAgain} className="btn-primary py-4 bg-green-500 hover:bg-green-400 shadow-[0_4px_0_#006600]">Reuse Settings</button>
                  <button onClick={() => setPlayAgainSettingsMode('edit')} className="btn-secondary py-3">Change Settings</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-6">Change Settings</h2>

                <div className="mb-8 text-left space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-2 text-center">Number of Rounds</label>
                     <div className="flex items-center gap-4 bg-[#0a0212] p-2 rounded-xl border-2 border-[var(--surface-border)]">
                       <button type="button" className="w-12 h-12 bg-[var(--primary)] text-white rounded-lg font-black text-2xl flex items-center justify-center" onClick={() => setRestartSettings(prev => ({ ...prev, totalRounds: Math.max(1, Number(prev.totalRounds) - 1) }))}>-</button>
                       {isEditingRestartRounds ? (
                         <input
                           type="number"
                           value={restartSettings.totalRounds}
                           onChange={(e) => {
                             const val = e.target.value;
                             if (val === '') {
                               setRestartSettings(prev => ({ ...prev, totalRounds: '' }));
                             } else {
                               const num = parseInt(val, 10);
                               if (!isNaN(num)) {
                                 setRestartSettings(prev => ({ ...prev, totalRounds: num }));
                               }
                             }
                           }}
                           onBlur={() => {
                             const num = parseInt(restartSettings.totalRounds, 10);
                             if (isNaN(num) || num < 1) {
                               setRestartSettings(prev => ({ ...prev, totalRounds: 1 }));
                             } else if (num > 15) {
                               setRestartSettings(prev => ({ ...prev, totalRounds: 15 }));
                             } else {
                               setRestartSettings(prev => ({ ...prev, totalRounds: num }));
                             }
                             setIsEditingRestartRounds(false);
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               e.target.blur();
                             }
                           }}
                           autoFocus
                           className="flex-1 text-center font-black text-3xl text-[var(--accent)] bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                         />
                       ) : (
                         <div 
                           onClick={() => setIsEditingRestartRounds(true)}
                           className="flex-1 text-center font-black text-3xl text-[var(--accent)] cursor-pointer hover:scale-110 transition-transform"
                         >
                           {restartSettings.totalRounds}
                         </div>
                       )}
                       <button type="button" className="w-12 h-12 bg-[var(--secondary)] text-slate-900 rounded-lg font-black text-2xl flex items-center justify-center" onClick={() => setRestartSettings(prev => ({ ...prev, totalRounds: Math.min(15, Number(prev.totalRounds) + 1) }))}>+</button>
                     </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#ff007f] uppercase tracking-wider mb-2 text-center">Round Duration</label>
                    <select
                      value={restartSettings.roundDuration}
                      onChange={(e) => setRestartSettings(prev => ({ ...prev, roundDuration: Number(e.target.value) }))}
                      className="w-full bg-[#0a0212] text-[var(--accent)] font-black text-2xl text-center p-4 rounded-xl border-2 border-[var(--surface-border)] cursor-pointer outline-none"
                    >
                      <option value={10}>10 Seconds</option>
                      <option value={15}>15 Seconds</option>
                      <option value={20}>20 Seconds</option>
                      <option value={30}>30 Seconds</option>
                      <option value={45}>45 Seconds</option>
                      <option value={60}>60 Seconds</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button onClick={handleFinalizePlayAgain} className="btn-primary py-4">Save & Start Game</button>
                  <button onClick={() => setPlayAgainSettingsMode('confirm')} className="btn-secondary py-3 text-sm">Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {editingScoreFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#150722] border-4 border-[var(--primary)] shadow-[8px_8px_0_#ff007f] rounded-2xl p-6 md:p-8 max-w-md w-full animate-bounce-in relative">
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter border-b-2 border-[#2a1142] pb-2">
              Edit Score
            </h2>
            <div className="text-[#a890c2] font-bold text-sm uppercase tracking-widest mb-6">
              Category: <span className="text-[var(--accent)]">{editingScoreFor.category}</span>
            </div>

            <div className="bg-[#0a0212] border-2 border-[var(--surface-border)] rounded-xl p-4 mb-6">
              <div className="text-xs text-[#a890c2] font-bold uppercase tracking-widest mb-1">Player</div>
              <div className="text-lg font-bold text-white mb-4">{editingScoreFor.fullName || editingScoreFor.playerName}</div>

              <div className="text-xs text-[#a890c2] font-bold uppercase tracking-widest mb-1">Answer</div>
              <div className="text-xl font-black text-white break-words">{editingScoreFor.answer}</div>
            </div>

            <div className="mb-6">
              <div className="text-xs text-[#a890c2] font-bold uppercase tracking-widest mb-2">Select New Score</div>
              <div className="flex justify-between gap-3">
                {[10, 5, 0].map(score => (
                  <button
                    key={score}
                    onClick={() => {
                      handleUpdateScore(editingScoreFor.playerId, editingScoreFor.category, score);
                      setEditingScoreFor(null);
                    }}
                    className={`flex-1 py-4 rounded-xl border-2 font-black text-xl transition-all hover:scale-105 active:scale-95 ${editingScoreFor.points === score ? (score === 10 ? 'bg-[var(--accent)] text-black border-transparent shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)]' : score === 0 ? 'bg-red-600 text-white border-transparent shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)]' : 'bg-[var(--primary)] text-white border-transparent shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)]') : 'bg-[#2a1142] text-[#a890c2] border-[#3d1a5c] hover:border-[var(--primary)] hover:text-white'}`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <button
                onClick={() => setEditingScoreFor(null)}
                className="px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-sm bg-transparent border-2 border-[#2a1142] text-[#a890c2] hover:bg-[#2a1142] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
