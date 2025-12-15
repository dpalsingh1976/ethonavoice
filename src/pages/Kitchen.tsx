import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePrintTicket } from '@/hooks/usePrintTicket';
import { Order, OrderItem } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

const Kitchen = () => {
  const printTicket = usePrintTicket();
  const seenOrderIds = useRef<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [printedOrders, setPrintedOrders] = useState<(Order & { items: OrderItem[] })[]>([]);
  const [printCount, setPrintCount] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const newOrder = payload.new as Order;

          // Skip if already processed in this session
          if (seenOrderIds.current.has(newOrder.id)) return;

          // Skip if already printed (database check)
          if (newOrder.ticket_printed_at) return;

          // Only auto-print new orders
          if (newOrder.status !== 'new') return;

          // Fetch order items
          const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', newOrder.id);

          const fullOrder = { ...newOrder, items: (items || []) as OrderItem[] };

          // Mark as seen and print
          seenOrderIds.current.add(newOrder.id);
          await printTicket(fullOrder);

          // Update UI
          setPrintCount((prev) => prev + 1);
          setPrintedOrders((prev) => [fullOrder, ...prev.slice(0, 9)]);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [printTicket]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Kitchen Auto-Print</h1>
          </div>
          <Badge
            variant="outline"
            className={isConnected ? 'border-green-500 text-green-500' : 'border-destructive text-destructive'}
          >
            {isConnected ? (
              <>
                <Wifi className="mr-1 h-3 w-3" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="mr-1 h-3 w-3" />
                Disconnected
              </>
            )}
          </Badge>
        </div>

        {/* Status Card */}
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
              </span>
              Auto-Print Active
            </CardTitle>
            <CardDescription>
              Leave this window open. New phone orders will print automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Orders printed this session: <span className="font-bold text-foreground">{printCount}</span>
            </p>
          </CardContent>
        </Card>

        {/* Printer Setup */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Printer className="h-5 w-5 text-muted-foreground" />
              Printer Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Check Default Printer (Windows):</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Win + I</kbd> to open Settings</li>
                <li>Go to <span className="font-medium text-foreground">Bluetooth & devices → Printers & scanners</span></li>
                <li>Find your thermal printer and click it</li>
                <li>Click <span className="font-medium text-foreground">"Set as default"</span></li>
              </ol>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-2">Verify Setup:</p>
              <p className="text-sm text-muted-foreground">
                Your default printer will be used automatically. Test by placing a test order or printing from any application.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Kiosk Warning */}
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-warning">
              <AlertTriangle className="h-5 w-5" />
              Kiosk Mode Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              For hands-free printing without dialogs, open this page in Chrome with kiosk printing:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>chrome.exe --kiosk --kiosk-printing --app="{window.location.origin}/kitchen"</code>
            </pre>
          </CardContent>
        </Card>

        {/* Recent Prints */}
        {printedOrders.length > 0 && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Prints</CardTitle>
              <CardDescription>Last {printedOrders.length} auto-printed orders</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {printedOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.items.length} items • ${order.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{order.id.slice(-6).toUpperCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Kitchen;
