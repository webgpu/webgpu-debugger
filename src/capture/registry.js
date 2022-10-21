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
        this.currentTraceSerial ++;
    }

    has(obj) {
        return this.dataMap.has(obj);
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

const TraceState = {
    On: Symbol("On"),
    Off: Symbol("Off"),
    WaitingForPresent: Symbol("WaitingForPresent"),
}

class Spector2 {
    constructor() {
        function replacePrototypeOf(c, registry) {
            let originalProto = {};

            for (const name in c.prototype) {
              const props = Object.getOwnPropertyDescriptor(c.prototype, name);
                if (!props?.writable || typeof c.prototype[name] !== 'function') {
                  continue;
                }
                const originalMethod = c.prototype[name];
                originalProto[name] = originalMethod;
                c.prototype[name] = function(...args) {
                    if (spector2.inReentrantWebGPUOperations) {
                        return originalMethod.apply(this, args);
                    }

                    let self = registry.get(this);
                    if (!self[name]) {
                        console.assert(false, `Doesn't have "${name}"`);
                    }
                    return self[name].apply(self, args);
                }
            }
            return originalProto;
        }

        this.traceState = TraceState.Off;
        this.dataSerial = 0;
        this.inReentrantWebGPUOperations = false;

        this.adapters = new ObjectRegistry();
        this.bindGroups = new ObjectRegistry();
        this.bindGroupLayouts = new ObjectRegistry();
        this.buffers = new ObjectRegistry();
        this.commandBuffers = new ObjectRegistry();
        this.commandEncoders = new ObjectRegistry();
        this.canvasContexts = new ObjectRegistry();
        this.devices = new ObjectRegistry();
        this.pipelineLayouts = new ObjectRegistry();
        this.querySets = new ObjectRegistry();
        this.queues = new ObjectRegistry();
        this.renderPassEncoders = new ObjectRegistry();
        this.renderPipelines = new ObjectRegistry();
        this.samplers = new ObjectRegistry();
        this.shaderModules = new ObjectRegistry();
        this.textures = new ObjectRegistry();
        this.textureViews = new ObjectRegistry();

        this.adapterProto = replacePrototypeOf(GPUAdapter, this.adapters);
        // GPUBindGroup doesn't have methods except the label setter?
        // GPUBindGroupLayout doesn't have methods except the label setter?
        this.bufferProto = replacePrototypeOf(GPUBuffer, this.buffers);
        // GPUCommandBuffer doesn't have methods except the label setter?
        this.commandEncoderProto = replacePrototypeOf(GPUCommandEncoder, this.commandEncoders);
        this.canvasContextProto = replacePrototypeOf(GPUCanvasContext, this.canvasContexts);
        this.deviceProto = replacePrototypeOf(GPUDevice, this.devices);
        // GPUPipelineLayout doesn't have methods except the label setter?
        this.querySetProto = replacePrototypeOf(GPUQuerySet, this.querySets);
        this.queueProto = replacePrototypeOf(GPUQueue, this.queues);
        this.renderPassEncoderProto = replacePrototypeOf(GPURenderPassEncoder, this.renderPassEncoders);
        // TODO render pipeline prototype
        // GPUSampler doesn't have methods except the label setter?
        // TODO shader module prototype
        this.textureProto = replacePrototypeOf(GPUTexture, this.textures);
        // GPUTextureView doesn't have methods except the label setter?

        // Special case replacements
        this.canvasGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type) {
            let context = spector2.canvasGetContext.apply(this, arguments);
            if (type === 'webgpu') {
                spector2.registerObjectIn('canvasContexts', context, new CanvasContextState(this));
            }
            return context;
        };
        this.gpuRequestAdapter = GPU.prototype.requestAdapter;
        GPU.prototype.requestAdapter = async function(options) {
            let adapter = await spector2.gpuRequestAdapter.apply(this, arguments);
            spector2.registerObjectIn('adapters', adapter, new AdapterState(options)); // TODO deep copy options
            return adapter;
        };
    }

    // For now we don't support all entrypoints, which breaks the replay, here's a method to put regular entrypoints back.
    revertEntryPoints() {
        function revertEntryPoints(Class, proto) {
            for (const name in proto) {
                Class.prototype[name] = proto[name];
            }
        }
        revertEntryPoints(GPUAdapter, this.adapterProto);
        revertEntryPoints(GPUBuffer, this.bufferProto);
        revertEntryPoints(GPUCommandEncoder, this.commandEncoderProto);
        revertEntryPoints(GPUCanvasContext, this.canvasContextProto);
        revertEntryPoints(GPUDevice, this.deviceProto);
        revertEntryPoints(GPUQuerySet, this.querySetProto);
        revertEntryPoints(GPUQueue, this.queueProto);
        revertEntryPoints(GPURenderPassEncoder, this.renderPassEncoderProto);
        revertEntryPoints(GPUTexture, this.textureProto);

        HTMLCanvasElement.prototype.getContext = this.canvasGetContext;
        GPU.prototype.requestAdapter = this.gpuRequestAdapter;
    }

    doWebGPUOp(f) {
        this.inReentrantWebGPUOperations = true;
        f();
        this.inReentrantWebGPUOperations = false;
    }

    // TODO add support for prune all.
    // TODO make something to trace easily instead of start stop trace.
    startTracing() {
        function serializeAllObjects(registry) {
            const result = {};
            for (const obj of registry) {
                result[obj.traceSerial] = obj.serialize();
            }
            return result;
        }

        // Yuck
        function serializeAsyncAllObjects(registry, pendingPromises) {
            const result = {};
            // TODO have some context where objects can ask for a device?
            for (const obj of registry) {
                pendingPromises.push(obj.serializeAsync().then(d => result[obj.traceSerial] = d));
            }
            return result;
        }

        this.traceState = TraceState.On;
        this.pendingTraceOperations = [];

        this.trace = {
            objects: {
                adapters: serializeAllObjects(this.adapters),
                bindGroups: serializeAsyncAllObjects(this.bindGroups),
                bindGroupLayouts: serializeAllObjects(this.bindGroupLayouts),
                buffers: serializeAsyncAllObjects(this.buffers, this.pendingTraceOperations),
                commandBuffers: serializeAllObjects(this.commandBuffers),
                commandEncoders: {},
                canvasContexts: {},
                devices: serializeAllObjects(this.devices),
                pipelineLayouts: serializeAllObjects(this.pipelineLayouts),
                querySets: serializeAllObjects(this.querySets),
                queues: serializeAllObjects(this.queues),
                samplers: serializeAllObjects(this.samplers),
                renderPassEncoders: {},
                renderPipelines: serializeAllObjects(this.renderPipelines),
                shaderModules: serializeAllObjects(this.shaderModules),
                textures: serializeAllObjects(this.textures),
                textureViews: serializeAllObjects(this.textureViews),
            },
            commands: [],
            data: {},
        }
    }

    async endTracing() {
        // No more commands are recorded except presents
        this.traceState = TraceState.WaitingForPresent;
        // TODO deep copy what we currently have? We risk changing state with future operations.

        await Promise.all(this.pendingTraceOperations);
        this.traceState = TraceState.Off;

        return this.trace;
    }

    tracingNewPresents() {
        return this.traceState === TraceState.On;
    }

    addPendingPresent(presentPromise) {
        if (this.traceState === TraceState.On) {
            this.pendingTraceOperations.push(presentPromise);
        }
    }

    traceCommand(command) {
        if (this.traceState === TraceState.On) {
            this.trace.commands.push(command);
        } else if (this.traceState === TraceState.WaitingForPresent && command.name === 'present') {
            this.trace.commands.push(command);
        }
    }

    traceData(buffer, offset, size) {
        if (this.traceState !== TraceState.On) {
            return {garbage: true};
        }
        const byteArray = new Uint8Array(buffer, offset, size);
        // Worst serialization ever!
        const badArray = [];
        for (let i = 0; i < byteArray.byteLength; i++) {
            badArray.push(byteArray[i]);
        }

        this.trace.data[this.dataSerial] = badArray;
        const dataRef =  {
            size,
            serial: this.dataSerial,
        }
        this.dataSerial++;
        return dataRef;
    }

    registerObjectIn(typePlural, webgpuObject, state) {
        this[typePlural].add(webgpuObject, state);
        if (this.traceState === TraceState.On) {
            this.trace.objects[typePlural][state.traceSerial] = state.serialize();
        }
    }

    async traceFrame() {
        this.startTracing();

        await new Promise((resolve) => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    resolve();
                }, 0);
            });
        });

        return await this.endTracing();
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
        this.traceSerial = -1;
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
        spector2.registerObjectIn('devices', device, new DeviceState(this, desc ?? {}));
        spector2.registerObjectIn('queues', device.queue, new QueueState(spector2.devices.get(device), {}/*TODO desc*/));
        return device;
    }
}

