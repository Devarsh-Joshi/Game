const ALLOWED_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVW'.split(''); // Omitting Q, X, Y, Z for easier play

function generateLetter(usedLetters = []) {
  let available = ALLOWED_LETTERS.filter(letter => !usedLetters.includes(letter));
  
  if (available.length === 0) {
    usedLetters.length = 0; // Reset
    available = [...ALLOWED_LETTERS];
  }
  
  const randomIndex = Math.floor(Math.random() * available.length);
  const selectedLetter = available[randomIndex];
  
  usedLetters.push(selectedLetter);
  
  console.log(`Generated Letter: ${selectedLetter}`);
  console.log(`Used Letters: [${usedLetters.join(',')}]`);
  
  return selectedLetter;
}

module.exports = {
  generateLetter,
  ALLOWED_LETTERS
};
