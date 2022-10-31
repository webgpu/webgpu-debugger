import React from 'react';
import Debugger from '../Debugger/Debugger';
import MiniUI from '../MiniUI/MiniUI';
import { createUIState, PaneIdToViewType, UIProps, UIState, UIStateContext } from '../../contexts/UIStateContext';
import { maxPanes } from '../../globals';

import FramesVis from '../../views/FramesVis/FramesVis';
import ObjectVis from '../../views/ObjectVis/ObjectVis';
import ResultVis from '../../views/ResultVis/ResultVis';
import StateVis from '../../views/StateVis/StateVis';
import StepsVis from '../../views/StepsVis/StepsVis';

import './App.css';

class App extends React.Component<UIProps, UIState> {
    constructor(props: UIProps) {
        super(props);
        const { uiStateHelper } = props;

        const paneIdToViewType: PaneIdToViewType = {
            pane0: { component: FramesVis, name: 'Frames', data: null },
            pane1: { component: StepsVis, name: 'Steps', data: null },
            pane2: { component: ResultVis, name: 'Result', data: null },
            pane3: { component: StateVis, name: 'State', data: null },
            pane4: { component: ObjectVis, name: 'Data', data: null },
        };

        const freePaneIds: string[] = [];
        for (let i = 0; i < maxPanes; ++i) {
            const paneId = `pane${i}`;
            if (!paneIdToViewType[paneId]) {
                freePaneIds.push(paneId);
            }
        }

        this.state = createUIState({
            paneIdToViewType,
            freePaneIds,
        });

        uiStateHelper.setStateFn = (...args) => {
            this.setState(...args);
        };
    }
    render() {
        const { uiStateHelper } = this.props;
        uiStateHelper.updateState(this.state);
        return (
            <UIStateContext.Provider value={{ helper: uiStateHelper }}>
                <div className="spector2">{this.state.fullUI ? <Debugger /> : <MiniUI />}</div>
            </UIStateContext.Provider>
        );
    }
}

export default App;
