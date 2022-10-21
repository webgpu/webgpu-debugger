import React, { useState } from 'react';
import {
  createTilePanes,
  DraggableTitle,
  TileBranchSubstance,
  TileContainer,
  TileProvider,
} from 'react-tile-pane';
import Toolbar from '../Toolbar/Toolbar';
import BufferViz from '../../views/BufferVis/BufferVis';

import './App.css';
import './react-tile-pane.css';

const paneStyle: React.CSSProperties = {
  width: '100%',
  height: ' 100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

function Arbutus() {
  const [number, count] = useState(1)
  return (
    <div className="spector2-tile" onClick={() => count((n) => n + 1)} style={paneStyle}>
      {number} catties of arbutus
    </div>
  )
}

function Apple() {
  return <div className="spector2-tile" style={paneStyle}>apple</div>
}

const [paneList, names] = createTilePanes({
  frames: <BufferViz />,
  arbutus: <Arbutus />,
  pcherry: <div className="spector2-tile"style={paneStyle}>cherry</div>,
  apple: <Apple />,
  banana: <div className="spector2-tile" style={paneStyle}>banana</div>,
  lemon: <div className="spector2-tile" style={paneStyle}>lemon</div>,
  mango: <div className="spector2-tile" style={paneStyle}>mango</div>,
  pomelo: <div className="spector2-tile"style={paneStyle}>pomelo</div>,
});

const rootPane: TileBranchSubstance = {
  children: [
    { children: [names.frames]},
    {
      isRow: true,
      grow: 2,
      children: [
        { children: names.arbutus },
        { children: names.lemon },
      ],
    },
  ],
}

const App: React.FC = () => {
  return (
    <div className="spector2">
      <Toolbar/>
      <TileProvider tilePanes={paneList} rootNode={rootPane}>
          <div className="spector2-tiles" style={{ border: '#afafaf solid 2px', width: '100%', height: '100%' }}>
            <TileContainer />
          </div>
        {/* <DraggableTitle name={names.banana}>Drag this banana🍌</DraggableTitle> */}
      </TileProvider>
    </div>
  )
}

export default App
