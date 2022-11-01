import React, { useRef, useEffect  } from 'react';
import { ReplayTexture } from '../../../replay';
import { spector2 as capture } from '../../../capture';

interface Props {
    texture: ReplayTexture;
    mipLevel: number;
}

class TextureRenderer {
    device : GPUDevice;
    shaderModule : GPUShaderModule;
    bindGroupLayout : GPUBindGroupLayout;
    pipeline : GPURenderPipeline;
    sampler : GPUSampler;

    constructor(device : GPUDevice) {
        this.device = device;
        this.shaderModule = device.createShaderModule({ code: `
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

        this.bindGroupLayout = device.createBindGroupLayout({
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

        this.pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.shaderModule,
                entryPoint: 'vertexMain'
            },
            primitive: {
                topology: 'triangle-strip'
            },
            fragment: {
                module: this.shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat(),
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

        this.sampler = device.createSampler({});
    }

    render(context : GPUCanvasContext, texture : GPUTexture, mipLevel : number) {
        const textureBindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [{
                binding: 0,
                resource: texture.createView({
                    baseMipLevel: mipLevel,
                    mipLevelCount: 1
                }),
            }, {
                binding: 1,
                resource: this.sampler
            }]
        });

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        passEncoder.setBindGroup(0, textureBindGroup);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.draw(4);

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    // Get or create a texture renderer for the given device.
    static rendererCache = new Map();
    static getRendererForDevice(device : GPUDevice) {
        let renderer = TextureRenderer.rendererCache.get(device);
        if (!renderer) {
            renderer = new TextureRenderer(device);
            TextureRenderer.rendererCache.set(device, renderer);
        }
        return renderer;
    }
}

export const TextureLevelViewer: React.FC<Props> = ({ texture, mipLevel }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        capture.doWebGPUOp(() => {
            const device = texture.device.webgpuObject;
            if (!device) { return; }

            const canvas = canvasRef.current;
            canvas.width = texture.size.width;
            canvas.height = texture.size.height;

            const context = canvas.getContext('webgpu');
            context.configure({
                device,
                format: navigator.gpu.getPreferredCanvasFormat(),
                alphaMode: 'premultiplied',
            });

            const renderer = TextureRenderer.getRendererForDevice(device);
            renderer.render(context, texture.webgpuObject, mipLevel);
        });
    }, []);

    return <div>Texture mipLevel: {mipLevel} <canvas ref={canvasRef}/></div>;
};
