import React, { useRef, useEffect, useContext } from 'react';
import { ReplayBuffer } from '../../../replay';
import { getUnwrappedGPUCanvasContext } from '../../../capture';
import { UIStateContext } from '../../contexts/UIStateContext';
import { BufferRenderer, BufferRenderParameters } from './BufferRenderer';

import { mat4 } from 'wgpu-matrix';

import './BufferViewer.css';

interface Props {
    buffer: ReplayBuffer;
}

const BufferViewer: React.FC<Props> = ({ buffer }: Props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { helper } = useContext(UIStateContext);

    useEffect(() => {
        const device = buffer.device.webgpuObject!;

        const canvas = canvasRef.current!;
        canvas.width = 300;
        canvas.height = 300;

        const context = getUnwrappedGPUCanvasContext(canvas);
        context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
        });

        const projection = mat4.perspective((30 * Math.PI) / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 10);
        const eye = [1, 4, -6];
        const target = [0, 0, 0];
        const up = [0, 1, 0];

        const camera = mat4.lookAt(eye, target, up);
        const view = mat4.inverse(camera);
        const viewProjection = mat4.multiply(projection, view);
        const world = mat4.rotationY(0.1);
        const worldViewMatrix = mat4.multiply(viewProjection, world);

        let rafId = 0;
        const draw = () => {
            const renderer = BufferRenderer.getRendererForDevice(device);
            const params: BufferRenderParameters = {
                position: { buffer, offset: 0, stride: 9, size: 3 },
                primitiveTopology: 'line-list',
                worldViewMatrix,
                renderColor: [1, 0, 0, 1],
                numVertices: 24,
            };
            renderer.render(context, params);
            rafId = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [buffer, helper.state.replayCount]);

    return (
        <div className="spector2-buffer-viewer">
            <div className="spector2-buffer-viewer-canvas-container">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

export default BufferViewer;
