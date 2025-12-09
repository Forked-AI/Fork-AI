"use client";

import type React from "react";

import { AuroraBackground } from "@/components/ui/aurora-background";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Loader2, Mail, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export default function PrelaunchPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flipIndex, setFlipIndex] = useState(0);
  const [launchStatus, setLaunchStatus] = useState<'coming-soon' | 'countdown'>('coming-soon');
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const flipWords = [
    "AI Experience",
    "Conversations",
    "Workflows",
    "Ideas",
    "Everything",
  ];

  // Set launch date (30 days from now)
  const launchDate = new Date();
  launchDate.setDate(launchDate.getDate() + 30);

  useEffect(() => {
    const flipInterval = setInterval(() => {
      setFlipIndex((prev) => (prev + 1) % flipWords.length);
    }, 3000);

    return () => clearInterval(flipInterval);
  }, []);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +launchDate - +new Date();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setIsSubmitted(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuroraBackground className="min-h-screen w-full">
      <div className="min-h-screen w-full relative flex flex-col">
        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-4 py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-white/10 mb-8"
            >
              <Sparkles className="w-4 h-4 text-[#cbd5e1]" />
              <span className="text-sm font-medium text-white/80">
                {launchStatus === 'coming-soon' ? 'Coming Soon' : 'Launching Soon'}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold mb-6"
            >
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Fork your
              </span>
              <br />
              <div className="inline-flex items-center justify-center min-w-[280px] md:min-w-[500px] h-[80px] md:h-[100px] mt-2">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={flipIndex}
                    initial={{ rotateX: 90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    exit={{ rotateX: -90, opacity: 0 }}
                    transition={{
                      duration: 0.2,
                      type: "spring",
                      stiffness: 100,
                    }}
                    className="inline-block bg-white text-black px-6 py-2 rounded-2xl text-4xl md:text-6xl"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {flipWords[flipIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Fork AI is a multi-AI platform with a fine-grained, zero-effort
              UX. Fork chats, swap models without losing context, and share only
              what you want.
            </motion.p>

            {/* Countdown Timer */}
            {launchStatus === 'countdown' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-12"
              >
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-[#cbd5e1]" />
                  <span className="text-white/60 text-sm font-medium">
                    Launching in
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
                {[
                  { label: "Days", value: timeLeft.days },
                  { label: "Hours", value: timeLeft.hours },
                  { label: "Minutes", value: timeLeft.minutes },
                  { label: "Seconds", value: timeLeft.seconds },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="glass border-white/20 rounded-2xl p-4 md:p-6 hover:border-white/30 hover:shadow-lg hover:shadow-[#cbd5e1]/20 transition-all duration-300"
                  >
                    <div className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] bg-clip-text text-transparent mb-2">
                      {String(item.value).padStart(2, "0")}
                    </div>
                    <div className="text-white/60 text-xs md:text-sm font-medium">
                      {item.label}
                    </div>
                  </motion.div>
                ))}
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="max-w-xl mx-auto"
            >
              {!isSubmitted ? (
                <form onSubmit={handleSubmit}>
                  <div className="relative flex items-center gap-2 bg-[#0f172a] border border-white/20 rounded-full px-4 py-2 backdrop-blur-xl shadow-xl">
                    <Mail className="w-5 h-5 text-white/40 flex-shrink-0" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      disabled={isLoading}
                      className="flex-1 bg-transparent py-2 text-white placeholder:text-white/40 focus:outline-none text-base min-w-0 disabled:opacity-50"
                    />
                    <motion.button
                      type="submit"
                      disabled={isLoading}
                      whileHover={!isLoading ? { scale: 1.03 } : {}}
                      whileTap={!isLoading ? { scale: 0.97 } : {}}
                      className="flex-shrink-0 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#e2e8f0] to-white text-black font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        launchStatus === 'coming-soon' ? 'Notify Me' : 'Join Waitlist'
                      )}
                    </motion.button>
                  </div>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm mt-3"
                    >
                      {error}
                    </motion.p>
                  )}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-white/50 text-sm mt-4"
                  >
                    Join early users shaping the future of multi-AI workflows.
                    No spam.
                  </motion.p>
                </form>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass border-white/20 rounded-2xl p-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] flex items-center justify-center"
                  >
                    <svg
                      className="w-8 h-8 text-black"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    You're on the list!
                  </h3>
                  <p className="text-white/60">
                    We'll send you an email as soon as we launch. Get ready for
                    the best AI UX you've ever experienced!
                  </p>
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
            >
              {[
                {
                  title: "Fork Branching UI",
                  desc: "Drag-and-drop branching to explore ideas without losing the main thread.",
                },
                {
                  title: "Privacy-First Sharing",
                  desc: "Share only specific branches or messages, never your whole conversation.",
                },
                {
                  title: "Model Switching",
                  desc: "Swap models mid-flow without losing context or starting over.",
                },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: 1.1 + index * 0.1,
                    type: "spring",
                    stiffness: 100
                  }}
                  whileHover={{
                    scale: 1.02,
                    borderColor: "rgba(148, 163, 184, 0.6)",
                    boxShadow: "0 0 30px rgba(148, 163, 184, 0.2)",
                    transition: { duration: 0.2, ease: "easeOut" }
                  }}
                  className="glass border-white/10 rounded-2xl p-6 cursor-pointer"
                >
                  <h3 className="text-white font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </main>
      </div>
    </AuroraBackground>
  );
}
