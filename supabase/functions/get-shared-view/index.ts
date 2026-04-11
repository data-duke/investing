import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tax rates (mirroring src/lib/taxCalculations.ts)
const countries: Record<string, { dividendTax: number; capitalGainsTax: number }> = {
  AT: { dividendTax: 0.275, capitalGainsTax: 0.275 },
  DE: { dividendTax: 0.26375, capitalGainsTax: 0.26375 },
  US: { dividendTax: 0.15, capitalGainsTax: 0.20 },
  UK: { dividendTax: 0.125, capitalGainsTax: 0.20 },
  CH: { dividendTax: 0.35, capitalGainsTax: 0 },
  RS: { dividendTax: 0.15, capitalGainsTax: 0.15 },
  CA: { dividendTax: 0.39, capitalGainsTax: 0.25 },
};

const withholdingTaxMatrix: Record<string, Record<string, number>> = {
  US: { AT: 0.15, DE: 0.15, US: 0, UK: 0.15, CH: 0.15, RS: 0.15, CA: 0.15 },
  AT: { AT: 0, DE: 0, US: 0.25, UK: 0, CH: 0, RS: 0.15, CA: 0.25 },
  DE: { AT: 0, DE: 0, US: 0.2637, UK: 0, CH: 0, RS: 0.15, CA: 0.2637 },
  UK: { AT: 0, DE: 0, US: 0, UK: 0, CH: 0, RS: 0.15, CA: 0 },
  CH: { AT: 0.35, DE: 0.35, US: 0.35, UK: 0.35, CH: 0.35, RS: 0.35, CA: 0.35 },
  RS: { AT: 0.15, DE: 0.15, US: 0.15, UK: 0.15, CH: 0.15, RS: 0, CA: 0.15 },
  CA: { AT: 0.25, DE: 0.25, US: 0.15, UK: 0.15, CH: 0.25, RS: 0.25, CA: 0 },
};

const creditableWithholdingRates: Record<string, Record<string, number>> = {
  CA: { AT: 0.15, DE: 0.15, US: 0.15, UK: 0.15, CH: 0.15, RS: 0.15 },
};

function calculateCapitalGainsTax(gain: number, country: string) {
  const rates = countries[country];
  if (!rates || gain <= 0) return { tax: 0, netGain: gain, taxRate: 0 };
  const tax = gain * rates.capitalGainsTax;
  return { tax, netGain: gain - tax, taxRate: rates.capitalGainsTax };
}

function calculateDividendNet(grossPerShare: number, quantity: number, stockCountry: string, investorCountry: string): number {
  const gross = grossPerShare * quantity;
  if (gross <= 0) return 0;
  const whRate = withholdingTaxMatrix[stockCountry]?.[investorCountry] ?? 0.15;
  const whTax = gross * whRate;
  const investorRates = countries[investorCountry];
  if (!investorRates) return gross - whTax;
  const resTaxOnGross = gross * investorRates.dividendTax;
  const creditableRate = creditableWithholdingRates[stockCountry]?.[investorCountry] ?? whRate;
  const creditableWh = gross * Math.min(creditableRate, whRate);
  let residenceTax: number;
  if (stockCountry !== investorCountry && (investorCountry === 'AT' || investorCountry === 'DE')) {
    const credit = Math.min(creditableWh, resTaxOnGross);
    residenceTax = Math.max(0, resTaxOnGross - credit);
  } else if (stockCountry !== investorCountry) {
    residenceTax = resTaxOnGross - Math.min(whTax, resTaxOnGross);
  } else {
    return gross - whTax - resTaxOnGross;
  }
  return gross - whTax - residenceTax;
}

