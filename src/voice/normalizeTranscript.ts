// Fuzzy matching and normalization for voice transcripts
import { distance } from 'fastest-levenshtein';
import type { MenuItemWithVariants } from '@/menu/menuDictionary';

export type NormalizedItemMatch = {
  canonicalName: string;
  matchedVariant: string;
  originalText: string;
  similarity: number;
  startIndex: number;
  endIndex: number;
};

export type NormalizationResult = {
  normalizedText: string;
  matches: NormalizedItemMatch[];
};

// Calculate similarity score between two strings (0-1, where 1 is exact match)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const dist = distance(s1, s2);
  return 1 - (dist / maxLen);
}

// Generate n-grams from an array of words
function generateNgrams(words: string[], n: number): Array<{ text: string; startIdx: number; endIdx: number }> {
  const ngrams: Array<{ text: string; startIdx: number; endIdx: number }> = [];
  
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push({
      text: words.slice(i, i + n).join(' '),
      startIdx: i,
      endIdx: i + n - 1
    });
  }
  
  return ngrams;
}

// Find the best match for a given text against menu items
function findBestMatch(
  text: string,
  menuItems: MenuItemWithVariants[],
  threshold: number
): { item: MenuItemWithVariants; variant: string; similarity: number } | null {
  let bestMatch: { item: MenuItemWithVariants; variant: string; similarity: number } | null = null;
  
  for (const item of menuItems) {
    // Check canonical name
    const canonicalSim = calculateSimilarity(text, item.canonicalName);
    if (canonicalSim >= threshold && (!bestMatch || canonicalSim > bestMatch.similarity)) {
      bestMatch = { item, variant: item.canonicalName, similarity: canonicalSim };
    }
    
    // Check all phonetic variants
    for (const variant of item.phoneticVariants) {
      const variantSim = calculateSimilarity(text, variant);
      if (variantSim >= threshold && (!bestMatch || variantSim > bestMatch.similarity)) {
        bestMatch = { item, variant, similarity: variantSim };
      }
    }
  }
  
  return bestMatch;
}

/**
 * Normalizes a transcript by replacing fuzzy matches of menu items with their canonical names
 * @param transcript - The raw transcript from ASR
 * @param menuItems - Array of menu items with phonetic variants
 * @param threshold - Minimum similarity score (0-1) to consider a match (default: 0.75)
 * @returns Object containing normalized text and array of matches found
 */
export function normalizeTranscriptToMenuItems(
  transcript: string,
  menuItems: MenuItemWithVariants[],
  threshold: number = 0.75
): NormalizationResult {
  if (!transcript || !menuItems.length) {
    return { normalizedText: transcript, matches: [] };
  }
  
  // Split into words, preserving positions
  const words = transcript.split(/\s+/);
  const matches: NormalizedItemMatch[] = [];
  const processedIndices = new Set<number>();
  
  // Try matching n-grams from longest to shortest (3, 2, 1)
  for (let n = 3; n >= 1; n--) {
    const ngrams = generateNgrams(words, n);
    
    for (const ngram of ngrams) {
      // Skip if any word in this ngram has already been matched
      let alreadyProcessed = false;
      for (let i = ngram.startIdx; i <= ngram.endIdx; i++) {
        if (processedIndices.has(i)) {
          alreadyProcessed = true;
          break;
        }
      }
      if (alreadyProcessed) continue;
      
      const match = findBestMatch(ngram.text, menuItems, threshold);
      
      if (match) {
        matches.push({
          canonicalName: match.item.canonicalName,
          matchedVariant: match.variant,
          originalText: ngram.text,
          similarity: match.similarity,
          startIndex: ngram.startIdx,
          endIndex: ngram.endIdx
        });
        
        // Mark these word indices as processed
        for (let i = ngram.startIdx; i <= ngram.endIdx; i++) {
          processedIndices.add(i);
        }
      }
    }
  }
  
  // Sort matches by start index
  matches.sort((a, b) => a.startIndex - b.startIndex);
  
  // Build normalized text
  const resultWords = [...words];
  
  // Process matches in reverse order to maintain correct indices
  const reversedMatches = [...matches].reverse();
  for (const match of reversedMatches) {
    // Replace the matched words with the canonical name
    resultWords.splice(match.startIndex, match.endIndex - match.startIndex + 1, match.canonicalName);
  }
  
  return {
    normalizedText: resultWords.join(' '),
    matches
  };
}

/**
 * Generates a context hint for the LLM about uncertain matches
 */
export function generateMatchHints(matches: NormalizedItemMatch[], uncertainThreshold: number = 0.85): string {
  const uncertainMatches = matches.filter(m => m.similarity < uncertainThreshold && m.similarity >= 0.75);
  
  if (uncertainMatches.length === 0) return '';
  
  const hints = uncertainMatches.map(m => 
    `If the user said something like '${m.originalText}', assume they meant '${m.canonicalName}'.`
  );
  
  return hints.join(' ');
}
