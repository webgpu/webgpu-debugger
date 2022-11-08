import { kTextureFormatInfo } from '../../../capture';

export interface TextureSampleValue {
    values: Array<number>;
    cssColor: string;
}

export class TextureSamples {
    position: { x: number; y: number };
    samples: Array<TextureSampleValue>;

    constructor(data: { samples?: Array<TextureSampleValue>; position?: { x: number; y: number } }) {
        this.position = data.position ?? { x: 0, y: 0 };
        this.samples = data.samples ?? [];
    }
}

export class TextureInspector {
    device: GPUDevice;
    pipelines: Map<string, GPUComputePipeline> = new Map<string, GPUComputePipeline>();
    uniformBuffer: GPUBuffer;
    resultBuffer: GPUBuffer;

    constructor(device: GPUDevice) {
        this.device = device;
        const shaderModule = device.createShaderModule({
            code: `
          @group(0) @binding(0) var<uniform> pixelCoord : vec2<i32>;
          @group(0) @binding(1) var<storage, read_write> result : array<vec4<f32>>;
          @group(0) @binding(1) var<storage, read_write> depthResult : array<f32>;

          @group(0) @binding(2) var img : texture_2d<f32>;
          @compute @workgroup_size(1)
          fn pickerMain() {
              result[0] = textureLoad(img, pixelCoord, 0);
          }

          @group(0) @binding(2) var depthImg : texture_depth_2d;
          @compute @workgroup_size(1)
          fn depthPickerMain() {
              depthResult[0] = textureLoad(depthImg, pixelCoord, 0);
          }

          @group(0) @binding(2) var multiImg : texture_multisampled_2d<f32>;
          @compute @workgroup_size(1)
          fn multiPickerMain() {
              let sampleCount = i32(textureNumSamples(multiImg));
              for (var i = 0i; i < sampleCount; i += 1i) {
                  result[i] = textureLoad(multiImg, pixelCoord, i);
              }
          }

          @group(0) @binding(2) var multiDepthImg : texture_depth_multisampled_2d;
          @compute @workgroup_size(1)
          fn multiDepthPickerMain() {
              let sampleCount = i32(textureNumSamples(multiDepthImg));
              for (var i = 0i; i < sampleCount; i += 1i) {
                  depthResult[i] = textureLoad(multiDepthImg, pixelCoord, i);
              }
          }
      `,
        });

        this.pipelines.set(
            'color',
            device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: shaderModule,
                    entryPoint: 'pickerMain',
                },
            })
        );

        this.pipelines.set(
            'depth',
            device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: shaderModule,
                    entryPoint: 'depthPickerMain',
                },
            })
        );

        this.pipelines.set(
            'multisampled-color',
            device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: shaderModule,
                    entryPoint: 'multiPickerMain',
                },
            })
        );

        this.pipelines.set(
            'multisampled-depth',
            device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: shaderModule,
                    entryPoint: 'multiDepthPickerMain',
                },
            })
        );

        this.uniformBuffer = device.createBuffer({
            size: Float32Array.BYTES_PER_ELEMENT * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
        this.resultBuffer = device.createBuffer({
            size: Float32Array.BYTES_PER_ELEMENT * 64, // Ought to be enough for anybody!
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
        });
    }

    readbackBuffers: GPUBuffer[] = [];
    getReadbackBuffer() {
        if (this.readbackBuffers.length) {
            return this.readbackBuffers.pop()!;
        } else {
            return this.device.createBuffer({
                size: this.resultBuffer.size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });
        }
    }

    async resolveReadbackBuffer(readbackBuffer: GPUBuffer) {
        await readbackBuffer.mapAsync(GPUMapMode.READ);

        const result = new ArrayBuffer(readbackBuffer.size);
        new Uint8Array(result).set(new Uint8Array(readbackBuffer.getMappedRange()));
        readbackBuffer.unmap();
        this.readbackBuffers.push(readbackBuffer);
        return result;
    }

    formatResultSamples(
        result: ArrayBuffer,
        sampleCount: number,
        format: GPUTextureFormat,
        formatType: string
    ): Array<TextureSampleValue> {
        const resultArray = new Float32Array(result);

        let componentFormatter;
        if (format.includes('unorm')) {
            componentFormatter = (v: number) => Math.floor(v * 255);
        } else if (format.includes('snorm')) {
            componentFormatter = (v: number) => Math.floor(v * 127);
        } else {
            componentFormatter = (v: number) => v;
        }

        const sampleResults = [];

        switch (formatType) {
            case 'color':
                for (let i = 0; i < sampleCount; ++i) {
                    sampleResults.push({
                        values: [
                            componentFormatter(resultArray[i * 4]),
                            componentFormatter(resultArray[i * 4 + 1]),
                            componentFormatter(resultArray[i * 4 + 2]),
                            componentFormatter(resultArray[i * 4 + 3]),
                        ],
                        cssColor: `rgb(${resultArray[i * 4] * 255}, ${resultArray[i * 4 + 1] * 255}, ${
                            resultArray[i * 4 + 2] * 255
                        })`,
                    });
                }
                break;
            case 'depth':
                for (let i = 0; i < sampleCount; ++i) {
                    sampleResults.push({
                        values: [componentFormatter(resultArray[i])],
                        cssColor: `rgb(${resultArray[i] * 255}, ${resultArray[i] * 255}, ${resultArray[i] * 255})`,
                    });
                }
                break;
            default:
                console.warn(`Color picker does not currently support ${formatType} textures.`);
                return [];
        }

        return sampleResults;
    }

    async getSamples(
        texture: GPUTexture,
        x: number,
        y: number,
        mipLevel: number,
        layer: number
    ): Promise<TextureSamples> {
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
            const uniformArray = new Uint32Array(this.uniformBuffer.size / Float32Array.BYTES_PER_ELEMENT);
            uniformArray[0] = x;
            uniformArray[1] = y;
            this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

            const entries: Array<GPUBindGroupEntry> = [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                },
                {
                    binding: 1,
                    resource: { buffer: this.resultBuffer },
                },
                {
                    binding: 2,
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

            bindGroup = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries,
            });
        } else {
            console.warn(`No appropriate pipeline found for texture type "${type}"`);
        }

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        if (pipeline && bindGroup) {
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.setPipeline(pipeline);
            passEncoder.dispatchWorkgroups(1);
        }

        passEncoder.end();

        const readbackBuffer = this.getReadbackBuffer();
        commandEncoder.copyBufferToBuffer(this.resultBuffer, 0, readbackBuffer, 0, readbackBuffer.size);

        this.device.queue.submit([commandEncoder.finish()]);

        const result = await this.resolveReadbackBuffer(readbackBuffer);
        return new TextureSamples({
            samples: this.formatResultSamples(result, texture.sampleCount, texture.format, formatType),
            position: { x, y },
        });
    }

    // Get or create a texture color picker for the given device.
    static pickerCache = new WeakMap();
    static getInspectorForDevice(device: GPUDevice) {
        let picker = TextureInspector.pickerCache.get(device);
        if (!picker) {
            picker = new TextureInspector(device);
            TextureInspector.pickerCache.set(device, picker);
        }
        return picker;
    }
}
