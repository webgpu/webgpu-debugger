import React from 'react';

interface TileContext {
    onAddPaneViaDrag(
        event: React.MouseEvent | React.TouchEvent<HTMLButtonElement>,
        name: string,
        data: any,
        freePaneId: string
    ): void;
}

export const TileContext = React.createContext<TileContext>({} as TileContext);
