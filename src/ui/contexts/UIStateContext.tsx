import React from 'react';
import StepsVis from '../views/StepsVis/StepsVis';
import ResultVis from '../views/ResultVis/ResultVis';
import { Replay } from '../../replay/lib';

export type PaneComponent = React.FunctionComponent<{ data: any }> | React.ComponentClass<{ data: any }>;
type ViewData = {
    component: PaneComponent;
    data: unknown;
};

export interface ReplayAPI {
    captureFrame: () => void;
    startCapture: () => void;
    endCapture: () => void;
    getBufferData: (buffer: GPUBuffer, offset: number, size: number) => Promise<ArrayBuffer>;
    getTextureData: (
        texture: GPUTexture,
        level: number,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        depth: number
    ) => Promise<ArrayBuffer>;
    getTextureImage: (texture: GPUTexture, level: number) => Promise<ImageBitmap>;
}

export class UIStateHelper {
    paneIdToViewType: Record<string, ViewData> = {};
    // map of PaneComponents to lru paneIds where the first
    // entry is the most recently used view of that type.
    mruViewsByType: Map<PaneComponent, string[]> = new Map();
    fullUI = false;
    replayAPI?: ReplayAPI;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hackRenderFn: (v: number) => void = (_: number) => {};
    render = () => {
        this.hackRenderFn(performance.now());
    };

    setFullUI = (full: boolean) => {
        this.fullUI = full;
        this.render();
    };

    toggleUI = () => {
        this.setFullUI(!this.fullUI);
    };

    capture = () => {
        this.replayAPI?.captureFrame();
    };

    registerAPI(api: ReplayAPI) {
        this.replayAPI = api;
    }

    setMostRecent = (component: PaneComponent, paneId: string) => {
        this.mruViewsByType.set(component, this.mruViewsByType.get(component) || []);
        const mru = this.mruViewsByType.get(component)!;
        const ndx = mru.indexOf(paneId);
        if (ndx >= 0) {
            mru.splice(ndx, 1);
        }
        mru.unshift(paneId);
    };

    getMostRecent = (component: PaneComponent): string | undefined => {
        const mru = this.mruViewsByType.get(component)!;
        return mru.length ? mru[0] : undefined;
    };

    setPaneViewType = (paneId: string, component: PaneComponent, data: any): void => {
        this.paneIdToViewType[paneId] = { component, data };
        this.setMostRecent(component, paneId);
    };

    addReplay = (replay: Replay) => {
        this.replays.push(replay);
        const paneId = this.getMostRecent(StepsVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, StepsVis, replay);
    };

    setResult = (canvas: HTMLCanvasElement) => {
        const paneId = this.getMostRecent(ResultVis);
        if (!paneId) {
            throw new Error('TODO: add pane of this type');
        }
        this.setPaneViewType(paneId, ResultVis, canvas);
    };

    // This is a hack to get react to render.
    // TODO: fix so not needed
    setRenderHackFn = (fn: (number: number) => void) => {
        this.hackRenderFn = fn;
    };

    replays: Replay[] = [];
}

export const uiState = new UIStateHelper();
export const UIStateContext = React.createContext(uiState);
