import React from 'react';
import { createTilePanes, TileBranchSubstance, TileContainer, TileProvider, TilePane } from 'react-tile-pane';
import Toolbar from '../Toolbar/Toolbar';

import BufferVis from '../../views/BufferVis/BufferVis';
import FramesVis from '../../views/FramesVis/FramesVis';
import ResultVis from '../../views/ResultVis/ResultVis';
import StepsVis from '../../views/StepsVis/StepsVis';

import Pane from '../Pane/Pane';
import { uiState } from '../../contexts/UIStateContext';

import './Debugger.css';
import './react-tile-pane.css';

const paneList: TilePane[] = [];
const names: Record<string, any> = {}; // TODO: Figure out what this maps to

let nextPaneId = 0;
function addPane(componentFn: (data: any) => React.ReactElement, data: any) {
    const temp: Record<string, React.ReactNode> = {};
    const paneId = `pane${nextPaneId++}`;
    uiState.setPaneViewType(paneId, componentFn, data);
    temp[paneId] = <Pane id={paneId} />;
    const [pList, nameOb] = createTilePanes(temp);
    paneList.push(...pList);
    Object.assign(names, nameOb);
}

addPane(FramesVis, ['frame1', 'frame2']);
addPane(StepsVis, null);
addPane(ResultVis, null);
addPane(BufferVis, null);

const rootPane: TileBranchSubstance = {
    children: [
        { children: [names.pane0] },
        {
            isRow: true,
            grow: 5,
            children: [
                { children: names.pane1 },
                {
                    children: [{ children: names.pane2 }, { children: names.pane3 }],
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
                <div className="spector2-tiles" style={{ border: '#afafaf solid 2px', width: '100%', height: '100%' }}>
                    <TileContainer />
                </div>
                {/* <DraggableTitle name={names.banana}>Drag this banana🍌</DraggableTitle> */}
            </TileProvider>
        </div>
    );
};

export default Debugger;
