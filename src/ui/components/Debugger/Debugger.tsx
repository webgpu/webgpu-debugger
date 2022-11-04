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

const s_defaultLayout: FlexLayout.IJsonModel = {
    global: {
        splitterSize: 4,
        tabEnableRename: false,
    },
    borders: [],
    layout: {
        type: 'row',
        children: [
            {
                type: 'row',
                weight: 50,
                children: [
                    {
                        type: 'tabset',
                        weight: 65,
                        children: [
                            {
                                type: 'tab',
                                name: 'pane0',
                                component: 'Pane',
                            },
                        ],
                    },
                    {
                        type: 'tabset',
                        weight: 35,
                        children: [
                            {
                                type: 'tab',
                                name: 'pane5',
                                component: 'Pane',
                            },
                        ],
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
                            {
                                type: 'tab',
                                name: 'pane3',
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
                                name: 'pane4',
                                component: 'Pane',
                            },
                        ],
                        active: true,
                    },
                ],
            },
        ],
    },
};

const getJsonTabNodeByName = (model: FlexLayout.IJsonModel, name: string) => {
    const getNode = (node: any): any => {
        if (node.children) {
            for (const child of node.children) {
                const foundNode = getNode(child);
                if (foundNode) {
                    return foundNode;
                }
            }
            return undefined;
        } else {
            return node.name === name ? node : undefined;
        }
    };
    return getNode(model.layout);
};

const getTabNodeByName = (model: FlexLayout.Model, name: string): FlexLayout.TabNode | null => {
    let foundNode: FlexLayout.TabNode | null = null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    model.visitNodes((node, _level) => {
        if (node.getType() === 'tab') {
            const tabNode = node as FlexLayout.TabNode;
            if (tabNode.getName() === name) {
                foundNode = tabNode;
            }
        }
    });

    return foundNode;
};

interface IState {
    model: FlexLayout.Model;
}

interface IProps {
    initialLayout?: FlexLayout.IJsonModel;
}

class Debugger extends React.Component<IProps, IState> {
    layoutRef?: React.RefObject<FlexLayout.Layout>;

    constructor(props: IProps) {
        super(props);
        const { initialLayout } = props;

        // add the enableClose flags
        // This is probably kind of silly to walk through and apply these.
        // Part of the design is left over from a previous pane library.
        const layout = structuredClone(initialLayout ?? s_defaultLayout);
        for (const [paneId, viewData] of Object.entries(uiStateHelper.state.paneIdToViewType)) {
            const node = getJsonTabNodeByName(layout, paneId);
            node.enableClose = viewData.componentInfo.closable;
        }

        this.state = { model: FlexLayout.Model.fromJson(layout) };
        this.layoutRef = React.createRef();

        // register a function on uiStateHelper so we can tell FlexLayout
        // to change features of a pane.
        const updatePane = (paneId: string, enableClose: boolean) => {
            const tabNode = getTabNodeByName(this.state.model, paneId);
            if (tabNode) {
                this.state.model.doAction(
                    FlexLayout.Actions.updateNodeAttributes(tabNode.getId(), {
                        enableClose,
                    })
                );
            }
        };

        const getLayoutJson = () => this.state.model.toJson();

        uiStateHelper.setPaneAPI({
            updatePane,
            getLayoutJson,
        });
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
        event.stopPropagation();
        event.preventDefault();
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
                break;
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
        uiStateHelper.saveLayout();
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
