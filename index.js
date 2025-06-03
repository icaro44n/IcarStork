import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Importa o CSS do Tailwind
import AppWrapper from './App'; // Importa o componente principal da sua aplicação
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

// Para medir o desempenho do seu aplicativo (opcional)
reportWebVitals();
