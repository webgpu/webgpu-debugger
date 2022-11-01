import React, { useRef, useEffect  } from 'react';
import { ReplayTexture } from '../../../replay';
import { spector2 as capture } from '../../../capture';

interface Props {
    texture: ReplayTexture;
    mipLevel: number;
}

export const TextureLevelViewer: React.FC<Props> = ({ texture, mipLevel }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        capture.doWebGPUOp(() => {
            const device = texture.device.webgpuObject;
            const canvas = canvasRef.current;
            canvas.width = texture.size.width;
            canvas.height = texture.size.height;

            const format = navigator.gpu.getPreferredCanvasFormat();

            const context = canvas.getContext('webgpu');
            context.configure({
                device,
                format,
                alphaMode: 'premultiplied',
            });

            // TODO: Cache this renderer per-device
            const shaderModule = device.createShaderModule({ code: `
                var<private> pos : array<vec2<f32>, 4> = array<vec2<f32>, 4>(
                    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, 1.0),
                    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0)
                );

                struct VertexOut {
                    @builtin(position) position : vec4<f32>,
                    @location(0) texCoord : vec2<f32>,
                };

                @vertex
                fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOut {
                    let p = pos[vertexIndex];
                    var output : VertexOut;
                    output.position = vec4<f32>(p, 0.0, 1.0);
                    output.texCoord = (vec2(p.x, -p.y) + vec2(1.0)) * vec2(0.5);
                    return output;
                }

                @group(0) @binding(0) var img : texture_2d<f32>;
                @group(0) @binding(1) var imgSampler : sampler;

                @fragment
                fn fragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
                    return textureSample(img, imgSampler, texCoord);
                }
            `});

            const textureBindGroupLayout = device.createBindGroupLayout({
                entries: [{
                    binding: 0,
                    texture: {},
                    visibility: GPUShaderStage.FRAGMENT
                }, {
                    binding: 1,
                    sampler: {},
                    visibility: GPUShaderStage.FRAGMENT
                }]
            });

            const texturePipelineLayout = device.createPipelineLayout({
                bindGroupLayouts: [textureBindGroupLayout]
            });

            const texturePipeline = device.createRenderPipeline({
                layout: texturePipelineLayout,
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vertexMain'
                },
                primitive: {
                    topology: 'triangle-strip'
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [{
                        format,
                        blend: {
                            color: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                            alpha: {
                                srcFactor: 'one',
                                dstFactor: 'zero'
                            }
                        }
                    }]
                }
            });

            const defaultSampler = device.createSampler({});

            const textureBindGroup = device.createBindGroup({
                layout: textureBindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: texture.webgpuObject.createView(),
                }, {
                    binding: 1,
                    resource: defaultSampler
                }]
            });

            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    clearValue: [1.0, 0.0, 0.0, 1.0],
                    storeOp: 'store'
                }]
            });

            passEncoder.setBindGroup(0, textureBindGroup);

            passEncoder.setPipeline(texturePipeline);
            passEncoder.draw(4);

            passEncoder.end();
            device.queue.submit([commandEncoder.finish()]);
        });
    }, []);

    return <div>Texture mipLevel: {mipLevel} <canvas ref={canvasRef}/></div>;
};
