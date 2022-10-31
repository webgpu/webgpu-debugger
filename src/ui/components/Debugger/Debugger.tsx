import React from 'react';
import Toolbar from '../Toolbar/Toolbar';
import { maxPanes } from '../../globals';
import Pane from '../Pane/Pane';
import * as FlexLayout from '../../../3rdParty/FlexLayout/src/index';

import '../../../3rdParty/FlexLayout/style/dark.css';
import './Debugger.css';

import { TileContext } from '../../contexts/TileContext';

// react-tile-pane refers to panes by id
// we what we do is make each new pane with a new id `pane<id>`
//
// Separately, in the uiState, we associate that id
// with a component and a piece of data so we can put that component
// in that pane with that data

// TODO: Make it so the user can add more panes. I had some code that added
// panes on demand but ending up switching to code that just makes N panes
// and then ideally these panes would be stored on unused-pane list.
//
// It bugs me that these 3 things, paneList, names, and rootPane are
// global. I think they could go into the component but as the component is
// created and destroyed they'd lose their state.

const layout: FlexLayout.IJsonModel = {
    global: {
        splitterSize: 4,
    },
    borders: [],
    layout: {
        type: 'row',
        children: [
            {
                type: 'row',
                weight: 10,
                children: [
                    {
                        type: 'tabset',
                        weight: 10,
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
                        weight: 90,
                        children: [
                            {
                                type: 'tabset',
                                weight: 50,
                                children: [
                                    {
                                        type: 'tab',
                                        name: 'pane1',
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
                                        weight: 34,
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
                                        weight: 33,
                                        children: [
                                            {
                                                type: 'tab',
                                                name: 'pane3',
                                                component: 'Pane',
                                            },
                                        ],
                                    },
                                    {
                                        type: 'tabset',
                                        weight: 33,
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
                ],
            },
        ],
    },
};

interface IState {
    model: FlexLayout.Model;
}

class Debugger extends React.Component<any, IState> {
    constructor(props: any) {
        super(props);
        this.state = { model: FlexLayout.Model.fromJson(layout) };
    }
    factory = (node: FlexLayout.TabNode) => {
        const component = node.getComponent();
        if (component === 'Pane') {
            return <Pane id={node.getName()} />;
        } else {
            return <div>unknown tab component: (component)</div>;
        }
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
                    <FlexLayout.Layout model={this.state.model} factory={this.factory} />
                </div>
            </div>
        );
    }
}

export default Debugger;
