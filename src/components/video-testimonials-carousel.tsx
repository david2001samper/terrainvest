"use client";

import type { VideoTestimonial } from "@/lib/testimonials";
import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface VideoTestimonialsCarouselProps {
  testimonials: VideoTestimonial[];
}

export function VideoTestimonialsCarousel({ testimonials }: VideoTestimonialsCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (testimonials.length === 0) return null;

  const scrollTo = (index: number) => {
    const i = Math.max(0, Math.min(index, testimonials.length - 1));
    setActiveIndex(i);
    const el = scrollRef.current;
    if (el) {
      const slide = el.querySelector(`[data-index="${i}"]`);
      slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  return (
    <section className="relative z-10 px-6 lg:px-12 py-20 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-center">Client Video Testimonials</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: "thin" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            const scrollLeft = el.scrollLeft;
            const itemWidth = el.offsetWidth;
            const index = Math.round(scrollLeft / itemWidth);
            setActiveIndex(Math.max(0, Math.min(index, testimonials.length - 1)));
          }}
        >
          {testimonials.map((t, i) => (
            <div
              key={t.id}
              data-index={i}
              className="flex-shrink-0 w-[min(400px,90vw)] snap-center"
            >
              <div className="glass-card-hover rounded-2xl overflow-hidden relative aspect-video">
                <video
                  src={t.video_url}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                  <div className="flex items-center gap-3">
                    {t.avatar_url ? (
                      <img
                        src={t.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-white/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#00D4FF]/30 flex items-center justify-center text-[#00D4FF] font-bold">
                        {t.client_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-white text-sm">{t.client_name}</p>
                      <p className="text-white/80 text-xs line-clamp-2">&ldquo;{t.quote}&rdquo;</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {testimonials.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollTo(activeIndex - 1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full glass-card flex items-center justify-center text-foreground hover:border-[#00D4FF]/30 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo(activeIndex + 1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full glass-card flex items-center justify-center text-foreground hover:border-[#00D4FF]/30 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
