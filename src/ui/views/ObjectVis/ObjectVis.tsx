/* eslint-disable @typescript-eslint/ban-types */
import React from 'react';
import { PaneComponent } from '../../contexts/UIStateContext';

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
import BufferVis from '../objectViews/BufferVis/BufferVis';
import PipelineVis from '../objectViews/PipelineVis/PipelineVis';

interface ObjectVisProps {
    data: any;
}

const s_objectClassToVis = new Map<Function, PaneComponent>([
    [ReplayBuffer, BufferVis],
    [ReplayRenderPipeline, PipelineVis],
]);

export default function ObjectVis({ data }: ObjectVisProps) {
    if (!data) {
        return <div className="spector2-viz">no object</div>;
    }
    const ctor = Object.getPrototypeOf(data).constructor;
    const component = s_objectClassToVis.get(ctor);
    return component ? (
        React.createElement(component, { data })
    ) : (
        <div className="spector2-viz">unsupported object type: (ctor.name)</div>
    );
}
