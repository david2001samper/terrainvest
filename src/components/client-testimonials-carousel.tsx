"use client";

import type { ClientTestimonial } from "@/lib/testimonials";
import { Quote } from "lucide-react";

interface ClientTestimonialsCarouselProps {
  testimonials: ClientTestimonial[];
}

export function ClientTestimonialsCarousel({ testimonials }: ClientTestimonialsCarouselProps) {
  if (testimonials.length === 0) return null;

  return (
    <section className="relative z-10 px-6 lg:px-12 py-20 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-center">What Our Clients Say</h2>
      <div
        className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="glass-card-hover flex-shrink-0 w-[min(340px,85vw)] snap-center rounded-2xl p-6 flex flex-col items-center text-center"
          >
            <img
              src={t.headshot_url}
              alt=""
              className="w-20 h-20 rounded-full object-cover border-2 border-[#00D4FF]/20 mb-4"
            />
            <Quote className="w-8 h-8 text-[#00D4FF]/40 mb-3" />
            <p className="text-muted-foreground leading-relaxed mb-4 flex-1">
              &ldquo;{t.quote}&rdquo;
            </p>
            <p className="text-sm font-medium text-foreground">
              {t.attribution}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
