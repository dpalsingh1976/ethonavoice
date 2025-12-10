// Menu item dictionary with phonetic variants for fuzzy matching (Deno version for edge functions)

export type MenuItemWithVariants = {
  id: string;
  canonicalName: string;
  category?: string;
  phoneticVariants: string[];
};

// Common Indian food items with phonetic variants for ASR recognition
export const indianMenuDictionary: MenuItemWithVariants[] = [
  // Bhaji Pav category
  {
    id: "pav-bhaji",
    canonicalName: "Pav Bhaji",
    category: "Bhaji Pav",
    phoneticVariants: ["pav bhaji", "pow bhaji", "pao bhaji", "pav bhajee", "pow bhajee", "pao bhajee", "paav bhaji", "paav bhaaji"]
  },
  {
    id: "vada-pav",
    canonicalName: "Vada Pav",
    category: "Bhaji Pav",
    phoneticVariants: ["vada pav", "wada pav", "vada pow", "wada pow", "vadapav", "wadapav", "vada paav", "wada paav"]
  },
  {
    id: "dabeli",
    canonicalName: "Dabeli",
    category: "Bhaji Pav",
    phoneticVariants: ["dabeli", "dabelli", "dabheli", "dabhaeli", "double roti"]
  },

  // Chaat category
  {
    id: "pani-puri",
    canonicalName: "Pani Puri",
    category: "Chaat",
    phoneticVariants: ["pani puri", "paani puri", "pani poori", "paani poori", "golgappa", "gol gappa", "puchka"]
  },
  {
    id: "sev-puri",
    canonicalName: "Sev Puri",
    category: "Chaat",
    phoneticVariants: ["sev puri", "sev poori", "sev pouri", "shev puri", "shev poori"]
  },
  {
    id: "bhel-puri",
    canonicalName: "Bhel Puri",
    category: "Chaat",
    phoneticVariants: ["bhel puri", "bhel poori", "bel puri", "bhelpuri", "bhel", "bhael puri"]
  },
  {
    id: "dahi-puri",
    canonicalName: "Dahi Puri",
    category: "Chaat",
    phoneticVariants: ["dahi puri", "dahi poori", "dahee puri", "dahi poori", "curd puri"]
  },
  {
    id: "ragda-pattice",
    canonicalName: "Ragda Pattice",
    category: "Chaat",
    phoneticVariants: ["ragda pattice", "ragda patties", "ragda patis", "ragada pattice", "ragda pattis"]
  },
  {
    id: "papdi-chaat",
    canonicalName: "Papdi Chaat",
    category: "Chaat",
    phoneticVariants: ["papdi chaat", "papri chaat", "paapdi chaat", "papadi chaat", "papdi chat"]
  },

  // South Indian category
  {
    id: "idli-sambar",
    canonicalName: "Idli Sambar",
    category: "South Indian",
    phoneticVariants: ["idli sambar", "idly sambar", "idlee sambar", "idli sambhar", "idly sambhar"]
  },
  {
    id: "masala-dosa",
    canonicalName: "Masala Dosa",
    category: "South Indian",
    phoneticVariants: ["masala dosa", "masala dosai", "masala dose", "masaala dosa", "masala dhosa"]
  },
  {
    id: "mysore-masala-dosa",
    canonicalName: "Mysore Masala Dosa",
    category: "South Indian",
    phoneticVariants: ["mysore masala dosa", "mysore dosa", "mysoore masala dosa", "mysore masala dose"]
  },
  {
    id: "rava-dosa",
    canonicalName: "Rava Dosa",
    category: "South Indian",
    phoneticVariants: ["rava dosa", "rava dosai", "rawa dosa", "ravva dosa", "rava dose"]
  },
  {
    id: "uttapam",
    canonicalName: "Uttapam",
    category: "South Indian",
    phoneticVariants: ["uttapam", "uthappam", "uttappam", "utthapam", "oothappam"]
  },
  {
    id: "medu-vada",
    canonicalName: "Medu Vada",
    category: "South Indian",
    phoneticVariants: ["medu vada", "medu wada", "medhu vada", "medu vadai", "vada"]
  },
  {
    id: "upma",
    canonicalName: "Upma",
    category: "South Indian",
    phoneticVariants: ["upma", "uppuma", "upuma", "uppma"]
  },

  // North Indian category
  {
    id: "chole-bhature",
    canonicalName: "Chole Bhature",
    category: "North Indian",
    phoneticVariants: ["chole bhature", "choley bhature", "chole bature", "chhole bhature", "chole bhatura"]
  },
  {
    id: "paneer-tikka",
    canonicalName: "Paneer Tikka",
    category: "North Indian",
    phoneticVariants: ["paneer tikka", "panir tikka", "paner tikka", "paneer tika", "paneer tikaa"]
  },
  {
    id: "paneer-butter-masala",
    canonicalName: "Paneer Butter Masala",
    category: "North Indian",
    phoneticVariants: ["paneer butter masala", "paneer makhani", "panir butter masala", "paneer butter masaala"]
  },
  {
    id: "dal-makhani",
    canonicalName: "Dal Makhani",
    category: "North Indian",
    phoneticVariants: ["dal makhani", "daal makhani", "dal makhanee", "dal makhni", "daal makhni"]
  },
  {
    id: "aloo-paratha",
    canonicalName: "Aloo Paratha",
    category: "North Indian",
    phoneticVariants: ["aloo paratha", "alu paratha", "aloo parantha", "aloo pratha", "aaloo paratha"]
  },
  {
    id: "rajma-chawal",
    canonicalName: "Rajma Chawal",
    category: "North Indian",
    phoneticVariants: ["rajma chawal", "rajma rice", "rajmah chawal", "rajma chaawal"]
  },

  // Indo-Chinese category
  {
    id: "gobi-manchurian",
    canonicalName: "Gobi Manchurian",
    category: "Indo-Chinese",
    phoneticVariants: ["gobi manchurian", "gobhi manchurian", "gobi manchoorian", "gobi manchu", "cauliflower manchurian"]
  },
  {
    id: "veg-manchurian",
    canonicalName: "Veg Manchurian",
    category: "Indo-Chinese",
    phoneticVariants: ["veg manchurian", "vegetable manchurian", "veg manchoorian", "veggie manchurian"]
  },
  {
    id: "hakka-noodles",
    canonicalName: "Hakka Noodles",
    category: "Indo-Chinese",
    phoneticVariants: ["hakka noodles", "hakka noodle", "haka noodles", "chinese noodles"]
  },
  {
    id: "fried-rice",
    canonicalName: "Fried Rice",
    category: "Indo-Chinese",
    phoneticVariants: ["fried rice", "fry rice", "veg fried rice", "chinese rice"]
  },

  // Sweets/Desserts
  {
    id: "gulab-jamun",
    canonicalName: "Gulab Jamun",
    category: "Sweets",
    phoneticVariants: ["gulab jamun", "gulab jamoon", "gulaab jamun", "gulab jaman"]
  },
  {
    id: "rasmalai",
    canonicalName: "Rasmalai",
    category: "Sweets",
    phoneticVariants: ["rasmalai", "ras malai", "rosmalai", "rasmalayi"]
  },
  {
    id: "jalebi",
    canonicalName: "Jalebi",
    category: "Sweets",
    phoneticVariants: ["jalebi", "jalebee", "jilebi", "jilabi"]
  },

  // Beverages
  {
    id: "masala-chai",
    canonicalName: "Masala Chai",
    category: "Beverages",
    phoneticVariants: ["masala chai", "masala tea", "masaala chai", "chai", "cutting chai"]
  },
  {
    id: "lassi",
    canonicalName: "Lassi",
    category: "Beverages",
    phoneticVariants: ["lassi", "lassee", "lasee", "sweet lassi", "mango lassi"]
  },
  {
    id: "chaas",
    canonicalName: "Chaas",
    category: "Beverages",
    phoneticVariants: ["chaas", "chaach", "buttermilk", "mattha"]
  }
];

