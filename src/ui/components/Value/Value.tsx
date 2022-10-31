/* eslint-disable @typescript-eslint/ban-types */
import React, { useContext } from 'react';

import {
    ReplayAdapter,
    ReplayBindGroup,
    ReplayBindGroupLayout,
    ReplayBuffer,
    ReplayCommandBuffer,
    ReplayDevice,
    ReplayPipelineLayout,
    ReplayQuerySet,
    ReplayQueue,
    ReplayRenderPass,
    ReplayRenderPipeline,
    ReplaySampler,
    ReplayShaderModule,
    ReplayTexture,
    ReplayTextureView,
} from '../../../replay';
import { TileContext } from '../../contexts/TileContext';
import { UIStateContext } from '../../contexts/UIStateContext';

import './Value.css';

export type ValueComponent = React.FunctionComponent<any> | React.ComponentClass<any>;

function PlaceHolder({ data }: { data: any }) {
    return <div>placeholder{`<${Object.getPrototypeOf(data).constructor.name}>`}</div>;
}

function makeVisValue(Class: Function, typeName: string) {
    return function VisValue({ data }: { data: any }) {
        const { helper } = useContext(UIStateContext);
        const { onAddPaneViaDrag } = useContext(TileContext);
        const freePaneId = helper.state.freePaneIds[0];
        const name = `${typeName}`;
        return (
            <div
                className={`spector2-value-vis spector-value-${typeName}`}
                onClick={() => {
                    helper.setObjectView(typeName, data);
                }}
            >
                {typeName}
                <span onMouseDown={event => onAddPaneViaDrag(event, name, data, freePaneId)}>👁</span>
            </div>
        );
    };
}

const BufferValue = makeVisValue(ReplayBuffer, 'GPUBuffer');
const RenderPipelineValue = makeVisValue(ReplayRenderPass, 'GPURenderPipeline');

const s_replayClassToComponent = new Map<Function, ValueComponent>([
    [ReplayAdapter, PlaceHolder],
    [ReplayBindGroup, PlaceHolder],
    [ReplayBindGroupLayout, PlaceHolder],
    [ReplayBuffer, BufferValue],
    [ReplayCommandBuffer, PlaceHolder],
    [ReplayDevice, PlaceHolder],
    [ReplayPipelineLayout, PlaceHolder],
    [ReplayQuerySet, PlaceHolder],
    [ReplayQueue, PlaceHolder],
    [ReplayRenderPass, PlaceHolder],
    [ReplayRenderPipeline, RenderPipelineValue],
    [ReplaySampler, PlaceHolder],
    [ReplayShaderModule, PlaceHolder],
    [ReplayTexture, PlaceHolder],
    [ReplayTextureView, PlaceHolder],
]);

const baseObjectProto = Object.getPrototypeOf({});

export function ValueObject({ depth, data }: { depth?: number; data: Record<string, any> }) {
    const childDepth = (depth || 0) + 1;
    return (
        <table className={`spector2-value-object spector2-value-depth${depth}`}>
            <tbody>
                {Object.entries(data).map(([key, value], ndx) => [
                    <tr className="spector2-value-key-value" key={'p${ndx}'}>
                        <td key={`k${ndx}`} className="spector2-value-key">
                            {key}:
                        </td>
                        <td>
                            <Value key={`v${ndx}`} depth={childDepth} data={value} />
                        </td>
                    </tr>,
                ])}
            </tbody>
        </table>
    );
}

function ValueArray({ depth, data }: { depth?: number; data: any[] }) {
    const childDepth = (depth || 0) + 1;
    return (
        <table className={`spector2-value-array spector2-value-depth${depth}`}>
            <tbody>
                {data.map((v, ndx) => (
                    <tr key={`e${ndx}`}>
                        <td>{ndx}</td>
                        <td>
                            <Value depth={childDepth} data={v} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function Value({ depth, data }: { depth?: number; data: any }) {
    if (data === undefined) {
        return <div>undefined</div>;
    } else if (data === null) {
        return <div>null</div>;
    } else if (typeof data === 'number') {
        return <div className="spector2-value-number">{data}</div>;
    } else if (typeof data === 'string') {
        return <div className="spector2-value-string">&quot;{data}&quot;</div>;
    } else if (Array.isArray(data)) {
        return <ValueArray depth={depth} data={data} />;
    } else if (typeof data === 'function') {
        return <div className="spector2-value-function">{data.name}</div>;
    } else if (typeof data === 'object') {
        const proto = Object.getPrototypeOf(data);
        if (proto === baseObjectProto) {
            return <ValueObject depth={depth} data={data} />;
        } else {
            const component = s_replayClassToComponent.get(proto.constructor);
            if (component) {
                return React.createElement(component, { data });
            }
            return <div>unsupported type: {proto.constructor.name}</div>;
        }
    } else {
        return <div>--unsupported-type--</div>;
    }
}
