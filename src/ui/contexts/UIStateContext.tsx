import React from 'react';
import StepsVis from '../views/StepsVis/StepsVis';
import ResultVis from '../views/ResultVis/ResultVis';
import ReplayAPI from '../ReplayAPI';
import { Replay } from '../fudge';

export type PaneComponent = React.FunctionComponent<{ data: any }> | React.ComponentClass<{ data: any }>;
type ViewData = {
    component: PaneComponent;
    data: unknown;
};

export type PaneIdToViewType = Record<string, ViewData>;

export type UIState = {
    paneIdToViewType: PaneIdToViewType;
    fullUI: boolean;
    replays: Replay[];
};

export type SetStateArgs = Partial<UIState>;

export function createUIState(state: SetStateArgs = {}): UIState {
    return {
        ...{
            paneIdToViewType: {},
            fullUI: false,
            replays: [],
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

    registerAPI(api: ReplayAPI) {
        this.replayAPI = api;
    }

    setMostRecentPaneIdForComponentType = (component: PaneComponent, paneId: string) => {
        this.mruViewsByType.set(component, this.mruViewsByType.get(component) || []);
        const mru = this.mruViewsByType.get(component)!;
        const ndx = mru.indexOf(paneId);
        if (ndx >= 0) {
            mru.splice(ndx, 1);
        }
        mru.unshift(paneId);
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

    setPaneViewType = (paneId: string, component: PaneComponent, data: any): void => {
        const paneIdToViewType = { ...this.state.paneIdToViewType };
        paneIdToViewType[paneId] = { component, data };
        this.setState({ paneIdToViewType });
        this.setMostRecentPaneIdForComponentType(component, paneId);
    };

    addReplay = (replay: Replay) => {
        this.setState({
            replays: [...this.state.replays, replay],
        });
        this.setReplay(replay);
    };

    setReplay = (replay: Replay) => {
        const paneId = this.getMostRecentPaneIdForComponentType(StepsVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, StepsVis, replay);
        this.setFullUI(true);
    };

    setResult = (canvas: HTMLCanvasElement) => {
        const paneId = this.getMostRecentPaneIdForComponentType(ResultVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, ResultVis, canvas);
    };

    playTo(replay: Replay, id: number[]) {
        this.replayAPI?.playTo(replay, id);
    }
}

type UIContextData = {
    helper: UIStateHelper;
};

export const uiStateHelper = new UIStateHelper();
export const UIStateContext = React.createContext<UIContextData>({
    helper: uiStateHelper,
});
