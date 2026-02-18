export interface Bond {
  id: number;
  isin_code: string;
  bond_type: "TRT" | "TRB";
  issue_date: string;
  maturity_date: string;
  coupon_rate: string;
  coupon_frequency: number;
  face_value: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BondCreate {
  isin_code: string;
  bond_type: string;
  issue_date: string;
  maturity_date: string;
  coupon_rate: string;
  coupon_frequency?: number;
  face_value?: string;
  currency?: string;
}

export interface BondListResponse {
  items: Bond[];
  total: number;
}
