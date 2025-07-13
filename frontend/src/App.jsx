import { useState } from 'react'
import JobCoreViewer from "./components/swiper/JobCoreViewer.jsx";
import JobDashboard from "./components/data-fetching/FetchConfig.jsx";

function App() {
  const [count, setCount] = useState(0)

  return (
    <JobDashboard/>
  )
}

export default App
