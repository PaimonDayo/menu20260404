import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import UILab from './UILab.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UILab />
  </StrictMode>,
);
