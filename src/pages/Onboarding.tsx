import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    timezone: 'Asia/Kolkata',
  });

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Create restaurant
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .insert({
          owner_id: user.id,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          timezone: formData.timezone,
        })
        .select()
        .single();

      if (restError) throw restError;

      // Create default voice settings
      const { error: voiceError } = await supabase
        .from('restaurant_voice_settings')
        .insert({
          restaurant_id: restaurant.id,
          supported_languages: ['en', 'hi', 'pa', 'gu'],
          greeting_en: `Welcome to ${formData.name}! How can I help you today?`,
          greeting_hi: `${formData.name} में आपका स्वागत है! मैं आपकी कैसे मदद कर सकता हूं?`,
        });

      if (voiceError) console.error('Error creating voice settings:', voiceError);

      toast({
        title: 'Restaurant created!',
        description: 'Your restaurant has been set up successfully.',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error creating restaurant',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.name || !formData.phone)) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    if (step === 2 && !formData.address) {
      toast({
        title: 'Missing information',
        description: 'Please enter your restaurant address.',
        variant: 'destructive',
      });
      return;
    }
    if (step < 3) setStep(step + 1);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <Card className="w-full max-w-2xl border-border/50 shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Phone className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to VoiceServe</CardTitle>
          <CardDescription>
            Let's set up your restaurant in just a few steps
          </CardDescription>
          <div className="mt-4 flex justify-center space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 w-16 rounded-full transition-all ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
              <div className="space-y-2">
                <Label htmlFor="name">Restaurant Name *</Label>
                <Input
                  id="name"
                  placeholder="Bikanerwala"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Location Details</h3>
              <div className="space-y-2">
                <Label htmlFor="address">Restaurant Address *</Label>
                <Textarea
                  id="address"
                  placeholder="123 Main Street, Connaught Place, New Delhi"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  Used for order timestamps and business hours
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Ready to Launch!</h3>
              <div className="rounded-lg border border-border/50 bg-secondary/50 p-4">
                <h4 className="mb-2 font-semibold text-foreground">Your Restaurant</h4>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="inline font-medium">Name: </dt>
                    <dd className="inline text-muted-foreground">{formData.name}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Phone: </dt>
                    <dd className="inline text-muted-foreground">{formData.phone}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Address: </dt>
                    <dd className="inline text-muted-foreground">{formData.address}</dd>
                  </div>
                </dl>
              </div>
              <p className="text-sm text-muted-foreground">
                We'll create default voice agent settings in English and Hindi. You can customize
                these later in your dashboard settings.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={nextStep} className="ml-auto">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="ml-auto">
                {loading ? 'Creating...' : 'Complete Setup'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
