import { useState, useEffect } from 'react'
import { Card } from './components/ui/card'
import { Button } from './components/ui/button'

interface HealthStatus {
  status: string
  timestamp: number
}

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(console.error)
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card title="Welcome to {{projectNamePascal}}" className="max-w-md w-full">
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your fullstack React app is running on Cloudflare Workers.
        </p>

        {health && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4 mb-6">
            <p className="text-green-800 dark:text-green-300">
              API Status: <span className="font-semibold">{health.status}</span>
            </p>
            <p className="text-green-600 dark:text-green-400 text-sm">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="primary">Get Started</Button>
          <Button variant="secondary">Learn More</Button>
        </div>

        <p className="mt-6 text-sm text-brand dark:text-brand-light">
          Styled with Tailwind CSS v4.1
        </p>
      </Card>
    </div>
  )
}
