import { NextResponse } from "next/server";
import { getClientTestimonials } from "@/lib/testimonials";

export async function GET() {
  const testimonials = await getClientTestimonials();
  return NextResponse.json(testimonials);
}
