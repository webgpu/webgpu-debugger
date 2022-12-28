import React, { useState, useContext, useEffect } from 'react';
import {
    ReplayCommandBufferCommand,
    ReplayQueueCommand,
    ReplayCommandSubmit,
    ReplayCommandBufferCommandRenderPass,
} from '../../../replay';
import SelectSimpleIndex from '../../components/SelectSimple/SelectSimpleIndex';
import Value from '../../components/Value/Value';
import Checkbox from '../../components/Checkbox/Checkbox';
import Overflow from '../../components/Overflow/Overflow';
import RowHolder from '../../components/RowHolder/RowHolder';
import Row from '../../components/Row/Row';
import { ReplayInfo, UIStateContext } from '../../contexts/UIStateContext';
import { classNames } from '../../lib/css';
import { canDisplayInline } from '../../components/VisValue/VisValue';

import './StepsVis.css';

type StepsState = {
    currentStep: number[];
};

type StepsContextData = {
    state: StepsState;
    playTo(step: number[]): void;
    showCommandArgNames: boolean;
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

function Json({ data }: { data: any }) {
    try {
        const json = JSON.stringify(data);
        return <div>{json}</div>;
    } catch (e: any) {
        /*
        let errMsg = '';
        try {
            errMsg = e.toString();
        } catch {
            errMsg = 'EXCEPTION toString throws?!?!';
        }
        console.error(errMsg);
        */
        return <div className="spector2-error">object with cycle({data.constructor.name})</div>;
    }
}

function Arg({ k, v }: { k: string; v: any }) {
    const { showCommandArgNames } = useContext(StepsContext)!;
    const argName = showCommandArgNames ? `: ${k}` : '';
    if (Array.isArray(v)) {
        return <div className="spector2-cmd-arg">[...]{argName}</div>;
    }
    if (typeof v === 'object') {
        return (
            <div className="spector2-cmd-arg">
                {canDisplayInline(v) ? <Value data={v} /> : <Json data={v} />}
                {argName}
            </div>
        );
    }
    return (
        <div className="spector2-cmd-arg">
            <Value data={v} />
            {argName}
        </div>
    );
}

function Args({ args }: { args: any }) {
    return (
        <div className="spector2-cmd-args">
            {interleave(
                Object.entries(args as Record<string, any>)
                    .filter(([, v]) => v !== undefined)
                    .map(([k, v], ndx) => <Arg key={`a${ndx}`} k={k} v={v} />),
                ', '
            )}
        </div>
    );
}

function RenderPassCommandStep({ command, commandId }: { command: ReplayCommandBufferCommand; commandId: number[] }) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name, args } = command as any;
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

function RenderPassCommands({ commands, commandId }: { commands: ReplayCommandBufferCommand[]; commandId: number[] }) {
    return (
        <React.Fragment>
            {commands.map((c, ndx) => (
                <RenderPassCommandStep key={`f${ndx}`} command={c} commandId={[...commandId, ndx]} />
            ))}
        </React.Fragment>
    );
}

function RenderPass({ command, commandId }: { command: ReplayCommandBufferCommandRenderPass; commandId: number[] }) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name, renderPass: rp } = command;
    const commands = rp.commands;

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
            <RenderPassCommands commands={commands} commandId={commandId} />
        </React.Fragment>
    );
}

function QueueSubmit({ command, commandId }: { command: ReplayQueueCommand; commandId: number[] }) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name } = command;
    const submitCommand = command as ReplayCommandSubmit;
    const commandBuffers = submitCommand.args.commandBuffers;

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
                        <CommandBufferCommands commands={cb.commands} commandId={[...commandId, ndx]} />
                    </React.Fragment>
                );
            })}
        </React.Fragment>
    );
}

function GenericCommandBufferCommand({
    command,
    commandId,
}: {
    command: ReplayCommandBufferCommand;
    commandId: number[];
}) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name, args } = command as any;
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

