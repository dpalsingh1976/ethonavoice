import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, ArrowLeft, Save, Workflow, Upload, BookOpen, CheckCircle, Code, Copy } from 'lucide-react';
import { Restaurant } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface ExtendedRestaurant extends Restaurant {
  retell_conversation_flow_id?: string;
  retell_knowledge_base_id?: string;
}

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<ExtendedRestaurant | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [uploadingKb, setUploadingKb] = useState(false);
  const [flowData, setFlowData] = useState<any>(null);
  const [fetchingFlow, setFetchingFlow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchRestaurant();
    }
  }, [user]);

  const fetchRestaurant = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error) throw error;
      setRestaurant(data as ExtendedRestaurant);

      // Fetch voice settings
      const { data: voiceData, error: voiceError } = await supabase
        .from('restaurant_voice_settings')
        .select('*')
        .eq('restaurant_id', data.id)
        .maybeSingle();

      if (voiceError && voiceError.code !== 'PGRST116') {
        console.error('Error fetching voice settings:', voiceError);
      }

      setVoiceSettings(voiceData || {
        supported_languages: ['en', 'hi', 'pa', 'gu'],
        greeting_en: '',
        greeting_hi: '',
        greeting_pa: '',
        greeting_gu: '',
        closing_en: '',
        closing_hi: '',
        closing_pa: '',
        closing_gu: '',
        notes_for_agent: ''
      });
    } catch (error: any) {
      toast({
        title: 'Error loading settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!restaurant) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: restaurant.name,
          phone: restaurant.phone,
          address: restaurant.address,
          timezone: restaurant.timezone,
        })
        .eq('id', restaurant.id);

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Your restaurant information has been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVoiceSettings = async () => {
    if (!restaurant || !voiceSettings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurant_voice_settings')
        .upsert({
          restaurant_id: restaurant.id,
          ...voiceSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: 'Voice settings saved',
        description: 'Your voice agent configuration has been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving voice settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateConversationFlow = async () => {
    if (!restaurant) return;

    setCreatingFlow(true);
    try {
      // First save voice settings
      await handleSaveVoiceSettings();

      // Create Conversation Flow via edge function
      const { data, error } = await supabase.functions.invoke('retell-conversation-flow', {
        body: { restaurantId: restaurant.id }
      });

      if (error) throw error;

      if (data.success) {
        // Update local restaurant state with new IDs
        setRestaurant(prev => prev ? { 
          ...prev, 
          retell_agent_id: data.agentId,
          retell_conversation_flow_id: data.conversationFlowId 
        } : null);
        
        toast({
          title: 'Voice Flow Created!',
          description: `Your conversation flow and agent have been set up successfully.`,
        });
      } else {
        throw new Error(data.error || 'Failed to create conversation flow');
      }
    } catch (error: any) {
      console.error('Error creating conversation flow:', error);
      toast({
        title: 'Error creating flow',
        description: error.message || 'Please check your Retell API key and try again.',
        variant: 'destructive',
      });
    } finally {
      setCreatingFlow(false);
    }
  };

  const handleKnowledgeBaseUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !restaurant) return;

    setUploadingKb(true);
    try {
      // Read file content
      const content = await file.text();
      
      // Call edge function to create knowledge base
      const { data, error } = await supabase.functions.invoke('retell-knowledge-base', {
        body: { 
          restaurantId: restaurant.id,
          kbContent: content
        }
      });

      if (error) throw error;

      if (data.success) {
        setRestaurant(prev => prev ? { 
          ...prev, 
          retell_knowledge_base_id: data.knowledgeBaseId 
        } : null);
        
        toast({
          title: 'Knowledge Base Uploaded!',
          description: `Successfully processed ${data.itemCount} Q&A items.`,
        });
      } else {
        throw new Error(data.error || 'Failed to upload knowledge base');
      }
    } catch (error: any) {
      console.error('Error uploading knowledge base:', error);
      toast({
        title: 'Error uploading knowledge base',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingKb(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFetchConversationFlow = async () => {
    if (!restaurant?.retell_conversation_flow_id) return;
    
    setFetchingFlow(true);
    setFlowData(null);
    try {
      const { data, error } = await supabase.functions.invoke('retell-get-flow', {
        body: { conversationFlowId: restaurant.retell_conversation_flow_id }
      });
      
      if (error) throw error;
      if (data.success) {
        setFlowData(data.flow);
        toast({
          title: 'Flow data retrieved',
          description: 'Conversation flow configuration loaded successfully.',
        });
      } else {
        throw new Error(data.error || 'Failed to fetch flow');
      }
    } catch (error: any) {
      console.error('Error fetching conversation flow:', error);
      toast({ 
        title: 'Error fetching flow', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setFetchingFlow(false);
    }
  };

  const handleCopyFlowData = () => {
    if (flowData) {
      navigator.clipboard.writeText(JSON.stringify(flowData, null, 2));
      toast({
        title: 'Copied!',
        description: 'Flow data copied to clipboard.',
      });
    }
  };

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
              <span className="text-2xl font-bold text-foreground">Settings</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Restaurant Settings</h1>
            <p className="text-muted-foreground">
              Manage your restaurant information and voice agent configuration
            </p>
          </div>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="voice">Voice Agent</TabsTrigger>
              <TabsTrigger value="integration">Integrations</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Update your restaurant's basic details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Restaurant Name</Label>
                    <Input
                      id="name"
                      value={restaurant?.name || ''}
                      onChange={(e) =>
                        setRestaurant((prev) =>
                          prev ? { ...prev, name: e.target.value } : null
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={restaurant?.phone || ''}
                      onChange={(e) =>
                        setRestaurant((prev) =>
                          prev ? { ...prev, phone: e.target.value } : null
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={restaurant?.address || ''}
                      onChange={(e) =>
                        setRestaurant((prev) =>
                          prev ? { ...prev, address: e.target.value } : null
                        )
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={restaurant?.timezone || 'Asia/Kolkata'}
                      onChange={(e) =>
                        setRestaurant((prev) =>
                          prev ? { ...prev, timezone: e.target.value } : null
                        )
                      }
                    />
                  </div>
                  <Button onClick={handleSaveBasicInfo} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Knowledge Base
                    </CardTitle>
                    <CardDescription>
                      Upload a Q&A file to help your voice agent answer common questions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {restaurant?.retell_knowledge_base_id && (
                      <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <div>
                          <p className="text-sm font-medium">Knowledge Base Active</p>
                          <p className="text-xs opacity-80 font-mono">
                            {restaurant.retell_knowledge_base_id}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Upload Q&A File</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Upload a text or RTF file with Q&A pairs. Format each pair as:
                        <br />
                        <code className="bg-muted px-1 rounded">Q: Your question here</code>
                        <br />
                        <code className="bg-muted px-1 rounded">A: The answer here</code>
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.rtf,.md"
                        onChange={handleKnowledgeBaseUpload}
                        className="hidden"
                        id="kb-file-input"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingKb}
                        className="w-full"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadingKb 
                          ? 'Uploading...' 
                          : restaurant?.retell_knowledge_base_id 
                            ? 'Replace Knowledge Base' 
                            : 'Upload Knowledge Base'}
                      </Button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      The knowledge base helps your voice agent answer questions about menu items, hours, policies, and more.
                    </p>
                  </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="voice">
              <div className="space-y-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Workflow className="h-5 w-5" />
                      Voice Flow Status
                    </CardTitle>
                    <CardDescription>
                      {restaurant?.retell_agent_id 
                        ? 'Your voice assistant is active with a conversation flow' 
                        : 'Create a conversation flow to start taking orders'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {restaurant?.retell_conversation_flow_id && (
                      <div className="rounded-lg bg-primary/10 p-4 space-y-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">Conversation Flow ID</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            {restaurant.retell_conversation_flow_id}
                          </p>
                        </div>
                        {restaurant?.retell_agent_id && (
                          <div>
                            <p className="text-sm font-medium text-foreground">Agent ID</p>
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              {restaurant.retell_agent_id}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <Button 
                      onClick={handleCreateConversationFlow} 
                      disabled={creatingFlow}
                      className="w-full"
                    >
                      <Workflow className="mr-2 h-4 w-4" />
                      {creatingFlow 
                        ? 'Creating Flow...' 
                        : restaurant?.retell_conversation_flow_id 
                          ? 'Update Voice Flow' 
                          : 'Create Voice Flow'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This creates a structured conversation flow that guides callers through ordering, answering questions, and more.
                    </p>
                  </CardContent>
                </Card>

                {restaurant?.retell_conversation_flow_id && (
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Conversation Flow Details
                      </CardTitle>
                      <CardDescription>
                        Retrieve and inspect the full conversation flow configuration from Retell
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button 
                        onClick={handleFetchConversationFlow}
                        disabled={fetchingFlow}
                        variant="outline"
                        className="w-full"
                      >
                        <Code className="mr-2 h-4 w-4" />
                        {fetchingFlow ? 'Fetching...' : 'Fetch Flow Data'}
                      </Button>
                      
                      {flowData && (
                        <div className="relative">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="absolute top-2 right-2 z-10"
                            onClick={handleCopyFlowData}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <pre className="bg-muted rounded-lg p-4 overflow-auto max-h-96 text-xs font-mono">
                            <code>{JSON.stringify(flowData, null, 2)}</code>
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Multilingual Greetings</CardTitle>
                    <CardDescription>
                      Customize greetings for each supported language
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="greeting_en">English Greeting</Label>
                      <Textarea
                        id="greeting_en"
                        value={voiceSettings?.greeting_en || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, greeting_en: e.target.value }))
                        }
                        placeholder="Welcome to [Restaurant Name]! How can I help you today?"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="greeting_hi">Hindi Greeting (हिंदी)</Label>
                      <Textarea
                        id="greeting_hi"
                        value={voiceSettings?.greeting_hi || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, greeting_hi: e.target.value }))
                        }
                        placeholder="[Restaurant Name] में आपका स्वागत है! मैं आपकी कैसे मदद कर सकता हूं?"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="greeting_pa">Punjabi Greeting (ਪੰਜਾਬੀ)</Label>
                      <Textarea
                        id="greeting_pa"
                        value={voiceSettings?.greeting_pa || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, greeting_pa: e.target.value }))
                        }
                        placeholder="[Restaurant Name] ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ! ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="greeting_gu">Gujarati Greeting (ગુજરાતી)</Label>
                      <Textarea
                        id="greeting_gu"
                        value={voiceSettings?.greeting_gu || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, greeting_gu: e.target.value }))
                        }
                        placeholder="[Restaurant Name] માં તમારું સ્વાગત છે! હું તમારી કેવી રીતે મદદ કરી શકું?"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Closing Messages</CardTitle>
                    <CardDescription>
                      Customize closing messages for each language
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="closing_en">English Closing</Label>
                      <Textarea
                        id="closing_en"
                        value={voiceSettings?.closing_en || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, closing_en: e.target.value }))
                        }
                        placeholder="Thank you for calling [Restaurant Name]. Have a great day!"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="closing_hi">Hindi Closing (हिंदी)</Label>
                      <Textarea
                        id="closing_hi"
                        value={voiceSettings?.closing_hi || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, closing_hi: e.target.value }))
                        }
                        placeholder="[Restaurant Name] को कॉल करने के लिए धन्यवाद। आपका दिन शुभ हो!"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="closing_pa">Punjabi Closing (ਪੰਜਾਬੀ)</Label>
                      <Textarea
                        id="closing_pa"
                        value={voiceSettings?.closing_pa || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, closing_pa: e.target.value }))
                        }
                        placeholder="[Restaurant Name] ਨੂੰ ਕਾਲ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਤੁਹਾਡਾ ਦਿਨ ਸ਼ੁਭ ਹੋਵੇ!"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="closing_gu">Gujarati Closing (ગુજરાતી)</Label>
                      <Textarea
                        id="closing_gu"
                        value={voiceSettings?.closing_gu || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, closing_gu: e.target.value }))
                        }
                        placeholder="[Restaurant Name] ને કૉલ કરવા બદલ આભાર। તમારો દિવસ શુભ રહે!"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Agent Instructions</CardTitle>
                    <CardDescription>
                      Special instructions and guidelines for your AI assistant
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="notes_for_agent">Additional Instructions</Label>
                      <Textarea
                        id="notes_for_agent"
                        value={voiceSettings?.notes_for_agent || ''}
                        onChange={(e) =>
                          setVoiceSettings((prev: any) => ({ ...prev, notes_for_agent: e.target.value }))
                        }
                        placeholder="Examples: Always mention today's special, ask about spice level, mention delivery time is 30-45 minutes..."
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        These instructions will be included in the conversation flow's global prompt.
                      </p>
                    </div>

                    <Button onClick={handleSaveVoiceSettings} disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Voice Settings'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="integration">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>POS Integration</CardTitle>
                  <CardDescription>
                    Connect Toast or Clover POS (Coming Soon)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    POS integration will be available in the next update.
                    You'll be able to sync your menu, pricing, and inventory from Toast or Clover.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Settings;