// Helper to build ASR hints from menu items
export function buildASRHints(menuItems: MenuItemWithVariants[]): string[] {
  const hints: Set<string> = new Set();
  
  for (const item of menuItems) {
    hints.add(item.canonicalName);
    for (const variant of item.phoneticVariants) {
      hints.add(variant);
    }
  }
  
  return Array.from(hints);
}

// Simple Levenshtein distance implementation
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const dist = levenshteinDistance(s1, s2);
  return 1 - (dist / maxLen);
}

// Generate n-grams from words
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

// Find best match for text against menu items
function findBestMatch(
  text: string,
  menuItems: MenuItemWithVariants[],
  threshold: number
): { item: MenuItemWithVariants; variant: string; similarity: number } | null {
  let bestMatch: { item: MenuItemWithVariants; variant: string; similarity: number } | null = null;
  
  for (const item of menuItems) {
    const canonicalSim = calculateSimilarity(text, item.canonicalName);
    if (canonicalSim >= threshold && (!bestMatch || canonicalSim > bestMatch.similarity)) {
      bestMatch = { item, variant: item.canonicalName, similarity: canonicalSim };
    }
    
    for (const variant of item.phoneticVariants) {
      const variantSim = calculateSimilarity(text, variant);
      if (variantSim >= threshold && (!bestMatch || variantSim > bestMatch.similarity)) {
        bestMatch = { item, variant, similarity: variantSim };
      }
    }
  }
  
  return bestMatch;
}

