import { ReplayBuffer } from '../../../replay';
import { vec3, mat4 } from 'wgpu-matrix';
import { TypedArray, TypedArrayViewGenerator } from '../../lib/typedarray-utils';

type VertexDesc = {
    buffer: ReplayBuffer;
    offset: number;
    stride: number;
    size: number; // 1 - 4
};

export type BufferRenderParameters = {
    position: VertexDesc;
    color?: VertexDesc;
    indexBuffer?: ReplayBuffer;
    indexBufferType?: GPUIndexFormat;
    primitiveTopology: GPUPrimitiveTopology;
    worldViewMatrix: Float32Array | number[];
    numVertices: number;
    renderColor: Float32Array | number[];
};

function setUniformValues(
    params: Record<string, number | number[] | TypedArray>,
    uniformValues: Record<string, TypedArray>
) {
    for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'number') {
            uniformValues[k][0] = v;
        } else {
            uniformValues[k].set(v);
        }
    }
}

const lineHelperParams = {
    'point-list': {
        /*
        Each vertex defines a point primitive.

        0 1 2 3 4 5
        */
        triDiv: 6,
        triMul: 6,
        midMod: 6,
        midDiv: 1,
        oddMod: 1,
        triMod: 3,
    },
    'line-strip': {
        /*
        Each vertex after the first defines a line primitive between it and the previous vertex.

        0--1--2--3

        0 1 1 2 2 3

                var i = (vertex_index / 2u) * 1u +   // 0 0 0 0 0 0 3 3 3 3 3 3 6 6 6 6 6 6
                        ((vertex_index % 1u) / 2u +  // 0 0 1 1 2 2 0 0 1 1 2 2 0 0 1 1 2 2
                        (vertex_index % 2u)) % 1;    // 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1
                                                     // 0 1 1 2 2 0 3 4 4 5 5 3
        */
        triDiv: 2,
        triMul: 1,
        midMod: 1,
        midDiv: 2,
        oddMod: 2,
        triMod: 1,
    },
    'line-list': {
        /*
        Each consecutive pair of two vertices defines a line primitive.

        0--1  2--3

        0 1 2 3 4 5

                var i = (vertex_index / 6u) * 6u +   // 0 0 0 0 0 0 3 3 3 3 3 3 6 6 6 6 6 6
                        ((vertex_index % 6u) / 1u +  // 0 0 1 1 2 2 0 0 1 1 2 2 0 0 1 1 2 2
                        (vertex_index % 1u)) % 3;    // 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1
                                                     // 0 1 1 2 2 0 3 4 4 5 5 3
        */
        triDiv: 6,
        triMul: 6,
        midMod: 6,
        midDiv: 1,
        oddMod: 1,
        triMod: 3,
    },

    'triangle-strip': {
        /*
        Each vertex after the first two defines a triangle primitive between it and the previous two vertices.

          1---3---5
         / \ / \ /
        0---2---4

        0 1 1 2 2 0, 1 2 2 3 3 1, 2 3 3 4 4 2, 3 4 4 5 5 3

                var i = (vertex_index / 6u) * 1u +   // 0 0 0 0 0 0 3 3 3 3 3 3 6 6 6 6 6 6
                        ((vertex_index % 6u) / 2u +  // 0 0 1 1 2 2 0 0 1 1 2 2 0 0 1 1 2 2
                        (vertex_index % 2u)) % 3;    // 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1
                                                     // 0 1 1 2 2 0 3 4 4 5 5 3
        */
        triDiv: 6,
        triMul: 1,
        midMod: 6,
        midDiv: 2,
        oddMod: 2,
        triMod: 3,
    },
    'triangle-list': {
        /*
        Each consecutive triplet of three vertices defines a triangle primitive.

          1  3---5
         / \  \ /
        0---2  4

        0 1 1 2 2 0, 3 4 4 5 5 3,

                var i = (vertex_index / 6u) * 3u +   // 0 0 0 0 0 0 3 3 3 3 3 3 6 6 6 6 6 6
                        ((vertex_index % 6u) / 2u +  // 0 0 1 1 2 2 0 0 1 1 2 2 0 0 1 1 2 2
                        (vertex_index % 2u)) % 3;    // 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1
                                                     // 0 1 1 2 2 0 3 4 4 5 5 3
        */
        triDiv: 6,
        triMul: 3,
        midMod: 6,
        midDiv: 2,
        oddMod: 2,
        triMod: 3,
    },
};

export class BufferRenderer {
    device: GPUDevice;
    pipelines: Map<string, GPURenderPipeline> = new Map<string, GPURenderPipeline>();

