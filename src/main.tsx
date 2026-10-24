import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/* No StrictMode: game timelines (audio, launch countdowns) must run once. */
createRoot(document.getElementById('root')!).render(<App />);
