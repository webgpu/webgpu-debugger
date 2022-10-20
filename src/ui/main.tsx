import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';

export default function main(elem: HTMLElement) {
  // @ts-ignore
  const root = ReactDOM.createRoot(elem);
  root.render(<App/>);
};