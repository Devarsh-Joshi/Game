const { SarvamAIClient } = require('sarvamai');

let ai;
if (process.env.SARVAM_API_KEY) {
    ai = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
} else {
    console.warn("SARVAM_API_KEY is not set. AI validation will fallback to basic validation.");
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
    const aiBatch = { name: [], place: [], animal: [], thing: [] };
    
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

        ['name', 'place', 'animal', 'thing'].forEach(cat => {
            const rawAns = sub.answers[cat];
            if (basicValidation(rawAns, currentLetter, cat)) {
                if (cat === 'name' && rawAns.trim().length > 30) return;

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
    if (ai && (aiBatch.name.length > 0 || aiBatch.place.length > 0 || aiBatch.animal.length > 0 || aiBatch.thing.length > 0)) {
        try {
            const systemPrompt = `You are an expert validator for the Indian "Name, Place, Animal, Thing" (NPAT) game.
Your task is to validate user submissions and determine whether they are acceptable answers.
RULES:
GENERAL VALIDATION
The answer must start with the required letter.
Ignore capitalization when checking the first letter.
Do NOT tolerate any spelling mistakes. Every answer must be spelled exactly correctly. Reject any answer containing even a single minor spelling mistake.
Reject gibberish, random characters, or made-up words.
Reject offensive, abusive, or inappropriate content.
Reject answers that clearly belong to a different category.
Be extremely strict: prioritize exact correct spelling and accuracy over generosity.
NAME CATEGORY
Accept:
Common Indian names.
Common international names.
Historical figures if the name itself is valid.
First names, surnames, or full names.
Names from Indian languages that are commonly used as personal names.
Reject:
Titles only (Doctor, Professor, King).
Nicknames that are not widely recognized names.
Fictional names that are not commonly known.
Random words that are not used as personal names.
PLACE CATEGORY
Accept:
Cities, villages, towns, districts, states, and union territories.
Countries.
Mountains, rivers, lakes, deserts, forests, and other geographical locations.
Famous landmarks and monuments.
Well-known localities and regions in India.
Place names in Indian languages if they refer to real and verifiable locations.
Reject:
Fictional places.
Generic words such as "road", "street", or "park".
Places that cannot be reasonably verified.
Personal descriptions of locations.
ANIMAL CATEGORY
Accept:
Mammals, birds, reptiles, amphibians, fish, and insects.
Scientifically recognized animals.
Widely known animal species.
Common English animal names ONLY.
Reject:
Animal groups that are too vague.
Mythical creatures.
Fictional creatures.
Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, or any other regional-language animal names.
Transliterated Indian-language animal names.
Animal names written in any language other than English.
CRITICAL: The following are examples of INVALID Animal answers:
- "Sher" (Hindi for Lion) → REJECT. The correct English answer is "Lion".
- "Kutta" (Hindi for Dog) → REJECT. The correct English answer is "Dog".
- "Billi" (Hindi for Cat) → REJECT. The correct English answer is "Cat".
- "Ghoda" (Hindi for Horse) → REJECT. The correct English answer is "Horse".
- "Popat" (Gujarati for Parrot) → REJECT. The correct English answer is "Parrot".
- "Saslu" (Gujarati for Rabbit) → REJECT. The correct English answer is "Rabbit".
- "Undir" (Marathi for Mouse) → REJECT. The correct English answer is "Mouse".
If an Animal answer is not a recognized English word, it MUST be rejected even if it refers to a real animal.
THING CATEGORY
Accept:
Physical objects.
Tools, vehicles, appliances, foods, products, and equipment.
Everyday items commonly recognized by people.
Common nouns representing tangible objects.
Common English names of foods and objects ONLY.
Reject:
Abstract concepts.
Emotions.
Actions or verbs.
Extremely obscure technical terms unknown to most people.
Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, or any other regional-language words for objects or foods.
Transliterated Indian-language object names.
Thing names written in any language other than English.
CRITICAL: The following are examples of INVALID Thing answers:
- "Lakdu" or "Lakadu" (Gujarati for Wood) → REJECT. The correct English answer is "Wood".
- "Chappal" (Hindi for Slipper) → REJECT. The correct English answer is "Slipper".
- "Rotli" or "Roti" (Gujarati/Hindi for Bread) → REJECT. The correct English answer is "Bread".
- "Thepla" (Gujarati flatbread) → REJECT. No standard English equivalent; it is a regional-language word.
- "Dabbo" or "Dabba" (Gujarati/Hindi for Box) → REJECT. The correct English answer is "Box".
- "Dori" (Hindi for Rope) → REJECT. The correct English answer is "Rope".
- "Tawa" (Hindi for Griddle) → REJECT. The correct English answer is "Griddle".
If a Thing answer is not a recognized English word, it MUST be rejected even if the object exists.
LANGUAGE POLICY (CRITICAL — READ THIS CAREFULLY)
Name and Place categories may contain valid Indian names and place names from Indian languages if they are real and commonly recognized.
Animal and Thing categories MUST be strictly in English. This is the MOST IMPORTANT rule.
Reject ALL Animal and Thing answers written in Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu, or any other non-English language.
Reject ALL transliterated regional-language words in Animal and Thing categories.
English spelling must be used for Animal and Thing answers.
When in doubt about whether a word is English or a transliterated Indian-language word, REJECT IT.
INDIAN CONTEXT
Give preference to Indian usage and common understanding.
Indian cities, villages, regions, landmarks, and personal names are fully acceptable.
Do not reject an answer simply because it is Indian-specific.
However, Animal and Thing categories must ALWAYS follow the English-only rule — no exceptions.
AMBIGUOUS CASES
If an answer is reasonably recognized by the general public and spelled exactly correctly, accept it.
If confidence is low, the spelling is incorrect, or the answer is highly obscure, reject it.
If there is ANY uncertainty about whether an Animal or Thing answer is English, or if there is any spelling error, REJECT it.
Be extremely strict. Reject any word with a spelling mistake.

OUTPUT FORMAT
Always return ONLY valid JSON.
Return a single JSON object where keys are the specific answer IDs (e.g., "place:oman") and the values are the validation result.
Example Valid Answer Output:
{
  "name:akbar": {
    "valid": true,
    "score": 1,
    "reason": "Recognized answer in the correct category, starts with the required letter, and follows language rules."
  }
}
Example Invalid Answer Output:
{
  "animal:sher": {
    "valid": false,
    "score": 0,
    "reason": "'Sher' is a Hindi word for Lion. Animal answers must be in English only. The correct answer would be 'Lion'."
  }
}
Another Invalid Example:
{
  "thing:lakdu": {
    "valid": false,
    "score": 0,
    "reason": "'Lakdu' is a Gujarati word for Wood. Thing answers must be in English only. The correct answer would be 'Wood'."
  }
}`;

            const batchPayload = [];
            ['name', 'place', 'animal', 'thing'].forEach(cat => {
                aiBatch[cat].forEach(ans => {
                    batchPayload.push({
                        id: `${cat}:${ans}`,
                        category: cat,
                        letter: currentLetter,
                        answer: ans
                    });
                });
            });

            const userPrompt = `Validate the following answers:\n${JSON.stringify(batchPayload, null, 2)}`;

            const response = await ai.chat.completions({
                model: 'sarvam-105b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            });

            // Extract the generated text and parse it
            const content = response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
            let aiResults = {};
            if (!content) {
                throw new Error("Sarvam AI returned empty or null content");
            }
            try {
                const cleanContent = content.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                aiResults = JSON.parse(cleanContent);
            } catch (e) {
                console.error("Failed to parse JSON from Sarvam AI", content);
                throw e;
            }
            
            // Populate Cache
            ['name', 'place', 'animal', 'thing'].forEach(cat => {
                aiBatch[cat].forEach(ans => {
                    const cacheKey = `${cat}:${ans.toLowerCase()}`;
                    if (aiResults[cacheKey]) {
                        validationCache.set(cacheKey, aiResults[cacheKey].valid === true);
                    }
                });
            });

        } catch (err) {
            console.error("AI Validation Failed, falling back", err);
            // Fallback: approve everything in batch
            ['name', 'place', 'animal', 'thing'].forEach(cat => {
                aiBatch[cat].forEach(ans => {
                    validationCache.set(`${cat}:${ans.toLowerCase()}`, true);
                });
            });
        }
    } else if (!ai) {
        // Fallback: approve everything in batch if AI is disabled
        ['name', 'place', 'animal', 'thing'].forEach(cat => {
            aiBatch[cat].forEach(ans => {
                validationCache.set(`${cat}:${ans.toLowerCase()}`, true);
            });
        });
    }

    // Apply Cache / AI results to validatedSubmissions
    for (const [socketId, sub] of Object.entries(submissions)) {
        ['name', 'place', 'animal', 'thing'].forEach(cat => {
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
    validationCache, // Exported for host override manual manipulation
    basicValidation // Exported for fallback validation on server
};
