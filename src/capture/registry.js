class ObjectRegistry {
    constructor() {
        this.dataMap = new WeakMap();
        this.objects = [];
        this.currentTraceSerial = 0;
        this.iterating = false;
    }

    add(obj, data) {
        if (this.iterating) {
            throw "Mutating Registry while iterating it.";
        }

        this.dataMap.set(obj, data);
        this.objects.push(new WeakRef(obj));
        data.webgpuObject = obj;
        data.traceSerial = this.currentTraceSerial;

    }

    get(obj) {
        return this.dataMap.get(obj);
    }

    prune() {
        if (this.iterating) {
            throw "Mutating Registry while iterating it.";
        }

        this.objects = this.objects.filter(ref => ref.deref() !== undefined);
    }

    [Symbol.iterator]() {
        let i = 0;
        let self = this;
        this.iterating = true;

        return {
            next() {
                while (i < self.objects.length) {
                    let obj = self.objects[i++].deref();
                    if (obj === undefined) {
                        continue;
                    }
                    return { value: self.get(obj), done: false };
                }
                self.iterating = false;
                return { done: true };
            }
        }
    }
}

function replacePrototypeOf(c, registry, methodsToWrap) {
    let originalProto = {};
    for (const name of methodsToWrap) {
        console.assert(c.prototype[name]);
        originalProto[name] = c.prototype[name];
        c.prototype[name] = function() {
            let self = registry.get(this);
            return self[name].apply(self, arguments);
        }
    }
    return originalProto;
}

function serializeAllObjects(registry) {
    const result = {};
    for (const obj of registry) {
        result[obj.tracingSerial] = obj.serialize();
    }
    return result;
}

class Spector2 {
    constructor() {
        this.tracing = false;

        this.adapters = new ObjectRegistry();
        this.commandBuffers = new ObjectRegistry();
        this.commandEncoders = new ObjectRegistry();
        this.canvasContexts = new ObjectRegistry();
        this.devices = new ObjectRegistry();
        this.queues = new ObjectRegistry();
        this.renderPassEncoders = new ObjectRegistry();
        this.renderPipelines = new ObjectRegistry();
        this.shaderModules = new ObjectRegistry();
        this.textures = new ObjectRegistry();
        this.textureViews = new ObjectRegistry();

        this.adapterProto = replacePrototypeOf(GPUAdapter, this.adapters, ['requestDevice']);
        // GPUCommandBuffer doesn't have methods except the label setter?
        this.commandEncoderProto = replacePrototypeOf(GPUCommandEncoder, this.commandEncoders, [
            'beginRenderPass', 'beginComputePass',
            'copyBufferToBuffer', 'copyBufferToTexture', 'copyTextureToBuffer', 'copyTextureToTexture',
            'clearBuffer', 'writeTimestamp', 'resolveQuerySet',
            'finish',
        ]);
        this.canvasContextProto = replacePrototypeOf(GPUCanvasContext, this.canvasContexts, ['configure', 'unconfigure', 'getCurrentTexture']);
        this.deviceProto = replacePrototypeOf(GPUDevice, this.devices, [
            'destroy',
            'createBuffer', 'createTexture', 'createSampler', 'importExternalTexture',
            'createBindGroupLayout', 'createPipelineLayout', 'createBindGroup',
            'createShaderModule', 'createComputePipeline', 'createRenderPipeline', 'createComputePipelineAsync', 'createRenderPipelineAsync',
            'createCommandEncoder', 'createRenderBundleEncoder',
            'createQuerySet',
        ]);
        this.queueProto = replacePrototypeOf(GPUQueue, this.queues, [
            'submit', 'onSubmittedWorkDone',
            'writeBuffer', 'writeTexture', 'copyExternalImageToTexture',
        ]);
        this.renderPassEncoderProto = replacePrototypeOf(GPURenderPassEncoder, this.renderPassEncoders, [
            'pushDebugGroup', 'popDebugGroup', 'insertDebugMarker',
            'setBindGroup',
            'setPipeline', 'setIndexBuffer', 'setVertexBuffer',
            'draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect',
            'setViewport', 'setScissorRect', 'setBlendConstant', 'setStencilReference',
            'beginOcclusionQuery', 'endOcclusionQuery',
            'executeBundles',
            'end',
        ]);
        // TODO render pipeline prototype
        // TODO shader module prototype
        this.textureProto = replacePrototypeOf(GPUTexture, this.textures, ['destroy', 'createView']);
        // GPUTextureView doesn't have methods except the label setter?

        // Special case replacements
        let canvasGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type) {
            let context = canvasGetContext.apply(this, arguments);
            if (type === 'webgpu') {
                spector2.canvasContexts.add(context, new CanvasContextState(this));
            }
            return context;
        };
        let gpuRequestAdapter = GPU.prototype.requestAdapter;
        GPU.prototype.requestAdapter = async function(options) {
            let adapter = await gpuRequestAdapter.apply(this, arguments);
            spector2.adapters.add(adapter, new AdapterState(options)); // TODO deep copy options
            return adapter;
        };
    }

    // TODO add support for prune all.
    // TODO make something to trace easily instead of start stop trace.
    startTracing() {
        this.tracing = true;
        this.trace = {
            objects: {
                // TODO have objects created after tracing work as well, whoops
                adapters: serializeAllObjects(this.adapters),
                commandBuffers: serializeAllObjects(this.commandBuffers),
                devices: serializeAllObjects(this.devices),
                queues: serializeAllObjects(this.queues),
                renderPipelines: serializeAllObjects(this.renderPipelines),
                shaderModules: serializeAllObjects(this.shaderModules),
                textures: serializeAllObjects(this.textures),
                textureViews: serializeAllObjects(this.textureViews),
            },
            commands: [],
        }
    }

    endTracing() {
        this.tracing = false;
        return JSON.stringify(trace);
    }
}

