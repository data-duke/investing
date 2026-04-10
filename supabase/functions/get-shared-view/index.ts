import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to access shared_views and portfolios
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Fetching shared view for token: ${token.substring(0, 8)}...`);

    // Fetch the shared view
    const { data: share, error: shareError } = await supabase
      .from("shared_views")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      console.log("Share not found or inactive");
      return new Response(
        JSON.stringify({ error: "Share not found or expired" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(share.expires_at) < new Date()) {
      console.log("Share expired");
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment view count
    await supabase
      .from("shared_views")
      .update({ view_count: share.view_count + 1 })
      .eq("id", share.id);

    // Fetch owner's portfolios filtered by tags
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", share.user_id);

    if (portfolioError) {
      console.error("Error fetching portfolios:", portfolioError);
      throw new Error("Failed to fetch portfolio data");
    }

    // Check if sharing all portfolios (special marker "__ALL__" or empty tags)
    const isShareAll = share.tags.length === 0 || share.tags.includes("__ALL__");

    // Filter by tags (check if any of portfolio's tags match share's tags)
    const filteredPortfolios = isShareAll 
      ? portfolios || []
      : portfolios?.filter((p) => {
          const portfolioTags = p.tags || [];
          // Also check legacy tag and auto_tag_date
          if (p.tag && !portfolioTags.includes(p.tag)) {
            portfolioTags.push(p.tag);
          }
          if (p.auto_tag_date && !portfolioTags.includes(p.auto_tag_date)) {
            portfolioTags.push(p.auto_tag_date);
          }
          return portfolioTags.some((t: string) => share.tags.includes(t));
        }) || [];

    console.log(`Found ${filteredPortfolios.length} portfolios matching tags`);

    // Fetch latest snapshots for each portfolio
    const enrichedPortfolios = await Promise.all(
      filteredPortfolios.map(async (portfolio) => {
        const { data: snapshots } = await supabase
          .from("portfolio_snapshots")
          .select("*")
          .eq("portfolio_id", portfolio.id)
          .order("snapshot_date", { ascending: false })
          .limit(1);

        if (snapshots && snapshots.length > 0) {
          const snap = snapshots[0];
          // Use manual dividend override if set, same as dashboard
          const dividend = portfolio.manual_dividend_eur != null
            ? portfolio.manual_dividend_eur
            : Number(snap.dividend_annual_eur) || 0;
          return {
            ...portfolio,
            current_price_eur: Number(snap.current_price_eur),
            current_value_eur: Number(snap.current_value_eur),
            gain_loss_eur:
              Number(snap.current_value_eur) -
              Number(portfolio.original_investment_eur),
            gain_loss_percent:
              ((Number(snap.current_value_eur) -
                Number(portfolio.original_investment_eur)) /
                Number(portfolio.original_investment_eur)) *
              100,
            dividend_annual_eur: dividend,
          };
        }

        return {
          ...portfolio,
          current_price_eur: Number(portfolio.original_price_eur),
          current_value_eur: Number(portfolio.original_investment_eur),
          gain_loss_eur: 0,
          gain_loss_percent: 0,
          dividend_annual_eur: portfolio.manual_dividend_eur ?? 0,
        };
      })
    );

    // Aggregate by symbol
    const grouped = new Map();
    enrichedPortfolios.forEach((p) => {
      // Mirror dashboard logic: manual_dividend_eur is per-share, multiply by quantity
      const lotDividend = p.manual_dividend_eur != null
        ? p.manual_dividend_eur * Number(p.quantity)
        : p.dividend_annual_eur ?? 0;

      const existing = grouped.get(p.symbol);
      if (existing) {
        existing.totalQuantity += Number(p.quantity);
        existing.totalOriginalInvestment += Number(p.original_investment_eur);
        existing.lots.push(p);
        if (p.current_value_eur) {
          existing.current_value_eur =
            (existing.current_value_eur || 0) + p.current_value_eur;
        }
        existing.dividend_annual_eur =
          (existing.dividend_annual_eur || 0) + lotDividend;
      } else {
        grouped.set(p.symbol, {
          symbol: p.symbol,
          name: p.name,
          country: p.country,
          totalQuantity: Number(p.quantity),
          totalOriginalInvestment: Number(p.original_investment_eur),
          avgOriginalPrice: 0,
          current_price_eur: p.current_price_eur,
          current_value_eur: p.current_value_eur,
          dividend_annual_eur: lotDividend,
          lots: [p],
        });
      }
    });

    const positions = Array.from(grouped.values()).map((pos) => {
      pos.avgOriginalPrice = pos.totalOriginalInvestment / pos.totalQuantity;
      if (pos.current_value_eur) {
        pos.gain_loss_eur = pos.current_value_eur - pos.totalOriginalInvestment;
        pos.gain_loss_percent =
          (pos.gain_loss_eur / pos.totalOriginalInvestment) * 100;
      }
      // Remove lots to avoid exposing individual position details
      delete pos.lots;
      return pos;
    });

    // Calculate totals
    const totalValue = positions.reduce(
      (sum, p) => sum + (p.current_value_eur || 0),
      0
    );
    const totalOriginal = positions.reduce(
      (sum, p) => sum + p.totalOriginalInvestment,
      0
    );
    const totalGainLoss = totalValue - totalOriginal;
    const totalGainLossPercent =
      totalOriginal > 0 ? (totalGainLoss / totalOriginal) * 100 : 0;
    const totalDividend = positions.reduce(
      (sum, p) => sum + (p.dividend_annual_eur || 0),
      0
    );

    const result = {
      name: share.name,
      tags: share.tags,
      expires_at: share.expires_at,
      show_values: share.show_values,
      positions,
      totalValue,
      totalGainLoss,
      totalGainLossPercent,
      totalDividend,
    };

    console.log(`Returning ${positions.length} aggregated positions`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-shared-view:", error);
    return new Response(
      JSON.stringify({ error: "Unable to load shared portfolio. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
