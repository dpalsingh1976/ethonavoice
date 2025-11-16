import { RestaurantHours, MenuItem, MenuCategory } from '@/types/database';

export function formatHoursForPrompt(hours: RestaurantHours[]): string {
  if (!hours || hours.length === 0) {
    return 'Hours not set. Please ask the customer to check our website or call during business hours.';
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const formattedHours = hours
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map(h => {
      const day = daysOfWeek[h.day_of_week];
      if (h.is_closed) {
        return `${day}: Closed`;
      }
      return `${day}: ${h.open_time} - ${h.close_time}`;
    })
    .join('\n');

  return formattedHours;
}

export function formatMenuForPrompt(
  categories: MenuCategory[],
  items: MenuItem[]
): string {
  if (!items || items.length === 0) {
    return 'Menu not yet configured. Please ask the customer to check our website or visit in person.';
  }

  let menuText = '';

  // Group items by category
  const categoriesMap = new Map<string, MenuItem[]>();
  
  items.forEach(item => {
    if (!item.is_available) return; // Skip unavailable items
    
    const categoryId = item.category_id || 'uncategorized';
    if (!categoriesMap.has(categoryId)) {
      categoriesMap.set(categoryId, []);
    }
    categoriesMap.get(categoryId)?.push(item);
  });

  // Format by category
  categories.forEach(category => {
    const categoryItems = categoriesMap.get(category.id);
    if (categoryItems && categoryItems.length > 0) {
      menuText += `\n## ${category.name}\n`;
      categoryItems.forEach(item => {
        menuText += `- ${item.name}`;
        if (item.description) {
          menuText += ` - ${item.description}`;
        }
        menuText += ` - ₹${item.price}`;
        if (item.is_vegetarian) {
          menuText += ' (Veg)';
        }
        if (item.spice_level_options && Array.isArray(item.spice_level_options)) {
          menuText += ` - Spice levels: ${item.spice_level_options.join(', ')}`;
        }
        menuText += '\n';
      });
    }
  });

  // Add uncategorized items if any
  const uncategorized = categoriesMap.get('uncategorized');
  if (uncategorized && uncategorized.length > 0) {
    menuText += `\n## Other Items\n`;
    uncategorized.forEach(item => {
      menuText += `- ${item.name} - ₹${item.price}`;
      if (item.is_vegetarian) menuText += ' (Veg)';
      menuText += '\n';
    });
  }

  return menuText.trim();
}

export function isCurrentlyOpen(hours: RestaurantHours[], timezone: string): boolean {
  if (!hours || hours.length === 0) {
    return false;
  }

  try {
    // Get current date/time in the restaurant's timezone
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Find today's hours
    const todayHours = hours.find(h => h.day_of_week === currentDay);
    
    if (!todayHours || todayHours.is_closed) {
      return false;
    }

    // Get current time in HH:MM format
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: timezone 
    });

    // Compare times (simple string comparison works for HH:MM format)
    return currentTime >= todayHours.open_time && currentTime <= todayHours.close_time;
  } catch (error) {
    console.error('Error checking if restaurant is open:', error);
    return false;
  }
}

export function generateSystemPrompt(
  restaurant: any,
  voiceSettings: any,
  hours: RestaurantHours[],
  categories: MenuCategory[],
  items: MenuItem[]
): string {
  return `You are an AI voice assistant for ${restaurant.name}, a restaurant located at ${restaurant.address}.

## SUPPORTED LANGUAGES
You support English (en), Hindi (hi), Punjabi (pa), and Gujarati (gu).
- Auto-detect the language from the caller's first words
- Respond in the same language throughout the conversation
- If language is unclear, politely ask: "Would you prefer English, Hindi, Punjabi, or Gujarati?"

## GREETINGS (by language)
English: ${voiceSettings.greeting_en || 'Welcome! How can I help you?'}
Hindi: ${voiceSettings.greeting_hi || 'नमस्ते! मैं कैसे मदद कर सकता हूं?'}
Punjabi: ${voiceSettings.greeting_pa || 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ?'}
Gujarati: ${voiceSettings.greeting_gu || 'નમસ્તે! હું કેવી રીતે મદદ કરી શકું?'}

## RESTAURANT INFORMATION
- Phone: ${restaurant.phone}
- Address: ${restaurant.address}
- Timezone: ${restaurant.timezone}

## RESTAURANT HOURS
${formatHoursForPrompt(hours)}

## MENU
${formatMenuForPrompt(categories, items)}

## YOUR RESPONSIBILITIES
1. Answer questions about menu, prices, hours, location
2. Take phone orders for pickup or delivery
3. Collect: customer name, phone, address (if delivery), items, quantities, spice level
4. Confirm order details and approximate total before completing
5. Be polite, patient, and helpful with an Indian hospitality tone

## CONSTRAINTS
- Never take payment information over phone
- Only offer items that are on the menu
- Respect business hours (we are ${isCurrentlyOpen(hours, restaurant.timezone) ? 'currently OPEN' : 'currently CLOSED'})
- If unsure about anything, inform caller that a staff member will call back
- Never make up information not provided here
- Always ask about spice level preference for items that offer it

## SPECIAL INSTRUCTIONS
${voiceSettings.notes_for_agent || 'None'}

## CLOSING MESSAGES (by language)
English: ${voiceSettings.closing_en || 'Thank you for calling!'}
Hindi: ${voiceSettings.closing_hi || 'कॉल करने के लिए धन्यवाद!'}
Punjabi: ${voiceSettings.closing_pa || 'ਕਾਲ ਕਰਨ ਲਈ ਧੰਨਵਾਦ!'}
Gujarati: ${voiceSettings.closing_gu || 'કૉલ કરવા બદલ આભાર!'}
`;
}
