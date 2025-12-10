import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { indianMenuDictionary, buildASRHints } from "@/menu/menuDictionary";
import { normalizeTranscriptToMenuItems, generateMatchHints } from "@/voice/normalizeTranscript";

export default function VoiceTest() {
  const [transcript, setTranscript] = useState("one pow bhajee and one wada pow please");
  const [result, setResult] = useState<{
    normalizedText: string;
    matches: Array<{
      canonicalName: string;
      matchedVariant: string;
      originalText: string;
      similarity: number;
    }>;
    hints: string;
  } | null>(null);

  const handleNormalize = () => {
    const normResult = normalizeTranscriptToMenuItems(transcript, indianMenuDictionary);
    const hints = generateMatchHints(normResult.matches);
    setResult({
      ...normResult,
      hints
    });
  };

  const asrHints = buildASRHints(indianMenuDictionary);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Voice Transcript Normalization Test</h1>
          <p className="text-muted-foreground">Test fuzzy matching of Indian food names for voice ordering</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Input Transcript</CardTitle>
            <CardDescription>Enter a simulated ASR transcript with mispronounced menu items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g., one pow bhajee and one wada pow please"
              rows={3}
            />
            <Button onClick={handleNormalize}>Normalize Transcript</Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-2">Original Text</h3>
                <p className="font-mono text-sm bg-muted p-3 rounded">{transcript}</p>
              </div>

              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-2">Normalized Text</h3>
                <p className="font-mono text-sm bg-primary/10 p-3 rounded text-primary">{result.normalizedText}</p>
              </div>

              {result.matches.length > 0 && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Matches Found</h3>
                  <div className="space-y-2">
                    {result.matches.map((match, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-muted rounded">
                        <Badge variant={match.similarity >= 0.9 ? "default" : match.similarity >= 0.8 ? "secondary" : "outline"}>
                          {(match.similarity * 100).toFixed(0)}%
                        </Badge>
                        <span className="text-sm">
                          <span className="text-muted-foreground">"{match.originalText}"</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">{match.canonicalName}</span>
                          {match.matchedVariant !== match.canonicalName && (
                            <span className="text-xs text-muted-foreground ml-2">(via: {match.matchedVariant})</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.hints && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">LLM Context Hints</h3>
                  <p className="text-sm italic bg-muted p-3 rounded">{result.hints}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>ASR Hints for Retell</CardTitle>
            <CardDescription>These hints are sent to Retell to improve speech recognition ({asrHints.length} total)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
              {asrHints.slice(0, 50).map((hint, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">{hint}</Badge>
              ))}
              {asrHints.length > 50 && (
                <Badge variant="secondary" className="text-xs">+{asrHints.length - 50} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Menu Dictionary</CardTitle>
            <CardDescription>Configured menu items with phonetic variants ({indianMenuDictionary.length} items)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {indianMenuDictionary.map((item) => (
                <div key={item.id} className="p-3 border rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{item.canonicalName}</span>
                    {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Variants: {item.phoneticVariants.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
