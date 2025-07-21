import { useState } from 'react'
import JobCoreViewer from "./components/swiper/JobCoreViewer.jsx";
import FullLayout from "./components/home/FullLayout.jsx";

function App() {
  const [count, setCount] = useState(0)

  return (
    <FullLayout/>
  )
}

export default App
