const { GoogleGenAI } = require('@google/genai');

let ai;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
    console.warn("GEMINI_API_KEY is not set. AI validation will fallback to basic validation.");
}

const validationCache = new Map();

/**
 * Checks if a string has repeating characters (3 or more of same character sequentially)
 */
function hasRepeatingChars(str) {
    return /(.)\1{2,}/.test(str);
}

/**
 * Checks if a string has any vowels
 */
function hasVowels(str) {
    return /[aeiou]/i.test(str);
}

/**
 * Common gibberish patterns
 */
const gibberishBlacklist = [
    'asdf', 'qwerty', 'zxcv', 'qwer', 'asdfgh', 'zxcvbn', 'poiuyt', 'lkjhgf', 'mnbvcx', '123'
];

/**
 * Layer 1 & 2 Validation
 */
function basicValidation(answer, currentLetter, category) {
    if (!answer || typeof answer !== 'string') return false;
    const cleanAns = answer.trim();
    if (cleanAns.length < 2) return false;
    
    // Layer 1
    if (cleanAns[0].toLowerCase() !== currentLetter.toLowerCase()) return false;
    if (!/^[a-zA-Z\s\-]+$/.test(cleanAns)) return false;

    // Layer 2
    const lowerAns = cleanAns.toLowerCase();
    
    // Check repeating chars like "Oooo"
    if (hasRepeatingChars(lowerAns)) return false;
    
    // Must contain vowels unless it's extremely short (e.g., 'Tv' but even Tv has no vowels, let's say >=3 length needs vowels)
    if (lowerAns.length >= 3 && !hasVowels(lowerAns)) return false;

    // Gibberish blacklist
    for (let gib of gibberishBlacklist) {
        if (lowerAns.includes(gib)) return false;
    }

    return true;
}

/**
 * Main Entry Point for Validation
 * submissions is an object { [socketId]: { answers: { name, place, animal, thing } } }
 */
async function validateRoundSubmissions(submissions, currentLetter) {
    const validatedSubmissions = {};
    const aiBatch = { place: [], animal: [], thing: [] };
    
    // Object structure to keep track of where the answer maps back
    // aiMap[category][cleanAnswer] = [ { socketId, field: category } ]

    // Run Layer 1 & 2
    for (const [socketId, sub] of Object.entries(submissions)) {
        validatedSubmissions[socketId] = {
            name: { answer: sub.answers.name || '', valid: false, mode: 'basic' },
            place: { answer: sub.answers.place || '', valid: false, mode: 'basic' },
            animal: { answer: sub.answers.animal || '', valid: false, mode: 'basic' },
            thing: { answer: sub.answers.thing || '', valid: false, mode: 'basic' }
        };

        // Name
        if (basicValidation(sub.answers.name, currentLetter, 'name')) {
            // Name doesn't require AI, length max 30 check
            if (sub.answers.name.trim().length <= 30) {
                validatedSubmissions[socketId].name.valid = true;
                validatedSubmissions[socketId].name.mode = 'basic';
            }
        }

        // Place, Animal, Thing
        ['place', 'animal', 'thing'].forEach(cat => {
            const rawAns = sub.answers[cat];
            if (basicValidation(rawAns, currentLetter, cat)) {
                const cleanAns = rawAns.trim().toLowerCase();
                
                // Check Cache First
                const cacheKey = `${cat}:${cleanAns}`;
                if (validationCache.has(cacheKey)) {
                    validatedSubmissions[socketId][cat].valid = validationCache.get(cacheKey);
                    validatedSubmissions[socketId][cat].mode = 'cache';
                } else {
                    // Send to AI
                    if (!aiBatch[cat].includes(cleanAns)) {
                        aiBatch[cat].push(cleanAns);
                    }
                }
            }
        });
    }

    // Layer 3: AI Validation
    if (ai && (aiBatch.place.length > 0 || aiBatch.animal.length > 0 || aiBatch.thing.length > 0)) {
        try {
            const prompt = `Validate the following game answers. You MUST strictly validate each answer against its specific CATEGORY. 
For example, if the category is "Place", the answer MUST be a real geographic place (city, village, town, state, country, region, landmark). If the answer is a real word but NOT a Place (like "Samosa", which is a food/thing), you MUST mark it as false.
If the category is "Animal", it MUST be a real animal, not a place or a thing.

Respond strictly in JSON format matching this schema:
{
  "place": { "oman": true, "fakeplace": false },
  "animal": { "ox": true, "fakeanimal": false },
  "thing": { "orange": true, "fakething": false }
}

Data to validate:
Place: ${aiBatch.place.join(', ') || 'none'}
Animal: ${aiBatch.animal.join(', ') || 'none'}
Thing: ${aiBatch.thing.join(', ') || 'none'}

Remember:
1. Accept rare/uncommon entities if they are real.
2. Reject gibberish or non-existent entities.
3. CRITICAL: Reject answers that do not belong to the requested category, even if they are real words.
Ensure output is strict JSON.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            let aiResults = JSON.parse(response.text());
            
            // Populate Cache
            ['place', 'animal', 'thing'].forEach(cat => {
                if (aiResults[cat]) {
                    Object.entries(aiResults[cat]).forEach(([ans, isValid]) => {
                        validationCache.set(`${cat}:${ans.toLowerCase()}`, isValid === true);
                    });
                }
            });

        } catch (err) {
            console.error("AI Validation Failed, falling back", err);
            // Fallback: approve everything in batch
            ['place', 'animal', 'thing'].forEach(cat => {
                aiBatch[cat].forEach(ans => {
                    validationCache.set(`${cat}:${ans.toLowerCase()}`, true);
                });
            });
        }
    } else if (!ai) {
        // Fallback: approve everything in batch if AI is disabled
        ['place', 'animal', 'thing'].forEach(cat => {
            aiBatch[cat].forEach(ans => {
                validationCache.set(`${cat}:${ans.toLowerCase()}`, true);
            });
        });
    }

    // Apply Cache / AI results to validatedSubmissions
    for (const [socketId, sub] of Object.entries(submissions)) {
        ['place', 'animal', 'thing'].forEach(cat => {
            const rawAns = sub.answers[cat];
            if (basicValidation(rawAns, currentLetter, cat)) {
                const cleanAns = rawAns.trim().toLowerCase();
                const cacheKey = `${cat}:${cleanAns}`;
                
                if (validationCache.has(cacheKey)) {
                    // Update validity and mode if it went through AI or Fallback
                    if (validatedSubmissions[socketId][cat].mode === 'basic') {
                        validatedSubmissions[socketId][cat].valid = validationCache.get(cacheKey);
                        validatedSubmissions[socketId][cat].mode = ai ? 'ai' : 'fallback';
                    }
                }
            }
        });
    }

    return validatedSubmissions;
}

module.exports = {
    validateRoundSubmissions,
    validationCache // Exported for host override manual manipulation
};