serve(async (req) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: share, error: shareError } = await supabase
      .from("shared_views")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: "Share not found or expired" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(share.expires_at) < new Date()) {
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

    // Fetch owner's tax residence
    const { data: profile } = await supabase
      .from("profiles")
      .select("residence_country")
      .eq("id", share.user_id)
      .single();
    const userCountry = profile?.residence_country || "AT";

    // Fetch owner's portfolios
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", share.user_id);

    if (portfolioError) throw new Error("Failed to fetch portfolio data");

    const isShareAll = share.tags.length === 0 || share.tags.includes("__ALL__");
    const filteredPortfolios = isShareAll
      ? portfolios || []
      : portfolios?.filter((p: any) => {
          const portfolioTags = [...(p.tags || [])];
          if (p.tag && !portfolioTags.includes(p.tag)) portfolioTags.push(p.tag);
          if (p.auto_tag_date && !portfolioTags.includes(p.auto_tag_date)) portfolioTags.push(p.auto_tag_date);
          return portfolioTags.some((t: string) => share.tags.includes(t));
        }) || [];

    // Date 1 year ago for YoY
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoISO = oneYearAgo.toISOString();

    // Enrich portfolios with latest + 1yr-ago snapshots
    const enrichedPortfolios = await Promise.all(
      filteredPortfolios.map(async (portfolio: any) => {
        // Latest snapshot
        const { data: snapshots } = await supabase
          .from("portfolio_snapshots")
          .select("*")
          .eq("portfolio_id", portfolio.id)
          .order("snapshot_date", { ascending: false })
          .limit(1);

        // 1yr-ago snapshot
        const { data: oldSnapshots } = await supabase
          .from("portfolio_snapshots")
          .select("*")
          .eq("portfolio_id", portfolio.id)
          .lte("snapshot_date", oneYearAgoISO)
          .order("snapshot_date", { ascending: false })
          .limit(1);

        const oldSnap = oldSnapshots?.[0] || null;

        if (snapshots && snapshots.length > 0) {
          const snap = snapshots[0];
          const dividend = portfolio.manual_dividend_eur != null
            ? portfolio.manual_dividend_eur
            : Number(snap.dividend_annual_eur) || 0;
          return {
            ...portfolio,
            current_price_eur: Number(snap.current_price_eur),
            current_value_eur: Number(snap.current_value_eur),
            gain_loss_eur: Number(snap.current_value_eur) - Number(portfolio.original_investment_eur),
            gain_loss_percent: ((Number(snap.current_value_eur) - Number(portfolio.original_investment_eur)) / Number(portfolio.original_investment_eur)) * 100,
            dividend_annual_eur: dividend,
            old_value_eur: oldSnap ? Number(oldSnap.current_value_eur) : null,
            old_dividend_eur: oldSnap ? Number(oldSnap.dividend_annual_eur) : null,
          };
        }

        return {
          ...portfolio,
          current_price_eur: Number(portfolio.original_price_eur),
          current_value_eur: Number(portfolio.original_investment_eur),
          gain_loss_eur: 0,
          gain_loss_percent: 0,
          dividend_annual_eur: portfolio.manual_dividend_eur ?? 0,
          old_value_eur: oldSnap ? Number(oldSnap.current_value_eur) : null,
          old_dividend_eur: oldSnap ? Number(oldSnap.dividend_annual_eur) : null,
        };
      })
    );

    // Aggregate by symbol
    const grouped = new Map();
    enrichedPortfolios.forEach((p: any) => {
      const lotDividend = p.manual_dividend_eur != null
        ? p.manual_dividend_eur * Number(p.quantity)
        : p.dividend_annual_eur ?? 0;

      const existing = grouped.get(p.symbol);
      if (existing) {
        existing.totalQuantity += Number(p.quantity);
        existing.totalOriginalInvestment += Number(p.original_investment_eur);
        existing.lots.push(p);
        if (p.current_value_eur) {
          existing.current_value_eur = (existing.current_value_eur || 0) + p.current_value_eur;
        }
        existing.dividend_annual_eur = (existing.dividend_annual_eur || 0) + lotDividend;
        if (p.old_value_eur != null) {
          existing.old_value_eur = (existing.old_value_eur || 0) + p.old_value_eur;
        }
        if (p.old_dividend_eur != null) {
          existing.old_dividend_eur = (existing.old_dividend_eur || 0) + (p.old_dividend_eur || 0);
        }
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
          old_value_eur: p.old_value_eur,
          old_dividend_eur: p.old_dividend_eur,
          lots: [p],
        });
      }
    });

    const positions = Array.from(grouped.values()).map((pos: any) => {
      pos.avgOriginalPrice = pos.totalOriginalInvestment / pos.totalQuantity;
      if (pos.current_value_eur) {
        pos.gain_loss_eur = pos.current_value_eur - pos.totalOriginalInvestment;
        pos.gain_loss_percent = (pos.gain_loss_eur / pos.totalOriginalInvestment) * 100;
      }
      delete pos.lots;
      return pos;
    });

    // Compute dashboard-equivalent net metrics
    const totalValue = positions.reduce((s: number, p: any) => s + (p.current_value_eur || 0), 0);
    const totalOriginal = positions.reduce((s: number, p: any) => s + p.totalOriginalInvestment, 0);
    const grossGain = totalValue - totalOriginal;
    const cgTax = calculateCapitalGainsTax(grossGain, userCountry);
    const netLiquidationValue = totalValue - (grossGain > 0 ? cgTax.tax : 0);
    const netGain = cgTax.netGain;

    // Net dividends (per-lot, same as PortfolioOverview)
    let totalDividendsNet = 0;
    enrichedPortfolios.forEach((p: any) => {
      const grossPerShare = p.manual_dividend_eur || 0;
      const grossTotal = p.dividend_annual_eur ?? 0;
      const grossToTax = grossPerShare > 0 ? grossPerShare * Number(p.quantity) : grossTotal;
      if (grossToTax > 0) {
        totalDividendsNet += calculateDividendNet(grossToTax / Number(p.quantity), Number(p.quantity), p.country, userCountry);
      }
    });

    // Top performer
    const topPerformer = positions.reduce((best: any, cur: any) => {
      return (cur.gain_loss_percent || 0) > (best?.gain_loss_percent || 0) ? cur : best;
    }, positions[0]);

    // 4% safe withdrawal & available profit (profitable positions only)
    let safeWithdrawalTotal = 0;
    let availableProfitTotal = 0;
    // Group by lot for per-position calculation
    enrichedPortfolios.forEach((p: any) => {
      const invested = Number(p.original_investment_eur);
      const marketValue = p.current_value_eur || 0;
      const grossGainPos = marketValue - invested;
      if (grossGainPos > 0) {
        const taxRes = calculateCapitalGainsTax(grossGainPos, userCountry);
        const netValuePos = marketValue - taxRes.tax;
        safeWithdrawalTotal += netValuePos * 0.04;
        availableProfitTotal += netValuePos - invested;
      }
    });

    // YoY: compute previous stats from 1yr-ago snapshots
    let previousStats: any = null;
    const hasOldData = enrichedPortfolios.some((p: any) => p.old_value_eur != null);
    if (hasOldData) {
      const prevTotalValue = enrichedPortfolios.reduce((s: number, p: any) => s + (p.old_value_eur || p.current_value_eur || 0), 0);
      const prevGrossGain = prevTotalValue - totalOriginal;
      const prevCgTax = calculateCapitalGainsTax(prevGrossGain, userCountry);
      const prevNetLiquidation = prevTotalValue - (prevGrossGain > 0 ? prevCgTax.tax : 0);
      const prevNetGain = prevCgTax.netGain;

      let prevDividendsNet = 0;
      enrichedPortfolios.forEach((p: any) => {
        if (p.old_dividend_eur != null && p.old_dividend_eur > 0) {
          prevDividendsNet += calculateDividendNet(p.old_dividend_eur / Number(p.quantity), Number(p.quantity), p.country, userCountry);
        }
      });

      previousStats = {
        totalValue: prevNetLiquidation,
        netGain: prevNetGain,
        totalDividends: prevDividendsNet,
      };
    }

    const result = {
      name: share.name,
      tags: share.tags,
      expires_at: share.expires_at,
      show_values: share.show_values,
      positions,
      // Raw totals (legacy)
      totalValue,
      totalGainLoss: grossGain,
      totalGainLossPercent: totalOriginal > 0 ? (grossGain / totalOriginal) * 100 : 0,
      totalDividend: totalDividendsNet,
      // Net metrics (dashboard-equivalent)
      netLiquidationValue,
      capitalGainsTax: grossGain > 0 ? cgTax.tax : 0,
      taxRate: cgTax.taxRate,
      grossGain,
      netGain,
      totalGainPercent: totalOriginal > 0 ? (netGain / totalOriginal) * 100 : 0,
      totalDividendsNet,
      monthlyDividends: totalDividendsNet / 12,
      dividendYield: totalValue > 0 ? (totalDividendsNet / totalValue) * 100 : 0,
      topPerformer: topPerformer ? { symbol: topPerformer.symbol, gain_loss_percent: topPerformer.gain_loss_percent } : null,
      safeWithdrawalTotal,
      availableProfitTotal,
      previousStats,
    };

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
