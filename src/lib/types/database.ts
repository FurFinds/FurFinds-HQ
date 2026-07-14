export type HqRole =
  | "admin"
  | "verification_manager"
  | "support"
  | "content_editor"
  | "developer";

export type SiteRole = "pet_owner" | "business" | "admin";
export type BusinessCategory =
  | "restaurants"
  | "hotels"
  | "parks"
  | "retail"
  | "groomers"
  | "vets"
  | "events"
  | "transportation"
  | "other";
export type BusinessTier = "pets_allowed" | "pet_friendly" | "pet_inclusive";
export type VerificationStatus = "pending" | "in_progress" | "approved" | "rejected" | "expired";
export type HumanDecision = "approved" | "rejected" | "overridden";
export type LeadAction = "visit_website" | "get_directions" | "call_now";
export type ReportIssueType =
  | "policy_violation"
  | "false_information"
  | "unwelcoming_staff"
  | "safety_concern"
  | "other";
export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";
export type SubscriptionModel = "subscription" | "commission";
export type SubscriptionStatus = "active" | "paused" | "canceled" | "expired";
export type EmailStatus = "queued" | "sent" | "failed";
export type ContentChannel = "instagram" | "facebook" | "tiktok" | "email" | "blog";
export type ContentStatus = "draft" | "scheduled" | "published";
export type BlogCategory =
  | "Pet-Friendly Travel"
  | "Business Spotlights"
  | "Pet Care Tips"
  | "Industry News";
export type BlogStatus = "draft" | "published";
export type ComplianceType = "contract" | "insurance" | "compliance_check";
export type ComplianceStatus = "valid" | "expiring" | "expired" | "pending";
export type AlertSeverity = "info" | "warning" | "critical";
export type CalendarEventType = "social_post" | "meeting" | "deadline" | "other";

// ---------------------------------------------------------------------------
// Tables that already existed in the live Supabase project before this app
// touched it — column names/shapes here must match the real schema exactly.
// ---------------------------------------------------------------------------

/** HQ staff account (internal dashboard access). */
export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  full_name: string | null;
  role: HqRole;
  department: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Public-site consumer account (pet owner or business). */
export type SiteUser = {
  id: string;
  email: string;
  name: string;
  role: SiteRole;
  avatar_url: string | null;
  pets: { name: string; species: string; breed?: string }[];
  notification_prefs: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type Business = {
  id: string;
  slug: string | null;
  owner_id: string | null;
  name: string;
  category: BusinessCategory | null;
  tier: BusinessTier;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  business_hours: string | null;
  pet_policy: string | null;
  service_animals_allowed: boolean | null;
  esa_policy: string | null;
  photos: string[] | null;
  verification_status: VerificationStatus;
  verification_score: number | null;
  verification_date: string | null;
  verification_expiration: string | null;
  is_active: boolean;
  application_data: Record<string, unknown>;
  contract_accepted: boolean;
  contract_accepted_at: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
  owner?: Pick<SiteUser, "id" | "name" | "email"> | null;
};

/** AI-analysis + human-decision audit trail for a business's verification. */
export type Verification = {
  id: string;
  business_id: string | null;
  ai_score: number | null;
  ai_confidence: number | null;
  ai_tier_suggestion: BusinessTier | null;
  ai_policy_extraction: string | null;
  ai_sentiment_analysis: string | null;
  human_decision: HumanDecision | null;
  final_tier: BusinessTier | null;
  notes: string | null;
  reviewed_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  business_id: string | null;
  user_id: string | null;
  rating: number;
  comment: string | null;
  photos: string[] | null;
  is_verified_purchase: boolean;
  created_at: string;
  updated_at: string;
  user?: Pick<SiteUser, "id" | "name" | "email"> | null;
  business?: Pick<Business, "id" | "name" | "slug"> | null;
};

export type Lead = {
  id: string;
  business_id: string | null;
  user_id: string | null;
  action: LeadAction;
  ip_address: string | null;
  user_agent: string | null;
  tracked_at: string;
  billed: boolean;
  billed_at: string | null;
};

export type Report = {
  id: string;
  business_id: string | null;
  user_email: string | null;
  issue_type: ReportIssueType | null;
  description: string | null;
  photos: string[] | null;
  status: ReportStatus;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
  business?: Pick<Business, "id" | "name"> | null;
};

export type Subscription = {
  id: string;
  business_id: string | null;
  tier: BusinessTier;
  model: SubscriptionModel;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Genuinely new tables (no live equivalent) — created by
// supabase/live_schema_migration.sql.
// ---------------------------------------------------------------------------

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  category: BlogCategory;
  author: string;
  status: BlogStatus;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
};

export type ContentPost = {
  id: string;
  title: string;
  channel: ContentChannel;
  status: ContentStatus;
  scheduled_at: string | null;
  body: string | null;
  created_by: string | null;
  created_at: string;
};

export type EmailLog = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  template: string | null;
  status: EmailStatus;
  error: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
};

export type ComplianceRecord = {
  id: string;
  business_id: string | null;
  type: ComplianceType;
  title: string;
  status: ComplianceStatus;
  expires_at: string | null;
  document_url: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount_cents: number;
  expense_date: string;
  created_by: string | null;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  description: string | null;
  type: CalendarEventType;
  created_by: string | null;
  created_at: string;
};

export type Meeting = {
  id: string;
  title: string;
  starts_at: string;
  department: string | null;
  created_at: string;
};

export type DepartmentAlert = {
  id: string;
  department: string;
  message: string;
  severity: AlertSeverity;
  resolved: boolean;
  created_at: string;
};

export type SiteSetting = {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
};

export type RevenueSnapshot = {
  id: string;
  month: string;
  revenue_cents: number;
  mrr_cents: number;
  new_customers: number;
  churned_customers: number;
  created_at: string;
};

export type DiscountCode = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      users: Table<SiteUser>;
      businesses: Table<Business>;
      verification: Table<Verification>;
      reviews: Table<Review>;
      leads: Table<Lead>;
      reports: Table<Report>;
      subscriptions: Table<Subscription>;
      blog_posts: Table<BlogPost>;
      content_posts: Table<ContentPost>;
      email_log: Table<EmailLog>;
      compliance_records: Table<ComplianceRecord>;
      expenses: Table<Expense>;
      calendar_events: Table<CalendarEvent>;
      meetings: Table<Meeting>;
      department_alerts: Table<DepartmentAlert>;
      site_settings: Table<SiteSetting>;
      revenue_snapshots: Table<RevenueSnapshot>;
      discount_codes: Table<DiscountCode>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
