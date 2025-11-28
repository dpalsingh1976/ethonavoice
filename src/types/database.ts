export type AppRole = 'admin' | 'owner';
export type PosType = 'toast' | 'clover' | 'none';
export type OrderStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  address: string;
  timezone: string;
  pos_type: PosType;
  pos_api_key?: string;
  vapi_assistant_id?: string;
  retell_agent_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestaurantHours {
  id: string;
  restaurant_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  created_at: string;
}

export interface RestaurantVoiceSettings {
  id: string;
  restaurant_id: string;
  supported_languages: string[];
  greeting_en?: string;
  greeting_hi?: string;
  greeting_pa?: string;
  greeting_gu?: string;
  closing_en?: string;
  closing_hi?: string;
  closing_pa?: string;
  closing_gu?: string;
  notes_for_agent?: string;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  is_available: boolean;
  is_vegetarian: boolean;
  spice_level_options: string[];
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  currency: string;
  language_used: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}
