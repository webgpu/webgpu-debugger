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

export type ValueComponent = React.FunctionComponent<any> | React.ComponentClass<any>;

function makeVisValue(Class: Function, typeName: string) {
    return function VisValue({ data }: { data: any }) {
        const { helper } = useContext(UIStateContext);
        const { onAddPaneViaDrag } = useContext(TileContext);

        const freePaneId = helper.state.freePaneIds[0];
        let name = `${typeName}${data.label ? `(${data.label})` : ''}`;
        switch (typeName) {
            case 'GPUTextureView':
                if (data.texture.label) {
                    name += `->(${data.texture.label})`;
                }
                break;
            case 'GPUTexture':
                if (data.swapChainId) {
                    name += `:[${data.swapChainId}]`;
                }
                break;
        }
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
const ReplayValue = makeVisValue(Replay, 'Resources');
const SamplerValue = makeVisValue(ReplaySampler, 'GPUSampler');
const ShaderModuleValue = makeVisValue(ReplayShaderModule, 'GPUShaderModule');
const TextureValue = makeVisValue(ReplayTexture, 'GPUTexture');
const TextureViewValue = makeVisValue(ReplayTextureView, 'GPUTextureView');

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

export const getSpecialPropertiesForClass = (Class: Function): PropertyNameToComponentMap =>
    s_classToSpecialProperties.get(Class) || {};
