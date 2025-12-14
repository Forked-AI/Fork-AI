/**
 * LANDING PAGE WITH MASKED SECTIONS
 * This is the full landing page with sections after Hero masked during prelaunch.
 * Only the Hero section is visible; other sections are commented out.
 * 
 * SEE: PRELAUNCH-RESTORATION.md for restoration instructions when ready to launch.
 */

"use client";
import Hero from "@/components/hero";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { useEffect } from "react";

export default function Landing() {
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

        {/* 
          ═══════════════════════════════════════════════════════════════
          MASKED DURING PRELAUNCH PHASE
          ═══════════════════════════════════════════════════════════════
          The sections below are hidden from the DOM during prelaunch.
          
          TO RESTORE: Uncomment all sections below when ready to launch.
          SEE: PRELAUNCH-RESTORATION.md for complete restoration steps.
          ═══════════════════════════════════════════════════════════════
        */}

        {/* Features Section */}
        {/* <div id="features">
          <Features />
        </div> */}

        {/* Pricing Section */}
        {/* <div id="pricing">
          <PricingSection />
        </div> */}

        {/* Testimonials Section */}
        {/* <div id="testimonials">
          <TestimonialsSection />
        </div> */}

        {/* New Release Promo */}
        {/* <NewReleasePromo /> */}

        {/* FAQ Section */}
        {/* <div id="faq">
          <FAQSection />
        </div> */}

        {/* 
          ═══════════════════════════════════════════════════════════════
          END OF MASKED SECTIONS
          ═══════════════════════════════════════════════════════════════
        */}
      </div>
    </AuroraBackground>
  );
}