    constructor(device: GPUDevice) {
        this.device = device;

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat(); // gpu.getPreferredCanvasFormat(adapter);

        const shaderModule = device.createShaderModule({
            code: `
    struct VertexDesc {
        offset: u32,
        stride: u32,
        size: u32,
        padding: u32,
    };

    struct LineInfo {
        triDiv: u32,
        triMul: u32,
        midMod: u32,
        midDiv: u32,
        oddMod: u32,
        triMod: u32,
        pad0: u32,
        pad1: u32,
    };

    struct VSUniforms {
        worldViewProjection: mat4x4<f32>,
        position: VertexDesc,
        lineInfo: LineInfo,
        color: vec4<f32>,
        lightDirection: vec3<f32>,
    };

    @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
    @group(0) @binding(1) var<storage> vertData: array<f32>;

    fn getVert(desc: VertexDesc, index: u32) -> vec4<f32> {
        var v = vec4<f32>(0, 0, 0, 1);
        let offset = desc.offset + index * desc.stride;
        for (var i: u32 = 0u; i < desc.size; i += 1u) {
            v[i] = vertData[offset + i];
        }
        return v;
    }

    struct MyVSOutput {
        @builtin(position) position: vec4<f32>,
    };

    @vertex
    fn myVSMain(@builtin(vertex_index) vertex_index: u32) -> MyVSOutput {
        var vsOut: MyVSOutput;
        var i = (vertex_index / vsUniforms.lineInfo.triDiv) * vsUniforms.lineInfo.triMul +
                ((vertex_index % vsUniforms.lineInfo.midMod) / vsUniforms.lineInfo.midDiv +
                (vertex_index % vsUniforms.lineInfo.oddMod)) % vsUniforms.lineInfo.triMod;
        let position = getVert(vsUniforms.position, i);
        vsOut.position = vsUniforms.worldViewProjection * position;
        return vsOut;
    }

    @fragment
    fn myFSMain(v: MyVSOutput) -> @location(0) vec4<f32> {
        return vsUniforms.color + vec4(vsUniforms.lightDirection, 0) * 0.0;
    }
       `,
        });

        function createBuffer(device: GPUDevice, data: Float32Array | Uint16Array, usage: number) {
            const buffer = device.createBuffer({
                size: data.byteLength,
                usage: usage | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(buffer, 0, data);
            return buffer;
        }

        const pos = [
            1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1,
            -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1,
            -1, 1, 1, -1, 1, -1, -1, -1, -1, -1,
        ];
        const positions = new Float32Array(
            [
                0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19,
                20, 21, 22, 20, 22, 23,
            ]
                .map(ndx => pos.slice(ndx * 3, (ndx + 1) * 3))
                .flat()
        );

        const positionBuffer = createBuffer(device, positions, GPUBufferUsage.STORAGE);

        //device.pushErrorScope('validation');
        const pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'myVSMain',
                //buffers: [
                //    // position
                //    {
                //        arrayStride: 3 * 4, // 3 floats, 4 bytes each
                //        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
                //    },
                //],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'myFSMain',
                targets: [
                    {
                        format: presentationFormat,
                        blend: {
                            color: {
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
                            alpha: {
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: 'line-list',
                cullMode: 'none',
            },
        });

        const gen = new TypedArrayViewGenerator((1 * 16 + 4 + 8 + 4 + 3) * 4);

        const vsUniformBuffer = device.createBuffer({
            size: gen.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const worldViewProjection = gen.f32(16);
        const position = {
            offset: gen.u32(1),
            stride: gen.u32(1),
            size: gen.u32(1),
            pad: gen.u32(1),
        };
        const lineInfoUniformValues = {
            triDiv: gen.u32(1),
            triMul: gen.u32(1),
            midMod: gen.u32(1),
            midDiv: gen.u32(1),
            oddMod: gen.u32(1),
            triMod: gen.u32(1),
            pad0: gen.u32(1),
            pad1: gen.u32(1),
        };
        const color = gen.f32(4);
        const lightDirection = gen.f32(3);

        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: vsUniformBuffer } },
                { binding: 1, resource: { buffer: positionBuffer } },
            ],
        });

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    // view: undefined, // Assigned later
                    // resolveTarget: undefined, // Assigned Later
                    clearValue: [0.5, 0.5, 0.5, 1.0],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        this.render = (context: GPUCanvasContext) => {
            const time = performance.now() * 0.001;
            const canvas = context.canvas as HTMLCanvasElement;

            const projection = mat4.perspective(
                (30 * Math.PI) / 180,
                canvas.clientWidth / canvas.clientHeight,
                0.5,
                10
            );
            const eye = [1, 4, -6];
            const target = [0, 0, 0];
            const up = [0, 1, 0];

            const camera = mat4.lookAt(eye, target, up);
            const view = mat4.inverse(camera);
            const viewProjection = mat4.multiply(projection, view);
            const world = mat4.rotationY(time);
            mat4.multiply(viewProjection, world, worldViewProjection);
            setUniformValues(
                {
                    offset: 0,
                    stride: 3,
                    size: 3,
                },
                position
            );
            color.set([1, 1, 0, 1]);
            setUniformValues(lineHelperParams['triangle-list'], lineInfoUniformValues);

            vec3.normalize([1, 8, -10], lightDirection);

            device.queue.writeBuffer(vsUniformBuffer, 0, gen.arrayBuffer);

            const colorTexture = context.getCurrentTexture();
            renderPassDescriptor.colorAttachments[0].view = colorTexture.createView();

            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw((positions.length / 3) * 2);
            passEncoder.end();
            device.queue.submit([commandEncoder.finish()]);
        };
    }

    // Get or create a texture renderer for the given device.
    static rendererCache = new WeakMap();
    static getRendererForDevice(device: GPUDevice) {
        let renderer = BufferRenderer.rendererCache.get(device);
        if (!renderer) {
            renderer = new BufferRenderer(device);
            BufferRenderer.rendererCache.set(device, renderer);
        }
        return renderer;
    }
}
