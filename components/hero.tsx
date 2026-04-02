'use client'
import { Button } from '@/components/ui/button'
import { geist } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { MoveRight, Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

const PIXEL_SCRIPT_URL = '/images/pixel.js'

// ── Particle Sphere Canvas (Offground-style) ───────────────────────────────
function ParticleSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const progressRef = useRef(0) // 0 = flat wave, 1 = sphere

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    // Grid config
    const COLS = 28
    const ROWS = 28
    const RADIUS = Math.min(W, H) * 0.28
    const particles: { flatX: number; flatY: number; flatZ: number; sphX: number; sphY: number; sphZ: number }[] = []

    // Pre-compute flat grid and sphere positions
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        // Flat wave grid — like offground's initial state
        const flatX = (j / (COLS - 1) - 0.5) * W * 1.6
        const flatY = 80 + ((i / (ROWS - 1)) - 0.5) * 160
        const flatZ = Math.sin((j / COLS) * Math.PI * 2) * 40 + Math.sin((i / ROWS) * Math.PI) * 30

        // Sphere position (Fibonacci spiral for even distribution)
        const idx = i * COLS + j
        const total = ROWS * COLS
        const phi = Math.acos(1 - (2 * (idx + 0.5)) / total)
        const theta = Math.PI * (1 + Math.sqrt(5)) * idx
        const sphX = RADIUS * Math.sin(phi) * Math.cos(theta)
        const sphY = RADIUS * Math.sin(phi) * Math.sin(theta)
        const sphZ = RADIUS * Math.cos(phi)

        particles.push({ flatX, flatY, flatZ, sphX, sphY, sphZ })
      }
    }

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const t = progressRef.current // 0→1

      const cx = W / 2
      const cy = H / 2

      particles.forEach((p) => {
        const x = cx + p.flatX * (1 - t) + p.sphX * t
        const y = cy + p.flatY * (1 - t) + p.sphY * t
        const z = p.flatZ * (1 - t) + p.sphZ * t

        // Depth-based size + opacity
        const depth = (z + RADIUS) / (RADIUS * 2) // 0..1
        const size = 0.8 + depth * 1.6
        const alpha = 0.25 + depth * 0.65

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2)
        gradient.addColorStop(0, `rgba(148, 210, 225, ${alpha})`)
        gradient.addColorStop(1, `rgba(56, 189, 248, 0)`)

        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }
    draw()

    // Wire progress to scroll via ScrollTrigger
    ScrollTrigger.create({
      trigger: '#hero-section',
      start: 'top top',
      end: '+=600',
      scrub: 0.8,
      onUpdate: (self) => {
        progressRef.current = self.progress
      },
    })

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.85 }}
    />
  )
}

// ── Word split helper ──────────────────────────────────────────────────────
function SplitWords({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span
          key={i}
          className="hero-word inline-block overflow-hidden"
          style={{ marginRight: '0.3em', lineHeight: 1.1 }}
        >
          <span className="hero-word-inner inline-block">{word}</span>
        </span>
      ))}
    </>
  )
}

