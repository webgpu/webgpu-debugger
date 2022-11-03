import React from 'react';
import ReplayAPI from '../ReplayAPI';
import { Replay, ReplayTexture } from '../../replay';
import { getPathForLastStep } from '../lib/replay-utils';
import { arrayRemoveElementByValue } from '../lib/array-utils';
import { requestUnwrappedAdapter } from '../../capture';
import { loadReplay } from '../../replay';

export type PaneComponent = React.FunctionComponent<{ data: any }> | React.ComponentClass<{ data: any }>;
type ViewData = {
    component: PaneComponent;
    name: string;
    data: unknown;
};

export type PaneIdToViewType = Record<string, ViewData>;

export type ReplayInfo = {
    replay?: Replay;
    lastPath: number[];
};

export type TraceInfo = {
    trace: Blob;
    name: string;
    replayUUID: string; // Because react wants state to be flat
};

export type UIState = {
    paneIdToViewType: PaneIdToViewType;
    fullUI: boolean;
    traces: TraceInfo[];
    currentTraceIndex: number;

    // Because react wants state to be flat
    replaysByUUID: Record<string, ReplayInfo>;
    freePaneIds: string[];

    // This exists solely to force react to respond. It's incremented when state arrives from each "replayTo"
    replayCount: number;
};

export type SetStateArgs = Partial<UIState>;

