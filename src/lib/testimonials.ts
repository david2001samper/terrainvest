import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export interface ClientTestimonial {
  id: string;
  headshot_url: string;
  quote: string;
  attribution: string;
  client_label?: string | null;
  result_badge?: string | null;
  rating?: number | null;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoTestimonial {
  id: string;
  video_url: string;
  avatar_url: string | null;
  client_name: string;
  quote: string;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_CLIENT_TESTIMONIALS: ClientTestimonial[] = [
  {
    id: "default-elena-v",
    headshot_url: "",
    quote: "The onboarding felt personal from day one. My account manager helped me compare opportunities and move with more confidence.",
    attribution: "Elena V.",
    client_label: "Private Investor",
    result_badge: "+38% ROI",
    rating: 5,
    sort_order: 0,
    visible: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "default-marcus-l",
    headshot_url: "",
    quote: "Clear reporting, quick answers, and a private investment flow I can review between meetings without feeling rushed.",
    attribution: "Marcus L.",
    client_label: "Apartment Investor",
    result_badge: "Passive Monthly Income",
    rating: 5,
    sort_order: 1,
    visible: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "default-ari-n",
    headshot_url: "",
    quote: "The team explained the risk profile clearly and kept me updated through each step. It felt structured and transparent.",
    attribution: "Ari N.",
    client_label: "Early Investor",
    result_badge: "Project Fully Funded",
    rating: 5,
    sort_order: 2,
    visible: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "default-sophia-r",
    headshot_url: "",
    quote: "I wanted something more hands-off. The process was simple, the updates were consistent, and the experience felt premium.",
    attribution: "Sophia R.",
    client_label: "Private Investor",
    result_badge: "Priority Access",
    rating: 5,
    sort_order: 3,
    visible: true,
    created_at: "",
    updated_at: "",
  },
];

async function fetchClientTestimonialsUncached(): Promise<ClientTestimonial[]> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("client_testimonials")
      .select("*")
      .eq("visible", true)
      .order("sort_order", { ascending: true });
    if (error) return DEFAULT_CLIENT_TESTIMONIALS;
    return data?.length ? (data as ClientTestimonial[]) : DEFAULT_CLIENT_TESTIMONIALS;
  } catch {
    return DEFAULT_CLIENT_TESTIMONIALS;
  }
}

async function fetchVideoTestimonialsUncached(): Promise<VideoTestimonial[]> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("video_testimonials")
      .select("*")
      .eq("visible", true)
      .order("sort_order", { ascending: true });
    if (error) return [];
    return (data ?? []) as VideoTestimonial[];
  } catch {
    return [];
  }
}

export async function getClientTestimonials(): Promise<ClientTestimonial[]> {
  return unstable_cache(
    () => fetchClientTestimonialsUncached(),
    ["client-testimonials"],
    { revalidate: 60, tags: ["testimonials"] }
  )();
}

export async function getVideoTestimonials(): Promise<VideoTestimonial[]> {
  return unstable_cache(
    () => fetchVideoTestimonialsUncached(),
    ["video-testimonials"],
    { revalidate: 60, tags: ["testimonials"] }
  )();
}
