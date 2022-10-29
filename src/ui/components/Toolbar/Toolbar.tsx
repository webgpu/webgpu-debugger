import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

export default function Toolbar() {
    const { helper } = useContext(UIStateContext);
    return (
        <div className="spector2-toolbar">
            <button onClick={helper.capture}>🔴</button>
            <button>Load</button>
            <button>Save</button>
            <button onClick={helper.toggleUI}>⌃</button>
        </div>
    );
}
