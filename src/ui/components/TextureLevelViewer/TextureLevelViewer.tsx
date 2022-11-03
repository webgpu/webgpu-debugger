import React, { useState, useRef, useEffect, useContext, DOMElement } from 'react';
import { ReplayTexture } from '../../../replay';
import { kTextureFormatInfo, getUnwrappedGPUCanvasContext } from '../../../capture';
import { UIStateContext } from '../../contexts/UIStateContext';
import Checkbox from '../../components/Checkbox/Checkbox';
import Range from '../../components/Range/Range';

import './TextureLevelViewer.css'

class TextureRenderer {
    device: GPUDevice;
    shaderModule: GPUShaderModule;
    pipelines: Map<string, GPURenderPipeline> = new Map<string, GPURenderPipeline>();
    sampler: GPUSampler;

    constructor(device: GPUDevice) {
        this.device = device;
        this.shaderModule = device.createShaderModule({
            code: `
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

            @group(0) @binding(0) var imgSampler : sampler;

            @group(0) @binding(1) var img : texture_2d<f32>;
            @fragment
            fn fragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
                return textureSample(img, imgSampler, texCoord);
            }

            @group(0) @binding(1) var depthImg : texture_depth_2d;
            @fragment
            fn depthFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
                let depth = textureSample(depthImg, imgSampler, texCoord);
                return vec4(depth, depth, depth, 1.0);
            }

            @group(0) @binding(1) var multiImg : texture_multisampled_2d<f32>;
            @fragment
            fn multiFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
                let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(multiImg)));
                return textureLoad(multiImg, sampleCoord, 0i);
            }

            @group(0) @binding(1) var multiDepthImg : texture_depth_multisampled_2d;
            @fragment
            fn multiDepthFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
                let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(multiDepthImg)));
                let depth = textureLoad(multiDepthImg, sampleCoord, 0i);
                return vec4(depth, depth, depth, 1.0);
            }
        `,
        });

        this.pipelines.set(
            'color',
            device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: this.shaderModule,
                    entryPoint: 'vertexMain',
                },
                primitive: {
                    topology: 'triangle-strip',
                },
                fragment: {
                    module: this.shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [
                        {
                            format: navigator.gpu.getPreferredCanvasFormat(),
                            blend: {
                                color: {
                                    srcFactor: 'src-alpha',
                                    dstFactor: 'one-minus-src-alpha',
                                },
                                alpha: {
                                    srcFactor: 'one',
                                    dstFactor: 'zero',
                                },
                            },
                        },
                    ],
                },
            })
        );

        this.pipelines.set(
            'depth',
            device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: this.shaderModule,
                    entryPoint: 'vertexMain',
                },
                primitive: {
                    topology: 'triangle-strip',
                },
                fragment: {
                    module: this.shaderModule,
                    entryPoint: 'depthFragmentMain',
                    targets: [
                        {
                            format: navigator.gpu.getPreferredCanvasFormat(),
                            blend: {
                                color: {
                                    srcFactor: 'src-alpha',
                                    dstFactor: 'one-minus-src-alpha',
                                },
                                alpha: {
                                    srcFactor: 'one',
                                    dstFactor: 'zero',
                                },
                            },
                        },
                    ],
                },
            })
        );

        this.pipelines.set(
            'multisampled-color',
            device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: this.shaderModule,
                    entryPoint: 'vertexMain',
                },
                primitive: {
                    topology: 'triangle-strip',
                },
                fragment: {
                    module: this.shaderModule,
                    entryPoint: 'multiFragmentMain',
                    targets: [
                        {
                            format: navigator.gpu.getPreferredCanvasFormat(),
                            blend: {
                                color: {
                                    srcFactor: 'src-alpha',
                                    dstFactor: 'one-minus-src-alpha',
                                },
                                alpha: {
                                    srcFactor: 'one',
                                    dstFactor: 'zero',
                                },
                            },
                        },
                    ],
                },
            })
        );

        this.pipelines.set(
            'multisampled-depth',
            device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: this.shaderModule,
                    entryPoint: 'vertexMain',
                },
                primitive: {
                    topology: 'triangle-strip',
                },
                fragment: {
                    module: this.shaderModule,
                    entryPoint: 'multiDepthFragmentMain',
                    targets: [
                        {
                            format: navigator.gpu.getPreferredCanvasFormat(),
                            blend: {
                                color: {
                                    srcFactor: 'src-alpha',
                                    dstFactor: 'one-minus-src-alpha',
                                },
                                alpha: {
                                    srcFactor: 'one',
                                    dstFactor: 'zero',
                                },
                            },
                        },
                    ],
                },
            })
        );

        this.sampler = device.createSampler({});
    }

    render(context: GPUCanvasContext, texture: GPUTexture, mipLevel: number, layer: number) {
        const formatInfo = kTextureFormatInfo[texture.format];
        const type = (texture.sampleCount > 1 ? 'multisampled-' : '') + formatInfo?.type;

        const pipeline = this.pipelines.get(type);
        let bindGroup;

        if (pipeline) {
            const entries: Array<GPUBindGroupEntry> = [
                {
                    binding: 1,
                    resource: texture.createView({
                        dimension: '2d',
                        baseMipLevel: mipLevel,
                        mipLevelCount: 1,
                        baseArrayLayer: layer,
                        arrayLayerCount: 1,
                    }),
                },
            ];

            if (texture.sampleCount === 1) {
                entries.push({
                    binding: 0,
                    resource: this.sampler,
                });
            }

            bindGroup = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries,
            });
        } else {
            console.warn(`No approprate pipeline found for texture type "${type}"`);
        }

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        if (pipeline && bindGroup) {
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.setPipeline(pipeline);
            passEncoder.draw(4);
        }

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    // Get or create a texture renderer for the given device.
    static rendererCache = new Map();
    static getRendererForDevice(device: GPUDevice) {
        let renderer = TextureRenderer.rendererCache.get(device);
        if (!renderer) {
            renderer = new TextureRenderer(device);
            TextureRenderer.rendererCache.set(device, renderer);
        }
        return renderer;
    }
}

