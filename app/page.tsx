"use client";
import { useState, useEffect } from "react";
import Hero from "@/components/hero";
import Features from "@/components/features";
import { TestimonialsSection } from "@/components/testimonials";
import { NewReleasePromo } from "@/components/new-release-promo";
import { FAQSection } from "@/components/faq-section";
import { PricingSection } from "@/components/pricing-section";
import { StickyFooter } from "@/components/sticky-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GitBranch } from "lucide-react";

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "system");
    root.classList.add("dark");
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMobileNavClick = (elementId: string) => {
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        const headerOffset = 120;
        const elementPosition =
          element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  return (
    <AuroraBackground className="min-h-screen w-full">
      <div className="min-h-screen w-full relative">
        {/* Desktop Header */}
        <header
          className={`sticky top-4 z-[9999] mx-auto hidden w-full flex-row items-center justify-between self-start rounded-full glass border-white/20 shadow-2xl shadow-[#cbd5e1]/10 transition-all duration-300 md:flex shimmer ${
            isScrolled ? "max-w-3xl px-2" : "max-w-5xl px-4"
          } py-2`}
          style={{
            willChange: "transform",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            perspective: "1000px",
          }}
        >
          <a
            className={`z-50 flex items-center justify-center gap-2 transition-all duration-300 ${
              isScrolled ? "ml-4" : ""
            }`}
            href="/"
          >
            <GitBranch className="w-8 h-8 text-white" />
            <span className="font-bold text-white text-lg">Fork AI</span>
          </a>

          <div className="absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium text-muted-foreground transition duration-200 hover:text-foreground md:flex md:space-x-2">
            <a
              className="relative px-4 py-2 text-muted-foreground hover:text-white transition-all cursor-pointer group"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById("features");
                if (element) {
                  const headerOffset = 120;
                  const elementPosition =
                    element.getBoundingClientRect().top + window.pageYOffset;
                  const offsetPosition = elementPosition - headerOffset;

                  window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth",
                  });
                }
              }}
            >
              <span className="relative z-20">Features</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a
              className="relative px-4 py-2 text-muted-foreground hover:text-white transition-all cursor-pointer group"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById("pricing");
                if (element) {
                  const headerOffset = 120;
                  const elementPosition =
                    element.getBoundingClientRect().top + window.pageYOffset;
                  const offsetPosition = elementPosition - headerOffset;

                  window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth",
                  });
                }
              }}
            >
              <span className="relative z-20">Pricing</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a
              className="relative px-4 py-2 text-muted-foreground hover:text-white transition-all cursor-pointer group"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById("testimonials");
                if (element) {
                  const headerOffset = 120;
                  const elementPosition =
                    element.getBoundingClientRect().top + window.pageYOffset;
                  const offsetPosition = elementPosition - headerOffset;

                  window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth",
                  });
                }
              }}
            >
              <span className="relative z-20">Testimonials</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a
              className="relative px-4 py-2 text-muted-foreground hover:text-white transition-all cursor-pointer group"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById("faq");
                if (element) {
                  const headerOffset = 120;
                  const elementPosition =
                    element.getBoundingClientRect().top + window.pageYOffset;
                  const offsetPosition = elementPosition - headerOffset;

                  window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth",
                  });
                }
              }}
            >
              <span className="relative z-20">FAQ</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/login"
              className="font-medium transition-colors hover:text-white text-muted-foreground text-sm cursor-pointer"
            >
              Log In
            </a>

            <a
              href="/prelaunch"
              className="rounded-full font-bold relative cursor-pointer hover:-translate-y-0.5 transition-all duration-200 inline-block text-center bg-gradient-to-r from-[#e2e8f0] to-white text-black shadow-xl shadow-white/20 hover:shadow-2xl hover:shadow-white/30 px-6 py-2 text-sm shimmer-hover"
            >
              Get Early Access
            </a>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="sticky top-4 z-[9999] mx-4 flex w-auto flex-row items-center justify-between rounded-full glass border-white/20 shadow-2xl md:hidden px-4 py-3 shimmer">
          <a className="flex items-center justify-center gap-2" href="/">
            <GitBranch className="w-7 h-7 text-white" />
            <span className="font-bold text-white">Fork AI</span>
          </a>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-full glass glass-hover border-white/20 transition-colors"
            aria-label="Toggle menu"
          >
            <div className="flex flex-col items-center justify-center w-5 h-5 space-y-1">
              <span
                className={`block w-4 h-0.5 bg-foreground transition-all duration-300 ${
                  isMobileMenuOpen ? "rotate-45 translate-y-1.5" : ""
                }`}
              ></span>
              <span
                className={`block w-4 h-0.5 bg-foreground transition-all duration-300 ${
                  isMobileMenuOpen ? "opacity-0" : ""
                }`}
              ></span>
              <span
                className={`block w-4 h-0.5 bg-foreground transition-all duration-300 ${
                  isMobileMenuOpen ? "-rotate-45 -translate-y-1.5" : ""
                }`}
              ></span>
            </div>
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-md md:hidden">
            <div className="absolute top-20 left-4 right-4 glass border-white/20 rounded-2xl shadow-2xl p-6 shimmer">
              <nav className="flex flex-col space-y-4">
                <button
                  onClick={() => handleMobileNavClick("features")}
                  className="text-left px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 hover:translate-x-2"
                >
                  Features
                </button>
                <button
                  onClick={() => handleMobileNavClick("pricing")}
                  className="text-left px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 hover:translate-x-2"
                >
                  Pricing
                </button>
                <button
                  onClick={() => handleMobileNavClick("testimonials")}
                  className="text-left px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 hover:translate-x-2"
                >
                  Testimonials
                </button>
                <button
                  onClick={() => handleMobileNavClick("faq")}
                  className="text-left px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 hover:translate-x-2"
                >
                  FAQ
                </button>
                <div className="border-t border-white/10 pt-4 mt-4 flex flex-col space-y-3">
                  <a
                    href="/login"
                    className="px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 cursor-pointer"
                  >
                    Log In
                  </a>
                  <a
                    href="/prelaunch"
                    className="px-4 py-3 text-lg font-bold text-center bg-gradient-to-r from-[#e2e8f0] to-white text-black rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Get Early Access
                  </a>
                </div>
              </nav>
            </div>
          </div>
        )}

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

        {/* Sticky Footer */}
        <StickyFooter />
      </div>
    </AuroraBackground>
  );
}
