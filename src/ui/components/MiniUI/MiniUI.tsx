import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

import './MiniUI.css';

const MiniUI: React.FC = () => {
    const { helper } = useContext(UIStateContext);
    return (
        <div className="spector2-mini">
            <button onClick={helper.capture}>🔴</button>
            <button onClick={helper.toggleUI}>⌄</button>
        </div>
    );
};

export default MiniUI;
