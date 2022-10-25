import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

export default function Toolbar() {
    const uiState = useContext(UIStateContext);
    return (
        <div className="spector2-toolbar">
            <button onClick={uiState.capture}>🔴</button>
            <button onClick={uiState.toggleUI}>⌃</button>
        </div>
    );
}
