import React from 'react';

// TileContext is used to pass down from the App a function
// that Value and lower level objects can use to provide a draggable
// Component that will create a new pane.
interface TileContext {
    onAddPaneViaDrag(
        event: React.MouseEvent | React.TouchEvent<HTMLButtonElement>,
        name: string,
        data: any,
        freePaneId: string
    ): void;
}

export const TileContext = React.createContext<TileContext>({} as TileContext);
