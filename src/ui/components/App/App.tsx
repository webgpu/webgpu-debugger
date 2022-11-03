import React from 'react';
import Debugger from '../Debugger/Debugger';
import MiniUI from '../MiniUI/MiniUI';
import {
    createUIState,
    PaneComponentInfo,
    PaneIdToViewType,
    UIProps,
    UIState,
    UIStateContext,
} from '../../contexts/UIStateContext';
import { maxPanes } from '../../globals';

import ObjectVis from '../../views/ObjectVis/ObjectVis';
import ResultVis from '../../views/ResultVis/ResultVis';
import ReplayVis from '../../views/objectViews/ReplayVis/ReplayVis';
import StateVis from '../../views/StateVis/StateVis';
import StepsVis from '../../views/StepsVis/StepsVis';

import './App.css';

class App extends React.Component<UIProps, UIState> {
    constructor(props: UIProps) {
        super(props);
        const { uiStateHelper } = props;

        const StateVisComponentInfo: PaneComponentInfo = { component: StateVis, closable: false };
        const StepsVisComponentInfo: PaneComponentInfo = { component: StepsVis, closable: false };
        const ObjectVisComponentInfo: PaneComponentInfo = { component: ObjectVis, closable: true };
        const ResultVisComponentInfo: PaneComponentInfo = { component: ResultVis, closable: false };
        const ReplayVisComponentInfo: PaneComponentInfo = { component: ReplayVis, closable: false };

        uiStateHelper.registerPaneComponent('StateVis', StateVisComponentInfo);
        uiStateHelper.registerPaneComponent('StepsVis', StepsVisComponentInfo);
        uiStateHelper.registerPaneComponent('ObjectVis', ObjectVisComponentInfo);
        uiStateHelper.registerPaneComponent('ResultVis', ResultVisComponentInfo);
        uiStateHelper.registerPaneComponent('ReplayVis', ReplayVisComponentInfo);

        // prettier-ignore
        const paneIdToViewType: PaneIdToViewType = {
            pane0: { componentInfo: StepsVisComponentInfo,  name: 'Steps',  data: null },
            pane1: { componentInfo: ResultVisComponentInfo, name: 'Result', data: null },
            pane2: { componentInfo: StateVisComponentInfo,  name: 'State',  data: null },
            pane3: { componentInfo: ReplayVisComponentInfo, name: 'Resources',  data: null },
            pane5: { componentInfo: ObjectVisComponentInfo, name: 'Data',  data: null },  // These two are swapped intentionally
            pane4: { componentInfo: ObjectVisComponentInfo, name: 'Data',  data: null },  // to get them on mru list in order
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
