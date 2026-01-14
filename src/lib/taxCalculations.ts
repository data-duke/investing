/**
 * Comprehensive tax calculation utilities for cross-border investments
 * Handles withholding tax, double taxation treaties, and residence tax
 */

// Tax treaty matrix: [stock country][investor country] = withholding rate
// Default US withholding is 30%, but treaties reduce this
const withholdingTaxMatrix: Record<string, Record<string, number>> = {
  US: {
    AT: 0.15, // US-Austria treaty
    DE: 0.15, // US-Germany treaty
    US: 0.00, // No withholding for US residents on US stocks
    UK: 0.15, // US-UK treaty
    CH: 0.15, // US-Switzerland treaty
    RS: 0.15, // US-Serbia treaty (assumed standard)
    CA: 0.15, // US-Canada treaty
  },
  AT: {
    AT: 0.00, // No withholding in home country
    DE: 0.00, // EU directive
    US: 0.25, // Austria withholding on foreign investors
    UK: 0.00, // EU-UK agreement
    CH: 0.00, // Bilateral treaty
    RS: 0.15, // Standard
    CA: 0.25, // Austria-Canada treaty
  },
  DE: {
    AT: 0.00, // EU directive
    DE: 0.00, // No withholding in home country
    US: 0.2637, // Germany withholding
    UK: 0.00, // EU-UK agreement
    CH: 0.00, // Bilateral treaty
    RS: 0.15, // Standard
    CA: 0.2637, // Germany-Canada treaty
  },
  UK: {
    AT: 0.00,
    DE: 0.00,
    US: 0.00,
    UK: 0.00, // No withholding in home country
    CH: 0.00,
    RS: 0.15,
    CA: 0.00, // UK-Canada treaty
  },
  CH: {
    AT: 0.35,
    DE: 0.35,
    US: 0.35,
    UK: 0.35,
    CH: 0.35, // Switzerland has high withholding, partially refundable
    RS: 0.35,
    CA: 0.35, // Switzerland-Canada
  },
  RS: {
    AT: 0.15,
    DE: 0.15,
    US: 0.15,
    UK: 0.15,
    CH: 0.15,
    RS: 0.00, // No withholding in home country
    CA: 0.15, // RS-Canada
  },
  CA: {
    AT: 0.25, // Canada-Austria: 25% withheld, 15% creditable
    DE: 0.25, // Canada-Germany treaty
    US: 0.15, // Canada-US treaty
    UK: 0.15, // Canada-UK treaty
    CH: 0.25, // Canada-Switzerland
    RS: 0.25, // Canada-Serbia (standard)
    CA: 0.00, // No withholding in home country
  },
};

// Residence country tax rates (on worldwide income)
interface CountryTaxRates {
  name: string;
  dividendTax: number; // Total tax rate on dividends
  capitalGainsTax: number; // Tax on capital gains
  allowsForeignTaxCredit: boolean; // Whether foreign taxes can be credited
}

export const countries: Record<string, CountryTaxRates> = {
  AT: { name: "Austria", dividendTax: 0.275, capitalGainsTax: 0.275, allowsForeignTaxCredit: true },
  DE: { name: "Germany", dividendTax: 0.26375, capitalGainsTax: 0.26375, allowsForeignTaxCredit: true },
  US: { name: "United States", dividendTax: 0.15, capitalGainsTax: 0.20, allowsForeignTaxCredit: true },
  UK: { name: "United Kingdom", dividendTax: 0.125, capitalGainsTax: 0.20, allowsForeignTaxCredit: true },
  CH: { name: "Switzerland", dividendTax: 0.35, capitalGainsTax: 0, allowsForeignTaxCredit: true },
  RS: { name: "Serbia", dividendTax: 0.15, capitalGainsTax: 0.15, allowsForeignTaxCredit: true },
  CA: { name: "Canada", dividendTax: 0.39, capitalGainsTax: 0.25, allowsForeignTaxCredit: true },
};

// Creditable withholding rates (may differ from total withholding)
// For example: Canada withholds 25% but only 15% is creditable against Austrian tax
export const creditableWithholdingRates: Record<string, Record<string, number>> = {
  CA: {
    AT: 0.15, // Only 15% of 25% is creditable, 10% is reclaimable
    DE: 0.15,
    US: 0.15,
    UK: 0.15,
    CH: 0.15,
    RS: 0.15,
  },
};

export interface DividendTaxBreakdown {
  grossDividend: number;
  withholdingTax: number;
  withholdingRate: number;
  afterWithholding: number;
  residenceTax: number;
  residenceTaxRate: number;
  foreignTaxCredit: number;
  netDividend: number;
  totalTaxRate: number;
}

