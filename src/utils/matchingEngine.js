import { areBreedsSimilar } from './breedMapping';

// Constants for score weighting
const WEIGHTS = {
    VISUAL: { visual: 0.85, location: 0.10, breed: 0.05 },
    TEXTUAL: { breed: 0.40, location: 0.35, details: 0.25 }
};

export const getLevenshteinDistance = (s, t) => {
    if (!s || !t) return 100;
    const n = s.length;
    const m = t.length;
    if (n === 0) return m;
    if (m === 0) return n;

    // Matrix initialization
    const d = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) d[i][0] = i;
    for (let j = 0; j <= m; j++) d[0][j] = j;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }
    return d[n][m];
};

export const getTextSimilarity = (str1, str2) => {
    const s1 = (str1 || "").toLowerCase().trim();
    const s2 = (str2 || "").toLowerCase().trim();
    if (!s1 || !s2) return 0;
    if (s1.includes(s2) || s2.includes(s1)) return 1.0;

    const distance = getLevenshteinDistance(s1, s2);
    return 1 - distance / Math.max(s1.length, s2.length);
};

export const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const calculateRelevanceScore = (searchData, dogData) => {
    let score = 0;
    const hasVisual = searchData.visualTags?.length > 0;
    const weights = hasVisual ? WEIGHTS.VISUAL : WEIGHTS.TEXTUAL;

    // 1. Breed Similarity (Text)
    if (searchData.breed && dogData.breed) {
        score += getTextSimilarity(searchData.breed, dogData.breed) * weights.breed;
    }

    // 2. Keyword/Detail Matching
    if (searchData.searchTerm) {
        if (dogData.details) {
            score += getTextSimilarity(searchData.searchTerm, dogData.details) * 0.1;
        }
        if (dogData.manualLocation) {
            score += getTextSimilarity(searchData.searchTerm, dogData.manualLocation) * weights.location;
        }
    }

    // 3. Geolocation Logic
    if (searchData.location && dogData.location) {
        try {
            const sL = typeof searchData.location === 'string' ? JSON.parse(searchData.location) : searchData.location;
            const dL = typeof dogData.location === 'string' ? JSON.parse(dogData.location) : dogData.location;

            if (sL?.latitude && dL?.latitude) {
                const distance = getDistanceKm(sL.latitude, sL.longitude, dL.latitude, dL.longitude);
                // Distance decay function
                if (distance < 5) score += weights.location;
                else if (distance < 15) score += weights.location * 0.6;
                else if (distance < 40) score += weights.location * 0.2;
            }
        } catch (e) {
            console.debug("Location parsing error", e);
        }
    }

    // 4. Visual AI Matching
    if (hasVisual) {
        let maxVisualScore = 0;

        // Compare Search Tags vs Report Tags
        if (dogData.aiTags?.length > 0) {
            searchData.visualTags.forEach(sTag => {
                dogData.aiTags.forEach(dTag => {
                    if (areBreedsSimilar(sTag.className, dTag.className)) {
                        // Weighted probability match
                        const matchScore = (sTag.probability * 0.8 + dTag.probability * 0.2) * weights.visual;
                        maxVisualScore = Math.max(maxVisualScore, matchScore);
                    }
                });
            });
        }

        // Fallback: AI vs Reported Breed Label
        if (maxVisualScore < 0.2 && dogData.breed) {
            searchData.visualTags.forEach(sTag => {
                if (areBreedsSimilar(sTag.className, dogData.breed)) {
                    maxVisualScore = Math.max(maxVisualScore, sTag.probability * weights.visual * 0.9);
                }
            });
        }

        // Penalty for strong mismatch (e.g. searching 'Shepherd' but report says 'Pug')
        const topSearchTag = searchData.visualTags[0];
        if (topSearchTag?.probability > 0.6 && dogData.breed) {
            if (!areBreedsSimilar(topSearchTag.className, dogData.breed) && maxVisualScore < 0.1) {
                score -= 0.5;
            }
        }

        score += maxVisualScore;
    }

    return Math.max(0, score);
};
