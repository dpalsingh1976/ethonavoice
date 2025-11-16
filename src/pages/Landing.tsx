import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, Users, Utensils, Languages, TrendingUp, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-2">
            <Phone className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">VoiceServe</span>
          </div>
          <Button onClick={() => navigate('/auth')} size="lg">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-5xl font-bold leading-tight text-foreground md:text-6xl">
            AI Voice Agents for Your
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Indian Restaurant
            </span>
          </h1>
          <p className="mb-8 text-xl text-muted-foreground">
            Handle customer calls in Hindi, English, Punjabi, and Gujarati. Take orders, answer questions, and delight customers 24/7.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button onClick={() => navigate('/auth')} size="lg" className="px-8">
              Start Free Trial
            </Button>
            <Button onClick={() => navigate('/auth')} variant="outline" size="lg" className="px-8">
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
          Everything You Need to Automate Customer Service
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/50 p-6 transition-all hover:shadow-lg">
            <Languages className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-2 text-xl font-semibold text-foreground">Multilingual Support</h3>
            <p className="text-muted-foreground">
              Automatically detects and responds in Hindi, English, Punjabi, and Gujarati.
            </p>
          </Card>

          <Card className="border-border/50 p-6 transition-all hover:shadow-lg">
            <Utensils className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-2 text-xl font-semibold text-foreground">Smart Menu Integration</h3>
            <p className="text-muted-foreground">
              Sync with Toast and Clover POS systems. Always up-to-date menu and pricing.
            </p>
          </Card>

          <Card className="border-border/50 p-6 transition-all hover:shadow-lg">
            <Phone className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-2 text-xl font-semibold text-foreground">24/7 Phone Orders</h3>
            <p className="text-muted-foreground">
              Never miss an order. Take pickup and delivery orders any time of day.
            </p>
          </Card>

          <Card className="border-border/50 p-6 transition-all hover:shadow-lg">
            <Users className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-2 text-xl font-semibold text-foreground">Customer-Friendly</h3>
            <p className="text-muted-foreground">
              Polite, helpful responses with authentic Indian hospitality.
            </p>
          </Card>

          <Card className="border-border/50 p-6 transition-all hover:shadow-lg">
            <TrendingUp className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-2 text-xl font-semibold text-foreground">Increase Revenue</h3>
            <p className="text-muted-foreground">
              Handle more calls, take more orders, and grow your business.
            </p>
          </Card>

          <Card className="border-border/50 p-6 transition-all hover:shadow-lg">
            <Shield className="mb-4 h-12 w-12 text-primary" />
            <h3 className="mb-2 text-xl font-semibold text-foreground">Secure & Reliable</h3>
            <p className="text-muted-foreground">
              Enterprise-grade security. Your data is always protected.
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 bg-gradient-to-r from-primary/10 to-accent/10 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Join hundreds of restaurants using AI to serve customers better.
          </p>
          <Button onClick={() => navigate('/auth')} size="lg" className="px-12">
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 VoiceServe. Empowering restaurants with AI voice technology.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
