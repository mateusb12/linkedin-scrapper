import { useState } from 'react'
import JobSwiper from "./components/swiper/JobSwiper.jsx";

function App() {
  const [count, setCount] = useState(0)

  return (
    <JobSwiper/>
  )
}

export default App
