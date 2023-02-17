import React from 'react';
import * as FlexLayout from 'flexlayout-react';
import Debugger from '../Debugger/Debugger';
import MiniUI from '../MiniUI/MiniUI';
import {
    createUIState,
    PaneComponentInfo,
    PaneIdToViewType,
    UIProps,
    UISettings,
    UIState,
    UIStateContext,
    UIStateHelper,
} from '../../contexts/UIStateContext';
import { maxPanes, webgpuDebuggerLocalStorageId } from '../../globals';

import ObjectVis from '../../views/ObjectVis/ObjectVis';
import ResultVis from '../../views/ResultVis/ResultVis';
import ReplayVis from '../../views/objectViews/ReplayVis/ReplayVis';
import StateVis from '../../views/StateVis/StateVis';
import StepsVis from '../../views/StepsVis/StepsVis';

import './App.css';

const StateVisComponentInfo: PaneComponentInfo = { component: StateVis, closable: false, defaultName: 'State' };
const StepsVisComponentInfo: PaneComponentInfo = { component: StepsVis, closable: false, defaultName: 'Steps' };
const ObjectVisComponentInfo: PaneComponentInfo = { component: ObjectVis, closable: true, defaultName: 'Data' };
const ResultVisComponentInfo: PaneComponentInfo = { component: ResultVis, closable: false, defaultName: 'Result' };
const ReplayVisComponentInfo: PaneComponentInfo = { component: ReplayVis, closable: false, defaultName: 'Resources' };

function getPersistentSettings(uiStateHelper: UIStateHelper): {
    layout?: FlexLayout.IJsonModel;
    paneIdToViewType: PaneIdToViewType;
    uiSettings?: UISettings;
} {
    try {
        const persistentSettingsStr = localStorage.getItem(webgpuDebuggerLocalStorageId);
        if (persistentSettingsStr && persistentSettingsStr.length > 1 && persistentSettingsStr[0] === '{') {
            const settings = JSON.parse(persistentSettingsStr);
            if (settings && settings.layout && settings.paneTypes) {
                const paneTypes = settings.paneTypes as Record<string, string>;
                const paneIdToViewType: PaneIdToViewType = {};
                for (const [paneId, componentName] of Object.entries(paneTypes)) {
                    const componentInfo = uiStateHelper.getComponentInfoByComponentName(componentName);
                    paneIdToViewType[paneId] = { componentInfo, name: componentInfo.defaultName, data: null };
                }
                return {
                    layout: settings.layout as FlexLayout.IJsonModel,
                    paneIdToViewType,
                    uiSettings: settings.uiSettings || {},
                };
            }
        }
    } catch (e) {
        //
    }

    // prettier-ignore
    const paneIdToViewType: PaneIdToViewType = {
            pane0: { componentInfo: StepsVisComponentInfo,  name: 'Steps',  data: null },
            pane1: { componentInfo: ResultVisComponentInfo, name: 'Result', data: null },
            pane2: { componentInfo: StateVisComponentInfo,  name: 'State',  data: null },
            pane3: { componentInfo: ReplayVisComponentInfo, name: 'Resources',  data: null },
            pane5: { componentInfo: ObjectVisComponentInfo, name: 'Data',  data: null },  // These two are swapped intentionally
            pane4: { componentInfo: ObjectVisComponentInfo, name: 'Data',  data: null },  // to get them on mru list in order
        };
    return { paneIdToViewType };
}

function normalizeUISettings(uiSettings: Partial<UISettings> = {}) {
    return {
        ...createUIState().uiSettings,
        ...uiSettings,
    };
}

class App extends React.Component<UIProps, UIState> {
    #layout?: FlexLayout.IJsonModel;

    constructor(props: UIProps) {
        super(props);
        const { uiStateHelper } = props;

        uiStateHelper.registerPaneComponent('StateVis', StateVisComponentInfo);
        uiStateHelper.registerPaneComponent('StepsVis', StepsVisComponentInfo);
        uiStateHelper.registerPaneComponent('ObjectVis', ObjectVisComponentInfo);
        uiStateHelper.registerPaneComponent('ResultVis', ResultVisComponentInfo);
        uiStateHelper.registerPaneComponent('ReplayVis', ReplayVisComponentInfo);

        const { layout, paneIdToViewType, uiSettings } = getPersistentSettings(uiStateHelper);
        this.#layout = layout;

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
            uiSettings: normalizeUISettings(uiSettings),
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
                <div className="wgdb">{this.state.fullUI ? <Debugger initialLayout={this.#layout} /> : <MiniUI />}</div>
            </UIStateContext.Provider>
        );
    }
}

export default App;