export type NormalizedItemMatch = {
  canonicalName: string;
  matchedVariant: string;
  originalText: string;
  similarity: number;
  startIndex: number;
  endIndex: number;
};

// Normalize transcript by replacing fuzzy matches with canonical names
export function normalizeTranscriptToMenuItems(
  transcript: string,
  menuItems: MenuItemWithVariants[],
  threshold: number = 0.75
): { normalizedText: string; matches: NormalizedItemMatch[] } {
  if (!transcript || !menuItems.length) {
    return { normalizedText: transcript, matches: [] };
  }
  
  const words = transcript.split(/\s+/);
  const matches: NormalizedItemMatch[] = [];
  const processedIndices = new Set<number>();
  
  for (let n = 3; n >= 1; n--) {
    const ngrams = generateNgrams(words, n);
    
    for (const ngram of ngrams) {
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
        
        for (let i = ngram.startIdx; i <= ngram.endIdx; i++) {
          processedIndices.add(i);
        }
      }
    }
  }
  
  matches.sort((a, b) => a.startIndex - b.startIndex);
  
  const resultWords = [...words];
  const reversedMatches = [...matches].reverse();
  for (const match of reversedMatches) {
    resultWords.splice(match.startIndex, match.endIndex - match.startIndex + 1, match.canonicalName);
  }
  
  return {
    normalizedText: resultWords.join(' '),
    matches
  };
}

// Enrich DB menu items with dictionary variants
export function enrichMenuItemsWithVariants(
  dbItems: Array<{ id: string; name: string; category_id?: string }>,
  dictionary: MenuItemWithVariants[]
): MenuItemWithVariants[] {
  const enrichedItems: MenuItemWithVariants[] = [];
  
  for (const dbItem of dbItems) {
    const dictEntry = dictionary.find(d => 
      d.canonicalName.toLowerCase() === dbItem.name.toLowerCase() ||
      d.phoneticVariants.some(v => v.toLowerCase() === dbItem.name.toLowerCase())
    );
    
    if (dictEntry) {
      enrichedItems.push({
        ...dictEntry,
        id: dbItem.id,
        canonicalName: dbItem.name
      });
    } else {
      enrichedItems.push({
        id: dbItem.id,
        canonicalName: dbItem.name,
        phoneticVariants: [dbItem.name.toLowerCase()]
      });
    }
  }
  
  return enrichedItems;
}
