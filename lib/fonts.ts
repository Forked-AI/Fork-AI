import { Fraunces, Manrope } from "next/font/google";

export const fraunces = Fraunces({
	subsets: ["latin"],
	variable: "--font-serif",
	display: "swap",
});

export const manrope = Manrope({
	subsets: ["latin"],
	variable: "--font-sans",
	display: "swap",
});
