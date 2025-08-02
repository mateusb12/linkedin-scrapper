import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Buffer } from 'buffer';
import {Toaster} from "react-hot-toast";
window.Buffer = Buffer;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
      <Toaster position="top-center" reverseOrder={false} />
  </StrictMode>,
)
