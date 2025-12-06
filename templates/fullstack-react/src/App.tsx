import { useState, useEffect } from 'react'

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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to {{projectNamePascal}}
        </h1>
        <p className="text-gray-600 mb-6">
          Your fullstack React app is running on Cloudflare Workers.
        </p>
        {health && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-green-800">
              API Status: <span className="font-semibold">{health.status}</span>
            </p>
            <p className="text-green-600 text-sm">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
