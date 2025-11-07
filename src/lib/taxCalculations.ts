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
  },
  AT: {
    AT: 0.00, // No withholding in home country
    DE: 0.00, // EU directive
    US: 0.25, // Austria withholding on foreign investors
    UK: 0.00, // EU-UK agreement
    CH: 0.00, // Bilateral treaty
    RS: 0.15, // Standard
  },
  DE: {
    AT: 0.00, // EU directive
    DE: 0.00, // No withholding in home country
    US: 0.2637, // Germany withholding
    UK: 0.00, // EU-UK agreement
    CH: 0.00, // Bilateral treaty
    RS: 0.15, // Standard
  },
  UK: {
    AT: 0.00,
    DE: 0.00,
    US: 0.00,
    UK: 0.00, // No withholding in home country
    CH: 0.00,
    RS: 0.15,
  },
  CH: {
    AT: 0.35,
    DE: 0.35,
    US: 0.35,
    UK: 0.35,
    CH: 0.35, // Switzerland has high withholding, partially refundable
    RS: 0.35,
  },
  RS: {
    AT: 0.15,
    DE: 0.15,
    US: 0.15,
    UK: 0.15,
    CH: 0.15,
    RS: 0.00, // No withholding in home country
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
  
  // Step 2: Apply residence country tax
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
  
  // Step 3: Apply foreign tax credit (if allowed)
  let foreignTaxCredit = 0;
  let residenceTax = residenceTaxOnGross;
  
  if (investorTaxRates.allowsForeignTaxCredit) {
    // Credit is the lesser of: withholding tax paid OR residence tax due
    foreignTaxCredit = Math.min(withholdingTax, residenceTaxOnGross);
    residenceTax = residenceTaxOnGross - foreignTaxCredit;
  }
  
  const netDividend = grossDividend - withholdingTax - residenceTax;
  const totalTaxRate = (withholdingTax + residenceTax) / grossDividend;
  
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
