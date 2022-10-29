import React from 'react';
import { createTilePanes, TileBranchSubstance, TileContainer, TileProvider } from 'react-tile-pane';
import Toolbar from '../Toolbar/Toolbar';

import Pane from '../Pane/Pane';

import './Debugger.css';
import './react-tile-pane.css';

// react-tile-pane refers to panes by id
// we what we do is make each new pane with a new id `pane<id>`
//
// Separately, in the uiState, we associate that id
// with a component and a piece of data so we can put that component
// in that pane with that data

// TODO: Make it so the user can add more panes. I had some code that added
// panes on demand but ending up switching to code that just makes N panes
// and then ideally these panes would be stored on unused-pane list.
//
// It bugs me that these 3 things, paneList, names, and rootPane are
// global. I think they could go into the component but as the component is
// created and destroyed they'd lose their state.
const maxPanes = 10;
const [paneList, names] = createTilePanes(
    Object.fromEntries(
        new Array(maxPanes).fill(0).map((_, ndx) => {
            const paneId = `pane${ndx}`;
            return [paneId, <Pane key={paneId} id={paneId} />];
        })
    )
);

const rootPane: TileBranchSubstance = {
    children: [
        { children: [names.pane0] },
        {
            isRow: true,
            grow: 5,
            children: [
                { children: names.pane1 },
                {
                    children: [{ children: names.pane2 }, { children: names.pane3 }, { children: names.pane4 }],
                },
            ],
        },
    ],
};

const Debugger: React.FC = () => {
    return (
        <div className="spector2-debugger">
            <Toolbar />
            <TileProvider tilePanes={paneList} rootNode={rootPane}>
                <div className="spector2-tiles">
                    <TileContainer />
                </div>
                {/* <DraggableTitle name={names.banana}>Drag this banana🍌</DraggableTitle> */}
            </TileProvider>
        </div>
    );
};

export default Debugger;
