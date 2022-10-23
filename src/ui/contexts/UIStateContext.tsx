import React from "react";

type PaneComponent = React.FunctionComponent<{ data: any; }> | React.ComponentClass<{ data: any; }>;
type ViewData = {
  component: PaneComponent;
  data: any;
};

export class UIState {
  paneIdToViewType: Record<string, ViewData> = {};

  setPaneViewType(paneId: string, component: PaneComponent, data: any): void {
    this.paneIdToViewType[paneId] = {component, data};
  };
};

const uiState = new UIState();
export const UIStateContext = React.createContext(uiState);