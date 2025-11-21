import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, ArrowLeft, Calendar, User, MapPin, Package } from 'lucide-react';
import { Order, OrderItem } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Orders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      // First get restaurant
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (restError) throw restError;

      // Then get orders
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading orders',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'new' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Order updated',
        description: `Order status changed to ${newStatus}`,
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: 'Error updating order',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-primary text-primary-foreground';
      case 'in_progress':
        return 'bg-warning text-warning-foreground';
      case 'completed':
        return 'bg-success text-success-foreground';
      case 'cancelled':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(order => order.status === filter);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <Phone className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">Orders</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Order Management</h1>
            <p className="text-muted-foreground">
              {filteredOrders.length} {filter === 'all' ? 'total' : filter} orders
            </p>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter orders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredOrders.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="mb-4 h-16 w-16 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">
                No orders found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="border-border/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-1 flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        {order.customer_name}
                      </CardTitle>
                      <CardDescription className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {order.customer_phone}
                        </span>
                        {order.customer_address && (
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {order.customer_address}
                          </span>
                        )}
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(order.created_at).toLocaleString()}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <div className="text-2xl font-bold text-foreground">
                        ${order.total_amount.toLocaleString('en-US')}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Language: {order.language_used.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                      Change Status
                    </h4>
                    <Select
                      value={order.status}
                      onValueChange={(value) => updateOrderStatus(order.id, value as 'new' | 'in_progress' | 'completed' | 'cancelled')}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Orders;