class BindGroupState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.layout = spector2.bindGroupLayouts.get(desc.layout);

        this.entries = desc.entries.map(e => {
            const entry = {binding: e.binding};
            if (spector2.textureViews.has(e.resource)) {
                entry.textureView = spector2.textureViews.get(e.resource);
            } else if (spector2.samplers.has(e.resource)) {
                entry.sampler = spector2.samplers.get(e.resource);
            } else if (e.resource.buffer !== undefined) {
                entry.buffer = spector2.buffers.get(e.resource.buffer);
                entry.offset = e.resource.offset ?? 0;
                entry.size = e.resource.size ?? Math.max(0, entry.buffer.size - entry.offset);
            } else {
                console.assert('Unhandled binding type.');
            }
            return entry;
        });
    }

    serialize() {
        return {
            deviceSerial: this.device.traceSerial,
            layoutSerial: this.layout.traceSerial,
            entries: this.entries.map(e => {
                const entry = {binding: e.binding};
                if (e.textureView !== undefined) {
                    entry.textureViewSerial = e.textureView.traceSerial;
                }
                if (e.sampler !== undefined) {
                    entry.samplerSerial = e.sampler.traceSerial;
                }
                if (e.buffer !== undefined) {
                    entry.bufferSerial = e.buffer.traceSerial;
                    entry.offset = e.offset;
                    entry.size = e.size;
                }
                return entry;
            }),
        };
    }
}

