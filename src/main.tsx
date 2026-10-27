import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Fonts are bundled (no Google Fonts CDN), so the app looks identical offline
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
