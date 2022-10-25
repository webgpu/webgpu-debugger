import React, { useState, useContext } from 'react';
import { Command, CommandArgs, QueueSubmitArgs, Replay } from '../../../replay/lib';
import { classNames } from '../../lib/css';

import './StepsVis.css';

type StepsState = {
    currentStep: number[];
};

type StepsContextData = {
    state: StepsState;
    playTo(step: number[]): void;
};

const arrayEqual = (a: any[], b: any[]) => {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};

const StepsContext = React.createContext<StepsContextData | undefined>(undefined);

const interleave = (array: any[], elem: any): any[] => {
    const newArray = [];
    let i = 0;
    if (i < array.length) {
        newArray.push(array[i++]);
    }
    while (i < array.length) {
        newArray.push(elem, array[i++]);
    }
    return newArray;
};

function Arg({ k, v }: { k: string; v: any }) {
    if (Array.isArray(v)) {
        return <div className="spector2-cmd-arg">[...]: {k}</div>;
    }
    if (typeof v === 'object') {
        return <div className="spector2-cmd-arg">{v.constructor.name}</div>;
    }
    return (
        <div className="spector2-cmd-arg">
            {JSON.stringify(v)}: {k}
        </div>
    );
}

function Args({ args }: { args: CommandArgs }) {
    return (
        <div className="spector2-cmd-args">
            {interleave(
                Object.entries(args)
                    .filter(([, v]) => v !== undefined)
                    .map(([k, v], ndx) => <Arg key={`a${ndx}`} k={k} v={v} />),
                ', '
            )}
        </div>
    );
}

function QueueSubmit({ command, commandId }: { command: Command; commandId: number[] }) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name, args } = command;
    const qsArgs: QueueSubmitArgs = args as QueueSubmitArgs;
    const commandBuffers = qsArgs.commandBuffers;

    return (
        <React.Fragment>
            <div
                className={classNames('spector2-cmd', `spector2-cmd-indent-${commandId.length}`, {
                    'spector2-cmd-selected': isCurrent,
                })}
                onClick={() => stepsContextData.playTo(commandId)}
            >
                <div>›</div>
                <div className="spector2-cmd-name">{name}</div>
            </div>
            {commandBuffers.map((cb, ndx) => {
                return (
                    <React.Fragment key={`cm${ndx}`}>
                        <div className={`spector2-cmd spector2-cmd-indent-${commandId.length + 1}`} key={`cb${ndx}`}>
                            CommandBuffer: #{ndx}
                        </div>
                        {cb.commands.map((c, cNdx) => {
                            const id = `cb${ndx}_${cNdx}`;
                            return <Command key={id} id={id} command={c} commandId={[...commandId, ndx, cNdx]} />;
                        })}
                    </React.Fragment>
                );
            })}
        </React.Fragment>
    );
}

function GenericCommand({ command, commandId }: { command: Command; commandId: number[] }) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name, args } = command;
    return (
        <div
            className={classNames('spector2-cmd', `spector2-cmd-indent-${commandId.length}`, {
                'spector2-cmd-selected': isCurrent,
            })}
            onClick={() => stepsContextData.playTo(commandId)}
        >
            <div className="spector2-cmd-name">{name}</div>({args ? <Args args={args} /> : ''})
        </div>
    );
}

function Command({ command, id, commandId }: { command: Command; id: string; commandId: number[] }) {
    const { name } = command;
    // MEH! I feel like this should/could be generic.
    switch (name) {
        case 'queueSubmit':
            return <QueueSubmit key={`qs${id}`} command={command} commandId={commandId} />;
        default:
            return <GenericCommand key={`gc${id}`} command={command} commandId={commandId} />;
    }
}

export default function StepsVis({ data }: { data: Replay }) {
    const [state, setState] = useState<StepsState>({
        currentStep: [],
    });
    const playTo = (step: number[]) => {
        setState({ currentStep: step });
    };

    return (
        <div className="spector2-viz">
            <StepsContext.Provider value={{ state, playTo }}>
                {data
                    ? data.commands.map((c, ndx) => (
                          <Command key={`f${ndx}`} id={ndx.toString()} command={c} commandId={[ndx]} />
                      ))
                    : 'no replay'}
            </StepsContext.Provider>
        </div>
    );
}
