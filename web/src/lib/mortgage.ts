/** Mortgage math. Estimates only — never a lending quote. Pure functions, unit-testable. */

export interface MortgageInput {
  purchasePrice: number
  downPayment: number
  interestRate: number // annual %, e.g. 6.75
  loanTermYears: number
  taxesAnnual: number
  insuranceAnnual: number
  hoaMonthly: number
  /** Annual PMI as % of loan. Applied only when down payment < 20%. */
  pmiRate: number
}

export interface MortgageResult {
  loanAmount: number
  principalInterest: number
  taxes: number
  insurance: number
  hoa: number
  pmi: number
  total: number
  downPaymentPct: number
}

export const DEFAULT_ASSUMPTIONS = {
  interestRate: 6.75,
  loanTermYears: 30,
  downPaymentPct: 20,
  /** Massachusetts-ish homeowners insurance as % of price per year; editable everywhere it's used. */
  insuranceRatePct: 0.35,
  pmiRate: 0.5,
}

export function principalAndInterest(loan: number, annualRatePct: number, years: number) {
  if (loan <= 0 || years <= 0) return 0
  const n = years * 12
  const r = annualRatePct / 100 / 12
  if (r === 0) return loan / n
  return (loan * r) / (1 - Math.pow(1 + r, -n))
}

export function calculateMortgage(i: MortgageInput): MortgageResult {
  const loanAmount = Math.max(0, i.purchasePrice - i.downPayment)
  const downPaymentPct = i.purchasePrice > 0 ? (i.downPayment / i.purchasePrice) * 100 : 0
  const principalInterest = principalAndInterest(loanAmount, i.interestRate, i.loanTermYears)
  const taxes = i.taxesAnnual / 12
  const insurance = i.insuranceAnnual / 12
  const hoa = i.hoaMonthly
  const pmi = downPaymentPct < 20 && loanAmount > 0 ? (loanAmount * (i.pmiRate / 100)) / 12 : 0
  return {
    loanAmount,
    principalInterest,
    taxes,
    insurance,
    hoa,
    pmi,
    total: principalInterest + taxes + insurance + hoa + pmi,
    downPaymentPct,
  }
}

/** Quick monthly estimate for a property + buyer using default assumptions. */
export function estimateMonthly(
  property: { listing_price: number | null; property_tax: number | null; hoa_fee: number | null },
  buyer?: { down_payment_amount: number | null } | null,
  overrides?: Partial<typeof DEFAULT_ASSUMPTIONS>,
) {
  const a = { ...DEFAULT_ASSUMPTIONS, ...overrides }
  const price = property.listing_price ?? 0
  if (!price) return null
  const down = buyer?.down_payment_amount ?? (price * a.downPaymentPct) / 100
  return calculateMortgage({
    purchasePrice: price,
    downPayment: Math.min(down, price),
    interestRate: a.interestRate,
    loanTermYears: a.loanTermYears,
    taxesAnnual: property.property_tax ?? 0,
    insuranceAnnual: (price * a.insuranceRatePct) / 100,
    hoaMonthly: property.hoa_fee ?? 0,
    pmiRate: a.pmiRate,
  })
}
