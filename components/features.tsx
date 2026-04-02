'use client'

import { geist } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { ArrowLeftRight, GitBranch, Share2, Sparkles } from 'lucide-react'
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

// ── Service tags (offground section-2 style horizontal row) ───────────────
const SERVICE_TAGS = ['Branching', 'Multi-Model', 'Privacy', 'Speed']

// ── Feature steps for Taiko-style pinned narrative ────────────────────────
const STEPS = [
  {
    icon: GitBranch,
    tag: 'Branching UI',
    title: 'Fork your chat,\nnot your brain.',
    body: 'Drag and drop to branch off alternatives, compare responses side-by-side, and keep your main line of thought clean. Each branch is its own thread.',
    visual: (
      <svg viewBox="0 0 240 200" className="w-full max-w-[220px]" aria-hidden="true">
        <line x1="120" y1="20" x2="120" y2="80" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="120" y1="80" x2="60" y2="140" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <line x1="120" y1="80" x2="180" y2="140" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <line x1="60" y1="140" x2="35" y2="185" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="60" y1="140" x2="85" y2="185" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="120" cy="20" r="10" fill="#cbd5e1" />
        <circle cx="120" cy="80" r="7" fill="none" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="60" cy="140" r="6" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="180" cy="140" r="6" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="35" cy="185" r="5" fill="none" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="85" cy="185" r="5" fill="none" stroke="#64748b" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    icon: Share2,
    tag: 'Privacy-First',
    title: 'Share only what\nmatters.',
    body: 'Instead of dumping your entire chat, share a precise slice: a branch, a set of messages, or an AI summary—with full control over what is visible.',
    visual: (
      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
          <span className="text-sm text-white/70">Selected messages</span>
        </div>
        <div className="rounded-xl border border-[#cbd5e1]/30 bg-[#cbd5e1]/10 px-4 py-3 text-sm text-[#cbd5e1]">
          + AI Summary
        </div>
        <div className="rounded-full bg-white/10 border border-white/20 px-4 py-2 text-xs text-center text-white/50">
          link copied ✓
        </div>
      </div>
    ),
  },
  {
    icon: ArrowLeftRight,
    tag: 'Multi-Model',
    title: 'Swap models\nmid-flow.',
    body: 'Different models excel at different tasks. Switch GPT-4, Claude, or Gemini on any branch—compare responses on the same context with zero re-explaining.',
    visual: (
      <div className="flex items-end gap-3 w-full max-w-[240px]">
        {[
          { name: 'GPT-4', h: 'h-20', color: 'from-green-500/25 to-emerald-500/10' },
          { name: 'Claude', h: 'h-28', color: 'from-orange-500/30 to-amber-500/10', active: true },
          { name: 'Gemini', h: 'h-16', color: 'from-blue-500/25 to-cyan-500/10' },
        ].map((m) => (
          <div
            key={m.name}
            className={cn(
              'flex-1 rounded-xl border border-white/10 bg-gradient-to-b flex flex-col items-center justify-end pb-3 text-xs font-medium transition-all',
              m.h,
              m.color,
              m.active ? 'border-[#cbd5e1]/40 shadow-[0_0_20px_rgba(203,213,225,0.2)]' : ''
            )}
          >
            <span className={m.active ? 'text-[#cbd5e1]' : 'text-white/50'}>{m.name}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Sparkles,
    tag: 'Accessible',
    title: 'Premium UX,\nzero barrier.',
    body: 'Fork AI runs on an ad-supported model so powerful AI stays accessible to everyone—no credit card, no paywall. Start free and upgrade when you\'re ready.',
    visual: (
      <div className="text-center w-full max-w-[200px]">
        <div className="text-7xl font-black bg-gradient-to-b from-[#cbd5e1] to-[#94a3b8] bg-clip-text text-transparent leading-none">
          $0
        </div>
        <div className="text-white/40 mt-2 text-sm">to get started</div>
        <div className="mt-5 flex flex-col gap-2 text-left text-sm">
          {['Thoughtful, minimal ads', 'Full branching & sharing', 'All major AI models'].map((i) => (
            <div key={i} className="flex items-center gap-2 text-white/55">
              <div className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1] flex-shrink-0" />
              {i}
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

export function Features() {
  const containerRef = useRef<HTMLDivElement>(null)
  const narrativeRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add('(min-width: 768px)', () => {

      // ── 1. Section-2 entrance: slide up FROM BELOW (offground pattern) ──
      // The header tag row reveals horizontally (slides from left, like offground service tags)
      gsap.from('.features-tag-row .ftag', {
        x: -60,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: '.features-tag-row',
          start: 'top 88%',
        },
      })

      // Main headline: clip-path reveal from bottom (offground "We specialize in" style)
      gsap.from('.features-main-headline .clip-line', {
        y: '105%',
        duration: 1.0,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: '.features-main-headline',
          start: 'top 85%',
        },
      })

      gsap.from('.features-subtext', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.features-subtext',
          start: 'top 88%',
        },
      })

      // ── 2. Taiko-style: PIN the narrative section ─────────────────────────
      const steps = gsap.utils.toArray<HTMLElement>('.step-content')
      const visuals = gsap.utils.toArray<HTMLElement>('.step-visual')

      if (steps.length > 0 && narrativeRef.current) {
        const totalScrollLength = (steps.length - 1) * 600 // 600px scroll per step
        let lastStep = 0

        // Set ALL steps' initial CSS so there's zero bleed-through
        steps.forEach((s, i) => gsap.set(s, { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 30, visibility: i === 0 ? 'visible' : 'hidden' }))
        visuals.forEach((v, i) => gsap.set(v, { opacity: i === 0 ? 1 : 0, x: i === 0 ? 0 : 40, scale: i === 0 ? 1 : 0.92, visibility: i === 0 ? 'visible' : 'hidden' }))

        ScrollTrigger.create({
          trigger: narrativeRef.current,
          start: 'top top',
          end: `+=${totalScrollLength}`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            const rawStep = self.progress * (steps.length - 1)
            const currentStep = Math.max(0, Math.min(steps.length - 1, Math.round(rawStep)))
            if (currentStep === lastStep) return
            const prev = lastStep
            lastStep = currentStep

            // Exit old step
            gsap.to(steps[prev], { opacity: 0, y: prev < currentStep ? -30 : 30, duration: 0.35, ease: 'power2.in', onComplete: () => gsap.set(steps[prev], { visibility: 'hidden' }) })
            gsap.to(visuals[prev], { opacity: 0, x: prev < currentStep ? -40 : 40, scale: 0.92, duration: 0.35, ease: 'power2.in', onComplete: () => gsap.set(visuals[prev], { visibility: 'hidden' }) })

            // Enter new step
            gsap.set(steps[currentStep], { visibility: 'visible', y: prev < currentStep ? 30 : -30 })
            gsap.set(visuals[currentStep], { visibility: 'visible', x: prev < currentStep ? 40 : -40 })
            gsap.to(steps[currentStep], { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.1 })
            gsap.to(visuals[currentStep], { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'power2.out', delay: 0.1 })
          },
        })
      }

      // ── 3. Word-level opacity scroll reveal (Taiko "About" style) ──
      // Applied to features body text
      gsap.utils.toArray<HTMLElement>('.scroll-word').forEach((word) => {
        gsap.fromTo(
          word,
          { opacity: 0.15 },
          {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: word,
              start: 'top 75%',
              end: 'top 45%',
              scrub: true,
            },
          }
        )
      })

      return () => mm.revert()
    })

    mm.add('(max-width: 767px)', () => {
      gsap.utils.toArray<HTMLElement>('.step-content').forEach((el) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        })
      })
    })
  }, { scope: containerRef })

  return (
    <section
      id="features"
      ref={containerRef}
      className="relative"
    >
      {/* ── Part A: Offline-style section opener ────────────────────────────── */}
      <div className="py-20 px-4">
        <div className="max-w-6xl mx-auto">

          {/* Horizontal service tags — offground "Web Dev · Design · Automation · Consulting" */}
          <div className="features-tag-row flex flex-wrap items-center gap-x-8 gap-y-3 mb-10">
            {SERVICE_TAGS.map((tag) => (
              <div key={tag} className="ftag flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#cbd5e1]/60" />
                <span className="text-sm text-white/55 font-medium tracking-wide">{tag}</span>
              </div>
            ))}
          </div>

          {/* Clipping-mask headline reveal — offground "We specialize in customer happiness" */}
          <div className="features-main-headline overflow-hidden mb-6">
            {['What is Fork AI?'].map((line, i) => (
              <div key={i} className="overflow-hidden">
                <div
                  className={cn(
                    'clip-line text-4xl md:text-[56px] md:leading-[1.1] font-bold tracking-tight text-white',
                    geist.className
                  )}
                >
                  {line}
                </div>
              </div>
            ))}
          </div>

          <p className="features-subtext text-white/55 text-lg leading-relaxed max-w-xl">
            A Multi-AI Chat Platform & AI Workspace — work with multiple models
            in one place without restarting conversations or losing context.
          </p>
        </div>
      </div>

      {/* ── Part B: Taiko-style pinned narrative (text swaps, visual transitions) ─ */}
      <div
        ref={narrativeRef}
        className="relative h-screen flex items-center overflow-hidden"
      >
        {/* Left: Text steps (overlap each other, shown one at a time) */}
        <div className="absolute inset-0 flex items-center px-4">
          <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

            {/* Text column */}
            <div className="relative h-72">
              {STEPS.map((step, i) => (
                <div
                  key={step.tag}
                  className="step-content absolute inset-0 flex flex-col justify-center"
                >
                  {/* Step counter */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs font-mono text-white/30 tabular-nums">
                      0{i + 1} / 0{STEPS.length}
                    </span>
                    <div className="flex-1 h-px bg-white/10">
                      <div
                        className="h-full bg-[#cbd5e1]/60 transition-all duration-500"
                        style={{ width: `${((i + 1) / STEPS.length) * 100}%` }}
                      />
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#cbd5e1]">
                      {step.tag}
                    </span>
                  </div>

                  <h3
                    className={cn(
                      'text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 whitespace-pre-line',
                      geist.className
                    )}
                  >
                    {step.title}
                  </h3>

                  <p className="text-white/55 text-base leading-relaxed max-w-md">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Visual column */}
            <div className="relative h-72 flex items-center justify-center">
              {STEPS.map((step) => (
                <div
                  key={step.tag}
                  className="step-visual absolute inset-0 flex items-center justify-center"
                >
                  {step.visual}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress dots (taiko-style scroll position indicator) */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
          {STEPS.map((step, i) => (
            <div
              key={step.tag}
              className="w-1.5 h-1.5 rounded-full bg-white/20 transition-all duration-300"
              title={step.tag}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
