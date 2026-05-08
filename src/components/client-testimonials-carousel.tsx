"use client";

import Image from "next/image";
import type { ClientTestimonial } from "@/lib/testimonials";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";

interface ClientTestimonialsCarouselProps {
  testimonials: ClientTestimonial[];
}

export function ClientTestimonialsCarousel({ testimonials }: ClientTestimonialsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (testimonials.length === 0) return null;

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

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
            className="glass-card-hover flex-shrink-0 w-[min(360px,85vw)] snap-center rounded-2xl p-6 flex flex-col"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, Math.max(1, t.rating ?? 5)) }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#00D4FF] text-[#00D4FF]" />
                ))}
              </div>
              {t.result_badge ? (
                <span className="rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-3 py-1 text-[11px] font-semibold text-[#00D4FF]">
                  {t.result_badge}
                </span>
              ) : null}
            </div>
            <Quote className="w-7 h-7 text-[#00D4FF]/40 mb-3" />
            <p className="text-muted-foreground leading-relaxed mb-5 flex-1">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="flex items-center gap-3">
              {t.headshot_url ? (
                <Image
                  src={t.headshot_url}
                  alt={t.attribution}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00D4FF]/15 text-xs font-bold text-[#00D4FF]">
                  {getInitials(t.attribution)}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{t.attribution}</p>
                <p className="text-xs text-muted-foreground">{t.client_label || "Private Investor"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
