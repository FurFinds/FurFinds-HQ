export type HqRole =
  | "admin"
  | "verification_manager"
  | "support"
  | "content_editor"
  | "developer";

export type BusinessTier = "basic" | "verified" | "premium";
export type BusinessStatus = "pending" | "active" | "suspended" | "rejected";
export type VerificationStatus = "pending" | "approved" | "rejected" | "needs_info";
export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketType = "customer" | "business";
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
export type SubscriptionPlan = "basic" | "pro" | "premium";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";
export type AlertSeverity = "info" | "warning" | "critical";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: HqRole;
  department: string | null;
  created_at: string;
};

export type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "suspended";
  favorites_count: number;
  created_at: string;
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

export type Business = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  description: string | null;
  tier: BusinessTier;
  status: BusinessStatus;
  city: string | null;
  state: string | null;
  owner_name: string | null;
  owner_email: string | null;
  phone: string | null;
  website: string | null;
  image_url: string | null;
  rating: number;
  review_count: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

export type VerificationApplication = {
  id: string;
  business_id: string | null;
  applicant_name: string;
  applicant_email: string | null;
  tier_requested: BusinessTier;
  category: string | null;
  status: VerificationStatus;
  documents: unknown[];
  ai_score: number | null;
  ai_summary: string | null;
  ai_flags: string[];
  application_data: Record<string, unknown>;
  contract_accepted: boolean;
  contract_accepted_at: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  businesses?: Pick<Business, "id" | "name" | "category" | "city" | "state" | "website" | "description"> | null;
};

export type Review = {
  id: string;
  business_id: string | null;
  author_name: string | null;
  rating: number;
  comment: string | null;
  status: "published" | "flagged" | "removed";
  created_at: string;
};

export type Subscription = {
  id: string;
  business_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  mrr_cents: number;
  current_period_end: string | null;
  created_at: string;
  canceled_at: string | null;
};

export type SupportTicket = {
  id: string;
  business_id: string | null;
  subject: string;
  message: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  assigned_to: string | null;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  updated_at: string;
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

export type CalendarEventType = "social_post" | "meeting" | "deadline" | "other";

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
      customers: Table<Customer>;
      revenue_snapshots: Table<RevenueSnapshot>;
      businesses: Table<Business>;
      verification_applications: Table<VerificationApplication>;
      reviews: Table<Review>;
      subscriptions: Table<Subscription>;
      support_tickets: Table<SupportTicket>;
      email_log: Table<EmailLog>;
      content_posts: Table<ContentPost>;
      blog_posts: Table<BlogPost>;
      compliance_records: Table<ComplianceRecord>;
      expenses: Table<Expense>;
      site_settings: Table<SiteSetting>;
      meetings: Table<Meeting>;
      calendar_events: Table<CalendarEvent>;
      department_alerts: Table<DepartmentAlert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
