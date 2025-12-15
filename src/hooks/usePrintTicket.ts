import { supabase } from '@/integrations/supabase/client';
import { printKitchenTicket } from '@/components/KitchenTicket';
import { Order, OrderItem } from '@/types/database';

export const usePrintTicket = () => {
  const printTicket = async (
    order: Order & { items: OrderItem[] },
    restaurantName: string = 'HONEST RESTAURANT',
    restaurantAddress: string = '60 Main Ave, Clifton, NJ'
  ) => {
    // Print the ticket
    printKitchenTicket(order, restaurantName, restaurantAddress);

    // Update ticket_printed_at in database
    await supabase
      .from('orders')
      .update({ ticket_printed_at: new Date().toISOString() })
      .eq('id', order.id);
  };

  return printTicket;
};