class BindGroupLayoutState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;

        this.entries = desc.entries.map(e => {
            const entry = {binding: e.binding, visibility: e.visibility};
            if (e.buffer) {
                entry.buffer = {
                    type: e.buffer.type ?? 'uniform',
                    hasDynamicOffset: e.buffer.hasDynamicOffset ?? false,
                    minBindingSize: e.buffer.minBindingSize ?? 0,
                };
            }
            if (e.sampler) {
                entry.sampler = {
                    type: e.sampler.type ?? 'filtering',
                };
            }
            if (e.texture) {
                entry.texture = {
                    sampleType: e.texture.sampleType ?? 'float',
                    viewDimension: e.texture.viewDimension ?? '2d',
                    multisampled: e.texture.multisampled ?? false,
                };
            }
            if (e.storageTexture) {
                entry.storageTexture = {
                    access: e.storageTexture.access ?? 'write-only',
                    format: e.storageTexture.format,
                    viewDimension: e.storageTexture.viewDimension ?? '2d',
                };
            }
            if (e.externalTexture) {
                entry.externalTexture = {};
            }
            return entry;
        });
    }

    serialize() {
        return {
            deviceSerial: this.device.traceSerial,
            entries: this.entries, // TODO deep copy?
        };
    }
}

class BufferState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.usage = desc.usage;
        this.size = desc.size;
        this.state = desc.mappedAtCreation ? 'mapped-at-creation' : 'unmapped';
    }

    async serializeAsync() {
        // TODO handle mappable buffers.
        if ((this.usage & (GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE)) != 0) {
            return this.serialize();
        }

        // Immediately copy the buffer contents to save its initial data to the side.
        let initialDataBuffer = null;
        let mapPromise = null;
        spector2.doWebGPUOp(() => {
            initialDataBuffer = this.device.webgpuObject.createBuffer({
                size: this.size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });

            // TODO pool encoders?
            const encoder = this.device.webgpuObject.createCommandEncoder();
            encoder.copyBufferToBuffer(this.webgpuObject, 0, initialDataBuffer, 0, this.size);
            this.device.webgpuObject.queue.submit([encoder.finish()]);

            mapPromise = initialDataBuffer.mapAsync(GPUMapMode.READ);
        });

        await mapPromise;

        let initialData = null;
        spector2.doWebGPUOp(() => {
            const data = initialDataBuffer.getMappedRange();
            initialData = spector2.traceData(data, 0, this.size);
            initialDataBuffer.destroy();
        });

        return {
            deviceSerial: this.device.traceSerial,
            usage: this.usage,
            size: this.size,
            state: this.state,
            initialData,
        };
    }

    serialize() {
        // Still called on creation during the trace
        return {
            deviceSerial: this.device.traceSerial,
            usage: this.usage,
            size: this.size,
            state: this.state,
        };
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
        return {commands: this.commands, deviceSerial: this.device.traceSerial};
    }
}

