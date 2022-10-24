import React from "react";
import StepsVis from "../views/StepsVis/StepsVis";
import ResultVis from "../views/ResultVis/ResultVis";
import { Replay } from "../fudge";

export type PaneComponent = React.FunctionComponent<{ data: any; }> | React.ComponentClass<{ data: any; }>;
type ViewData = {
  component: PaneComponent;
  data: any;
};

class UIState {
  paneIdToViewType: Record<string, ViewData> = {};
  // map of PaneComponents to lru paneIds where the first
  // entry is the most recently used view of that type.
  mruViewsByType: Map<PaneComponent, string[]> = new Map();

  setMostRecent(component: PaneComponent, paneId: string) {
    this.mruViewsByType.set(component, this.mruViewsByType.get(component) || []);
    const mru = this.mruViewsByType.get(component)!;
    const ndx = mru.indexOf(paneId);
    if (ndx >= 0) {
      mru.splice(ndx, 1);
    }
    mru.unshift(paneId);
  };

  getMostRecent(component: PaneComponent): string | undefined {
    const mru = this.mruViewsByType.get(component)!;
    return mru.length ? mru[0] : undefined;
  };

  setPaneViewType(paneId: string, component: PaneComponent, data: any): void {
    this.paneIdToViewType[paneId] = {component, data};
    this.setMostRecent(component, paneId);
  };

  addReplay(replay: Replay) {
    this.replays.push(replay);
    let paneId = this.getMostRecent(StepsVis);
    if (!paneId) {
      throw new Error('TODO: add pane of this type');
    }
    this.setPaneViewType(paneId, StepsVis, replay);
  }

  setResult(canvas: HTMLCanvasElement) {
    let paneId = this.getMostRecent(ResultVis);
    if (!paneId) {
      throw new Error('TODO: add pane of this type');
    }
    this.setPaneViewType(paneId, ResultVis, canvas);
  }

  replays: Replay[] = [];
};

export const uiState = new UIState();
export const UIStateContext = React.createContext(uiState);