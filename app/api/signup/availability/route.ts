import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const emailSchema = z.object({
	email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
})

export async function POST(request: Request) {
	try {
		const body = await request.json()
		const result = emailSchema.safeParse(body)

		if (!result.success) {
			return NextResponse.json(
				{ available: false, error: result.error.errors[0]?.message ?? 'Enter a valid email address.' },
				{ status: 400 }
			)
		}

		const { email } = result.data
		const existingUser = await prisma.user.findFirst({
			where: {
				email: {
					equals: email,
					mode: 'insensitive',
				},
			},
			select: { id: true },
		})

		if (existingUser) {
			return NextResponse.json(
				{
					available: false,
					error: 'This email is already registered. Use another email or sign in.',
				},
				{ status: 409 }
			)
		}

		return NextResponse.json({ available: true }, { status: 200 })
	} catch (error) {
		console.error('Signup availability check failed:', error)
		return NextResponse.json(
			{ available: false, error: "Couldn't verify email right now." },
			{ status: 500 }
		)
	}
}
