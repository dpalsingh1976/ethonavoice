import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration from environment variables
const getConfig = () => ({
  defaultWebhookUrl: Deno.env.get("WEBHOOK_TOOL_URL") || "",
  httpMethod: Deno.env.get("WEBHOOK_TOOL_METHOD") || "POST",
  timeoutMs: parseInt(Deno.env.get("WEBHOOK_TOOL_TIMEOUT") || "30000"),
  defaultHeaders: JSON.parse(Deno.env.get("WEBHOOK_TOOL_HEADERS") || "{}"),
});

// Input schema interface
interface WebhookToolInput {
  eventType: string;
  sessionId?: string;
  payload: Record<string, unknown>;
  // Optional overrides for multi-tenant use
  webhookUrl?: string;
  headers?: Record<string, string>;
  // For restaurant lookup
  agent_id?: string;
  restaurant_id?: string;
}

// Response interface
interface WebhookToolResponse {
  success: boolean;
  statusCode: number;
  responseBody: unknown | null;
  error: string | null;
  executionTimeMs: number;
}

// Validate required fields
function validateInput(input: unknown): { valid: boolean; error?: string; data?: WebhookToolInput } {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid input: expected an object" };
  }

  const data = input as Record<string, unknown>;

  if (!data.eventType || typeof data.eventType !== "string") {
    return { valid: false, error: "Missing or invalid required field: eventType (string)" };
  }

  if (!data.payload || typeof data.payload !== "object") {
    return { valid: false, error: "Missing or invalid required field: payload (object)" };
  }

  return {
    valid: true,
    data: {
      eventType: data.eventType as string,
      sessionId: data.sessionId as string | undefined,
      payload: data.payload as Record<string, unknown>,
      webhookUrl: data.webhookUrl as string | undefined,
      headers: data.headers as Record<string, string> | undefined,
      agent_id: data.agent_id as string | undefined,
      restaurant_id: data.restaurant_id as string | undefined,
    },
  };
}

// Restaurant lookup result interface
interface RestaurantLookup {
  webhook_url: string | null;
  name: string | null;
}

// Lookup restaurant-specific webhook URL from database
async function getRestaurantWebhookUrl(
  supabaseUrl: string,
  supabaseKey: string,
  agentId?: string,
  restaurantId?: string
): Promise<{ webhookUrl: string | null; restaurantName: string | null }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase.from("restaurants").select("webhook_url, name");

    if (restaurantId) {
      query = query.eq("id", restaurantId);
    } else if (agentId) {
      // Check all agent ID fields
      query = query.or(
        `elevenlabs_agent_id.eq.${agentId},retell_agent_id.eq.${agentId}`
      );
    } else {
      return { webhookUrl: null, restaurantName: null };
    }

    const { data: restaurant, error } = await query.maybeSingle();

    if (error) {
      console.error("Error looking up restaurant:", error);
      return { webhookUrl: null, restaurantName: null };
    }

    const result = restaurant as RestaurantLookup | null;
    return {
      webhookUrl: result?.webhook_url || null,
      restaurantName: result?.name || null,
    };
  } catch (err) {
    console.error("Exception looking up restaurant:", err);
    return { webhookUrl: null, restaurantName: null };
  }
}

// Execute webhook request with timeout
async function executeWebhook(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<WebhookToolResponse> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    console.log(`Executing webhook: ${method} ${url}`);
    console.log("Request body:", JSON.stringify(body));

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const executionTimeMs = Date.now() - startTime;
    let responseBody: unknown = null;

    try {
      const text = await response.text();
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      // Response is not JSON, that's okay
      responseBody = null;
    }

    console.log(`Webhook response: ${response.status} in ${executionTimeMs}ms`);

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody,
      error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
      executionTimeMs,
    };
  } catch (err: unknown) {
    const executionTimeMs = Date.now() - startTime;
    const error = err as Error;

    if (error.name === "AbortError") {
      console.error(`Webhook timeout after ${executionTimeMs}ms`);
      return {
        success: false,
        statusCode: 408,
        responseBody: null,
        error: `Request timeout after ${timeoutMs}ms`,
        executionTimeMs,
      };
    }

    console.error("Webhook execution error:", error);
    return {
      success: false,
      statusCode: 500,
      responseBody: null,
      error: error.message || "Unknown error occurred",
      executionTimeMs,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const config = getConfig();
    const requestBody = await req.json();

    console.log("Webhook tool invoked with:", JSON.stringify(requestBody));

    // Validate input
    const validation = validateInput(requestBody);
    if (!validation.valid || !validation.data) {
      console.error("Validation failed:", validation.error);
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 400,
          responseBody: null,
          error: validation.error,
          executionTimeMs: Date.now() - startTime,
        } as WebhookToolResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const input = validation.data;

    // Get Supabase credentials for restaurant lookup
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Determine target webhook URL with priority:
    // 1. Explicit webhookUrl in request
    // 2. Restaurant-specific webhook from database
    // 3. Default from environment variable
    let targetUrl = input.webhookUrl || "";
    let restaurantName: string | null = null;

    if (!targetUrl && (input.agent_id || input.restaurant_id)) {
      const lookup = await getRestaurantWebhookUrl(
        supabaseUrl,
        supabaseServiceKey,
        input.agent_id,
        input.restaurant_id
      );
      if (lookup.webhookUrl) {
        targetUrl = lookup.webhookUrl;
        restaurantName = lookup.restaurantName;
        console.log(`Using restaurant-specific webhook for ${restaurantName}: ${targetUrl}`);
      }
    }

    if (!targetUrl) {
      targetUrl = config.defaultWebhookUrl;
      console.log(`Using default webhook URL: ${targetUrl}`);
    }

    if (!targetUrl) {
      console.error("No webhook URL configured");
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 400,
          responseBody: null,
          error: "No webhook URL configured. Provide webhookUrl in request, configure restaurant webhook_url, or set WEBHOOK_TOOL_URL environment variable.",
          executionTimeMs: Date.now() - startTime,
        } as WebhookToolResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Construct the webhook payload
    const webhookPayload = {
      eventType: input.eventType,
      sessionId: input.sessionId || null,
      payload: input.payload,
      timestamp: new Date().toISOString(),
      source: "lovable_webhook_tool",
      metadata: {
        restaurantName,
        agentId: input.agent_id || null,
        restaurantId: input.restaurant_id || null,
      },
    };

    // Merge headers: default config headers + request-specific headers
    const mergedHeaders = {
      ...config.defaultHeaders,
      ...(input.headers || {}),
    };

    // Execute the webhook
    const result = await executeWebhook(
      targetUrl,
      config.httpMethod,
      mergedHeaders,
      webhookPayload,
      config.timeoutMs
    );

    console.log("Webhook tool result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : result.statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Webhook tool error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        statusCode: 500,
        responseBody: null,
        error: error.message || "Internal server error",
        executionTimeMs: Date.now() - startTime,
      } as WebhookToolResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
