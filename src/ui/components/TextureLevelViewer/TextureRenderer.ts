import { kTextureFormatInfo } from '../../../capture';

export class TextureRenderer {
    device: GPUDevice;
    pipelines: Map<string, GPURenderPipeline> = new Map<string, GPURenderPipeline>();
    sampler: GPUSampler;

    constructor(device: GPUDevice) {
        this.device = device;
        const shaderModule = device.createShaderModule({
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
                let sampleCount = i32(textureNumSamples(multiImg));
                let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(multiImg)));

                var accumValue : vec4<f32>;
                for (var i = 0i; i < sampleCount; i += 1i) {
                    accumValue += textureLoad(multiImg, sampleCoord, i);
                }
                return accumValue / f32(sampleCount);
            }

            @group(0) @binding(1) var multiDepthImg : texture_depth_multisampled_2d;
            @fragment
            fn multiDepthFragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
                let sampleCount = i32(textureNumSamples(multiDepthImg));
                let sampleCoord = vec2<i32>(texCoord * vec2<f32>(textureDimensions(multiDepthImg)));

                var accumValue : f32;
                for (var i = 0i; i < sampleCount; i += 1i) {
                    accumValue += textureLoad(multiDepthImg, sampleCoord, i);
                }
                return vec4(vec3(accumValue) / f32(sampleCount), 1.0);
            }
        `,
        });

        const vertex: GPUVertexState = {
            module: shaderModule,
            entryPoint: 'vertexMain',
        };
        const primitive: GPUPrimitiveState = {
            topology: 'triangle-strip',
        };
        const targets: GPUColorTargetState[] = [
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
        ];

        this.pipelines.set(
            'color',
            device.createRenderPipeline({
                layout: 'auto',
                vertex,
                primitive,
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets,
                },
            })
        );

        this.pipelines.set(
            'depth',
            device.createRenderPipeline({
                layout: 'auto',
                vertex,
                primitive,
                fragment: {
                    module: shaderModule,
                    entryPoint: 'depthFragmentMain',
                    targets,
                },
            })
        );

        this.pipelines.set(
            'multisampled-color',
            device.createRenderPipeline({
                layout: 'auto',
                vertex,
                primitive,
                fragment: {
                    module: shaderModule,
                    entryPoint: 'multiFragmentMain',
                    targets,
                },
            })
        );

        this.pipelines.set(
            'multisampled-depth',
            device.createRenderPipeline({
                layout: 'auto',
                vertex,
                primitive,
                fragment: {
                    module: shaderModule,
                    entryPoint: 'multiDepthFragmentMain',
                    targets,
                },
            })
        );

        this.sampler = device.createSampler({});
    }

    render(context: GPUCanvasContext, texture: GPUTexture, mipLevel: number, layer: number) {
        const formatInfo = kTextureFormatInfo[texture.format];
        let formatType = formatInfo?.type;
        let aspect: GPUTextureAspect = 'all';
        // TODO: For the moment force depth-stencil textures to only render the depth aspect.
        // We want to be able to visualize the stencil aspect as well, though.
        if (formatType === 'depth-stencil') {
            formatType = 'depth';
            aspect = 'depth-only';
        }
        const type = (texture.sampleCount > 1 ? 'multisampled-' : '') + formatType;

        const pipeline = this.pipelines.get(type);
        let bindGroup;

        if (pipeline) {
            const entries: Array<GPUBindGroupEntry> = [
                {
                    binding: 1,
                    resource: texture.createView({
                        dimension: '2d',
                        aspect,
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
    static rendererCache = new WeakMap();
    static getRendererForDevice(device: GPUDevice) {
        let renderer = TextureRenderer.rendererCache.get(device);
        if (!renderer) {
            renderer = new TextureRenderer(device);
            TextureRenderer.rendererCache.set(device, renderer);
        }
        return renderer;
    }
}

export class CubeTextureRenderer {
    device: GPUDevice;
    pipelines: Map<string, GPURenderPipeline> = new Map<string, GPURenderPipeline>();
    sampler: GPUSampler;
    uniformBuffer: GPUBuffer;

    constructor(device: GPUDevice) {
        this.device = device;
        const shaderModule = device.createShaderModule({
            code: `
            var<private> pos : array<vec3<f32>, 8> = array<vec3<f32>, 8>(
                vec3<f32>( 1.0,  1.0,  1.0),
                vec3<f32>(-1.0,  1.0,  1.0),
                vec3<f32>( 1.0, -1.0,  1.0),
                vec3<f32>(-1.0, -1.0,  1.0),
                vec3<f32>( 1.0,  1.0, -1.0),
                vec3<f32>(-1.0,  1.0, -1.0),
                vec3<f32>( 1.0, -1.0, -1.0),
                vec3<f32>(-1.0, -1.0, -1.0),
            );

            var<private> indices : array<u32, 36> = array<u32, 36>(
                // PosX (Right)
                0, 2, 4,
                6, 4, 2,

                // NegX (Left)
                5, 3, 1,
                3, 5, 7,

                // PosY (Top)
                4, 1, 0,
                1, 4, 5,

                // NegY (Bottom)
                2, 3, 6,
                7, 6, 3,

                // PosZ (Front)
                0, 1, 2,
                3, 2, 1,

                // NegZ (Back)
                6, 5, 4,
                5, 6, 7,
            );

            struct VertexOut {
                @builtin(position) position : vec4<f32>,
                @location(0) texCoord : vec3<f32>,
            };

            struct Uniforms {
                time : f32,
                angle : vec2<f32>,
            };
            @group(0) @binding(0) var<uniform> uniforms : Uniforms;

            // Builds rotation matrices around the X or Y axis.
            fn rotateX(t : f32) -> mat3x3<f32> {
                let c = cos(t);
                let s = sin(t);
                return mat3x3<f32>(
                    1, 0, 0,
                    0, c, -s,
                    0, s, c
                );
            }
            fn rotateY(t : f32) -> mat3x3<f32> {
                let c = cos(t);
                let s = sin(t);
                return mat3x3<f32>(
                    c, 0, s,
                    0, 1, 0,
                    -s, 0, c
                );
            }

            @vertex
            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOut {
                let p = pos[indices[vertexIndex]];
                var output : VertexOut;
                output.position = vec4<f32>(p, 1.0);
                output.texCoord = rotateY(uniforms.angle.x) * rotateX(uniforms.angle.y) * p;
                return output;
            }

            @group(0) @binding(1) var imgSampler : sampler;

            @group(0) @binding(2) var img : texture_cube<f32>;
            @fragment
            fn fragmentMain(@location(0) texCoord : vec3<f32>) -> @location(0) vec4<f32> {
                return textureSample(img, imgSampler, texCoord);
            }

            @group(0) @binding(2) var depthImg : texture_depth_cube;
            @fragment
            fn depthFragmentMain(@location(0) texCoord : vec3<f32>) -> @location(0) vec4<f32> {
                let depth = textureSample(depthImg, imgSampler, texCoord);
                return vec4(depth, depth, depth, 1.0);
            }
        `,
        });

        const vertex: GPUVertexState = {
            module: shaderModule,
            entryPoint: 'vertexMain',
        };
        const primitive: GPUPrimitiveState = {
            topology: 'triangle-strip',
        };
        const targets: GPUColorTargetState[] = [
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
        ];

        this.pipelines.set(
            'color',
            device.createRenderPipeline({
                layout: 'auto',
                vertex,
                primitive,
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets,
                },
            })
        );

        this.pipelines.set(
            'depth',
            device.createRenderPipeline({
                layout: 'auto',
                vertex,
                primitive,
                fragment: {
                    module: shaderModule,
                    entryPoint: 'depthFragmentMain',
                    targets,
                },
            })
        );

        this.sampler = device.createSampler({
            minFilter: 'linear',
            magFilter: 'linear',
        });
        this.uniformBuffer = device.createBuffer({
            size: Float32Array.BYTES_PER_ELEMENT * 36,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
    }

    render(
        context: GPUCanvasContext,
        texture: GPUTexture,
        mipLevel: number,
        layer: number,
        angleX: number,
        angleY: number
    ) {
        const formatInfo = kTextureFormatInfo[texture.format];
        const type = formatInfo?.type;

        const pipeline = this.pipelines.get(type);
        let bindGroup;

        const uniformArray = new Float32Array(this.uniformBuffer.size / Float32Array.BYTES_PER_ELEMENT);
        // Time
        uniformArray[0] = performance.now();
        // Angle
        uniformArray[2] = angleX;
        uniformArray[3] = angleY;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

        if (pipeline) {
            const entries: Array<GPUBindGroupEntry> = [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                },
                {
                    binding: 1,
                    resource: this.sampler,
                },
                {
                    binding: 2,
                    resource: texture.createView({
                        dimension: 'cube',
                        baseMipLevel: mipLevel,
                        mipLevelCount: 1,
                        baseArrayLayer: layer,
                        arrayLayerCount: 6,
                    }),
                },
            ];

            bindGroup = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries,
            });
        } else {
            console.warn(`No approprate cube pipeline found for texture type "${type}"`);
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
            passEncoder.draw(36);
        }

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    // Get or create a texture renderer for the given device.
    static rendererCache = new WeakMap();
    static getRendererForDevice(device: GPUDevice) {
        let renderer = CubeTextureRenderer.rendererCache.get(device);
        if (!renderer) {
            renderer = new CubeTextureRenderer(device);
            CubeTextureRenderer.rendererCache.set(device, renderer);
        }
        return renderer;
    }
}