export default function Hero() {
  const [flipIndex, setFlipIndex] = useState(0)
  const flipWords = ['AI', 'Chats', 'Ideas', 'Everything']
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add('(min-width: 768px)', () => {
      // ── 1. Word-by-word entrance ─────────────────────────────────────────
      gsap.from('.hero-word-inner', {
        y: '115%',
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.07,
        delay: 0.2,
      })

      gsap.from('.hero-subtitle', {
        y: 35,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.85,
      })

      gsap.from('.hero-cta', {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        delay: 1.05,
        stagger: 0.08,
      })

      gsap.from('.hero-roles', {
        y: 18,
        opacity: 0,
        duration: 0.65,
        ease: 'power3.out',
        delay: 1.3,
      })

      // ── 2. Big BG text slow rise (offground layer 1 — the slowest layer) ─
      gsap.to('.hero-bg-text', {
        y: -60,
        ease: 'none',
        scrollTrigger: {
          trigger: '#hero-section',
          start: 'top top',
          end: '+=800',
          scrub: 1.5,
        },
      })

      // ── 3. Scroll-pinned exit (offground pattern — section 2 slides over) ─
      // Hero content flies UP as you scroll, sphere exits top, section 2 comes from BELOW
      const exitTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=700',
          scrub: 0.7,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
        },
      })

      // Foreground (fastest layer): headline flies off-screen top
      exitTl
        .to('.hero-headline', { y: -200, opacity: 0, ease: 'power2.in' }, 0)
        // Subtitle (medium speed)
        .to('.hero-subtitle', { y: -140, opacity: 0, ease: 'power2.in' }, 0.05)
        // CTA + roles (slower exit)
        .to('.hero-cta, .hero-roles', { y: -90, opacity: 0, ease: 'power2.in' }, 0.1)
        // Sphere canvas exits up slower (layer 2 — medium)
        .to('.hero-sphere-wrap', { y: -300, scale: 1.1, opacity: 0, ease: 'power1.in' }, 0.15)
        // BG text exits slowest (layer 1 continues its drift)
        .to('.hero-bg-text', { scale: 0.88, opacity: 0, ease: 'power1.inOut' }, 0.2)

      return () => mm.revert()
    })

    mm.add('(max-width: 767px)', () => {
      gsap.from('.hero-word-inner', {
        y: '100%',
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.05,
        delay: 0.2,
      })
    })
  }, { scope: containerRef })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          import('@/lib/load-script').then(({ loadScript }) => {
            loadScript(PIXEL_SCRIPT_URL).catch(console.error)
          })
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    const el = document.getElementById('hero-section')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setFlipIndex((p) => (p + 1) % flipWords.length), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      id="hero-section"
      ref={containerRef}
      className="relative min-h-[100vh] w-full overflow-hidden flex flex-col items-center justify-center py-24"
    >
      {/* ── Layer 1: Massive BG text (slowest parallax, like offground "OFFGROUND") ── */}
      <div className="hero-bg-text absolute inset-0 flex items-end justify-center pb-0 pointer-events-none z-0 overflow-hidden select-none">
        <div
          className="text-[20vw] font-black uppercase tracking-tighter text-white will-change-transform"
          style={{ opacity: 0.04, letterSpacing: '-0.04em', lineHeight: 0.85 }}
          aria-hidden="true"
        >
          FORK AI
        </div>
      </div>

      {/* ── Layer 2: Particle sphere (medium speed, offground-style) ── */}
      <div className="hero-sphere-wrap absolute inset-0 will-change-transform z-[1] pointer-events-none">
        <ParticleSphere />
      </div>

      {/* ── Layer 3: Foreground content (fastest exit) ── */}
      <div className="container mx-auto px-4 2xl:max-w-[1400px] relative z-10">
        {/* Headline — split into word spans for stagger */}
        <div className="hero-headline mx-auto mt-8 max-w-4xl text-center">
          <h1
            className={cn(
              'text-center text-5xl font-bold tracking-tight text-white sm:text-6xl xl:text-7xl/none flex flex-wrap justify-center',
              geist.className
            )}
          >
            <SplitWords text="Your AI sucks." />
            <span className="w-full block h-2" />
            <SplitWords text="Fork your" />
            <span
              className="hero-word inline-block overflow-hidden"
              style={{ marginLeft: '0.3em' }}
            >
              <span className="hero-word-inner inline-block">
                <span className="inline-flex items-center justify-center min-w-[140px] md:min-w-[220px]">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={flipIndex}
                      initial={{ rotateX: 90, opacity: 0 }}
                      animate={{ rotateX: 0, opacity: 1 }}
                      exit={{ rotateX: -90, opacity: 0 }}
                      transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
                      className="inline-block bg-gradient-to-r from-white via-[#f8fafc] to-white text-black px-4 py-1 rounded-xl transform -rotate-1 shadow-2xl"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {flipWords[flipIndex]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
            </span>
          </h1>
        </div>

        {/* Subtitle */}
        <div className="hero-subtitle mx-auto mt-8 max-w-2xl text-center">
          <p className="text-gray-300 text-xl leading-relaxed">
            Fork AI is a powerful multi-AI chat platform and AI workspace.
            Seamlessly switch between ChatGPT, Claude, and Gemini without losing
            context. Branch conversations, organize chats, and start free—no
            credit card required.
          </p>
        </div>

        {/* CTAs */}
        <div className="hero-cta mt-10 flex flex-col sm:flex-row justify-center gap-4 items-center">
          <Link prefetch={false} href="/prelaunch">
            <Button className="bg-gradient-to-r from-white to-[#f8fafc] text-black hover:from-[#f8fafc] hover:to-white rounded-full px-8 py-6 text-lg font-medium transition-all hover:scale-105 hover:shadow-2xl hover:shadow-white/20">
              Get Early Access <MoveRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link prefetch={false} href="/demo">
            <Button
              variant="outline"
              className="glass border-white/20 text-white rounded-full px-8 py-6 text-lg font-medium group bg-transparent"
            >
              <Play className="mr-2 h-4 w-4 fill-current group-hover:scale-110 transition-transform" />{' '}
              Watch Demo
            </Button>
          </Link>
        </div>

        {/* Roles */}
        <div className="hero-roles mt-16 flex flex-col items-center justify-center gap-y-4">
          <span className="text-xs text-gray-400/70 font-medium tracking-widest uppercase">
            Built for people who think in branches
          </span>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-40">
            {['Researchers', 'Founders', 'Engineers', 'PMs', 'Builders', 'Creators'].map((role) => (
              <span
                key={role}
                className="text-lg font-bold text-white cursor-pointer transition-all duration-300 hover:opacity-100 hover:scale-110"
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="hero-cta mt-14 flex justify-center">
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-2 text-white/25"
          >
            <span className="text-[10px] tracking-widest uppercase">Scroll</span>
            <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
              <rect x="1" y="1" width="12" height="20" rx="6" stroke="currentColor" strokeWidth="1.5" />
              <motion.rect
                animate={{ y: [0, 7, 0], opacity: [1, 0, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                x="5.5" y="4" width="3" height="4" rx="1.5" fill="currentColor"
              />
            </svg>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
