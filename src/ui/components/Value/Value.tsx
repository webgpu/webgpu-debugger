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
import { gpuBufferUsageToString, gpuTextureUsageToString } from '../../lib/webgpu-utils';

import './Value.css';

export type ValueComponent = React.FunctionComponent<any> | React.ComponentClass<any>;

/*
function PlaceHolder({ data }: { data: any }) {
    return <div>placeholder{`<${Object.getPrototypeOf(data).constructor.name}>`}</div>;
}
*/

function makeVisValue(Class: Function, typeName: string) {
    return function VisValue({ data }: { data: any }) {
        const { helper } = useContext(UIStateContext);
        const { onAddPaneViaDrag } = useContext(TileContext);
        const freePaneId = helper.state.freePaneIds[0];
        const name = `${typeName}${data.label ? `(${data.label})` : ''}`;
        return (
            <div
                className={`spector2-value-vis spector-value-${typeName}`}
                onClick={() => {
                    helper.setObjectView(name, data);
                }}
            >
                {name}
                <span
                    title="drag to make new pane"
                    onMouseDown={event => onAddPaneViaDrag(event, name, data, freePaneId)}
                >
                    👁
                </span>
            </div>
        );
    };
}

const AdapterValue = makeVisValue(ReplayAdapter, 'GPUAdapter');
const BindGroupLayoutValue = makeVisValue(ReplayBindGroupLayout, 'GPUBindGroupLayout');
const BindGroupValue = makeVisValue(ReplayBindGroup, 'GPUBindGroup');
const BufferValue = makeVisValue(ReplayBuffer, 'GPUBuffer');
const CommandBufferValue = makeVisValue(ReplayCommandBuffer, 'GPUCommandBuffer');
const DeviceValue = makeVisValue(ReplayDevice, 'GPUDevice');
const PipelineLayoutValue = makeVisValue(ReplayPipelineLayout, 'GPUPipelineLayout');
const QuerySetValue = makeVisValue(ReplayQuerySet, 'GPUQuerySet');
const QueueValue = makeVisValue(ReplayQueue, 'GPUQueue');
const RenderPassValue = makeVisValue(ReplayRenderPass, 'GPURenderPass');
const RenderRenderPipelineValue = makeVisValue(ReplayRenderPass, 'GPURenderPipeline');
const SamplerValue = makeVisValue(ReplaySampler, 'GPUSampler');
const ShaderModuleValue = makeVisValue(ReplayShaderModule, 'GPUShaderModule');
const TextureValue = makeVisValue(ReplayTexture, 'GPUTexture');
const TextureViewValue = makeVisValue(ReplayTextureView, 'GPUTextureView');

const s_replayClassToComponent = new Map<Function, ValueComponent>([
    [ReplayAdapter, AdapterValue],
    [ReplayBindGroup, BindGroupValue],
    [ReplayBindGroupLayout, BindGroupLayoutValue],
    [ReplayBuffer, BufferValue],
    [ReplayCommandBuffer, CommandBufferValue],
    [ReplayDevice, DeviceValue],
    [ReplayPipelineLayout, PipelineLayoutValue],
    [ReplayQuerySet, QuerySetValue],
    [ReplayQueue, QueueValue],
    [ReplayRenderPass, RenderPassValue],
    [ReplayRenderPipeline, RenderRenderPipelineValue],
    [ReplaySampler, SamplerValue],
    [ReplayShaderModule, ShaderModuleValue],
    [ReplayTexture, TextureValue],
    [ReplayTextureView, TextureViewValue],
]);

export const canDisplayInline = (v: any) => s_replayClassToComponent.has(Object.getPrototypeOf(v).constructor);

const s_baseObjectProto = Object.getPrototypeOf({});

// 'device' is only on GPUAdaptorInfo and GPUCanvasConfiguration. Can special case those if we need to
// 'replay' is part of the ReplayXXX objects
// 'webgpuObject' is part of the ReplayXXX objects
const s_excludedProperties = new Set([
    'bufferSerial',
    'device',
    'deviceSerial',
    'layoutSerial',
    'moduleSerial',
    'replay',
    'textureSerial',
    'webgpuObject',
]);

type PropertyNameToComponentMap = Record<string, ValueComponent>;

const GPUBufferUsageValue = ({ data }: { data: number }) => {
    return <div className="spector2-value-bitmask">{gpuBufferUsageToString(data)}</div>;
};

const GPUTextureUsageValue = ({ data }: { data: number }) => {
    return <div className="spector2-value-bitmask">{gpuTextureUsageToString(data)}</div>;
};

const s_classToSpecialProperties = new Map<Function, PropertyNameToComponentMap>();
s_classToSpecialProperties.set(ReplayBuffer, {
    usage: GPUBufferUsageValue,
});
s_classToSpecialProperties.set(ReplayTexture, {
    usage: GPUTextureUsageValue,
});

function ValueProperty({ component, depth, data }: { component?: ValueComponent; depth: number; data: any }) {
    return component ? React.createElement(component, { data }) : <Value depth={depth} data={data} />;
}

export function ValueObject({ depth, data }: { depth?: number; data: Record<string, any> }) {
    const childDepth = (depth || 0) + 1;
    const ctor = Object.getPrototypeOf(data).constructor;
    const specialProperties: PropertyNameToComponentMap = s_classToSpecialProperties.get(ctor) || {};
    return (
        <table className={`spector2-value-object spector2-value-depth${depth}`}>
            <tbody>
                {Object.entries(data).map(([key, value], ndx) =>
                    s_excludedProperties.has(key) ? (
                        <React.Fragment key={`p${ndx}`} />
                    ) : (
                        <tr className="spector2-value-key-value" key={`p${ndx}`}>
                            <td key={`k${ndx}`} className="spector2-value-key">
                                {key}:
                            </td>
                            <td>
                                <ValueProperty
                                    component={specialProperties[key]}
                                    key={`v${ndx}`}
                                    depth={childDepth}
                                    data={value}
                                />
                            </td>
                        </tr>
                    )
                )}
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

const identity = (v: number) => v.toString();

export function ValueNumber({ data, format = identity }: { data: number; format?: (v: number) => string }) {
    return Number.isNaN(data) ? (
        <div className="spector2-value-nan">NaN</div>
    ) : Number.isFinite(data) ? (
        <div className="spector2-value-number">{format(data)}</div>
    ) : (
        <div className="spector2-value-inf">{data}</div>
    );
}

export default function Value({ depth, data }: { depth?: number; data: any }) {
    if (data === undefined) {
        return <div className="spector2-value-undefined">undefined</div>;
    } else if (data === null) {
        return <div className="spector2-value-null">null</div>;
    } else if (typeof data === 'number') {
        return <ValueNumber data={data} />;
    } else if (typeof data === 'string') {
        return <div className="spector2-value-string">&quot;{data}&quot;</div>;
    } else if (Array.isArray(data)) {
        return <ValueArray depth={depth} data={data} />;
    } else if (typeof data === 'function') {
        return <div className="spector2-value-function">{data.name}</div>;
    } else if (typeof data === 'object') {
        const proto = Object.getPrototypeOf(data);
        if (proto === s_baseObjectProto) {
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
