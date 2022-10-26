class ObjectRegistry {
    constructor() {
        this.dataMap = new WeakMap();
        this.objects = [];
        this.currentTraceSerial = 0;
        this.iterating = false;
    }

    add(obj, data) {
        if (this.iterating) {
            throw new Error("Mutating Registry while iterating it.");
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
            throw new Error("Mutating Registry while iterating it.");
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

        this.tracing = false;
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
        this.renderPipelineProto = replacePrototypeOf(GPURenderPipeline, this.renderPipelines);
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
        revertEntryPoints(GPURenderPipeline, this.renderPipelineProto);
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

        this.tracing = true;
        this.pendingTraceOperations = [];

        this.trace = {
            objects: {
                adapters: serializeAllObjects(this.adapters),
                bindGroups: serializeAllObjects(this.bindGroups),
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
                textures: serializeAsyncAllObjects(this.textures, this.pendingTraceOperations),
                textureViews: serializeAllObjects(this.textureViews),
            },
            commands: [],
            data: {},
        }
    }

    async endTracing() {
        // No more commands are recorded except presents
        this.tracing = false;

        // TODO deep copy what we currently have? We risk changing state with future operations.
        await Promise.all(this.pendingTraceOperations);

        return this.trace;
    }

    recordingTrace() {
        return this.tracing;
    }

    addPendingTraceOperation(promise) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0)
        this.pendingTraceOperations.push(promise);
    }

    traceCommand(command) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0)
        this.trace.commands.push(command);
    }

    traceData(buffer, offset, size) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0)
        offset ??= 0;
        size ??= buffer.byteLength - offset;

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
        if (this.tracing) {
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
        this.webgpuObject = null;
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

        this.implicit = desc.implicit;
        if (this.implicit) {
            this.parentRenderPipeline = desc.renderPipeline;
            this.pipelineGroupIndex = desc.groupIndex;
            return;
        }

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
        if (this.implicit) {
            return {
                renderPipelineSerial: this.parentRenderPipeline.traceSerial,
                groupIndex: this.pipelineGroupIndex,
            };
        } else {
            return {
                deviceSerial: this.device.traceSerial,
                entries: this.entries, // TODO deep copy?

            };
        }
    }
}

