export interface Calculation {
  id: number;
  bond_id: number;
  calc_date: string;
  dirty_price: string;
  accrued_interest: string;
  yield_to_maturity: string;
  spread: string | null;
  modified_duration: string | null;
  macaulay_duration: string | null;
  created_at: string;
}

export interface CalculationSummary {
  isin: string;
  settlement_date: string;
  clean_price: string;
  dirty_price: string;
  accrued_interest: string;
  yield_to_maturity: string;
  spread: string | null;
  macaulay_duration: string;
  modified_duration: string;
  cash_flows: { date: string; amount: string }[];
}
