"use client";

import { useState } from "react";
import { CheckCircle, Loader2, Send, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const COUNTRY_CODES = [
  { code: "+1", label: "🇺🇸 +1 (US/CA)" },
  { code: "+44", label: "🇬🇧 +44 (UK)" },
  { code: "+49", label: "🇩🇪 +49 (DE)" },
  { code: "+33", label: "🇫🇷 +33 (FR)" },
  { code: "+39", label: "🇮🇹 +39 (IT)" },
  { code: "+34", label: "🇪🇸 +34 (ES)" },
  { code: "+31", label: "🇳🇱 +31 (NL)" },
  { code: "+41", label: "🇨🇭 +41 (CH)" },
  { code: "+43", label: "🇦🇹 +43 (AT)" },
  { code: "+61", label: "🇦🇺 +61 (AU)" },
  { code: "+64", label: "🇳🇿 +64 (NZ)" },
  { code: "+971", label: "🇦🇪 +971 (UAE)" },
  { code: "+966", label: "🇸🇦 +966 (SA)" },
  { code: "+65", label: "🇸🇬 +65 (SG)" },
  { code: "+852", label: "🇭🇰 +852 (HK)" },
  { code: "+81", label: "🇯🇵 +81 (JP)" },
  { code: "+82", label: "🇰🇷 +82 (KR)" },
  { code: "+91", label: "🇮🇳 +91 (IN)" },
  { code: "+55", label: "🇧🇷 +55 (BR)" },
  { code: "+52", label: "🇲🇽 +52 (MX)" },
  { code: "+27", label: "🇿🇦 +27 (ZA)" },
  { code: "+20", label: "🇪🇬 +20 (EG)" },
  { code: "+90", label: "🇹🇷 +90 (TR)" },
  { code: "+7", label: "🇷🇺 +7 (RU)" },
  { code: "+48", label: "🇵🇱 +48 (PL)" },
  { code: "+46", label: "🇸🇪 +46 (SE)" },
  { code: "+47", label: "🇳🇴 +47 (NO)" },
  { code: "+45", label: "🇩🇰 +45 (DK)" },
  { code: "+358", label: "🇫🇮 +358 (FI)" },
  { code: "+351", label: "🇵🇹 +351 (PT)" },
  { code: "+30", label: "🇬🇷 +30 (GR)" },
  { code: "+32", label: "🇧🇪 +32 (BE)" },
  { code: "+420", label: "🇨🇿 +420 (CZ)" },
  { code: "+36", label: "🇭🇺 +36 (HU)" },
  { code: "+40", label: "🇷🇴 +40 (RO)" },
  { code: "+380", label: "🇺🇦 +380 (UA)" },
  { code: "+972", label: "🇮🇱 +972 (IL)" },
  { code: "+60", label: "🇲🇾 +60 (MY)" },
  { code: "+66", label: "🇹🇭 +66 (TH)" },
  { code: "+62", label: "🇮🇩 +62 (ID)" },
  { code: "+63", label: "🇵🇭 +63 (PH)" },
  { code: "+84", label: "🇻🇳 +84 (VN)" },
  { code: "+886", label: "🇹🇼 +886 (TW)" },
  { code: "+86", label: "🇨🇳 +86 (CN)" },
  { code: "+54", label: "🇦🇷 +54 (AR)" },
  { code: "+56", label: "🇨🇱 +56 (CL)" },
  { code: "+57", label: "🇨🇴 +57 (CO)" },
  { code: "+58", label: "🇻🇪 +58 (VE)" },
  { code: "+51", label: "🇵🇪 +51 (PE)" },
];

const INVESTMENT_RANGES = [
  { value: "under_10k", label: "Under $10,000" },
  { value: "10k_50k", label: "$10,000 – $50,000" },
  { value: "50k_100k", label: "$50,000 – $100,000" },
  { value: "100k_250k", label: "$100,000 – $250,000" },
  { value: "250k_500k", label: "$250,000 – $500,000" },
  { value: "500k_plus", label: "$500,000+" },
];

export function LeadsForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [investmentRange, setInvestmentRange] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Please fill in your name and email");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone ? `${countryCode} ${phone}` : null,
          country_code: countryCode,
          country: country || null,
          investment_range: investmentRange || null,
          message: message || null,
          source: "landing_page",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center mb-6">
          <CheckCircle className="w-8 h-8 text-[#00D4FF]" />
        </div>
        <h3 className="text-2xl font-bold mb-3">Thank you!</h3>
        <p className="text-muted-foreground max-w-sm leading-relaxed">
          Your information has been received. A member of our team will reach out to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Full Name <span className="text-red-400">*</span>
          </Label>
          <Input
            type="text"
            placeholder="John Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="bg-background/50 border-border focus:border-[#00D4FF] h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Email Address <span className="text-red-400">*</span>
          </Label>
          <Input
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-background/50 border-border focus:border-[#00D4FF] h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Phone Number</Label>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="h-11 rounded-md border border-border bg-background/50 px-3 pr-8 text-sm appearance-none focus:border-[#00D4FF] focus:outline-none min-w-[120px]"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <Input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 bg-background/50 border-border focus:border-[#00D4FF] h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Country</Label>
          <Input
            type="text"
            placeholder="United States"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-background/50 border-border focus:border-[#00D4FF] h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Investment Range</Label>
          <div className="relative">
            <select
              value={investmentRange}
              onChange={(e) => setInvestmentRange(e.target.value)}
              className="w-full h-11 rounded-md border border-border bg-background/50 px-3 pr-8 text-sm appearance-none focus:border-[#00D4FF] focus:outline-none"
            >
              <option value="">Select range...</option>
              {INVESTMENT_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea
          placeholder="Tell us about your investment goals or any questions you have..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-background/50 border-border focus:border-[#00D4FF] min-h-[90px] resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="w-full h-12 bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold text-base hover:from-[#22D3EE] hover:to-[#00D4FF] transition-all accent-glow"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Request a Consultation
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your information is kept strictly confidential. No spam, ever.
      </p>
    </form>
  );
}
