// Nigerian Tax Rules (Finance Act 2020 & PITA)

export const VAT_RATE = 0.075 // 7.5%

// PAYE tax bands (annual income in NGN)
export const PAYE_BANDS = [
  { limit: 300000, rate: 0.07 },
  { limit: 300000, rate: 0.11 },
  { limit: 500000, rate: 0.15 },
  { limit: 500000, rate: 0.19 },
  { limit: 1600000, rate: 0.21 },
  { limit: Infinity, rate: 0.24 },
]

// WHT rates
export const WHT_RATES = {
  individual: 0.05,    // 5% for individuals
  company: 0.10,       // 10% for companies
}

// Consolidated relief allowance
export const CRA_RATE = 0.20  // 20% of gross income
export const CRA_FIXED = 200000 // NGN 200,000 fixed

export function computePAYE(annualGross) {
  const cra = Math.max(CRA_FIXED + CRA_RATE * annualGross, CRA_FIXED)
  const taxable = Math.max(annualGross - cra, 0)

  let tax = 0
  let remaining = taxable

  for (const band of PAYE_BANDS) {
    if (remaining <= 0) break
    const taxable_in_band = Math.min(remaining, band.limit)
    tax += taxable_in_band * band.rate
    remaining -= taxable_in_band
  }

  return {
    annualGross,
    cra,
    taxableIncome: taxable,
    annualPAYE: tax,
    monthlyPAYE: tax / 12,
  }
}

export function computeWHT(amount, entityType = 'individual') {
  const rate = WHT_RATES[entityType] ?? WHT_RATES.individual
  return {
    grossAmount: amount,
    whtRate: rate,
    whtAmount: amount * rate,
    netPayable: amount * (1 - rate),
  }
}

export function computeVAT(amount) {
  return {
    netAmount: amount,
    vatAmount: amount * VAT_RATE,
    grossAmount: amount * (1 + VAT_RATE),
  }
}
