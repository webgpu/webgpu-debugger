import React from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

interface PaneProps {
    id: string;
}

/**
 * This is just a holder or a view/viz
 */
const Pane: React.FC<PaneProps> = ({ id }) => {
    return (
        <UIStateContext.Consumer>
            {({ paneIdToViewType }) => {
                const { component, data } = paneIdToViewType[id];
                return React.createElement(component, { data });
            }}
        </UIStateContext.Consumer>
    );
};

export default Pane;
