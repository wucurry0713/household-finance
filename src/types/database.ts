type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: Table<
        {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      households: Table<
        {
          id: string;
          name: string;
          base_currency: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name: string;
          base_currency?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      household_members: Table<
        {
          id: string;
          household_id: string;
          user_id: string;
          role: "owner" | "member";
          status: "invited" | "active";
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id: string;
          user_id: string;
          role?: "owner" | "member";
          status?: "invited" | "active";
          created_at?: string;
          updated_at?: string;
        }
      >;
      household_preferences: Table<
        {
          household_id: string;
          user_id: string;
          default_account_id: string | null;
          updated_at: string;
        },
        {
          household_id: string;
          user_id: string;
          default_account_id?: string | null;
          updated_at?: string;
        }
      >;
      household_invitations: Table<
        {
          id: string;
          household_id: string;
          email: string;
          invited_by: string;
          accepted_user_id: string | null;
          status: "pending" | "accepted" | "revoked";
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id: string;
          email: string;
          invited_by: string;
          accepted_user_id?: string | null;
          status?: "pending" | "accepted" | "revoked";
          created_at?: string;
          updated_at?: string;
        }
      >;
      accounts: Table<
        {
          id: string;
          household_id: string;
          owner_user_id: string | null;
          owner_id: string | null;
          name: string;
          account_type:
            | "cash"
            | "bank"
            | "credit_card"
            | "investment"
            | "loan"
            | "stock"
            | "securities"
            | "asset"
            | "real_estate"
            | "vehicle"
            | "liability"
            | "other";
          currency: string;
          opening_balance: number;
          is_shared: boolean;
          is_joint: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id: string;
          owner_user_id?: string | null;
          owner_id?: string | null;
          name: string;
          account_type:
            | "cash"
            | "bank"
            | "credit_card"
            | "investment"
            | "loan"
            | "stock"
            | "securities"
            | "asset"
            | "real_estate"
            | "vehicle"
            | "liability"
            | "other";
          currency?: string;
          opening_balance?: number;
          is_shared?: boolean;
          is_joint?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      categories: Table<
        {
          id: string;
          household_id: string | null;
          parent_category_id: string | null;
          name: string;
          kind: "expense" | "income";
          icon: string | null;
          color: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id?: string | null;
          parent_category_id?: string | null;
          name: string;
          kind: "expense" | "income";
          icon?: string | null;
          color?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      transactions: Table<
        {
          id: string;
          household_id: string;
          created_by: string;
          paid_by_user_id: string | null;
          owner_id: string | null;
          is_joint: boolean;
          kind: "income" | "expense" | "transfer" | "adjustment";
          transaction_date: string;
          currency: string;
          description: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id: string;
          created_by: string;
          paid_by_user_id?: string | null;
          owner_id?: string | null;
          is_joint?: boolean;
          kind: "income" | "expense" | "transfer" | "adjustment";
          transaction_date?: string;
          currency?: string;
          description?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      transaction_entries: Table<
        {
          id: string;
          household_id: string;
          transaction_id: string;
          account_id: string;
          amount_delta: number;
          created_at: string;
        },
        {
          id?: string;
          household_id: string;
          transaction_id: string;
          account_id: string;
          amount_delta: number;
          created_at?: string;
        }
      >;
      transaction_splits: Table<
        {
          id: string;
          household_id: string;
          transaction_id: string;
          category_id: string | null;
          member_user_id: string | null;
          amount: number;
          note: string | null;
          created_at: string;
        },
        {
          id?: string;
          household_id: string;
          transaction_id: string;
          category_id?: string | null;
          member_user_id?: string | null;
          amount: number;
          note?: string | null;
          created_at?: string;
        }
      >;
      assets: Table<
        {
          id: string;
          household_id: string;
          owner_id: string | null;
          is_joint: boolean;
          name: string;
          asset_type: "real_estate" | "vehicle" | "valuable" | "other";
          currency: string;
          purchase_price: number | null;
          purchase_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id: string;
          owner_id?: string | null;
          is_joint?: boolean;
          name: string;
          asset_type: "real_estate" | "vehicle" | "valuable" | "other";
          currency?: string;
          purchase_price?: number | null;
          purchase_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      asset_valuations: Table<
        {
          id: string;
          household_id: string;
          asset_id: string;
          valued_on: string;
          value: number;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          household_id: string;
          asset_id: string;
          valued_on?: string;
          value: number;
          notes?: string | null;
          created_at?: string;
        }
      >;
      liabilities: Table<
        {
          id: string;
          household_id: string;
          owner_id: string | null;
          is_joint: boolean;
          asset_id: string | null;
          name: string;
          liability_type: "mortgage" | "loan" | "credit_card" | "other";
          currency: string;
          current_balance: number;
          annual_interest_rate: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id: string;
          owner_id?: string | null;
          is_joint?: boolean;
          asset_id?: string | null;
          name: string;
          liability_type: "mortgage" | "loan" | "credit_card" | "other";
          currency?: string;
          current_balance?: number;
          annual_interest_rate?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      holdings: Table<
        {
          id: string;
          household_id: string;
          owner_id: string | null;
          is_joint: boolean;
          account_id: string | null;
          symbol: string;
          name: string;
          asset_type: "stock" | "etf" | "fund" | "crypto" | "other";
          currency: string;
          quantity: number;
          average_cost: number | null;
          current_price: number | null;
          price_as_of: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          household_id: string;
          owner_id?: string | null;
          is_joint?: boolean;
          account_id?: string | null;
          symbol: string;
          name: string;
          asset_type: "stock" | "etf" | "fund" | "crypto" | "other";
          currency?: string;
          quantity?: number;
          average_cost?: number | null;
          current_price?: number | null;
          price_as_of?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      investments: Table<
        {
          id: string;
          account_id: string;
          symbol: string;
          name: string;
          shares: number;
          cost_price: number;
          current_price: number;
          currency: "TWD" | "USD";
          exchange_rate: number;
          updated_at: string;
        },
        {
          id?: string;
          account_id: string;
          symbol: string;
          name: string;
          shares: number;
          cost_price: number;
          current_price: number;
          currency: "TWD" | "USD";
          exchange_rate?: number;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};