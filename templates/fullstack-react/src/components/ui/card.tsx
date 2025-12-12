/**
 * Card Component
 * Demonstrates dark mode support with Tailwind CSS v4.1
 */
import type { ReactNode } from 'react'

interface CardProps {
  title: string
  children: ReactNode
  className?: string
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-lg shadow-md p-6 bg-white dark:bg-gray-800 ${className}`}>
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  )
}
