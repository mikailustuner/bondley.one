export interface User {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  location: string | null;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
