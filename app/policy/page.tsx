"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { AuroraBackground } from "@/components/ui/aurora-background"
import { Shield, FileText, Lock, Eye, Mail, GitBranch } from "lucide-react"

const policySection = [
  {
    icon: Shield,
    title: "Privacy Policy",
    content: [
      {
        heading: "Information We Collect",
        text: "Fork AI collects information you provide directly to us, such as when you create an account, use our multi-AI platform, or communicate with us. This may include your name, email address, conversation data, and usage preferences.",
      },
      {
        heading: "How We Use Your Information",
        text: "We use the information we collect to provide, maintain, and improve Fork AI's services, including the branching conversation UI, model switching features, and privacy-first sharing capabilities. We also use data to personalize your experience and communicate updates.",
      },
      {
        heading: "Branch & Conversation Privacy",
        text: "Your conversation branches are private by default. When you share a branch, only the specific content you select is shared. We never share your complete conversation history without explicit consent. Our privacy-first design ensures you control what others see.",
      },
    ],
  },
  {
    icon: FileText,
    title: "Terms of Service",
    content: [
      {
        heading: "Acceptance of Terms",
        text: "By accessing and using Fork AI, you accept and agree to be bound by these terms. Fork AI provides a multi-AI platform with branching conversations, model switching, and selective sharing features.",
      },
      {
        heading: "Use License",
        text: "Fork AI grants you a personal, non-exclusive license to use our platform for creating, branching, and sharing AI conversations. You retain ownership of your conversation content while granting us license to process it through our services.",
      },
      {
        heading: "Ad-Supported Model",
        text: "Fork AI is supported by thoughtful, minimal ad placements to keep the platform accessible. By using Fork AI, you agree to view non-intrusive advertisements. Premium tiers may offer ad-free experiences.",
      },
    ],
  },
  {
    icon: Lock,
    title: "Data Security",
    content: [
      {
        heading: "Conversation Security",
        text: "All conversation data, including branches and shared content, is encrypted in transit and at rest. We implement industry-standard security measures to protect your AI interactions and personal information.",
      },
      {
        heading: "Model Switching Security",
        text: "When you switch between AI models, your conversation context is securely transferred. We ensure that model providers only receive the necessary context and not your complete conversation history.",
      },
    ],
  },
  {
    icon: Eye,
    title: "Your Rights",
    content: [
      {
        heading: "Branch Control",
        text: "You have full control over your conversation branches. You can create, delete, or share any branch at any time. You can also redact or hide specific messages before sharing with collaborators.",
      },
      {
        heading: "Data Export",
        text: "You can export your complete conversation history, including all branches, in standard formats. This allows you to maintain a personal record or transfer your data to other services.",
      },
    ],
  },
]

export default function PolicyPage() {
  const [activeSection, setActiveSection] = useState(0)

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "system")
    root.classList.add("dark")
  }, [])

  return (
    <AuroraBackground className="min-h-screen w-full">
      <div className="min-h-screen w-full relative">
        {/* Header */}
        <header className="sticky top-4 z-[9999] mx-auto w-full max-w-5xl px-4 py-2">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between rounded-full glass border-white/20 shadow-2xl shadow-[#cbd5e1]/10 px-6 py-3"
          >
            <a className="flex items-center justify-center gap-2" href="/">
              <GitBranch className="w-8 h-8 text-white" />
              <span className="font-bold text-white text-lg">Fork AI</span>
            </a>

            <a href="/" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
              Back to Home
            </a>
          </motion.div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-white/10 mb-6"
            >
              <Shield className="w-4 h-4 text-[#cbd5e1]" />
              <span className="text-sm font-medium text-white/80">Legal & Privacy</span>
            </motion.div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Privacy & Terms
              </span>
            </h1>

            <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
              Fork AI is built with privacy at its core. Learn how we protect your conversations, branches, and data
              while giving you full control.
            </p>
          </motion.div>

          {/* Navigation Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {policySection.map((section, index) => {
              const Icon = section.icon
              return (
                <motion.button
                  key={section.title}
                  onClick={() => setActiveSection(index)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                    activeSection === index
                      ? "bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black shadow-xl"
                      : "glass border-white/20 text-white/60 hover:text-white hover:border-white/30"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{section.title}</span>
                </motion.button>
              )
            })}
          </motion.div>

          {/* Content Sections */}
          <div className="max-w-4xl mx-auto">
            {policySection.map((section, sectionIndex) => {
              const Icon = section.icon
              return (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{
                    opacity: activeSection === sectionIndex ? 1 : 0,
                    x: activeSection === sectionIndex ? 0 : 20,
                    display: activeSection === sectionIndex ? "block" : "none",
                  }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  {/* Section Header */}
                  <div className="glass border-white/20 rounded-2xl p-8 hover:border-white/30 transition-all duration-300">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] flex items-center justify-center">
                        <Icon className="w-6 h-6 text-black" />
                      </div>
                      <h2 className="text-3xl font-bold text-white">{section.title}</h2>
                    </div>
                    <p className="text-white/60 leading-relaxed">
                      Last updated:{" "}
                      {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>

                  {/* Content Cards */}
                  {section.content.map((item, itemIndex) => (
                    <motion.div
                      key={item.heading}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: itemIndex * 0.1 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className="glass border-white/10 rounded-2xl p-8 hover:border-white/20 hover:shadow-lg hover:shadow-[#cbd5e1]/10 transition-all duration-300"
                    >
                      <h3 className="text-xl font-bold text-white mb-4">{item.heading}</h3>
                      <p className="text-white/70 leading-relaxed">{item.text}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )
            })}
          </div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-4xl mx-auto mt-16"
          >
            <div className="glass border-white/20 rounded-2xl p-8 text-center hover:border-white/30 transition-all duration-300">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] flex items-center justify-center">
                <Mail className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Questions or Concerns?</h3>
              <p className="text-white/60 mb-6 leading-relaxed">
                If you have any questions about our privacy policy, terms of service, or how Fork AI handles your data,
                please don't hesitate to contact us.
              </p>
              <motion.a
                href="mailto:privacy@forkai.com"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black font-bold shadow-xl shadow-[#cbd5e1]/20 hover:shadow-2xl hover:shadow-[#cbd5e1]/30 transition-all duration-300 shimmer-hover"
              >
                Contact Us
              </motion.a>
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="py-8 px-4 mt-16">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="glass border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-6 h-6 text-white" />
                  <span className="text-white/60 text-sm">© 2025 Fork AI. All rights reserved.</span>
                </div>
                <div className="flex items-center gap-6">
                  <a href="#" className="text-white/60 hover:text-white text-sm transition-colors relative group">
                    Twitter
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
                  </a>
                  <a href="#" className="text-white/60 hover:text-white text-sm transition-colors relative group">
                    LinkedIn
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
                  </a>
                  <a href="#" className="text-white/60 hover:text-white text-sm transition-colors relative group">
                    GitHub
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </footer>
      </div>
    </AuroraBackground>
  )
}