class BufferState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.usage = desc.usage;
        this.size = desc.size;
        this.state = desc.mappedAtCreation ? 'mapped-at-creation' : 'unmapped';
        this.mappedRanges = [];
    }

    async serializeAsync() {
        // Always serialize the creation parameters and add the initial data if possible.
        const result = this.serialize();

        // TODO handle mappable buffers.
        if ((this.usage & (GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE)) != 0) {
            return result;
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

        spector2.doWebGPUOp(() => {
            const data = initialDataBuffer.getMappedRange();
            result.initialData = spector2.traceData(data, 0, this.size);
            initialDataBuffer.destroy();
        });

        return result;
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

    getMappedRange(offset, size) {
        // TODO: support getting multiple small ranges and updating them on unmap.
        console.assert(offset === undefined && size === undefined);

        offset ??= 0;
        size ??= Math.max(this.size - offset);

        const arrayBuf = spector2.bufferProto.getMappedRange.call(this.webgpuObject, offset, size);
        this.mappedRanges.push({arrayBuf, offset, size,});
        return arrayBuf;
    }

    unmap(offset, size) {
        if (spector2.recordingTrace()) {
            spector2.traceCommand({
                name: 'bufferUpdateData',
                bufferSerial: this.traceSerial,
                updates: this.mappedRanges.map(({arrayBuf, offset, size}) => {
                    return {
                        data: spector2.traceData(arrayBuf, 0, size),
                        offset,
                        size,
                    };
                }),
            });
            spector2.traceCommand({
                name: 'bufferUnmap',
                bufferSerial: this.traceSerial,
            });
        }

        spector2.bufferProto.unmap.call(this.webgpuObject);
        this.mappedRanges = [];
    }

    destroy() {
        spector2.bufferProto.destroy.call(this.webgpuObject);
        this.mappedRanges = [];
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
        this.referencedObjects = new Set();
    }

    serialize() {
        return {};
    }

    reference(object) {
        this.referencedObjects.add(object);
    }

    addCommand(command) {
        this.commands.push(command);
    }

    beginRenderPass(desc) {
        const pass = spector2.commandEncoderProto.beginRenderPass.call(this.webgpuObject, desc);
        spector2.registerObjectIn('renderPassEncoders', pass, new RenderPassEncoderState(this, desc));
        return pass;
    }

    copyTextureToTexture(source, destination, copySize) {
        spector2.commandEncoderProto.copyTextureToTexture.call(this.webgpuObject, source, destination, copySize);
        this.addCommand({name: 'copyTextureToTexture', args: {
            source: {
                textureSerial: spector2.textures.get(source.texture).traceSerial,
                mipLevel: source.mipLevel ?? 0,
                origin: source.origin ?? {}, // TODO copy
                aspect: source.aspect ?? 'all',
            },
            destination: {
                textureSerial: spector2.textures.get(destination.texture).traceSerial,
                mipLevel: destination.mipLevel ?? 0,
                origin: destination.origin ?? {}, // TODO copy
                aspect: destination.aspect ?? 'all',
            },
            copySize, // TODO copy
        }});
        this.reference(source.texture);
        this.reference(destination.texture);
    }

    copyBufferToTexture(source, destination, copySize) {
        spector2.commandEncoderProto.copyBufferToTexture.call(this.webgpuObject, source, destination, copySize);
        this.addCommand({name: 'copyBufferToTexture', args: {
            source: {
                bufferSerial: spector2.buffers.get(source.buffer).traceSerial,
                offset: source.offset ?? 0,
                bytesPerRow: source.bytesPerRow,
                rowsPerImage: source.rowsPerImage,
            },
            destination: {
                textureSerial: spector2.textures.get(destination.texture).traceSerial,
                mipLevel: destination.mipLevel ?? 0,
                origin: destination.origin ?? {}, // TODO copy
                aspect: destination.aspect ?? 'all',
            },
            copySize, // TODO copy
        }});
        this.reference(source.buffer);
        this.reference(destination.texture);
    }

    finish(desc) {
        const commandBuffer = spector2.commandEncoderProto.finish.call(this.webgpuObject, desc);
        spector2.registerObjectIn('commandBuffers', commandBuffer, new CommandBufferState(this, desc ?? {}));
        return commandBuffer;
    }

    popDebugGroup() {
        spector2.commandEncoderProto.popDebugGroup.call(this.webgpuObject);
        this.addCommand({name: 'popDebugGroup'});
    }

    pushDebugGroup(groupLabel) {
        spector2.commandEncoderProto.pushDebugGroup.call(this.webgpuObject, groupLabel);
        this.addCommand({name: 'pushDebugGroup', args: {
            groupLabel,
        }});
    }

}

class CanvasContextState extends BaseState {
    constructor(canvas) {
        super({});
        this.canvas = canvas;
    }

    configure(config) {
        this.device = spector2.devices.get(config.device);
        this.format = config.format;
        this.usage = config.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;
        this.viewFormats = config.viewFormats ?? []; // TODO clone the inside
        this.colorSpace = config.colorSpace ?? 'srgb';
        this.alphaMode = config.alphaMode ?? 'opaque';

        spector2.canvasContextProto.configure.call(this.webgpuObject, {
            device: this.device.webgpuObject,
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
        const textureState = new TextureState(this.device, {
            format: this.format,
            size: {width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1},
            usage: this.usage,
            viewFormats: this.viewFormats,
        }, /* isSwapChain */ true);
        spector2.registerObjectIn('textures', texture, textureState);

        // Mark the texture as presented right after the animation frame.
        const recordingThePresent = spector2.recordingTrace();

        const presentPromise = new Promise((resolve,) => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (recordingThePresent) {
                        spector2.traceCommand({
                            name: 'present',
                            args: {canvasContextSerial: this.traceSerial, textureSerial: textureState.traceSerial},
                        });
                    }
                    textureState.onPresent();
                    resolve();
                }, 0);
            });
        });

        if (recordingThePresent) {
            spector2.addPendingTraceOperation(presentPromise);
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
        const texture = spector2.deviceProto.createTexture.call(this.webgpuObject, {
            ...desc,
            usage: desc.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
        });
        spector2.registerObjectIn('textures', texture, new TextureState(this, desc, /*isSwapChain*/ false));
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

    serializeWriteData(data, offset, size) {
        offset ??= 0;
        if (data instanceof ArrayBuffer) {
            size = size ?? data.byteLength - offset;
            return spector2.traceData(data, offset, size);
        } else {
            size = size ?? data.length - offset;
            return spector2.traceData(data.buffer, offset * data.BYTES_PER_ELEMENT, size * data.BYTES_PER_ELEMENT);
        }
    }

    writeBuffer(buffer, bufferOffset, data, dataOffset, size) {
        spector2.queueProto.writeBuffer.call(this.webgpuObject, buffer, bufferOffset, data, dataOffset, size);
        if (!spector2.recordingTrace()) {
            return;
        }

        let serializedData = this.serializeWriteData(data, dataOffset, size);
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

    writeTexture(destination, data, dataLayout, size) {
        spector2.queueProto.writeTexture.call(this.webgpuObject, destination, data, dataLayout, size);
        if (!spector2.recordingTrace()) {
            return;
        }

        let serializedData = this.serializeWriteData(data, dataLayout.dataOffset, undefined /*TODO guess the correct size based on the format / size??*/);
        spector2.traceCommand({
            name: 'queueWriteTexture',
            queueSerial: this.traceSerial,
            args: {
                destination: {
                    textureSerial: spector2.textures.get(destination.texture).traceSerial,
                    mipLevel: destination.mipLevel ?? 0,
                    origin: destination.origin ?? {}, // TODO copy
                    aspect: destination.aspect ?? 'all',
                },
                data: serializedData,
                dataLayout: {
                    offset: 0,
                    bytesPerRow: dataLayout.bytesPerRow,
                    rowsPerImage: dataLayout.rowsPerImage,
                },
                size, // TODO copy
            }
        });
    }

    copyExternalImageToTexture(source, destination, copySize) {
        spector2.queueProto.copyExternalImageToTexture.call(this.webgpuObject, source, destination, copySize);
        if (!spector2.recordingTrace()) {
            return;
        }

        // TODO implement me!
        console.assert(false);
    }

    submit(commandBuffers) {
        spector2.queueProto.submit.call(this.webgpuObject, commandBuffers);
        if (!spector2.recordingTrace()) {
            return;
        }

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
            colorAttachments: desc.colorAttachments.map(a => { 
                this.encoder.reference(a.view);
                this.encoder.reference(a.resolveTarget);
                return {
                    viewSerial: spector2.textureViews.get(a.view).traceSerial,
                    resolveTargetSerial: (a.resolveTarget ? spector2.textureViews.get(a.resolveTarget).traceSerial : undefined),

                    clearValue: a.clearValue ?? {r: 0, g: 0, b: 0, a: 0},
                    loadOp: a.loadOp,
                    storeOp: a.storeOp,
                }
            ;}),

            timestampWrites: (desc.timestampWrites ?? []).map(w => {
                this.encoder.reference(w.querySet);
                return {
                    querySetSerial: spector2.querySets.get(w.querySet).traceSerial,
                    queryIndex: w.queryIndex,
                    location: e.location,
                };
            }),

            occlusionQuerySetSerial: desc.occlusionQuerySet ? spector2.querySets.get(desc.occlusionQuerySet).traceSerial : undefined,
            maxDrawCount: desc.maxDrawCount ?? 50000000, // Yes that's the spec default.
        }
        this.encoder.reference(desc.occlusionQuerySet);

        const ds = desc.depthStencilAttachment;
        if (ds !== undefined) {
            this.encoder.reference(ds.view);
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

    popDebugGroup() {
        spector2.renderPassEncoderProto.popDebugGroup.call(this.webgpuObject);
        this.encoder.addCommand({name: 'popDebugGroup'});
    }

    pushDebugGroup(groupLabel) {
        spector2.renderPassEncoderProto.pushDebugGroup.call(this.webgpuObject, groupLabel);
        this.encoder.addCommand({name: 'pushDebugGroup', args: {
            groupLabel,
        }});
    }

    setBindGroup(index, bindGroup, dynamicOffsets) {
        if (dynamicOffsets !== undefined) {
            console.assert(false, "Don't know how to handle dynamic bindgroups yet.");
        }

        spector2.renderPassEncoderProto.setBindGroup.call(this.webgpuObject, index, bindGroup);
        this.encoder.reference(bindGroup);
        this.encoder.addCommand({name: 'setBindGroup', args: {
            index,
            bindGroupSerial: spector2.bindGroups.get(bindGroup).traceSerial,
        }});
    }

    setIndexBuffer(buffer, indexFormat, offset, size) {
        spector2.renderPassEncoderProto.setIndexBuffer.call(this.webgpuObject, buffer, indexFormat, offset, size);
        this.encoder.reference(buffer);
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
        this.encoder.reference(pipeline);
        this.encoder.addCommand({name: 'setPipeline', args: {
            pipelineSerial: spector2.renderPipelines.get(pipeline).traceSerial,
        }});
    }

    setVertexBuffer(slot, buffer, offset, size) {
        spector2.renderPassEncoderProto.setVertexBuffer.call(this.webgpuObject, slot, buffer, offset, size);
        this.encoder.reference(buffer);
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

    getBindGroupLayout(groupIndex) {
        const bgl = spector2.renderPipelineProto.getBindGroupLayout.call(this.webgpuObject, groupIndex);
        spector2.registerObjectIn('bindGroupLayouts', bgl, new BindGroupLayoutState(this, {
            implicit: true,
            renderPipeline: this,
            groupIndex,
        }));
        return bgl;
    }
}

class SamplerState extends BaseState {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.desc = {};
        this.desc.addressModeU = desc.addressModeU ?? 'clamp-to-edge';
        this.desc.addressModeV = desc.addressModeV ?? 'clamp-to-edge';
        this.desc.addressModeW = desc.addressModeW ?? 'clamp-to-edge';
        this.desc.magFilter = desc.magFilter ?? 'nearest';
        this.desc.minFilter = desc.minFilter ?? 'nearest';
        this.desc.mipmapFilter = desc.mipmapFilter ?? 'nearest';
        this.desc.lodMinClamp = desc.lodMinClamp ?? 0;
        this.desc.lodMaxClamp = desc.lodMaxClamp ?? 32;
        this.desc.compare = desc.compare;
        this.desc.maxAnisotropy = desc.maxAnisotropy ?? 1;
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

const kTextureFormatInfo = {
    'rgba8unorm': {type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 4},
    'rgba8unorm-srgb': {type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 4},
    'bgra8unorm': {type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 4},
    'rgba16float': {type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 8},
    'rgba32float': {type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 16},

    'depth32float': {type: 'depth', blockWidth: 1, blockHeight: 1, blockByteSize: 4},
    'depth24plus-stencil8': {type: 'depth-stencil',},
};
const kBytesPerRowAlignment = 256;

function align(n, alignment) {
    return Math.ceil(n / alignment) * alignment;
}

class TextureState extends BaseState {
    constructor(device, desc, isSwapChain) {
        super(desc);
        this.isSwapChain = isSwapChain;
        this.state = 'available';
        this.device = device;
        this.format = desc.format;
        this.usage = desc.usage;
        this.size = desc.size; // TODO reify
        this.dimension = desc.dimension ?? '2d';
        this.mipLevelCount = desc.mipLevelCount ?? 1;
        this.sampleCount = desc.sampleCount ?? 1;
        this.viewFormats = desc.viewFormats ?? []; // deep copy
    }

    async serializeAsync() {
        // Always serialize the creation parameters and add the initial data if possible.
        const result = this.serialize();

        // No need to gather initial data since this texture is already destroyed.
        if (this.state === 'destroyed') {
            return result;
        }

        if (this.isSwapChain) {
            // TODO: We should be able to make this work but it's hard to track exactly when these textures are destroyed.
            console.warn('No support for swapChain texture initial data.');
            return result;
        }
        if (this.sampleCount !== 1) {
            console.warn('No support for sampleCount > 1 texture initial data.');
            return result;
        }
        if (this.dimension !== '2d') {
            console.warn('No support for dimension != \'2d\' texture initial data.');
            return result;
        }
        if (kTextureFormatInfo[this.format].type !== 'color') {
            console.warn('No support for non-color texture initial data.');
            return result;
        }
        // TODO check for compressed textures as well.

        const formatInfo = kTextureFormatInfo[this.format];

        let readbacks = [];
        let mapPromises = [];

        spector2.doWebGPUOp(() => {
            // TODO pool encoders?
            const encoder = this.device.webgpuObject.createCommandEncoder();

            for (let mip = 0; mip < this.mipLevelCount; mip++) {
                const width = Math.max(1, (this.size.width || 1) >> mip);
                const height = Math.max(1, (this.size.height || 1) >> mip);
                const depthOrArrayLayers = (this.size.depthOrArrayLayers || 1); // TODO support 3D.
                const bytesPerRow = align(width * formatInfo.blockByteSize, kBytesPerRowAlignment);
                const bufferSize = bytesPerRow * height * depthOrArrayLayers;

                const readbackBuffer = this.device.webgpuObject.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                });

                encoder.copyTextureToBuffer(
                    {texture: this.webgpuObject, mipLevel: mip},
                    {buffer: readbackBuffer, bytesPerRow, rowsPerImage: height},
                    {width, height, depthOrArrayLayers},
                );

                readbacks.push({buffer: readbackBuffer, bytesPerRow, mipLevel: mip});
            }

            this.device.webgpuObject.queue.submit([encoder.finish()]);

            mapPromises = readbacks.map(r => r.buffer.mapAsync(GPUMapMode.READ));
        });

        await Promise.all(mapPromises);

        const initialData = [];
        spector2.doWebGPUOp(() => {
            for (let {buffer, bytesPerRow, mipLevel} of readbacks) {
                initialData.push({
                    data: spector2.traceData(buffer.getMappedRange()),
                    mipLevel,
                    bytesPerRow,
                });
                buffer.destroy();
            }
        });

        result.initialData = initialData;
        return result;
    }
        
    serialize() {
        return {
            deviceSerial: this.device.traceSerial,
            state: this.state,
            format: this.format,
            usage: this.usage,
            size: this.size,
            dimension: this.dimension,
            mipLevelCount: this.mipLevelCount,
            sampleCount: this.sampleCount,
            viewFormats: this.viewFormats,
        };
    }

    createView(viewDesc) {
        const view = spector2.textureProto.createView.call(this.webgpuObject, viewDesc);
        spector2.registerObjectIn('textureViews', view, new TextureViewState(this, viewDesc ?? {}));
        return view;
    }

    onPresent() {
        this.state = 'destroyed';
    }

    destroy() {
        spector2.textureProto.destroy.call(this.webgpuObject);
        this.state = 'destroyed';

        if (!spector2.recordingTrace()) {
            return;
        }

        spector2.traceCommand({
            name: 'textureDestroy',
            textureSerial: this.traceSerial,
        });
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