/**
 * Calculate comprehensive dividend taxation including withholding and residence tax
 * 
 * For flat tax countries (AT, DE): Total tax = residence rate (e.g., 27.5% for Austria)
 * Foreign withholding is credited against residence tax, not added on top.
 * 
 * Example for Austrian investor with Canadian stock (CNQ):
 * - Gross: €7.30
 * - Canada withholds: 25% = €1.825 (only 15% = €1.095 is creditable)
 * - Austrian KESt due: 27.5% = €2.01
 * - Foreign tax credit: €1.095 (creditable portion)
 * - Net Austrian tax: €2.01 - €1.095 = €0.915
 * - Net dividend: €7.30 - €1.825 - €0.915 = €4.56
 * - Total tax rate: 27.5% (Austrian flat rate) + 10% non-creditable = 37.5%
 */
export const calculateDividendTax = (
  grossDividendPerShare: number,
  quantity: number,
  stockCountry: string,
  investorCountry: string
): DividendTaxBreakdown => {
  const grossDividend = grossDividendPerShare * quantity;
  
  // Step 1: Apply withholding tax at source country
  const withholdingRate = withholdingTaxMatrix[stockCountry]?.[investorCountry] ?? 0.15; // Default 15%
  const withholdingTax = grossDividend * withholdingRate;
  const afterWithholding = grossDividend - withholdingTax;
  
  // Step 2: Get residence country tax rates
  const investorTaxRates = countries[investorCountry];
  if (!investorTaxRates) {
    // Fallback if country not found
    return {
      grossDividend,
      withholdingTax,
      withholdingRate,
      afterWithholding,
      residenceTax: 0,
      residenceTaxRate: 0,
      foreignTaxCredit: 0,
      netDividend: afterWithholding,
      totalTaxRate: withholdingRate,
    };
  }
  
  // Calculate residence tax on gross dividend
  const residenceTaxOnGross = grossDividend * investorTaxRates.dividendTax;
  
  // Step 3: Determine creditable withholding (may be less than actual withholding)
  // Some countries withhold more than is creditable (e.g., Canada 25% withheld, only 15% creditable)
  const creditableRate = creditableWithholdingRates[stockCountry]?.[investorCountry] ?? withholdingRate;
  const creditableWithholding = grossDividend * Math.min(creditableRate, withholdingRate);
  
  // Step 4: Apply foreign tax credit (if allowed)
  let foreignTaxCredit = 0;
  let residenceTax = residenceTaxOnGross;
  let netDividend: number;
  
  if (investorTaxRates.allowsForeignTaxCredit && stockCountry !== investorCountry) {
    // For flat tax countries (AT, DE): total tax burden = residence tax rate
    // Withholding is credited, any non-creditable portion is additional cost
    if (investorCountry === 'AT' || investorCountry === 'DE') {
      // Credit is limited to the creditable portion of withholding OR residence tax, whichever is lower
      foreignTaxCredit = Math.min(creditableWithholding, residenceTaxOnGross);
      
      // Remaining residence tax after credit
      residenceTax = Math.max(0, residenceTaxOnGross - foreignTaxCredit);
      
      // Net = Gross - Withholding (actual) - Remaining residence tax
      netDividend = grossDividend - withholdingTax - residenceTax;
    } else {
      // Other countries: standard foreign tax credit logic
      foreignTaxCredit = Math.min(withholdingTax, residenceTaxOnGross);
      residenceTax = residenceTaxOnGross - foreignTaxCredit;
      netDividend = grossDividend - withholdingTax - residenceTax;
    }
  } else {
    // No foreign tax credit (same country or not allowed)
    netDividend = afterWithholding - residenceTax;
  }
  
  const totalTaxRate = grossDividend > 0 ? (grossDividend - netDividend) / grossDividend : 0;
  
  return {
    grossDividend,
    withholdingTax,
    withholdingRate,
    afterWithholding,
    residenceTax,
    residenceTaxRate: investorTaxRates.dividendTax,
    foreignTaxCredit,
    netDividend,
    totalTaxRate,
  };
};

/**
 * Calculate capital gains tax
 */
export const calculateCapitalGainsTax = (
  gainAmount: number,
  investorCountry: string
): { grossGain: number; tax: number; netGain: number; taxRate: number } => {
  const investorTaxRates = countries[investorCountry];
  
  if (!investorTaxRates || gainAmount <= 0) {
    return {
      grossGain: gainAmount,
      tax: 0,
      netGain: gainAmount,
      taxRate: 0,
    };
  }
  
  const tax = gainAmount * investorTaxRates.capitalGainsTax;
  const netGain = gainAmount - tax;
  
  return {
    grossGain: gainAmount,
    tax,
    netGain,
    taxRate: investorTaxRates.capitalGainsTax,
  };
};

/**
 * Get withholding tax rate for a specific stock-investor country pair
 */
export const getWithholdingRate = (stockCountry: string, investorCountry: string): number => {
  return withholdingTaxMatrix[stockCountry]?.[investorCountry] ?? 0.15;
};
