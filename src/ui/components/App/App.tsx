import React, { useState } from 'react';
import Button from '../Button/Button';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <React.Fragment>
      <h1>Spector2</h1>
      <p>You clicked {count} times</p>
      <Button label="click me" onClick={() => { setCount(count + 1); }} ></Button>
    </React.Fragment>
  );
}