let spector2 = new Spector2();

class BaseState {
    constructor(desc) {
        // TODO what about the setter for labels?
        if (desc.label) {
            this.label = desc.label;
        }
        this.webgpuObj = null;
        this.tracingSerial = -1;
    }
}

class AdapterState extends BaseState {
    constructor(options) {
        super({});
    }

    serialize() {
        return {};
    }

    async requestDevice(desc) {
        let device = await spector2.adapterProto.requestDevice.call(this.webgpuObject, desc);
        spector2.devices.add(device, new DeviceState(this, desc ?? {}));
        spector2.queues.add(device.queue, new QueueState(spector2.devices.get(device), {}/*TODO desc*/));
        return device;
    }
}

class CommandBufferState extends BaseState {
    constructor(encoder, desc) {
        super(desc);
        this.device = encoder.device;
        this.commands = encoder.commands;
        // TODO get commands?
    }

    serialize() {
        return {commands: this.commands, deviceSerial: this.device.tracingSerial};
    }
}

class CommandEncoderState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.commands = [];
    }

    addCommand(command) {
        this.commands.push(command);
    }

    beginRenderPass(desc) {
        const pass = spector2.commandEncoderProto.beginRenderPass.call(this.webgpuObject, desc);
        spector2.renderPassEncoders.add(pass, new RenderPassEncoderState(this, desc));
        return pass;
    }

    finish(desc) {
        const commandBuffer = spector2.commandEncoderProto.finish.call(this.webgpuObject, desc);
        spector2.commandBuffers.add(commandBuffer, new CommandBufferState(this, desc ?? {}));
        return commandBuffer;
    }
}

class CanvasContextState extends BaseState {
    constructor(canvas) {
        super({});
        this.canvas = canvas;
    }

    configure(config) {
        this.device = config.device;
        this.format = config.format;
        this.usage = config.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;
        this.viewFormats = config.viewFormats ?? []; // TODO clone the inside
        this.colorSpace = config.colorSpace ?? 'srgb';
        this.alphaMode = config.alphaMode ?? 'opaque';

        spector2.canvasContextProto.configure.call(this.webgpuObject, {
            device: this.device,
            format: this.format,
            usage: this.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
            viewFormats: this.viewFormats,
            colorSpace: this.colorSpace,
            alphaMode: this.alphaMode,
        });
    }

    unconfigure() {
        spector2.canvasContextProto.unconfigure.call(this.webgpuObject);
    }

    getCurrentTexture() {
        // TODO mark destroyed postAnimationFrame?
        const texture = spector2.canvasContextProto.getCurrentTexture.call(this.webgpuObject);
        spector2.textures.add(texture, new TextureState(this.device, {
            format: this.format,
            size: {width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1},
            usage: this.usage,
            viewFormats: this.viewFormats,
        }));
        return texture;
    }
}

class DeviceState extends BaseState {
    constructor(adapter, desc) {
        super(desc);
        this.adapter = adapter;
    }

    serialize() {
        return {adapterSerial: this.adapter.tracingSerial};
    }

    createCommandEncoder(desc) {
        const encoder = spector2.deviceProto.createCommandEncoder.call(this.webgpuObject, desc);
        spector2.commandEncoders.add(encoder, new CommandEncoderState(this, desc ?? {}));
        return encoder;
    }

    createRenderPipeline(desc) {
        const pipeline = spector2.deviceProto.createRenderPipeline.call(this.webgpuObject, desc);
        spector2.renderPipelines.add(pipeline, new RenderPipelineState(this, desc));
        return pipeline;
    }

    createShaderModule(desc) {
        const module = spector2.deviceProto.createShaderModule.call(this.webgpuObject, desc);
        spector2.shaderModules.add(module, new ShaderModuleState(this, desc));
        return module;
    }
}

