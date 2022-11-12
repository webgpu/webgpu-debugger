import { ReplayRenderPipeline } from "../../../replay";

// This is a subset of the GPUVertexState that doesn't include the shader module
export interface DrawPreviewVertexAttribute extends GPUVertexAttribute {
  buffer: number,
  arrayStride: number,
}

export class DrawPreviewPipeline {
    renderPipeline: ReplayRenderPipeline;
    previewAttribs: Array<DrawPreviewVertexAttribute> = [];

    _positionAttrib: number = -1;
    _normalAttrib: number = -1;
    _texCoordAttrib: number = -1;
    _colorAttrib: number = -1;

    previewPipeline?: GPURenderPipeline;

    constructor(renderPipeline: ReplayRenderPipeline) {
        // TODO: Cache this layout in the browser local storage so that
        // developers don't have to set it up over and over again.

        this.renderPipeline = renderPipeline;
        const vertexLayout = renderPipeline.desc.vertex;

        if (!vertexLayout.buffers) { return; }

        let minShaderLocation = Number.MAX_SAFE_INTEGER;
        const buffers = [...vertexLayout.buffers];
        for (let i = 0; i < buffers.length; ++i) {
            const buffer = buffers[i];
            if (!buffer || buffer.stepMode === 'instance') { continue; }

            for (const attrib of buffer.attributes) {
                let previewAttrib = {
                    buffer: i,
                    arrayStride: buffer.arrayStride,
                    ...attrib
                };
                minShaderLocation = Math.min(previewAttrib.shaderLocation, minShaderLocation);
                this.previewAttribs.push(previewAttrib);
            }
        }

        // TODO: Do a better job of estimating this stuff.
        this.positionAttrib = minShaderLocation;
    }

    get positionAttrib() {
        return this._positionAttrib;
    }

    set positionAttrib(v) {
        if (this._positionAttrib !== v) {
            this._positionAttrib = v;
            this.previewPipeline = undefined;
        }
    }

    get normalAttrib() {
        return this._normalAttrib;
    }

    set normalAttrib(v) {
        if (this._normalAttrib !== v) {
            this._normalAttrib = v;
            this.previewPipeline = undefined;
        }
    }

    get texCoordAttrib() {
        return this._texCoordAttrib;
    }

    set texCoordAttrib(v) {
        if (this._texCoordAttrib !== v) {
            this._texCoordAttrib = v;
            this.previewPipeline = undefined;
        }
    }

    get colorAttrib() {
        return this._colorAttrib;
    }

    set colorAttrib(v) {
        if (this._colorAttrib !== v) {
            this._colorAttrib = v;
            this.previewPipeline = undefined;
        }
    }

    get device() {
        return this.renderPipeline.device.webgpuObject!;
    }

    bufferForPreviewAttrib(index: number, shaderLocation: number) : GPUVertexBufferLayout {
        const attrib = this.previewAttribs[index];
        return {
            arrayStride: attrib.arrayStride,
            attributes: [{
                format: attrib.format,
                offset: attrib.offset,
                shaderLocation,
            }]
        };
    }

