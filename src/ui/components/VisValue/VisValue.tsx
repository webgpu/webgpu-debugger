/* eslint-disable @typescript-eslint/ban-types */
import React, { useContext } from 'react';

import {
    Replay,
    ReplayAdapter,
    ReplayBindGroup,
    ReplayBindGroupLayout,
    ReplayBuffer,
    ReplayCommandBuffer,
    ReplayDevice,
    ReplayObject,
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
import { gpuBufferUsageToString, gpuExtent3DToShortString, gpuTextureUsageToString } from '../../lib/webgpu-utils';

export type ValueComponent = React.FunctionComponent<any> | React.ComponentClass<any>;

function makeVisValue<T extends ReplayObject>(
    Class: Function,
    typeName: string,
    shortInfo: (data: T) => string = () => ''
) {
    return function VisValue({ data }: { data: T }) {
        const { helper } = useContext(UIStateContext);
        const { onAddPaneViaDrag } = useContext(TileContext);

        const freePaneId = helper.state.freePaneIds[0];
        const extra = shortInfo(data);
        const name = `${typeName}${data.label ? `(${data.label})` : ''}${extra ? `[${extra}]` : ''}}`;
        return (
            <div
                className={`wgdb-value-vis spector-value-${typeName}`}
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

// Note: makeVisValue is just a shortcut to make a unique type for each
// type of resource. You are free to make a custom type or refactor
// makeVisValue for more options.
const AdapterValue = makeVisValue(ReplayAdapter, 'GPUAdapter');
const BindGroupLayoutValue = makeVisValue(ReplayBindGroupLayout, 'GPUBindGroupLayout');
const BindGroupValue = makeVisValue(ReplayBindGroup, 'GPUBindGroup');
const BufferValue = makeVisValue(
    ReplayBuffer,
    'GPUBuffer',
    (o: ReplayBuffer) => `s: ${o.size}, usage: ${o.usage.toString(16)}`
);
const CommandBufferValue = makeVisValue(ReplayCommandBuffer, 'GPUCommandBuffer');
const DeviceValue = makeVisValue(ReplayDevice, 'GPUDevice');
const PipelineLayoutValue = makeVisValue(ReplayPipelineLayout, 'GPUPipelineLayout');
const QuerySetValue = makeVisValue(ReplayQuerySet, 'GPUQuerySet');
const QueueValue = makeVisValue(ReplayQueue, 'GPUQueue');
const RenderPassValue = makeVisValue(ReplayRenderPass, 'GPURenderPass');
const RenderRenderPipelineValue = makeVisValue(ReplayRenderPass, 'GPURenderPipeline');
const ReplayValue = makeVisValue(Replay, 'Resources');
const SamplerValue = makeVisValue(ReplaySampler, 'GPUSampler');
const ShaderModuleValue = makeVisValue(ReplayShaderModule, 'GPUShaderModule');
const TextureValue = makeVisValue(
    ReplayTexture,
    'GPUTexture',
    (o: ReplayTexture) =>
        `${o.swapChainId ? `swp:${o.swapChainId},` : ''}sz:${gpuExtent3DToShortString(o.size)},${o.format}`
);
const TextureViewValue = makeVisValue(ReplayTextureView, 'GPUTextureView', (o: ReplayTextureView) =>
    o.texture.label ? `->(${o.texture.label}` : ''
);

const s_replayClassToComponent = new Map<Function, ValueComponent>([
    [Replay, ReplayValue],
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

export const getComponentForReplayClass = (Class: Function) => {
    return s_replayClassToComponent.get(Class);
};

export const canDisplayInline = (v: any) => s_replayClassToComponent.has(Object.getPrototypeOf(v).constructor);

export type PropertyNameToComponentMap = Record<string, ValueComponent>;

const GPUBufferUsageValue = ({ data }: { data: number }) => {
    return <div className="wgdb-value-bitmask">{gpuBufferUsageToString(data)}</div>;
};

const GPUTextureUsageValue = ({ data }: { data: number }) => {
    return <div className="wgdb-value-bitmask">{gpuTextureUsageToString(data)}</div>;
};

const GPUAdapterInfoValue = ({ data }: { data: GPUAdapterInfo }) => {
    return (
        <div className="wgdb-jsonvalue-key-value-expandable-value">
            {'{'}
            <div className="wgdb-jsonvalue-key-value">
                <div className="wgdb-jsonvalue-key">vendor:</div>
                <div className="wgdb-jsonvalue-value">{data.vendor},</div>
            </div>
            <div className="wgdb-jsonvalue-key-value">
                <div className="wgdb-jsonvalue-key">architecture:</div>
                <div className="wgdb-jsonvalue-value">{data.architecture},</div>
            </div>
            <div className="wgdb-jsonvalue-key-value">
                <div className="wgdb-jsonvalue-key">device:</div>
                <div className="wgdb-jsonvalue-value">{data.device},</div>
            </div>
            <div className="wgdb-jsonvalue-key-value">
                <div className="wgdb-jsonvalue-key">description:</div>
                <div className="wgdb-jsonvalue-value">{data.description},</div>
            </div>
            {'}'}
        </div>
    );
};

const s_classToSpecialProperties = new Map<Function, PropertyNameToComponentMap>();
s_classToSpecialProperties.set(ReplayBuffer, {
    usage: GPUBufferUsageValue,
});
s_classToSpecialProperties.set(ReplayTexture, {
    usage: GPUTextureUsageValue,
});
s_classToSpecialProperties.set(ReplayAdapter, {
    adapterInfo: GPUAdapterInfoValue,
});

export const getSpecialPropertiesForClass = (Class: Function): PropertyNameToComponentMap =>
    s_classToSpecialProperties.get(Class) || {};
