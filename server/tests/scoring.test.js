const assert = require('assert');
const { calculateCategoryScores } = require('../index');

console.log('--- Think & Type Scoring Engine Tests ---\n');

function runTest(testName, submissions, validatedAnswers, expected) {
  console.log(`[TEST] ${testName}`);
  const results = calculateCategoryScores(submissions, 'place', validatedAnswers);
  
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

// Helper: build a validatedAnswers structure marking an answer as valid for a given category
function makeValidated(submissions, category) {
  const validated = {};
  for (const [playerId, sub] of Object.entries(submissions)) {
    validated[playerId] = {};
    ['name', 'place', 'animal', 'thing'].forEach(cat => {
      const ans = sub.answers ? sub.answers[cat] : undefined;
      const isBlank = !ans || (typeof ans === 'string' && ans.trim().length === 0);
      validated[playerId][cat] = {
        answer: ans || '',
        valid: !isBlank && cat === category, // only valid for the tested category
        mode: 'test'
      };
    });
  }
  return validated;
}

// TEST 1: Unique Answers
const sub1 = {
  player1: { answers: { place: 'Tokyo' } },
  player2: { answers: { place: 'Paris' } },
  player3: { answers: { place: 'New York' } }
};
runTest(
  'All Unique Answers (10 points)',
  sub1,
  makeValidated(sub1, 'place'),
  [
    { playerId: 'player1', rawAns: 'Tokyo', points: 10, isUnique: true },
    { playerId: 'player2', rawAns: 'Paris', points: 10, isUnique: true },
    { playerId: 'player3', rawAns: 'New York', points: 10, isUnique: true }
  ]
);

// TEST 2: Duplicate Answers
const sub2 = {
  player1: { answers: { place: 'Ahmedabad' } },
  player2: { answers: { place: 'ahmedabad' } },
  player3: { answers: { place: 'AHMEDABAD  ' } } // with whitespace
};
runTest(
  'All Duplicate Answers (5 points) - Case Insensitive',
  sub2,
  makeValidated(sub2, 'place'),
  [
    { playerId: 'player1', rawAns: 'Ahmedabad', points: 5, isUnique: false },
    { playerId: 'player2', rawAns: 'ahmedabad', points: 5, isUnique: false },
    { playerId: 'player3', rawAns: 'AHMEDABAD  ', points: 5, isUnique: false }
  ]
);

// TEST 3: Mixed Answers
const sub3 = {
  playerA: { answers: { place: 'Ahmedabad' } },
  playerB: { answers: { place: 'ahmedabad' } },
  playerC: { answers: { place: 'Surat' } }
};
runTest(
  'Mixed Unique and Duplicate Answers',
  sub3,
  makeValidated(sub3, 'place'),
  [
    { playerId: 'playerA', rawAns: 'Ahmedabad', points: 5, isUnique: false },
    { playerId: 'playerB', rawAns: 'ahmedabad', points: 5, isUnique: false },
    { playerId: 'playerC', rawAns: 'Surat', points: 10, isUnique: true }
  ]
);

// TEST 4: Blank Answers — blank entries are not validated as valid
const sub4 = {
  player1: { answers: { place: ' ' } },
  player2: { answers: { place: '' } },
  player3: { answers: {} }, // place is undefined
  player4: { answers: { place: 'Delhi' } }
};
const validated4 = {
  player1: { place: { answer: ' ', valid: false, mode: 'test' } },
  player2: { place: { answer: '', valid: false, mode: 'test' } },
  player3: { place: { answer: '', valid: false, mode: 'test' } },
  player4: { place: { answer: 'Delhi', valid: true, mode: 'test' } }
};
runTest(
  'Blank and Undefined Answers (0 points)',
  sub4,
  validated4,
  [
    { playerId: 'player1', rawAns: ' ', points: 0, isUnique: false, invalid: false },
    { playerId: 'player2', rawAns: '', points: 0, isUnique: false, invalid: false },
    { playerId: 'player3', rawAns: '', points: 0, isUnique: false, invalid: false },
    { playerId: 'player4', rawAns: 'Delhi', points: 10, isUnique: true }
  ]
);
