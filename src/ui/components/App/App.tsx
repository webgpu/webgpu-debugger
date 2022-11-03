import React from 'react';
import Debugger from '../Debugger/Debugger';
import MiniUI from '../MiniUI/MiniUI';
import { createUIState, PaneIdToViewType, UIProps, UIState, UIStateContext } from '../../contexts/UIStateContext';
import { maxPanes } from '../../globals';

import ObjectVis from '../../views/ObjectVis/ObjectVis';
import ResultVis from '../../views/ResultVis/ResultVis';
import StateVis from '../../views/StateVis/StateVis';
import StepsVis from '../../views/StepsVis/StepsVis';

import './App.css';

class App extends React.Component<UIProps, UIState> {
    constructor(props: UIProps) {
        super(props);
        const { uiStateHelper } = props;

        // prettier-ignore
        const paneIdToViewType: PaneIdToViewType = {
            pane0: { component: StepsVis,  name: 'Steps',  data: null },
            pane1: { component: ResultVis, name: 'Result', data: null },
            pane2: { component: StateVis,  name: 'State',  data: null },
            pane4: { component: ObjectVis, name: 'Data',  data: null },  // These two are swapped intentionally
            pane3: { component: ObjectVis, name: 'Data',  data: null },  // to get them on mru list in order
        };

        uiStateHelper.registerPaneComponent('StateVis', StateVis);
        uiStateHelper.registerPaneComponent('StepsVis', StepsVis);
        uiStateHelper.registerPaneComponent('ObjectVis', ObjectVis);
        uiStateHelper.registerPaneComponent('ResultVis', ResultVis);

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
