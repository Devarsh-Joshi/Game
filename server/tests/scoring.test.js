const assert = require('assert');
const { calculateCategoryScores } = require('../index');

console.log('--- Think & Type Scoring Engine Tests ---\n');

function runTest(testName, submissions, expected) {
  console.log(`[TEST] ${testName}`);
  const results = calculateCategoryScores(submissions, 'place');
  
  try {
    // Sort both by playerId for consistent assertion
    results.sort((a, b) => a.playerId.localeCompare(b.playerId));
    expected.sort((a, b) => a.playerId.localeCompare(b.playerId));
    
    assert.deepStrictEqual(results, expected);
    console.log('✅ PASSED\n');
  } catch (err) {
    console.error('❌ FAILED');
    console.error('Expected:', JSON.stringify(expected, null, 2));
    console.error('Received:', JSON.stringify(results, null, 2));
    console.log('\n');
  }
}

// TEST 1: Unique Answers
runTest(
  'All Unique Answers (10 points)',
  {
    player1: { answers: { place: 'Tokyo' } },
    player2: { answers: { place: 'Paris' } },
    player3: { answers: { place: 'New York' } }
  },
  [
    { playerId: 'player1', rawAns: 'Tokyo', points: 10, isUnique: true },
    { playerId: 'player2', rawAns: 'Paris', points: 10, isUnique: true },
    { playerId: 'player3', rawAns: 'New York', points: 10, isUnique: true }
  ]
);

// TEST 2: Duplicate Answers
runTest(
  'All Duplicate Answers (5 points) - Case Insensitive',
  {
    player1: { answers: { place: 'Ahmedabad' } },
    player2: { answers: { place: 'ahmedabad' } },
    player3: { answers: { place: 'AHMEDABAD  ' } } // with whitespace
  },
  [
    { playerId: 'player1', rawAns: 'Ahmedabad', points: 5, isUnique: false },
    { playerId: 'player2', rawAns: 'ahmedabad', points: 5, isUnique: false },
    { playerId: 'player3', rawAns: 'AHMEDABAD  ', points: 5, isUnique: false }
  ]
);

// TEST 3: Mixed Answers
runTest(
  'Mixed Unique and Duplicate Answers',
  {
    playerA: { answers: { place: 'Ahmedabad' } },
    playerB: { answers: { place: 'ahmedabad' } },
    playerC: { answers: { place: 'Surat' } }
  },
  [
    { playerId: 'playerA', rawAns: 'Ahmedabad', points: 5, isUnique: false },
    { playerId: 'playerB', rawAns: 'ahmedabad', points: 5, isUnique: false },
    { playerId: 'playerC', rawAns: 'Surat', points: 10, isUnique: true }
  ]
);

// TEST 4: Blank Answers
runTest(
  'Blank and Undefined Answers (0 points)',
  {
    player1: { answers: { place: ' ' } },
    player2: { answers: { place: '' } },
    player3: { answers: {} }, // place is undefined
    player4: { answers: { place: 'Delhi' } }
  },
  [
    { playerId: 'player1', rawAns: ' ', points: 0, isUnique: false },
    { playerId: 'player2', rawAns: '', points: 0, isUnique: false },
    { playerId: 'player3', rawAns: '', points: 0, isUnique: false },
    { playerId: 'player4', rawAns: 'Delhi', points: 10, isUnique: true }
  ]
);