class QueueState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
    }

    serialize() {
        return {deviceSerial: this.device.tracingSerial};
    }

    submit(commandBuffers) {
        spector2.queueProto.submit.call(this.webgpuObject, commandBuffers);
        // TODO add to trace
    }
}

class RenderPassEncoderState extends BaseState {
    constructor(encoder, desc) {
        super(desc);
        this.encoder = encoder;
        // TODO special case less for hello triangle maybe :)
        let serializeDesc = {
            colorAttachments: [{
                viewSerial: spector2.textureViews.get(desc.colorAttachments[0].view).traceSerial,
                clearColor: desc.colorAttachments[0].clearColor,
                loadOp: desc.colorAttachments[0].clearColor,
                storeOp: desc.colorAttachments[0].storeOp,
            }],
        };
        this.encoder.addCommand({name: 'beginRenderPass', args: serializeDesc});
    }

    draw(vertexCount, instanceCount, firstVertex, firstInstance) {
        spector2.renderPassEncoderProto.draw.call(this.webgpuObject, vertexCount, instanceCount, firstVertex, firstInstance);
        this.encoder.addCommand({name: 'draw', args: {
            vertexCount,
            instanceCount: instanceCount ?? 1,
            firstVertex: firstVertex ?? 0,
            firstInstance: firstInstance ?? 0,
        }});
    }

    setPipeline(pipeline) {
        spector2.renderPassEncoderProto.setPipeline.call(this.webgpuObject, pipeline);
        this.encoder.addCommand({name: 'setPipeline', args: {
            pipeline: spector2.renderPipelines.get(pipeline).traceSerial,
        }});
    }

    end() {
        spector2.renderPassEncoderProto.end.call(this.webgpuObject);
        this.encoder.addCommand({name: 'endPass', args: {}});
    }
}

class RenderPipelineState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        // TODO ALLL TTTHEEEEE STATEEE! AND ALSO DEEP COPY! SAME FOR SERIALIZE
        this.layout = desc.layout;
        this.vertex = desc.vertex;
        this.fragment = desc.fragment;
    }

    serialize() {
        return {
            deviceSerial: this.device.tracingSerial,
            layout: this.layout, // TODO support explicit layout
            vertex: {
                moduleSerial: this.vertex.module.tracingSerial,
                entryPoint: this.vertex.module.entryPoint,
            },
            fragment: {
                moduleSerial: this.fragment.module.tracingSerial,
                entryPoint: this.fragment.module.entryPoint,
                targets: this.fragment.targets,
            }
        };
    }

}

class ShaderModuleState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.code = desc.code;
    }

    serialize() {
        return {deviceSerial: this.device.tracingSerial, code: this.code};
    }
}

class TextureState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.format = desc.format;
        this.usage = desc.usage;
        this.size = desc.size; // TODO reify
        this.dimension = desc.dimension ?? '2d';
        this.mipLevelCount = desc.mipLevelCount ?? 1;
        this.sampleCount = desc.sampleCount ?? 1;
        this.viewFormats = desc.viewFormats ?? []; // deep copy
    }

    serialize() {
        return {
            deviceSerial: this.device.tracingSerial,
            format: this.format,
            usage: this.usage,
            size: this.size,
            dimension: this.dimension,
            mipLevelCount: this.mipLevelCount,
            sampleCount: this.sampleCount,
            viewFormats: this.viewFormats,
            // TODO initial state, should be easy ^^ (j/k)
        };
    }

    createView(viewDesc) {
        const view = spector2.textureProto.createView.call(this.webgpuObject, viewDesc);
        spector2.textureViews.add(view, new TextureViewState(this, viewDesc ?? {}));
        return view;
    }

    destroy() {
        // TODO copy on write?
        // TODO store if recording trace.
        spector2.textureProto.destroy.call(webgpuObject);
    }

    // TODO getters lol
}

class TextureViewState extends BaseState {
    constructor(texture, desc) {
        super(desc);
        this.texture = texture;
        this.format = desc.format ?? texture.format;
        this.dimension = desc.dimension ?? '2d'; // TODO not actually correct
        this.aspect = desc.aspect ?? 'all';
        this.baseMipLevel = desc.baseMipLevel ?? 0;
        this.mipLevelCount = desc.mipLevelCount; // TODO default;
        this.baseArrayLayer = desc.baseArrayLayer ?? 0;
        this.arrayLayerCount = desc.arrayLayerCount; // TODO default;
    }

    serialize() {
        return {
            textureSerial: this.texture.tracingSerial,
            format: this.format,
            dimension: this.dimension,
            aspect: this.aspect,
            baseMipLevel: this.baseMipLevel,
            mipLevelCount: this.mipLevelCount,
            baseArrayLayer: this.baseArrayLayer,
            arrayLayerCount: this.arrayLayerCount,
        };
    }

}

// TODO full WebIDL and exceptions on bad type? Can we automate from TS webidl definition for WebGPU??
