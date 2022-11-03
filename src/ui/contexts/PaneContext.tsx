import React from 'react';

// PaneContext is used to pass down from the App a function
// that Value and lower level objects can use to provide a draggable
// Component that will create a new pane.
interface PaneContext {
    paneId: string;
}

export const PaneContext = React.createContext<PaneContext>({} as PaneContext);
