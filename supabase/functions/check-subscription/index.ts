import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string) => {
  // Security: Avoid logging sensitive details like emails, user IDs, customer IDs
  console.log(`[check-subscription] ${step}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Missing required configuration");
    logStep("Configuration verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header - returning unsubscribed");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("Auth error - returning unsubscribed");
      return new Response(JSON.stringify({ subscribed: false, auth_error: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    if (!user?.email) {
      logStep("No user email - returning unsubscribed");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    logStep("User authenticated");

    // Check for database override first
    const { data: override } = await supabaseClient
      .from('subscription_overrides')
      .select('is_premium')
      .eq('user_id', user.id)
      .single();

    if (override?.is_premium) {
      logStep("Database override found - user is premium");
      return new Response(JSON.stringify({
        subscribed: true,
        product_id: 'override',
        subscription_end: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    logStep("Checking subscription status");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("User is not subscribed");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer record");

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    const activeStatuses = new Set<string>(["active", "trialing", "past_due"]);
    const activeSub = subscriptions.data.find((s: Stripe.Subscription) => activeStatuses.has(s.status));
    const hasActiveSub = !!activeSub;

    let productId: string | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActiveSub && activeSub) {
      const periodEnd = activeSub.current_period_end;
      if (typeof periodEnd === 'number' && Number.isFinite(periodEnd)) {
        subscriptionEnd = new Date(periodEnd * 1000).toISOString();
      }
      logStep("Active subscription found");
      const firstItem = activeSub.items?.data?.[0];
      const price = firstItem?.price;
      productId = typeof price?.product === 'string' ? price.product : null;
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("Subscription check failed");
    // Return graceful fallback instead of exposing error details
    return new Response(JSON.stringify({ subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
