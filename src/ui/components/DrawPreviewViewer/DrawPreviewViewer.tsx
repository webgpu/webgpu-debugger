import React, { useState, useRef, useEffect, useContext } from 'react';
import { ReplayRenderPipeline } from '../../../replay';
import { getUnwrappedGPUCanvasContext } from '../../../capture';
import { UIStateContext } from '../../contexts/UIStateContext';
import { DrawPreviewAttribLayout } from '../../components/DrawPreviewAttribLayout/DrawPreviewAttribLayout';
import Value from '../Value/Value';
import { DrawPreviewPipeline, DrawPreviewRenderer } from './DrawPreviewRenderer';

interface Props {
  state: any;
}

export function DrawPreviewViewer({ state }: Props) {
  const [attribsOpen] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { helper } = useContext(UIStateContext);

  useEffect(() => {
    const pipeline = state?.pipeline;
    if (!(pipeline instanceof ReplayRenderPipeline)) { return; }

    const device = pipeline.device.webgpuObject!;
    const canvas = canvasRef.current!;

    canvas.width = 512;
    canvas.height = 512;

    const context = getUnwrappedGPUCanvasContext(canvas);
    context.configure({
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
    });

    const renderer = DrawPreviewRenderer.getRendererForDevice(device);

    let rafId = -1;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      renderer.render(context, state);
    };
    draw();

    return () => {
        cancelAnimationFrame(rafId);
    };

  }, [helper.state.replayCount]);

  return (
    <div className={'spector2-drawpreviewviewer'}>
      {state?.pipeline instanceof ReplayRenderPipeline &&
          <div>
              <details open={attribsOpen}>
                  <summary><b>Preview attributes for <Value data={state.pipeline} /></b></summary>
                  <DrawPreviewAttribLayout key={state.pipeline.replayObjectKey} data={state.pipeline} />
              </details>
              <hr/>
          </div>
      }
      <canvas ref={canvasRef} />
    </div>
  );
}