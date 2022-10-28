import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

interface PaneProps {
    id: string;
}

/**
 * This is just a holder or a view/viz
 */
const Pane: React.FC<PaneProps> = ({ id }) => {
    const { helper } = useContext(UIStateContext);
    const { state } = helper;
    const viewData = state.paneIdToViewType[id];
    // This is a hack. See Debugger.tsx
    return viewData ? React.createElement(viewData.component, { data: viewData.data }) : <div>not ready</div>;
};

export default Pane;
