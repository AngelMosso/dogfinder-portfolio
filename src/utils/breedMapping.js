/**
 * Breed normalization and similarity mapping.
 */

// Synonym dictionary for breed matching
const breedMapping = {
    "golden retriever": ["golden", "cobrador dorado", "perro amarillo", "retriever"],
    "german shepherd": ["pastor aleman", "pastor alemán", "alsatian", "pastor"],
    "labrador retriever": ["labrador", "lab", "perro cobrador", "retriever"],
    "beagle": ["beagle", "perro sabueso"],
    "poodle": ["poodle", "caniche", "perro lanudo"],
    "chihuahua": ["chihuahua", "chihuahueño", "perro pequeño"],
    "pug": ["pug", "carlino", "mops"],
    "bulldog": ["bulldog", "bull dog"],
    "french bulldog": ["bulldog frances", "bulldog francés", "frenchie"],
    "husky": ["husky", "siberiano", "perro de nieve", "malamute"],
    "boxer": ["boxer", "bóxer"],
    "dalmatian": ["dalmata", "dálmata", "perro manchado"],
    "rottweiler": ["rottie", "rottweiler"],
    "pit bull": ["pitbull", "pit bull terrier", "staffordshire"],
    "schnauzer": ["schnauzer", "perro con barba"],
    "cocker spaniel": ["cocker", "spaniel"],
    "shih tzu": ["shih tzu", "shitzu"],
    "doberman": ["doberman", "dóberman"],
    "great dane": ["gran danes", "gran danés"],
    "border collie": ["border collie", "collie"],
    "pomeranian": ["pomerania", "pomeranian"],
    "maltese": ["maltes", "maltés"],
    "yorkshire terrier": ["yorkie", "yorkshire"],
    "dachshund": ["salchicha", "dachshund", "teckel"],
    "mixed breed": ["criollo", "mezcla", "mestizo", "sin raza"],
    "saint bernard": ["san bernardo", "st. bernard"]
};

// Visual similarity groups for intelligent fallback
const BREED_FAMILIES = {
    "retriever": ["golden retriever", "labrador retriever", "flat-coated retriever"],
    "shepherd": ["german shepherd", "belgian malinois", "border collie"],
    "terrier": ["pit bull", "staffordshire bull terrier", "bull terrier", "american bully"],
    "spitz": ["husky", "alaskan malamute", "samoyed", "pomeranian"],
    "small_lap": ["shih tzu", "maltese", "poodle", "bichon frise"]
};

const normalize = (text) => text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

export const areBreedsSimilar = (aiPrediction, dbBreed) => {
    const aiTerm = normalize(aiPrediction);
    const dbTerm = normalize(dbBreed);

    // 1. Direct contains match
    if (aiTerm.includes(dbTerm) || dbTerm.includes(aiTerm)) return true;

    // 2. Dictionary synonym lookup
    for (const [english, synonyms] of Object.entries(breedMapping)) {
        const aiMatch = aiTerm.includes(english) || synonyms.some(s => aiTerm.includes(s));
        const dbMatch = dbTerm.includes(english) || synonyms.some(s => dbTerm.includes(s));
        if (aiMatch && dbMatch) return true;
    }

    // 3. Family-based similarity fallback
    for (const family of Object.values(BREED_FAMILIES)) {
        if (family.some(f => aiTerm.includes(f)) && family.some(f => dbTerm.includes(f))) return true;
    }

    return false;
};

export const getBreedSimilarityScore = (visualTags, targetBreed) => {
    if (!visualTags?.length || !targetBreed) return 0;

    let bestScore = 0;
    for (const tag of visualTags) {
        if (areBreedsSimilar(tag.className, targetBreed)) {
            bestScore = Math.max(bestScore, tag.probability);
        }
    }
    return bestScore;
};
