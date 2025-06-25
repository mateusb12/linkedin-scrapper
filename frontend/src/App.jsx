import { useState } from 'react'
import JobCoreViewer from "./components/swiper/JobCoreViewer.jsx";

function App() {
  const [count, setCount] = useState(0)

  return (
    <JobCoreViewer/>
  )
}

export default App