class CommandEncoderState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.commands = [];
    }

    serialize() {
        return {};
    }

    addCommand(command) {
        this.commands.push(command);
    }

    beginRenderPass(desc) {
        const pass = spector2.commandEncoderProto.beginRenderPass.call(this.webgpuObject, desc);
        spector2.registerObjectIn('renderPassEncoders', pass, new RenderPassEncoderState(this, desc));
        return pass;
    }

    finish(desc) {
        const commandBuffer = spector2.commandEncoderProto.finish.call(this.webgpuObject, desc);
        spector2.registerObjectIn('commandBuffers', commandBuffer, new CommandBufferState(this, desc ?? {}));
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
        const texture = spector2.canvasContextProto.getCurrentTexture.call(this.webgpuObject);
        const state = new TextureState(this, {
            format: this.format,
            size: {width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1},
            usage: this.usage,
            viewFormats: this.viewFormats,
        });
        spector2.registerObjectIn('textures', texture, state);

        // Mark the texture as presented right after the animation frame.
        // TODO also mark the texture destroyed?
        if (spector2.tracingNewPresents()) {
            const presentPromise = new Promise((resolve,) => {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        spector2.traceCommand({
                            name: 'present',
                            args: {canvasContextSerial: this.traceSerial, textureSerial: state.traceSerial}
                        }, 0);
                        resolve();
                    });
                });
            });
            spector2.addPendingPresent(presentPromise);
        }

        return texture;
    }
}

class DeviceState extends BaseState {
    constructor(adapter, desc) {
        super(desc);
        this.adapter = adapter;
    }

    serialize() {
        return {adapterSerial: this.adapter.traceSerial};
    }

    createBindGroup(desc) {
        const bg = spector2.deviceProto.createBindGroup.call(this.webgpuObject, desc);
        spector2.registerObjectIn('bindGroups', bg, new BindGroupState(this, desc));
        return bg;
    }

    createBindGroupLayout(desc) {
        const bgl = spector2.deviceProto.createBindGroupLayout.call(this.webgpuObject, desc);
        spector2.registerObjectIn('bindGroupLayouts', bgl, new BindGroupLayoutState(this, desc));
        return bgl;
    }

    createBuffer(desc) {
        let newUsage = desc.usage;
        if ((desc.usage & (GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE)) == 0) {
            newUsage = desc.usage | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
        }
        const buffer = spector2.deviceProto.createBuffer.call(this.webgpuObject, {
            ...desc,
            usage: newUsage,
        });
        spector2.registerObjectIn('buffers', buffer, new BufferState(this, desc));
        return buffer;
    }

    createCommandEncoder(desc) {
        const encoder = spector2.deviceProto.createCommandEncoder.call(this.webgpuObject, desc);
        spector2.registerObjectIn('commandEncoders', encoder, new CommandEncoderState(this, desc ?? {}));
        return encoder;
    }

    createPipelineLayout(desc) {
        const layout = spector2.deviceProto.createPipelineLayout.call(this.webgpuObject, desc);
        spector2.registerObjectIn('pipelineLayouts', layout, new PipelineLayoutState(this, desc));
        return layout;
    }

    createQuerySet(desc) {
        // TODO modify the desc for non-mappable buffers, see what to do for mappable.
        const querySet = spector2.deviceProto.createQuerySet.call(this.webgpuObject, desc);
        spector2.registerObjectIn('querySets', querySet, new QuerySetState(this, desc));
        return querySet;
    }

    createRenderPipeline(desc) {
        const pipeline = spector2.deviceProto.createRenderPipeline.call(this.webgpuObject, desc);
        spector2.registerObjectIn('renderPipelines', pipeline, new RenderPipelineState(this, desc));
        return pipeline;
    }

