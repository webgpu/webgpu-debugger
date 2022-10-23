import React, { useState } from 'react';
import {
  createTilePanes,
  DraggableTitle,
  TileBranchSubstance,
  TileContainer,
  TileProvider,
  TilePane,
} from 'react-tile-pane';
import Toolbar from '../Toolbar/Toolbar';
import BufferVis from '../../views/BufferVis/BufferVis';
import FramesVis from '../../views/FramesVis/FramesVis';
import StepsVis from '../../views/StepsVis/StepsVis';
import Pane from '../Pane/Pane';
import { UIState, UIStateContext } from '../../contexts/UIStateContext';

import './App.css';
import './react-tile-pane.css';

const paneStyle: React.CSSProperties = {
  width: '100%',
  height: ' 100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const uiState = new UIState();

const paneList: TilePane[] = [];
const names: Record<string, any> = {};  // TODO: Figure out what this maps to

let nextPaneId = 0;
function addPane(componentFn: () => JSX.Element, data: any) {
  const temp: Record<string, React.ReactNode> = {};
  const paneId = `pane${nextPaneId++}`;
  uiState.setPaneViewType(paneId, componentFn, data);
  temp[paneId] = <Pane id={paneId} />
  const [pList, nameOb] = createTilePanes(temp);
  paneList.push(...pList);
  Object.assign(names, nameOb);
};

addPane(FramesVis, ['frame1', 'frame2']);
addPane(StepsVis, [12, 34, 45]);
addPane(BufferVis, null);

const rootPane: TileBranchSubstance = {
  children: [
    { children: [names.pane0]},
    {
      isRow: true,
      grow: 5,
      children: [
        { children: names.pane1 },
        { children: names.pane2 },
      ],
    },
  ],
}

const App: React.FC = () => {
  return (
    <div className="spector2">
      <UIStateContext.Provider value={uiState}>
        <Toolbar/>
        <TileProvider tilePanes={paneList} rootNode={rootPane}>
            <div className="spector2-tiles" style={{ border: '#afafaf solid 2px', width: '100%', height: '100%' }}>
              <TileContainer />
            </div>
          {/* <DraggableTitle name={names.banana}>Drag this banana🍌</DraggableTitle> */}
        </TileProvider>
      </UIStateContext.Provider>
    </div>
  )
}

export default App
