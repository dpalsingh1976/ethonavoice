// Menu item dictionary with phonetic variants for fuzzy matching

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
    // Add canonical name
    hints.add(item.canonicalName);
    
    // Add all phonetic variants
    for (const variant of item.phoneticVariants) {
      hints.add(variant);
    }
  }
  
  return Array.from(hints);
}

// Helper to merge database menu items with phonetic dictionary
export function enrichMenuItemsWithVariants(
  dbItems: Array<{ id: string; name: string; category_id?: string }>,
  dictionary: MenuItemWithVariants[]
): MenuItemWithVariants[] {
  const enrichedItems: MenuItemWithVariants[] = [];
  
  for (const dbItem of dbItems) {
    // Try to find a matching dictionary entry
    const dictEntry = dictionary.find(d => 
      d.canonicalName.toLowerCase() === dbItem.name.toLowerCase() ||
      d.phoneticVariants.some(v => v.toLowerCase() === dbItem.name.toLowerCase())
    );
    
    if (dictEntry) {
      enrichedItems.push({
        ...dictEntry,
        id: dbItem.id, // Use DB id
        canonicalName: dbItem.name // Use DB name as canonical
      });
    } else {
      // Create entry with just the name as variant
      enrichedItems.push({
        id: dbItem.id,
        canonicalName: dbItem.name,
        phoneticVariants: [dbItem.name.toLowerCase()]
      });
    }
  }
  
  return enrichedItems;
}
