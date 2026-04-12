export interface MarketData {
  id: number;
  bond_id: number;
  trade_date: string;
  clean_price: string;
  tlref_index: string | null;
  fark: string | null;
  volume: string | null;
  created_at: string;
}
