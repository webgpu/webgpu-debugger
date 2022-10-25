import React from 'react';
import Debugger from '../Debugger/Debugger';
import MiniUI from '../MiniUI/MiniUI';
import { uiState, UIStateContext } from '../../contexts/UIStateContext';
import './App.css';

interface IState {
    id: number;
}

class App extends React.Component<null, IState> {
    declare context: React.ContextType<typeof UIStateContext>;

    constructor(props: null) {
        super(props);
        this.state = { id: 0 };
    }
    componentDidMount(): void {
        // TODO: remove. This is only here to make this component re-render
        this.context.setRenderHackFn(() => {
            this.setState({ id: performance.now() });
        });
    }
    render() {
        return (
            <UIStateContext.Provider value={uiState}>
                <div className="spector2">{uiState.fullUI ? <Debugger /> : <MiniUI />}</div>
            </UIStateContext.Provider>
        );
    }
}
App.contextType = UIStateContext;

export default App;
