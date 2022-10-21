import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';

export default function main() {
  const elem = document.createElement('div');
  document.body.appendChild(elem);
  // @ts-ignore
  const root = ReactDOM.createRoot(elem);
  root.render(<App/>);
};