interface Props {
    texture: ReplayTexture;
    baseMipLevel?: number;
    mipLevelCount?: number;
    baseArrayLayer?: number;
    arrayLayerCount?: number;
}

const TextureLevelViewer: React.FC<Props> = ({ texture, baseMipLevel = 0, mipLevelCount, baseArrayLayer = 0, arrayLayerCount }: Props) => {
    const [actualSize, setActualSize] = useState(false);
    const [pixelated, setPixelated] = useState(false);
    const [mipLevel, setMipLevel] = useState(baseMipLevel);
    const [arrayLayer, setArrayLayer] = useState(baseArrayLayer);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { helper } = useContext(UIStateContext);

    if (mipLevelCount === undefined) {
        mipLevelCount = texture.mipLevelCount - baseMipLevel;
    }
    if (arrayLayerCount === undefined) {
        arrayLayerCount = texture.size.depthOrArrayLayers - baseArrayLayer;
    }

    const maxMipLevel = baseMipLevel + mipLevelCount - 1;
    const maxArrayLayer = baseArrayLayer + arrayLayerCount - 1;

    useEffect(() => {
        const device = texture.device.webgpuObject!;

        const canvas = canvasRef.current!;
        canvas.width = texture.size.width >> mipLevel;
        canvas.height = texture.size.height >> mipLevel;

        const context = getUnwrappedGPUCanvasContext(canvas);
        context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
        });

        const renderer = TextureRenderer.getRendererForDevice(device);
        renderer.render(context, texture.webgpuObject, mipLevel, arrayLayer);
    }, [texture, mipLevel, arrayLayer, actualSize, helper.state.replayCount]);

    return (
        <div className="spector2-textureviewer" style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}>
            <div>
                <Checkbox label="Display actual size:" checked={actualSize} onChange={setActualSize} />
                <Checkbox label="Pixelated:" checked={pixelated} onChange={setPixelated} />
            </div>
            {arrayLayerCount > 1 && (
                <div>
                    <Range
                        label="Layer:"
                        min={baseArrayLayer}
                        max={maxArrayLayer}
                        value={arrayLayer}
                        valueFormatFn={(v: number) => `${v} of [${baseArrayLayer}, ${maxArrayLayer}]`}
                        onChange={setArrayLayer}
                    />
                </div>
            )}
            {mipLevelCount > 1 && (
                <div>
                    <Range
                        label="Level:"
                        min={baseMipLevel}
                        max={maxMipLevel}
                        value={mipLevel}
                        valueFormatFn={(v: number) => `${v} of [${baseMipLevel}, ${maxMipLevel}]`}
                        onChange={setMipLevel}
                    />
                </div>
            )}
            <div className="spector2-textureviewer-canvascontainer">
                <canvas ref={canvasRef} className={ actualSize ? '' : 'fill' } />
            </div>
        </div>
    );
};

export default TextureLevelViewer;