function CommandBufferCommandStep({
    command,
    id,
    commandId,
}: {
    command: ReplayCommandBufferCommand;
    id: string;
    commandId: number[];
}) {
    const { name } = command;
    // TODO: I feel like this should/could be generic.
    switch (name) {
        // TODO: we shouldn't need 2 types here.
        case 'renderPass':
            return <RenderPass key={`qs${id}`} command={command} commandId={commandId} />;
        default:
            return <GenericCommandBufferCommand key={`gc${id}`} command={command} commandId={commandId} />;
    }
}

function CommandBufferCommands({
    commands,
    commandId,
}: {
    commands: ReplayCommandBufferCommand[];
    commandId: number[];
}) {
    return (
        <React.Fragment>
            {commands.map((c, ndx) => (
                <CommandBufferCommandStep
                    key={`f${ndx}`}
                    id={ndx.toString()}
                    command={c}
                    commandId={[...commandId, ndx]}
                />
            ))}
        </React.Fragment>
    );
}

function GenericReplayQueueCommand({ command, commandId }: { command: ReplayQueueCommand; commandId: number[] }) {
    const stepsContextData = useContext(StepsContext)!;
    const isCurrent = arrayEqual(commandId, stepsContextData.state.currentStep);
    const { name, args } = command as any; // TODO: can we make this more generic?
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

function ReplayQueueCommandStep({
    command,
    id,
    commandId,
}: {
    command: ReplayQueueCommand;
    id: string;
    commandId: number[];
}) {
    const { name } = command;
    // TODO: I feel like this should/could be generic.
    switch (name) {
        case 'queueSubmit':
            return <QueueSubmit key={`qs${id}`} command={command} commandId={commandId} />;
        default:
            return <GenericReplayQueueCommand key={`gc${id}`} command={command} commandId={commandId} />;
    }
}

function ReplayQueueCommands({ commands, commandId }: { commands: ReplayQueueCommand[]; commandId: number[] }) {
    return (
        <React.Fragment>
            {commands.map((c, ndx) => (
                <ReplayQueueCommandStep
                    key={`f${ndx}`}
                    id={ndx.toString()}
                    command={c}
                    commandId={[...commandId, ndx]}
                />
            ))}
        </React.Fragment>
    );
}

interface StepsVisProps {
    data: ReplayInfo;
}

export default function StepsVis({ data }: StepsVisProps) {
    const { replay, lastPath } = data || {};
    const { helper } = useContext(UIStateContext);
    const [state, setState] = useState<StepsState>({
        currentStep: [],
    });
    const { wrapCommands, showCommandArgNames } = helper.state.uiSettings;
    const setWrapCommands = (wrapCommands: boolean) => {
        helper.setUISettings({ wrapCommands });
    };
    const setShowCommandArgNames = (showCommandArgNames: boolean) => {
        helper.setUISettings({ showCommandArgNames });
    };

    const playTo = (step: number[]) => {
        if (data) {
            setState({ currentStep: step });
            helper.playTo(replay!, step);
        }
    };

    useEffect(() => {
        playTo(lastPath);
    }, [data]);

    return (
        <div className="spector2-vis">
            <div className="spector2-steps-vis">
                <RowHolder>
                    <Row className="spector2-steps-vis-traces">
                        <SelectSimpleIndex
                            label=""
                            value={helper.state.currentTraceIndex}
                            options={helper.state.traces.map(t => t.name)}
                            onChange={helper.setCurrentTraceByIndex}
                        />
                    </Row>
                    <Row>
                        <Checkbox label="wrap:" checked={wrapCommands} onChange={setWrapCommands} />
                        <Checkbox
                            label="show arg names:"
                            checked={showCommandArgNames}
                            onChange={setShowCommandArgNames}
                        />
                    </Row>
                    <Row className="spector2-top-separator"></Row>
                    <Row expand={true} className="spector2-steps-steps">
                        <Overflow>
                            <div style={{ whiteSpace: wrapCommands ? 'normal' : 'nowrap' }}>
                                <StepsContext.Provider value={{ state, playTo, showCommandArgNames }}>
                                    <ReplayQueueCommands commands={replay!.commands} commandId={[]} />
                                </StepsContext.Provider>
                            </div>
                        </Overflow>
                    </Row>
                </RowHolder>
            </div>
        </div>
    );
}