    createSampler(desc) {
        const module = spector2.deviceProto.createSampler.call(this.webgpuObject, desc);
        spector2.registerObjectIn('samplers', module, new SamplerState(this, desc ?? {}));
        return module;
    }

    createShaderModule(desc) {
        const module = spector2.deviceProto.createShaderModule.call(this.webgpuObject, desc);
        spector2.registerObjectIn('shaderModules', module, new ShaderModuleState(this, desc));
        return module;
    }

    createTexture(desc) {
        // TODO modify the desc to contain copysrc/dst.
        const texture = spector2.deviceProto.createTexture.call(this.webgpuObject, desc);
        spector2.registerObjectIn('textures', texture, new TextureState(this, desc));
        return texture;
    }
}

class PipelineLayoutState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.bindGroupLayouts = desc.bindGroupLayouts.map(bgl => spector2.bindGroupLayouts.get(bgl));
    }

    serialize() {
        return {
            deviceSerial: this.device.traceSerial,
            bindGroupLayoutsSerial: this.bindGroupLayouts.map(bgl => bgl.traceSerial),
        };
    }
}

class QuerySetState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.type = desc.type;
        this.count = desc.count;
        this.state = 'valid';
    }

    serialize() {
        return {
            deviceSerial: this.device.traceSerial,
            type: this.type,
            count: this.count,
            state: this.state,
            // TODO what about the data it countains ????
        };
    }
}

class QueueState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
    }

    serialize() {
        return {deviceSerial: this.device.traceSerial};
    }

    writeBuffer(buffer, bufferOffset, data, dataOffset, size) {
        spector2.queueProto.writeBuffer.call(this.webgpuObject, buffer, bufferOffset, data, dataOffset, size);

        dataOffset ??= 0;
        let serializedData = null;
        if (data instanceof ArrayBuffer) {
            size = size ?? data.byteLength - offset;
            serializedData = spector2.traceData(data, dataOffset, size);
        } else {
            size = size ?? data.length - offset;
            serializedData = spector2.traceData(data.buffer, dataOffset * data.BYTES_PER_ELEMENT, size * data.BYTES_PER_ELEMENT);
        }

        spector2.traceCommand({
            name: 'queueWriteBuffer',
            queueSerial: this.traceSerial,
            args: {
                bufferSerial: spector2.buffers.get(buffer).traceSerial,
                bufferOffset,
                data: serializedData,
            }
        });
    }

    submit(commandBuffers) {
        spector2.queueProto.submit.call(this.webgpuObject, commandBuffers);
        spector2.traceCommand({
            name: 'queueSubmit',
            queueSerial: this.traceSerial,
            args: {commandBufferSerials: commandBuffers.map(c => spector2.commandBuffers.get(c).traceSerial)},
        });
    }
}

class RenderPassEncoderState extends BaseState {
    constructor(encoder, desc) {
        super(desc);
        this.encoder = encoder;
        let serializeDesc = {
            colorAttachments: desc.colorAttachments.map(a => { return {
                viewSerial: spector2.textureViews.get(a.view).traceSerial,
                resolveTargetSerial: (a.resolveTarget ? spector2.textureViews.get(a.resolveTarget).traceSerial : undefined),

                clearValue: a.clearValue ?? {r: 0, g: 0, b: 0, a: 0},
                loadOp: a.loadOp,
                storeOp: a.storeOp,
            };}),

            timestampWrites: (desc.timestampWrites ?? []).map(w => { return {
                querySetSerial: spector2.querySets.get(w).traceSerial,
                queryIndex: w.queryIndex,
                location: e.location,
            };}),

            occlusionQuerySetSerial: desc.occlusionQuerySet ? spector2.querySets.get(desc.occlusionQuerySet).traceSerial : undefined,
            maxDrawCount: desc.maxDrawCount ?? 50000000, // Yes that's the spec default.
        }

        const ds = desc.depthStencilAttachment;
        if (ds !== undefined) {
            serializeDesc.depthStencilAttachment = {
                viewSerial: spector2.textureViews.get(ds.view).traceSerial,

                depthClearValue: ds.depthClearValue ?? 0,
                depthLoadOp: ds.depthLoadOp,
                depthStoreOp: ds.depthStoreOp,
                depthReadOnly: ds.depthReadOnly ?? false,

                stencilClearValue: ds.stencilClearValue ?? 0,
                stencilLoadOp: ds.stencilLoadOp,
                stencilStoreOp: ds.stencilStoreOp,
                stencilReadOnly: ds.stencilReadOnly ?? false,
            };
        }

        this.encoder.addCommand({name: 'beginRenderPass', args: serializeDesc});
    }

