"use client";

import type { ClientTestimonial } from "@/lib/testimonials";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

interface ClientTestimonialsCarouselProps {
  testimonials: ClientTestimonial[];
}

export function ClientTestimonialsCarousel({ testimonials }: ClientTestimonialsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (testimonials.length === 0) return null;

  function scrollByCard(direction: -1 | 1) {
    scrollRef.current?.scrollBy({
      left: direction * 360,
      behavior: "smooth",
    });
  }

  return (
    <section className="relative z-10 px-6 lg:px-12 py-20 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">What Our Clients Say</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            className="glass-card h-10 w-10 rounded-full flex items-center justify-center hover:border-[#00D4FF]/30 transition-colors"
            aria-label="Previous testimonials"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            className="glass-card h-10 w-10 rounded-full flex items-center justify-center hover:border-[#00D4FF]/30 transition-colors"
            aria-label="Next testimonials"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="glass-card-hover flex-shrink-0 w-[min(340px,85vw)] snap-center rounded-2xl p-6 flex flex-col items-center text-center"
          >
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