export function createUIState(state: SetStateArgs = {}): UIState {
    return {
        ...{
            paneIdToViewType: {},
            fullUI: false,
            traces: [],
            currentTraceIndex: 0,
            replaysByUUID: {},
            freePaneIds: [],
            replayCount: 0,
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
    paneComponentsByName: Record<string, PaneComponent> = {};

    // map of PaneComponent names to lru paneIds where the first
    // entry is the most recently used view of that type.
    mruViewsByType: Map<string, string[]> = new Map();
    replayAPI?: ReplayAPI;
    nextTraceId = 1;

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

    setFullUI = (full: boolean) => {
        this.setState({ fullUI: full });
    };

    toggleUI = () => {
        this.setFullUI(!this.state.fullUI);
    };

    capture = () => {
        this.replayAPI?.captureFrame();
    };

    setCurrentTraceByIndex = (ndx: number) => {
        this.setState({ currentTraceIndex: ndx });
        this.replayTrace(this.state.traces[ndx]);
    };

    registerAPI(api: Partial<ReplayAPI>) {
        this.replayAPI = api as ReplayAPI;
    }

    registerPaneComponent = (name: string, component: PaneComponent) => {
        this.paneComponentsByName[name] = component;
    };

    setMostRecentPaneIdForComponentType = (componentName: string, paneId: string) => {
        this.mruViewsByType.set(componentName, this.mruViewsByType.get(componentName) || []);
        const mru = this.mruViewsByType.get(componentName)!;
        arrayRemoveElementByValue(mru, paneId);
        mru.unshift(paneId);
    };

    setMostRecentPaneByPaneId = (paneId: string) => {
        const viewType = this.state.paneIdToViewType[paneId];
        if (viewType) {
            this.setMostRecentPaneIdForComponentType(viewType.component.name, paneId);
        }
    };

    getMostRecentPaneIdForComponentType = (componentName: string): string | undefined => {
        // This is a hack: See Debugger.tsx
        if (!this.mruViewsByType.get(componentName)) {
            for (const [paneId, viewData] of Object.entries(this.state.paneIdToViewType)) {
                this.setMostRecentPaneIdForComponentType(viewData.component.name, paneId);
            }
        }
        const mru = this.mruViewsByType.get(componentName)!;
        return mru.length ? mru[0] : undefined;
    };

    setPaneViewType = (paneId: string, componentName: string, name: string, data: any): void => {
        const component = this.paneComponentsByName[componentName]!;
        const paneIdToViewType = { ...this.state.paneIdToViewType };
        paneIdToViewType[paneId] = { component, name, data };
        this.setState({ paneIdToViewType });
        this.setMostRecentPaneIdForComponentType(componentName, paneId);
    };

    deletePaneByPaneId(paneId: string) {
        // remove from mru list
        const viewType = this.state.paneIdToViewType[paneId]!;
        const component = viewType.component;
        const mru = this.mruViewsByType.get(component.name)!;
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
        const paneId = this.getMostRecentPaneIdForComponentType('ObjectVis');
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, 'ObjectVis', name, data);
    };

    /**
     * Called to add a new view
     * @param name Name to display in tab
     * @param data Data for ObjectVis
     * @param freePaneId Id of unused Pane
     */
    addObjectView = (name: string, data: any, freePaneId: string) => {
        this.setPaneViewType(freePaneId, 'ObjectVis', name, data);
        // remove from freePaneIds
        const freePaneIds = [...this.state.freePaneIds];
        arrayRemoveElementByValue(freePaneIds, freePaneId);
        this.setState({ freePaneIds });
    };

    replayTrace = async (traceInfo: TraceInfo) => {
        let replayInfo = this.state.replaysByUUID[traceInfo.replayUUID];
        if (!replayInfo) {
            const json = await traceInfo.trace.text();
            const trace = JSON.parse(json);
            const replay = await loadReplay(trace, requestUnwrappedAdapter);
            console.log('replay:', replay);

            const lastPath = getPathForLastStep(replay);
            replayInfo = { replay, lastPath };
            const replayByUUID: Record<string, ReplayInfo> = {};
            replayByUUID[traceInfo.replayUUID] = replayInfo;
            this.setState({
                replaysByUUID: { ...this.state.replaysByUUID, ...replayByUUID },
            });
        }
        this.setReplay(replayInfo);
    };

    addTraceFile = (trace: File) => {
        this.addTraceBlob(trace, trace.name);
    };

    addTraceBlob = (trace: Blob, name: string) => {
        const traceInfo: TraceInfo = {
            trace,
            name,
            replayUUID: crypto.randomUUID(),
        };
        const newNdx = this.state.traces.length;
        this.setState({
            traces: [...this.state.traces, traceInfo],
        });
        // Note: this seems iffy because the state has not yet been updated.
        this.setCurrentTraceByIndex(newNdx);
    };

    addTrace = (trace: any) => {
        console.log('trace:', trace);
        const blob = new Blob([JSON.stringify(trace)], { type: 'application/json' });
        this.addTraceBlob(blob, `trace-${this.nextTraceId++}`);
    };

    setReplay = (replayInfo: ReplayInfo) => {
        const paneId = this.getMostRecentPaneIdForComponentType('StepsVis');
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, 'StepsVis', 'Steps', replayInfo);

        const resourcePaneId = this.getMostRecentPaneIdForComponentType('ReplayVis');
        if (resourcePaneId) {
            this.setPaneViewType(resourcePaneId, 'ReplayVis', 'Resources', replayInfo.replay);
        }

        this.setFullUI(true);
    };

    // TODO: This should take a texture view?
    setResult = (texture: ReplayTexture, mipLevel: number) => {
        const paneId = this.getMostRecentPaneIdForComponentType('ResultVis');
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, 'ResultVis', 'Result', { texture, mipLevel });
    };

    setGPUState = (state: any) => {
        const paneId = this.getMostRecentPaneIdForComponentType('StateVis');
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        console.log('state:', state);
        this.setPaneViewType(paneId, 'StateVis', 'State', state);

        // TODO: choose the correct texture
        const mipLevel = 0;
        let texture = state?.currentTexture;
        if (!texture) {
            const attachments = state?.colorAttachments as any[];
            if (attachments) {
                texture = attachments[0]?.view?.texture;
            }
        }
        this.setResult(texture, mipLevel);
        this.setState({ replayCount: this.state.replayCount + 1 });
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
