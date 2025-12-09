"use client";
import { FAQSection } from "@/components/faq-section";
import Features from "@/components/features";
import Hero from "@/components/hero";
import { NewReleasePromo } from "@/components/new-release-promo";
import { PricingSection } from "@/components/pricing-section";
import { TestimonialsSection } from "@/components/testimonials";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "system");
    root.classList.add("dark");
  }, []);

  return (
    <AuroraBackground className="min-h-screen w-full">
      <div className="min-h-screen w-full relative">
        {/* Hero Section */}
        <Hero />

        {/* Features Section */}
        <div id="features">
          <Features />
        </div>

        {/* Pricing Section */}
        <div id="pricing">
          <PricingSection />
        </div>

        {/* Testimonials Section */}
        <div id="testimonials">
          <TestimonialsSection />
        </div>

        <NewReleasePromo />

        {/* FAQ Section */}
        <div id="faq">
          <FAQSection />
        </div>
      </div>
    </AuroraBackground>
  );
}
