"use client"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { GitBranch } from "lucide-react"

export function StickyFooter() {
  const [isAtBottom, setIsAtBottom] = useState(false)

  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY
          const windowHeight = window.innerHeight
          const documentHeight = document.documentElement.scrollHeight
          const isNearBottom = scrollTop + windowHeight >= documentHeight - 100

          setIsAtBottom(isNearBottom)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {isAtBottom && (
        <motion.div
          className="fixed z-50 bottom-0 left-0 w-full h-80 flex justify-center items-center glass"
          style={{
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 20, 25, 0.98) 100%)",
            boxShadow: "0 -8px 32px rgba(226, 232, 240, 0.1)",
          }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="relative overflow-hidden w-full h-full flex justify-end px-12 text-right items-start py-12">
            <div className="absolute inset-0 shimmer"></div>

            <motion.div
              className="flex flex-row space-x-12 sm:space-x-16 md:space-x-24 text-sm sm:text-lg md:text-xl relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <ul className="space-y-2">
                <li className="hover:text-white cursor-pointer transition-all duration-300 text-[#cbd5e1] hover:translate-x-1">
                  Home
                </li>
                <li className="hover:text-white cursor-pointer transition-all duration-300 text-[#cbd5e1] hover:translate-x-1">
                  Features
                </li>
                <li className="hover:text-white cursor-pointer transition-all duration-300 text-[#cbd5e1] hover:translate-x-1">
                  Pricing
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="hover:text-white cursor-pointer transition-all duration-300 text-[#cbd5e1] hover:translate-x-1">
                  Twitter
                </li>
                <li className="hover:text-white cursor-pointer transition-all duration-300 text-[#cbd5e1] hover:translate-x-1">
                  Discord
                </li>
                <li className="hover:text-white cursor-pointer transition-all duration-300 text-[#cbd5e1] hover:translate-x-1">
                  <a href="/policy">Privacy</a>
                </li>
              </ul>
            </motion.div>

            <motion.div
              className="absolute bottom-4 left-8 flex items-center gap-3"
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <GitBranch className="w-12 h-12 sm:w-16 sm:h-16 text-[#64748b]" />
              <span className="text-[60px] sm:text-[100px] font-bold select-none bg-gradient-to-t from-[#475569] to-[#64748b] bg-clip-text text-transparent">
                Fork AI
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