    getPreviewRenderPipeline() {
        if (this.previewPipeline || this._positionAttrib === -1) { return this.previewPipeline; }

        const device = this.device;

        let vertexInFields = [
            `@location(0) position : vec4<f32>,`
        ];

        let vertexOutSetters = [
            `output.position = input.position;`
        ];

        let vertexBuffers = [this.bufferForPreviewAttrib(this._positionAttrib, 0)];

        if (this._texCoordAttrib != -1) {
            vertexInFields.push('@location(1) texCoord : vec4<f32>,');
            vertexOutSetters.push('output.texCoord = input.texCoord;');
            vertexBuffers.push(this.bufferForPreviewAttrib(this._texCoordAttrib, 1));
        } else {
            vertexOutSetters.push('output.texCoord = vec4(0.0, 0.0, 0.0, 1.0);');
        }

        if (this._normalAttrib != -1) {
            vertexInFields.push('@location(2) normal : vec4<f32>,');
            vertexOutSetters.push('output.normal = input.normal;');
            vertexBuffers.push(this.bufferForPreviewAttrib(this._normalAttrib, 2));
        } else {
            vertexOutSetters.push('output.normal = vec4(0.0, 0.0, 1.0, 1.0);');
        }

        if (this._colorAttrib != -1) {
            vertexInFields.push('@location(3) color : vec4<f32>,');
            vertexOutSetters.push('output.color = input.color;');
            vertexBuffers.push(this.bufferForPreviewAttrib(this._colorAttrib, 3));
        } else {
            vertexOutSetters.push('output.color = vec4(1.0, 0.0, 1.0, 1.0);');
        }

        const code = `
            struct VertexIn {
                ${vertexInFields.join('\n')}
            };

            struct VertexOut {
                @builtin(position) position : vec4<f32>,
                @location(0) texCoord : vec4<f32>,
                @location(1) normal : vec4<f32>,
                @location(2) color : vec4<f32>,
            };

            @vertex
            fn vertexMain(input : VertexIn) -> VertexOut {
                var output : VertexOut;
                ${vertexOutSetters.join('\n')}
                return output;
            }

            @fragment
            fn fragmentMain(input : VertexOut) -> @location(0) vec4<f32> {
                return input.color;
            }`;
        const module = device.createShaderModule({ code });

        this.previewPipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module,
                entryPoint: 'vertexMain',
                buffers: vertexBuffers,
            },
            primitive: {
                ...this.renderPipeline.desc.primitive,
                cullMode: 'none'
            },
            fragment: {
                module,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat(),
                }]
            }
        });

        return this.previewPipeline;
    }

    render(context: GPUCanvasContext, state: any) {
        const device = this.device;

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    clearValue: [0.0, 0.0, 0.0, 0.5],
                    storeOp: 'store',
                },
            ],
        });

        const pipeline = this.getPreviewRenderPipeline();
        if (pipeline && state.vertexBuffers) {
            passEncoder.setPipeline(pipeline);

            // TODO: Set uniforms for camera/rotation.

            let slot = 0;
            const setVertexBufferForPreviewAttrib = (index: number) => {
                if (index == -1) { return; }
                const attrib = this.previewAttribs[index];
                const vertex = state.vertexBuffers[attrib.buffer];
                passEncoder.setVertexBuffer(slot++, vertex.buffer.webgpuObject, vertex.offset, vertex.size);
            };

            setVertexBufferForPreviewAttrib(this._positionAttrib);
            setVertexBufferForPreviewAttrib(this._texCoordAttrib);
            setVertexBufferForPreviewAttrib(this._normalAttrib);
            setVertexBufferForPreviewAttrib(this._colorAttrib);

            if (state.indexBuffer?.buffer) {
                const index = state.indexBuffer;
                passEncoder.setIndexBuffer(index.buffer.webgpuObject, index.indexFormat, index.offset, index.size);
            }

            // TODO: Use actual command!
            passEncoder.draw(36);
        }

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    static drawPreviewCache = new WeakMap();
    static getDrawPreviewPipeline(renderPipeline: ReplayRenderPipeline) {
        let drawPreview = DrawPreviewPipeline.drawPreviewCache.get(renderPipeline);
        if (!drawPreview) {
            drawPreview = new DrawPreviewPipeline(renderPipeline);
            DrawPreviewPipeline.drawPreviewCache.set(renderPipeline, drawPreview);
        }
        return drawPreview;
    }
}

export class DrawPreviewRenderer {
  device: GPUDevice;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  // Get or create a preview renderer for the given device.
  static rendererCache = new WeakMap();
  static getRendererForDevice(device: GPUDevice) {
      let renderer = DrawPreviewRenderer.rendererCache.get(device);
      if (!renderer) {
          renderer = new DrawPreviewRenderer(device);
          DrawPreviewRenderer.rendererCache.set(device, renderer);
      }
      return renderer;
  }
}