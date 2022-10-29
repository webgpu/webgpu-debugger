import React, { useState, useContext, useEffect } from 'react';
import { Command, CommandArgs, QueueSubmitArgs, RenderPassArgs, Replay } from '../../../replay';
import { ReplayInfo, UIStateContext } from '../../contexts/UIStateContext';
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

function RenderPass({ command, commandId }: { command: Command; commandId: number[] }) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name, renderPass: rp } = command as any; // TODO: fix!
    const rpArgs: RenderPassArgs = rp as RenderPassArgs;
    const commands = rpArgs.commands;

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
            <Commands commands={commands} commandId={commandId} />
        </React.Fragment>
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
                        <Commands commands={cb.commands} commandId={[...commandId, ndx]} />
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
    // TODO: I feel like this should/could be generic.
    switch (name) {
        // TODO: we shouldn't need 2 types here.
        case 'renderPass':
            return <RenderPass key={`qs${id}`} command={command} commandId={commandId} />;
        case 'queueSubmit':
            return <QueueSubmit key={`qs${id}`} command={command} commandId={commandId} />;
        default:
            return <GenericCommand key={`gc${id}`} command={command} commandId={commandId} />;
    }
}

function Commands({ commands, commandId }: { commands: Command[]; commandId: number[] }) {
    return (
        <React.Fragment>
            {commands.map((c, ndx) => (
                <Command key={`f${ndx}`} id={ndx.toString()} command={c} commandId={[...commandId, ndx]} />
            ))}
        </React.Fragment>
    );
}

interface StepsVisProps {
    data: ReplayInfo;
}

export default function StepsVis({ data }: StepsVisProps) {
    const { replay, lastPath } = data;
    const { helper } = useContext(UIStateContext);
    const [state, setState] = useState<StepsState>({
        currentStep: [],
    });

    const playTo = (step: number[]) => {
        setState({ currentStep: step });
        helper.playTo(replay, step);
    };

    useEffect(() => {
        playTo(lastPath);
    }, [data]);

    return (
        <div className="spector2-viz">
            <StepsContext.Provider value={{ state, playTo }}>
                {data ? <Commands commands={replay.commands} commandId={[]} /> : 'no replay'}
            </StepsContext.Provider>
        </div>
    );
}
