import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './index.css' // Make sure Tailwind is imported here

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center">
        <h2 className="text-2xl font-bold text-indigo-600 mb-4">
          ✅ Tailwind Test Passed
        </h2>
        <p className="text-gray-700 mb-6">
          If this card looks styled — rounded corners, shadows, colors, and spacing — then Tailwind is working!
        </p>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded transition">
          Confirm Tailwind
        </button>
      </div>
    </div>
  );
}

export default App
