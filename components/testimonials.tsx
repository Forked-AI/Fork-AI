import { Marquee } from "@/components/magicui/marquee"

const testimonials = [
  {
    name: "Dr. Sarah Chen",
    username: "@sarahresearch",
    body: "Fork AI completely changed how I explore research hypotheses. I can branch off multiple interpretations of a paper and compare them side-by-side.",
    img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "Marcus Thompson",
    username: "@marcuspm",
    body: "As a PM, I use Fork AI to compare product directions in parallel. The branching UI is exactly how my brain works when evaluating options.",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "Elena Rodriguez",
    username: "@elenabuilds",
    body: "Finally, an AI chat that doesn't trap me in a single messy thread. The privacy-first sharing is a game changer for client work.",
    img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "James Liu",
    username: "@jamescodes",
    body: "Testing prompts across GPT-4, Claude, and Gemini on the same context without re-explaining everything? This is what I've been waiting for.",
    img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "Priya Patel",
    username: "@priyafounder",
    body: "Fork AI's branching lets me explore multiple startup pivots simultaneously. Each idea gets its own thread without losing the main vision.",
    img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "David Kim",
    username: "@davidengineers",
    body: "The table of contents for long chats is brilliant. No more scrolling through hundreds of messages to find that one key insight.",
    img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "Anna Kowalski",
    username: "@annaresearcher",
    body: "Being able to share just a specific branch with my collaborators while keeping the rest private is exactly what academic research needs.",
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "Michael Chang",
    username: "@michaelbuilds",
    body: "Fork AI's UX is genuinely premium. The ad-backed model means I can use powerful AI without breaking the bank. Smart approach.",
    img: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face",
  },
  {
    name: "Sophie Turner",
    username: "@sophiecreates",
    body: "I use Fork AI for creative writing. Each story branch can take a different direction, and I never lose track of my main narrative.",
    img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
  },
]

const firstColumn = testimonials.slice(0, 3)
const secondColumn = testimonials.slice(3, 6)
const thirdColumn = testimonials.slice(6, 9)

const TestimonialCard = ({
  img,
  name,
  username,
  body,
}: {
  img: string
  name: string
  username: string
  body: string
}) => {
  return (
    <div className="relative w-full max-w-xs overflow-hidden rounded-3xl border border-white/10 glass p-10 shadow-xl transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:-translate-y-2 group">
      <div className="absolute -top-5 -left-5 -z-10 h-40 w-40 rounded-full bg-gradient-to-b from-[#cbd5e1]/10 to-transparent blur-2xl transition-all duration-300 group-hover:from-[#cbd5e1]/20"></div>

      <div className="text-white/90 leading-relaxed">{body}</div>

      <div className="mt-5 flex items-center gap-2">
        <img
          src={img || "/placeholder.svg"}
          alt={name}
          height="40"
          width="40"
          className="h-10 w-10 rounded-full ring-2 ring-white/10 group-hover:ring-white/20 transition-all"
        />
        <div className="flex flex-col">
          <div className="leading-5 font-medium tracking-tight text-white">{name}</div>
          <div className="leading-5 tracking-tight text-white/60">{username}</div>
        </div>
      </div>
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="mb-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-[540px]">
          <div className="flex justify-center">
            <button
              type="button"
              className="group relative z-[60] mx-auto rounded-full border border-white/20 glass px-6 py-1 text-xs transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:border-white/30 active:scale-100 md:text-sm"
            >
              <div className="absolute inset-x-0 -top-px mx-auto h-0.5 w-1/2 bg-gradient-to-r from-transparent via-[#cbd5e1] to-transparent shadow-2xl transition-all duration-500 group-hover:w-3/4"></div>
              <div className="absolute inset-x-0 -bottom-px mx-auto h-0.5 w-1/2 bg-gradient-to-r from-transparent via-[#cbd5e1] to-transparent shadow-2xl transition-all duration-500 group-hover:h-px"></div>
              <span className="relative text-white">Testimonials</span>
            </button>
          </div>
          <h2 className="from-foreground/60 via-foreground to-foreground/60 dark:from-muted-foreground/55 dark:via-foreground dark:to-muted-foreground/55 mt-5 bg-gradient-to-r bg-clip-text text-center text-4xl font-semibold tracking-tighter text-transparent md:text-[54px] md:leading-[60px] __className_bb4e88 relative z-10">
            What our users say
          </h2>

          <p className="mt-5 relative z-10 text-center text-lg text-zinc-500">
            From intuitive design to powerful features, our app has become an essential tool for users around the world.
          </p>
        </div>

        <div className="my-16 flex max-h-[738px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]">
          <div>
            <Marquee pauseOnHover vertical className="[--duration:20s]">
              {firstColumn.map((testimonial) => (
                <TestimonialCard key={testimonial.username} {...testimonial} />
              ))}
            </Marquee>
          </div>

          <div className="hidden md:block">
            <Marquee reverse pauseOnHover vertical className="[--duration:25s]">
              {secondColumn.map((testimonial) => (
                <TestimonialCard key={testimonial.username} {...testimonial} />
              ))}
            </Marquee>
          </div>

          <div className="hidden lg:block">
            <Marquee pauseOnHover vertical className="[--duration:30s]">
              {thirdColumn.map((testimonial) => (
                <TestimonialCard key={testimonial.username} {...testimonial} />
              ))}
            </Marquee>
          </div>
        </div>

        <div className="-mt-8 flex justify-center">
          <button className="group relative inline-flex items-center gap-2 rounded-full border border-white/20 glass px-6 py-3 text-sm font-medium text-white transition-all hover:border-white/30 hover:shadow-xl hover:scale-105 active:scale-95 glow-on-hover">
            <div className="absolute inset-x-0 -top-px mx-auto h-px w-3/4 bg-gradient-to-r from-transparent via-[#cbd5e1] to-transparent"></div>
            <div className="absolute inset-x-0 -bottom-px mx-auto h-px w-3/4 bg-gradient-to-r from-transparent via-[#cbd5e1] to-transparent"></div>
            <svg
              className="h-4 w-4 text-[#cbd5e1] transition-transform group-hover:scale-110"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"></path>
            </svg>
            Share your experience
          </button>
        </div>
      </div>
    </section>
  )
}
