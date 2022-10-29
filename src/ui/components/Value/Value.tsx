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
import { UIStateContext, PaneComponent } from '../../contexts/UIStateContext';
import BufferVis from '../../views/objectViews/BufferVis/BufferVis';
import PipelineVis from '../../views/objectViews/PipelineVis/PipelineVis';

import './Value.css';

export type ValueComponent = React.FunctionComponent<any> | React.ComponentClass<any>;

function PlaceHolder({ data }: { data: any }) {
    return <div>placeholder{`<${Object.getPrototypeOf(data).constructor.name}>`}</div>;
}

function makeVisValue(Class: Function, visComponent: PaneComponent, typeName: string) {
    return function VisValue({ data }: { data: ReplayBuffer }) {
        const { helper } = useContext(UIStateContext);
        return (
            <div
                onClick={() => {
                    helper.setObjectView(visComponent, data);
                }}
                className={`spector2-value-vis spector-value-${typeName}`}
            >
                {typeName}
            </div>
        );
    };
}

const BufferValue = makeVisValue(ReplayBuffer, BufferVis, 'GPUBuffer');
const RenderPipelineValue = makeVisValue(ReplayRenderPass, PipelineVis, 'GPURenderPipeline');

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

export function ValueObject({ data }: Record<string, any>) {
    return (
        <table className="spector2-value-object">
            <tbody>
                {Object.entries(data).map(([key, value], ndx) => [
                    <tr className="spector2-value-key-value" key={'p${ndx}'}>
                        <td key={`k${ndx}`} className="spector2-value-key">
                            {key}:
                        </td>
                        <td>
                            <Value key={`v${ndx}`} data={value} />
                        </td>
                    </tr>,
                ])}
            </tbody>
        </table>
    );
}

function ValueArray({ data }: { data: any[] }) {
    return (
        <table className="spector2-value-array">
            <tbody>
                {data.map((v, ndx) => (
                    <tr key={`e${ndx}`}>
                        <td>{ndx}</td>
                        <td>
                            <Value data={v} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function Value({ data }: { data: any }) {
    if (data === undefined) {
        return <div>undefined</div>;
    } else if (data === null) {
        return <div>null</div>;
    } else if (typeof data === 'number') {
        return <div className="spector2-value-number">{data}</div>;
    } else if (typeof data === 'string') {
        return <div className="spector2-value-string">&quot;{data}&quot;</div>;
    } else if (Array.isArray(data)) {
        return <ValueArray data={data} />;
    } else if (typeof data === 'function') {
        return <div className="spector2-value-function">{data.name}</div>;
    } else if (typeof data === 'object') {
        const proto = Object.getPrototypeOf(data);
        if (proto === baseObjectProto) {
            return <ValueObject data={data} />;
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
