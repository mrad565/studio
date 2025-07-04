import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/page';
import './app/globals.css';
import { Toaster } from "./components/ui/toaster";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>
);