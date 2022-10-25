import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

import './MiniUI.css';

const MiniUI: React.FC = () => {
    const uiState = useContext(UIStateContext);
    return (
        <div className="spector2-mini">
            <button>🔴</button>
            <button onClick={uiState.toggleUI}>⌄</button>
        </div>
    );
};

export default MiniUI;
