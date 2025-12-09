import { Order, OrderItem } from '@/types/database';

interface KitchenTicketProps {
  order: Order & { items: OrderItem[] };
  restaurantName?: string;
  restaurantAddress?: string;
}

// Parse item notes to extract customizations
const parseItemNotes = (notes?: string) => {
  if (!notes) return { spice: null, jain: null, otherNotes: null };
  
  const parts = notes.split(',').map(s => s.trim());
  let spice: string | null = null;
  let jain: string | null = null;
  const otherParts: string[] = [];
  
  parts.forEach(part => {
    const lower = part.toLowerCase();
    if (lower.includes('spice') || lower === 'mild' || lower === 'medium' || lower === 'hot' || lower === 'spicy') {
      spice = part;
    } else if (lower.includes('jain')) {
      jain = lower.includes('yes') || lower === 'jain' ? 'YES' : 'NO';
    } else if (part) {
      otherParts.push(part);
    }
  });
  
  return { 
    spice, 
    jain, 
    otherNotes: otherParts.length > 0 ? otherParts.join(', ') : null 
  };
};

export const generateKitchenTicketHTML = (
  order: Order & { items: OrderItem[] },
  restaurantName: string = 'HONEST RESTAURANT',
  restaurantAddress: string = '60 Main Ave, Clifton, NJ'
): string => {
  const orderNumber = order.id.slice(-8).toUpperCase();
  const createdTime = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const createdDate = new Date(order.created_at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const printedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const orderType = order.source?.toLowerCase().includes('delivery') ? 'DELIVERY' : 'PICKUP';

  const itemsHTML = order.items.map(item => {
    const { spice, jain, otherNotes } = parseItemNotes(item.notes);
    
    let customizations = '';
    if (spice) customizations += `<div class="customization">- Spice: ${spice}</div>`;
    if (jain) customizations += `<div class="customization">- Jain: ${jain}</div>`;
    if (otherNotes) customizations += `<div class="customization">- Notes: ${otherNotes}</div>`;
    
    return `
      <div class="item">
        <div class="item-header">${item.quantity} x ${item.name.toUpperCase()}</div>
        ${customizations}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kitchen Ticket - ${orderNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 14px;
      line-height: 1.4;
      width: 80mm;
      max-width: 80mm;
      padding: 8px;
      background: white;
      color: black;
    }
    
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    
    .restaurant-name {
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    
    .subline {
      font-size: 11px;
      color: #666;
    }
    
    .order-info {
      margin: 8px 0;
    }
    
    .order-number {
      font-size: 16px;
      font-weight: bold;
    }
    
    .order-type {
      font-size: 20px;
      font-weight: bold;
      text-align: center;
      padding: 6px;
      border: 2px solid black;
      margin: 8px 0;
    }
    
    .times {
      font-size: 12px;
      margin: 4px 0;
    }
    
    .divider {
      border: none;
      border-top: 1px dashed black;
      margin: 8px 0;
    }
    
    .customer-info {
      font-size: 12px;
      margin-bottom: 8px;
    }
    
    .section-title {
      font-weight: bold;
      font-size: 13px;
      margin-bottom: 6px;
      text-decoration: underline;
    }
    
    .items-section {
      margin: 8px 0;
    }
    
    .item {
      margin-bottom: 12px;
    }
    
    .item-header {
      font-size: 15px;
      font-weight: bold;
    }
    
    .customization {
      font-size: 12px;
      padding-left: 12px;
    }
    
    .special-instructions {
      margin-top: 8px;
      padding: 6px;
      border: 1px solid black;
    }
    
    .special-instructions-title {
      font-weight: bold;
      font-size: 12px;
    }
    
    .special-instructions-text {
      font-size: 12px;
      margin-top: 4px;
    }
    
    .footer {
      margin-top: 12px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    
    @media print {
      body {
        width: 80mm;
        max-width: 80mm;
        padding: 4px;
      }
      
      @page {
        size: 80mm auto;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">${restaurantName}</div>
    <div class="subline">Kitchen Ticket</div>
  </div>
  
  <div class="order-info">
    <div class="order-number">Order #: ${orderNumber}</div>
  </div>
  
  <div class="order-type">${orderType}</div>
  
  <div class="times">
    <div>Created: ${createdDate} ${createdTime}</div>
  </div>
  
  <hr class="divider">
  
  ${order.customer_name || order.customer_phone ? `
  <div class="customer-info">
    ${order.customer_name ? `<div>Name: ${order.customer_name}</div>` : ''}
    ${order.customer_phone ? `<div>Phone: ${order.customer_phone}</div>` : ''}
    ${order.customer_address ? `<div>Address: ${order.customer_address}</div>` : ''}
  </div>
  <hr class="divider">
  ` : ''}
  
  <div class="items-section">
    <div class="section-title">ITEMS</div>
    ${itemsHTML}
  </div>
  
  <hr class="divider">
  
  <div class="footer">
    <div>Printed at: ${printedTime}</div>
    <div>${restaurantName} - ${restaurantAddress}</div>
  </div>
</body>
</html>
  `;
};

export const printKitchenTicket = (
  order: Order & { items: OrderItem[] },
  restaurantName?: string,
  restaurantAddress?: string
): void => {
  const html = generateKitchenTicketHTML(order, restaurantName, restaurantAddress);
  
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    alert('Please allow popups to print kitchen tickets');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};

const KitchenTicket = ({ order, restaurantName, restaurantAddress }: KitchenTicketProps) => {
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: generateKitchenTicketHTML(order, restaurantName, restaurantAddress) 
      }} 
    />
  );
};

export default KitchenTicket;