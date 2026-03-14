import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export interface ClientTestimonial {
  id: string;
  headshot_url: string;
  quote: string;
  attribution: string;
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

async function fetchClientTestimonialsUncached(): Promise<ClientTestimonial[]> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("client_testimonials")
      .select("*")
      .eq("visible", true)
      .order("sort_order", { ascending: true });
    if (error) return [];
    return (data ?? []) as ClientTestimonial[];
  } catch {
    return [];
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
