import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolveSafeOrigin(originHeader: string | null): string {
  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  const additionalOrigins = (Deno.env.get("ADDITIONAL_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    ...(siteUrl ? [siteUrl] : []),
    ...additionalOrigins,
  ]);

  if (originHeader && allowedOrigins.has(originHeader)) {
    return originHeader;
  }

  if (siteUrl) {
    return siteUrl;
  }

  throw new Error("Missing SITE_URL configuration");
}

const logStep = (step: string) => {
  // Security: Avoid logging sensitive details like emails, user IDs, customer IDs
  console.log(`[customer-portal] ${step}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Missing required configuration");
    logStep("Configuration verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error("Authentication failed");
    const user = userData.user;
    if (!user?.email) throw new Error("Authentication required");
    logStep("User authenticated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No subscription found");
    }
    const customerId = customers.data[0].id;
    logStep("Customer found");

    const origin = resolveSafeOrigin(req.headers.get("origin"));
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });
    logStep("Portal session created");

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("Portal access failed");
    // Return generic error message to avoid information disclosure
    return new Response(JSON.stringify({ error: "Could not access subscription portal. Please try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
