import React from 'react';
import Toolbar from '../Toolbar/Toolbar';
import Pane from '../Pane/Pane';
import * as FlexLayout from 'flexlayout-react';

import { TileContext } from '../../contexts/TileContext';
import { uiStateHelper } from '../../contexts/UIStateContext';

import 'flexlayout-react/style/dark.css';
import './Debugger.css';

// We started with react-tile-pane. It refers to panes by id
// we what we do is make each new pane with a new id `pane<id>`
//
// Separately, in the uiState, we associate that id
// with a component and a piece of data so we can put that component
// in that pane with that data
//
// We switched to FlexLayout but have not refactored the code from
// this paneId stuff.

const layout: FlexLayout.IJsonModel = {
    global: {
        splitterSize: 4,
    },
    borders: [],
    layout: {
        type: 'row',
        children: [
            {
                type: 'tabset',
                weight: 50,
                children: [
                    {
                        type: 'tab',
                        name: 'pane0',
                        component: 'Pane',
                    },
                ],
            },
            {
                type: 'row',
                weight: 50,
                children: [
                    {
                        type: 'tabset',
                        weight: 40,
                        children: [
                            {
                                type: 'tab',
                                name: 'pane1',
                                component: 'Pane',
                            },
                        ],
                    },
                    {
                        type: 'tabset',
                        weight: 30,
                        children: [
                            {
                                type: 'tab',
                                name: 'pane2',
                                component: 'Pane',
                            },
                        ],
                    },
                    {
                        type: 'tabset',
                        weight: 30,
                        children: [
                            {
                                type: 'tab',
                                name: 'pane3',
                                component: 'Pane',
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

interface IState {
    model: FlexLayout.Model;
}

class Debugger extends React.Component<any, IState> {
    layoutRef?: React.RefObject<FlexLayout.Layout>;

    constructor(props: any) {
        super(props);
        this.state = { model: FlexLayout.Model.fromJson(layout) };
        this.layoutRef = React.createRef();
    }
    factory = (node: FlexLayout.TabNode) => {
        const component = node.getComponent();
        if (component === 'Pane') {
            return <Pane id={node.getName()} />;
        } else {
            return <div>unknown tab component: (component)</div>;
        }
    };
    onAddPaneViaDrag = (
        event: React.MouseEvent | React.TouchEvent<HTMLButtonElement>,
        name: string,
        data: any,
        freePaneId: string
    ) => {
        //event.stopPropagation();
        //event.preventDefault();
        this.layoutRef!.current!.addTabWithDragAndDrop(
            undefined,
            {
                component: 'Pane',
                name: freePaneId,
            },
            () => {
                // This is sketchy
                uiStateHelper.addObjectView(name, data, freePaneId);
            }
        );
    };
    onAction = (action: FlexLayout.Action) => {
        const { type, data } = action;
        switch (type) {
            case 'FlexLayout_DeleteTab':
                const tabNode = this.state.model.getNodeById(data.node) as FlexLayout.TabNode;
                if (tabNode) {
                    uiStateHelper.deletePaneByPaneId(tabNode.getName());
                }
        }
        return action;
    };
    onModelChange = () => {
        // When a pane become active, update the pane mru lists.
        const tabset = this.state.model.getActiveTabset();
        if (tabset) {
            const node = tabset.getSelectedNode() as FlexLayout.TabNode;
            uiStateHelper.setMostRecentPaneByPaneId(node.getName());
        }
    };
    onRenderTab = (node: FlexLayout.TabNode, renderValues: FlexLayout.ITabRenderValues) => {
        const paneId = node.getName();
        const viewType = uiStateHelper.state.paneIdToViewType[paneId];
        const name = viewType ? viewType.name : '*unknown*';
        renderValues.content = name;
        // renderValues.content = (<InnerComponent/>);
        // renderValues.content += " *";
        // renderValues.leading = <img style={{width:"1em", height:"1em"}}src="images/folder.svg"/>;
        // renderValues.name = "tab " + node.getId(); // name used in overflow menu
        // renderValues.buttons.push(<img style={{width:"1em", height:"1em"}} src="images/folder.svg"/>);
    };
    render() {
        return (
            <div className="spector2-debugger">
                <Toolbar />
                <div>
                    {/*
                        <button
                            onClick={() => {
                                console.log(JSON.stringify(this.state.model!.toJson(), null, '\t'));
                            }}
                        >
                            show model
                        </button>
                    */}
                </div>
                <div className="spector2-panes">
                    <TileContext.Provider value={{ onAddPaneViaDrag: this.onAddPaneViaDrag }}>
                        <FlexLayout.Layout
                            ref={this.layoutRef}
                            model={this.state.model}
                            factory={this.factory}
                            onAction={this.onAction}
                            onModelChange={this.onModelChange}
                            onRenderTab={this.onRenderTab}
                        />
                    </TileContext.Provider>
                </div>
            </div>
        );
    }
}

export default Debugger;
