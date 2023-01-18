import { assert } from 'chai';
import { spector2 as capture, requestUnwrappedAdapter } from '../../capture';
import { loadReplay, ReplayTexture } from '../../replay';
import { getPathForLastStep } from '../../ui/lib/replay-utils';

describe('replay tests', () => {
    it('simple', async () => {
        {
            const adapter = await navigator.gpu.requestAdapter();
            const device = await adapter!.requestDevice()!;

            const context = document.createElement('canvas').getContext('webgpu')!;
            const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
            context.configure({
                device,
                format: presentationFormat,
                alphaMode: 'opaque',
            });
            capture.startTracing();

            const module = device.createShaderModule({
                code: `
                    @vertex fn vs(
                      @builtin(vertex_index) VertexIndex : u32
                    ) -> @builtin(position) vec4<f32> {
                      var pos = array<vec2<f32>, 3>(
                        vec2(-1.0, -1.0),
                        vec2(-1.0,  3.0),
                        vec2( 3.0, -1.0)
                      );

                      return vec4(pos[VertexIndex], 0.0, 1.0);
                    }

                    @fragment fn fs(
                       @builtin(position) pos : vec4<f32>
                    ) -> @location(0) vec4<f32> {
                      return select(vec4f(1, 0, 0, 1), vec4f(0, 0, 1, 1), pos.x < 150.0);
                    }
                `,
            });

            const pipeline = device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module,
                    entryPoint: 'vs',
                },
                fragment: {
                    module,
                    entryPoint: 'fs',
                    targets: [{ format: presentationFormat }],
                },
            });

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: context.getCurrentTexture().createView(),
                        clearValue: [0.0, 0.0, 0.0, 0.0],
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            pass.setPipeline(pipeline);
            pass.draw(3);
            pass.end();

            device.queue.submit([encoder.finish()]);
        }

        {
            const trace = await capture.endTracing();
            const replay = await loadReplay(trace!, requestUnwrappedAdapter);
            const lastPath = getPathForLastStep(replay);
            const gpuState = await replay.replayTo(lastPath);
            const replayTexture = gpuState?.currentTexture as ReplayTexture;
            const texture = replayTexture.webgpuObject;
            const device = replayTexture.device.webgpuObject;
            const buffer = device.createBuffer({
                size: 512 * 150 * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });
            const encoder = device.createCommandEncoder();
            encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow: 512 * 4 }, { width: 300, height: 150 });
            device.queue.submit([encoder.finish()]);

            await buffer.mapAsync(GPUMapMode.READ);
            const pixels = new Uint32Array(buffer.getMappedRange());
            assert.equal(pixels[0], 0xff0000ff);
            assert.equal(pixels[512 * 149 + 299], 0xffff0000);
        }
    });
});
