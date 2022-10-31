import React from 'react';
import ReplayAPI from '../ReplayAPI';
import { Replay } from '../../replay';
import { getPathForLastStep } from '../lib/replay-utils';
import { arrayRemoveElementByValue } from '../lib/array-utils';

import StateVis from '../views/StateVis/StateVis';
import StepsVis from '../views/StepsVis/StepsVis';
import ObjectVis from '../views/ObjectVis/ObjectVis';
import ResultVis from '../views/ResultVis/ResultVis';

export type PaneComponent = React.FunctionComponent<{ data: any }> | React.ComponentClass<{ data: any }>;
type ViewData = {
    component: PaneComponent;
    name: string;
    data: unknown;
};

export type PaneIdToViewType = Record<string, ViewData>;
export type ReplayInfo = {
    replay: Replay;
    lastPath: number[];
};

export type UIState = {
    paneIdToViewType: PaneIdToViewType;
    fullUI: boolean;
    replays: ReplayInfo[];
    freePaneIds: string[];
};

export type SetStateArgs = Partial<UIState>;

export function createUIState(state: SetStateArgs = {}): UIState {
    return {
        ...{
            paneIdToViewType: {},
            fullUI: false,
            replays: [],
            freePaneIds: [],
        },
        ...state,
    };
}

export interface UIProps {
    uiStateHelper: UIStateHelper;
}

export type UIStateSetterFn = <K extends keyof UIState>(
    state:
        | UIState
        | ((prevState: Readonly<UIState>, props: Readonly<UIProps>) => UIState | Pick<UIState, K> | null)
        | Pick<UIState, K>
        | null,
    callback?: (() => void) | undefined
) => void;

export class UIStateHelper {
    setStateFn: UIStateSetterFn = () => {};
    state: Readonly<UIState> = createUIState();
    stateUpdateQueued = false;

    setState: UIStateSetterFn = (state: any) => {
        if (!this.stateUpdateQueued) {
            this.stateUpdateQueued = true;
            queueMicrotask(() => {
                this.stateUpdateQueued = false;
                this.setStateFn(this.state);
            });
        }
        Object.assign(this.state, state);
    };

    updateState = (state: UIState) => {
        if (this.stateUpdateQueued) {
            console.warn('!!!!! Ugh!! Attempt to update more state before previous state has been submitted');
        }
        this.state = { ...state };
    };

    // map of PaneComponents to lru paneIds where the first
    // entry is the most recently used view of that type.
    mruViewsByType: Map<PaneComponent, string[]> = new Map();
    replayAPI?: ReplayAPI;

    setFullUI = (full: boolean) => {
        this.setState({ fullUI: full });
    };

    toggleUI = () => {
        this.setFullUI(!this.state.fullUI);
    };

    capture = () => {
        this.replayAPI?.captureFrame();
    };

    registerAPI(api: Partial<ReplayAPI>) {
        this.replayAPI = api as ReplayAPI;
    }

    setMostRecentPaneIdForComponentType = (component: PaneComponent, paneId: string) => {
        this.mruViewsByType.set(component, this.mruViewsByType.get(component) || []);
        const mru = this.mruViewsByType.get(component)!;
        arrayRemoveElementByValue(mru, paneId);
        mru.unshift(paneId);
    };

    setMostRecentPaneByPaneId = (paneId: string) => {
        const viewType = this.state.paneIdToViewType[paneId];
        if (viewType) {
            this.setMostRecentPaneIdForComponentType(viewType.component, paneId);
        }
    };

    getMostRecentPaneIdForComponentType = (component: PaneComponent): string | undefined => {
        // This is a hack: See Debugger.tsx
        if (!this.mruViewsByType.get(component)) {
            for (const [paneId, viewData] of Object.entries(this.state.paneIdToViewType)) {
                this.setMostRecentPaneIdForComponentType(viewData.component, paneId);
            }
        }
        const mru = this.mruViewsByType.get(component)!;
        return mru.length ? mru[0] : undefined;
    };

    setPaneViewType = (paneId: string, component: PaneComponent, name: string, data: any): void => {
        const paneIdToViewType = { ...this.state.paneIdToViewType };
        paneIdToViewType[paneId] = { component, name, data };
        this.setState({ paneIdToViewType });
        this.setMostRecentPaneIdForComponentType(component, paneId);
    };

    deletePaneByPaneId(paneId: string) {
        // remove from mru list
        const viewType = this.state.paneIdToViewType[paneId]!;
        const component = viewType.component;
        const mru = this.mruViewsByType.get(component)!;
        arrayRemoveElementByValue(mru, paneId);

        // remove from paneIdToViewType list
        const paneIdToViewType = { ...this.state.paneIdToViewType };
        delete paneIdToViewType[paneId];

        // add to freePaneIds
        const freePaneIds = [paneId, ...this.state.freePaneIds];

        this.setState({ paneIdToViewType, freePaneIds });
    }

    /**
     * Called to find an existing view and change to to show
     * this object.
     * @param name Name to display in tab
     * @param data Data for ObjectVis
     */
    setObjectView = (name: string, data: any) => {
        const paneId = this.getMostRecentPaneIdForComponentType(ObjectVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, ObjectVis, name, data);
    };

    /**
     * Called to add a new view
     * @param name Name to display in tab
     * @param data Data for ObjectVis
     * @param freePaneId Id of unused Pane
     */
    addObjectView = (name: string, data: any, freePaneId: string) => {
        this.setPaneViewType(freePaneId, ObjectVis, name, data);
        // remove from freePaneIds
        const freePaneIds = [...this.state.freePaneIds];
        arrayRemoveElementByValue(freePaneIds, freePaneId);
        this.setState({ freePaneIds });
    };

    addReplay = (replay: Replay) => {
        const lastPath = getPathForLastStep(replay);
        const replayInfo = { replay, lastPath };
        this.setState({
            replays: [...this.state.replays, replayInfo],
        });
        this.setReplay(replayInfo);
    };

    setReplay = (replayInfo: ReplayInfo) => {
        const paneId = this.getMostRecentPaneIdForComponentType(StepsVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, StepsVis, 'Steps', replayInfo);
        this.setFullUI(true);
    };

    setResult = (canvas: HTMLCanvasElement) => {
        const paneId = this.getMostRecentPaneIdForComponentType(ResultVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, ResultVis, 'Result', canvas);
    };

    setGPUState = (state: any) => {
        const paneId = this.getMostRecentPaneIdForComponentType(StateVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        console.log(state);
        this.setPaneViewType(paneId, StateVis, 'State', state);
    };

    async playTo(replay: Replay, path: number[]) {
        const gpuState = await replay.replayTo(path);
        this.setGPUState(gpuState);
    }
}

type UIContextData = {
    helper: UIStateHelper;
};

export const uiStateHelper = new UIStateHelper();
export const UIStateContext = React.createContext<UIContextData>({
    helper: uiStateHelper,
});