    serialize() {
        return {};
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

    drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance) {
        spector2.renderPassEncoderProto.drawIndexed.call(this.webgpuObject, indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
        this.encoder.addCommand({name: 'drawIndexed', args: {
            indexCount,
            instanceCount: instanceCount ?? 1,
            firstIndex: firstIndex ?? 0,
            baseVertex: baseVertex ?? 0,
            firstInstance: firstInstance ?? 0,
        }});
    }

    setBindGroup(index, bindGroup, dynamicOffsets) {
        if (dynamicOffsets !== undefined) {
            console.assert("Don't know how to handle dynamic bindgroups yet.");
        }

        spector2.renderPassEncoderProto.setBindGroup.call(this.webgpuObject, index, bindGroup);
        this.encoder.addCommand({name: 'setBindGroup', args: {
            index,
            bindGroupSerial: spector2.bindGroups.get(bindGroup).traceSerial,
        }})
    }

    setIndexBuffer(buffer, indexFormat, offset, size) {
        spector2.renderPassEncoderProto.setIndexBuffer.call(this.webgpuObject, buffer, indexFormat, offset, size);
        const bufferState = spector2.buffers.get(buffer);
        this.encoder.addCommand({name: 'setIndexBuffer', args: {
            bufferSerial: bufferState.traceSerial,
            indexFormat,
            offset: offset ?? 0,
            size: size ?? Math.max(0, bufferState.size - offset),
        }});
    }

    setPipeline(pipeline) {
        spector2.renderPassEncoderProto.setPipeline.call(this.webgpuObject, pipeline);
        this.encoder.addCommand({name: 'setPipeline', args: {
            pipelineSerial: spector2.renderPipelines.get(pipeline).traceSerial,
        }});
    }

    setVertexBuffer(slot, buffer, offset, size) {
        spector2.renderPassEncoderProto.setVertexBuffer.call(this.webgpuObject, slot, buffer, offset, size);
        const bufferState = spector2.buffers.get(buffer);
        this.encoder.addCommand({name: 'setVertexBuffer', args: {
            slot,
            bufferSerial: bufferState.traceSerial,
            offset: offset ?? 0,
            size: size ?? Math.max(0, bufferState.size - offset),
        }});
    }

    setViewport(x, y, width, height, minDepth, maxDepth) {
        spector2.renderPassEncoderProto.setViewport.call(this.webgpuObject, x, y, width, height, minDepth, maxDepth);
        this.encoder.addCommand({name: 'setViewport', args: {x, y, width, height, minDepth, maxDepth}});
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
        this.layout = desc.layout;

        const v = desc.vertex;
        this.vertex = {
            module: spector2.shaderModules.get(v.module),
            entryPoint: v.entryPoint,
            constants: {...v.constants},

            buffers: (v.buffers ?? []).map(b => { return {
                arrayStride: b.arrayStride,
                stepMode: b.stepMode ?? 'vertex',
                attributes: b.attributes.map(a => {return {
                    format: a.format,
                    offset: a.offset,
                    shaderLocation: a.shaderLocation,
                };})
            };})
        };

        const p = desc.primitiveState ?? {};
        this.primitive = {
            topology: p.topology ?? 'triangle-list',
            stripIndexFormat: p.stripIndexFormat,
            frontFace: p.frontFace ?? 'ccw',
            cullMode: p.cullMode ?? 'none',

            unclippedDepth: p.unclippedDepth,
        };

        const ds = desc.depthStencil;
        if (ds !== undefined) {
            const stencilFront = ds.stencilFront ?? {};
            const stencilBack = ds.stencilBack ?? {};

            this.depthStencil = {
                format: ds.format,

                depthWriteEnabled: ds.depthWriteEnabled ?? false,
                depthCompare: ds.depthCompare ?? 'always',

                stencilFront: {
                    compare: stencilFront.compare ?? 'always',
                    failOp: stencilFront.failOp ?? 'keep',
                    depthFailOp: stencilFront.depthFailOp ?? 'keep',
                    passOp: stencilFront.passOp ?? 'keep',
                },
                stencilBack: {
                    compare: stencilBack.compare ?? 'always',
                    failOp: stencilBack.failOp ?? 'keep',
                    depthFailOp: stencilBack.depthFailOp ?? 'keep',
                    passOp: stencilBack.passOp ?? 'keep',
                },

                stencilReadMask: ds.stencilReadMask ?? 0xFFFFFFFF,
                stencilWriteMask: ds.stencilWriteMask ?? 0xFFFFFFFF,

                depthBias: ds.depthBias ?? 0,
                depthBiasSlopScale: ds.depthBiasSlopeScale ?? 0,
                depthBiasClamp: ds.depthBiasClamp ?? 0,
            };
        }

        const m = desc.multisample ?? {};
        this.multisample = {
            count: m.count ?? 1,
            mask: m.mask ?? 0xFFFFFFFF,
            alphaToCoverageEnabled: m.alphaToCoverageEnabled ?? false,
        };

        const f = desc.fragment;
        if (f !== undefined) {
            this.fragment = {
                module: spector2.shaderModules.get(f.module),
                entryPoint: f.entryPoint,
                constants: {...f.constants},

                targets: f.targets.map(t => {
                    const target = {
                        format: t.format,
                        writeMask: t.writeMask ?? GPUColorWrite.ALL,
                    };

                    const b = t.blend;
                    if (b !== undefined) {
                        target.blend = {
                            color: {
                                operation: b.color.operation ?? 'add',
                                operation: b.color.srcFactor ?? 'one',
                                operation: b.color.dstFactor ?? 'zero',
                            },
                            alpha: {
                                operation: b.alpha.operation ?? 'add',
                                operation: b.alpha.srcFactor ?? 'one',
                                operation: b.alpha.dstFactor ?? 'zero',
                            },
                        }
                    }

                    return target;
                }),
            }
        }
    }

    serialize() {
        const result = {
            deviceSerial: this.device.traceSerial,
            layout: this.layout,
            vertex: this.vertex,
            primitive: this.primitive,
            multisample: this.multisample,
            depthStencil: this.depthStencil,
            fragment: this.fragment,
        };

        if (result.layout !== 'auto') {
            result.layoutSerial = spector2.pipelineLayouts.get(this.layout).traceSerial;
            delete result.layout;
        }

        result.vertex.moduleSerial = result.vertex.module.traceSerial;
        delete result.vertex.module;

        if (result.fragment !== undefined) {
            result.fragment.moduleSerial = result.fragment.module.traceSerial;
            delete result.fragment.module;
        }

        return result;
    }
}

class SamplerState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.desc = {};
        this.addressModeU = desc.addressModeU ?? 'clamp-to-edge';
        this.addressModeV = desc.addressModeV ?? 'clamp-to-edge';
        this.addressModeW = desc.addressModeW ?? 'clamp-to-edge';
        this.magFilter = desc.magFilter ?? 'nearest';
        this.minFilter = desc.minFilter ?? 'nearest';
        this.mipmapFilter = desc.mipmapFilter ?? 'nearest';
        this.lodMinClamp = desc.lodMinClamp ?? 0;
        this.lodMaxClamp = desc.lodMaxClamp ?? 32;
        this.compare = desc.compare;
        this.maxAnisotropy = desc.maxAnisotropy ?? 1;
    }

    serialize() {
        return {
            deviceSerial: this.device.traceSerial,
            ...this.desc,
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
        return {deviceSerial: this.device.traceSerial, code: this.code};
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
            deviceSerial: this.device.traceSerial,
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
        spector2.registerObjectIn('textureViews', view, new TextureViewState(this, viewDesc ?? {}));
        return view;
    }

    destroy() {
        // TODO copy on write?
        // TODO store if recording trace.
        // TODO modify the current state as well
        spector2.textureProto.destroy.call(this.webgpuObject);
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
            textureSerial: this.texture.traceSerial,
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
