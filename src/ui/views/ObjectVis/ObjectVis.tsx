/* eslint-disable @typescript-eslint/ban-types */
import React from 'react';
import { PaneComponent } from '../../contexts/UIStateContext';

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

import AdapterVis from '../objectViews/AdapterVis/AdapterVis';
import BindGroupLayoutVis from '../objectViews/BindGroupLayoutVis/BindGroupLayoutVis';
import BindGroupVis from '../objectViews/BindGroupVis/BindGroupVis';
import BufferVis from '../objectViews/BufferVis/BufferVis';
import CommandBufferVis from '../objectViews/CommandBufferVis/CommandBufferVis';
import DeviceVis from '../objectViews/DeviceVis/DeviceVis';
import PipelineLayoutVis from '../objectViews/PipelineLayoutVis/PipelineLayoutVis';
import QuerySetVis from '../objectViews/QuerySetVis/QuerySetVis';
import QueueVis from '../objectViews/QueueVis/QueueVis';
import RenderPassVis from '../objectViews/RenderPassVis/RenderPassVis';
import RenderPipelineVis from '../objectViews/RenderPipelineVis/RenderPipelineVis';
import ReplayVis from '../objectViews/ReplayVis/ReplayVis';
import SamplerVis from '../objectViews/SamplerVis/SamplerVis';
import ShaderModuleVis from '../objectViews/ShaderModuleVis/ShaderModuleVis';
import TextureViewVis from '../objectViews/TextureViewVis/TextureViewVis';
import TextureVis from '../objectViews/TextureVis/TextureVis';

interface ObjectVisProps {
    data: any;
}

const s_objectClassToVis = new Map<Function, PaneComponent>([
    [Replay, ReplayVis],
    [ReplayAdapter, AdapterVis],
    [ReplayBindGroup, BindGroupVis],
    [ReplayBindGroupLayout, BindGroupLayoutVis],
    [ReplayBuffer, BufferVis],
    [ReplayCommandBuffer, CommandBufferVis],
    [ReplayDevice, DeviceVis],
    [ReplayPipelineLayout, PipelineLayoutVis],
    [ReplayQuerySet, QuerySetVis],
    [ReplayQueue, QueueVis],
    [ReplayRenderPass, RenderPassVis],
    [ReplayRenderPipeline, RenderPipelineVis],
    [ReplaySampler, SamplerVis],
    [ReplayShaderModule, ShaderModuleVis],
    [ReplayTexture, TextureVis],
    [ReplayTextureView, TextureViewVis],
]);

export default function ObjectVis({ data }: ObjectVisProps) {
    if (!data) {
        return <div className="spector2-vis">no object</div>;
    }
    const ctor = Object.getPrototypeOf(data).constructor;
    const component = s_objectClassToVis.get(ctor);
    return component ? (
        React.createElement(component, { data })
    ) : (
        <div className="spector2-vis">unsupported object type: {ctor.name}</div>
    );
}
