// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-types */
import { gpuExtent3DDictFullFromGPUExtent3D } from '../lib/utils';

type CaptureStateBase<T> = {
    webgpuObject: T | null;
    traceSerial: number;
};

class ObjectRegistry<GPUType extends Object, CaptureState extends CaptureStateBase<GPUType>> {
    iterating: boolean;
    currentTraceSerial: number;
    dataMap: WeakMap<GPUType, CaptureState>;
    objects: WeakRef<GPUType>[];

    constructor() {
        this.dataMap = new WeakMap();
        this.objects = [];
        this.currentTraceSerial = 0;
        this.iterating = false;
    }

    add(obj: GPUType, data: CaptureState) {
        if (this.iterating) {
            throw new Error('Mutating Registry while iterating it.');
        }

        this.dataMap.set(obj, data);
        this.objects.push(new WeakRef(obj));
        data.webgpuObject = obj;
        data.traceSerial = this.currentTraceSerial;
        this.currentTraceSerial++;
    }

    has(obj: GPUType) {
        return this.dataMap.has(obj);
    }

    get(obj: GPUType) {
        return this.dataMap.get(obj);
    }

    prune() {
        if (this.iterating) {
            throw new Error('Mutating Registry while iterating it.');
        }

        this.objects = this.objects.filter(ref => ref.deref() !== undefined);
    }

    [Symbol.iterator](): Iterator<CaptureState> {
        let i = 0;
        this.iterating = true;

        return {
            registry: this,
            next() {
                while (i < this.registry.objects.length) {
                    const obj = this.registry.objects[i++].deref();
                    if (obj === undefined) {
                        continue;
                    }
                    return { value: this.registry.get(obj), done: false };
                }
                this.registry.iterating = false;
                return { done: true };
            },
        };
    }
}

type Proto = Record<string, Function>;
type ClassFuncs = { Class: Function; proto: Proto; wrappers: Proto };
type RequestAdapterFn = (options?: GPURequestAdapterOptions | undefined) => Promise<GPUAdapter | null>;

export class Spector2 {
    tracing = false;
    dataSerial = 0;
    inReentrantWebGPUOperations = false;

    adapters = new ObjectRegistry<GPUAdapter, AdapterState>();
    bindGroups = new ObjectRegistry<GPUBindGroup, BindGroupState>();
    bindGroupLayouts = new ObjectRegistry<GPUBindGroupLayout, BindGroupLayoutState>();
    buffers = new ObjectRegistry<GPUBuffer, BufferState>();
    commandBuffers = new ObjectRegistry<GPUCommandBuffer, CommandBufferState>();
    commandEncoders = new ObjectRegistry<GPUCommandEncoder, CommandEncoderState>();
    canvasContexts = new ObjectRegistry<GPUCanvasContext, CanvasContextState>();
    devices = new ObjectRegistry<GPUDevice, DeviceState>();
    pipelineLayouts = new ObjectRegistry<GPUPipelineLayout, PipelineLayoutState>();
    querySets = new ObjectRegistry<GPUQuerySet, QuerySetState>();
    queues = new ObjectRegistry<GPUQueue, QueueState>();
    renderPassEncoders = new ObjectRegistry<GPURenderPassEncoder, RenderPassEncoderState>();
    renderPipelines = new ObjectRegistry<GPURenderPipeline, RenderPipelineState>();
    samplers = new ObjectRegistry<GPUSampler, SamplerState>();
    shaderModules = new ObjectRegistry<GPUShaderModule, ShaderModuleState>();
    textures = new ObjectRegistry<GPUTexture, TextureState>();
    textureViews = new ObjectRegistry<GPUTextureView, TextureViewState>();

    adapterProto: Proto;
    bufferProto: Proto;
    commandEncoderProto: Proto;
    canvasContextProto: Proto;
    deviceProto: Proto;
    querySetProto: Proto;
    queueProto: Proto;
    renderPassEncoderProto: Proto;
    renderPipelineProto: Proto;
    textureProto: Proto;

    canvasGetContext: Function;
    gpuRequestAdapter: RequestAdapterFn;

    wrappers: {
        classes: ClassFuncs[];
        getContextWrapper: Function;
        requestAdaptorWrapper: RequestAdapterFn;
    };

    constructor() {
        function replacePrototypeOf<GPUType extends Object, CaptureState extends CaptureStateBase<GPUType>>(
            c: Function,
            registry: ObjectRegistry<GPUType, CaptureState>
        ) {
            const originalProto: Record<string, Function> = {};

            for (const name in c.prototype) {
                const props = Object.getOwnPropertyDescriptor(c.prototype, name);
                if (!props?.writable || typeof c.prototype[name] !== 'function') {
                    continue;
                }
                const originalMethod: Function = c.prototype[name];
                originalProto[name] = originalMethod;
                c.prototype[name] = function (...args: any[]) {
                    if (spector2.inReentrantWebGPUOperations) {
                        return originalMethod.apply(this, args);
                    }

                    const self = registry.get(this)!;
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    const fn: Function = self[name] as Function;
                    if (!fn) {
                        console.assert(false, `Doesn't have "${name}"`);
                    }
                    return fn.call(self, ...args);
                };
            }
            return originalProto;
        }

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
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            const context = spector2.canvasGetContext.call(this, type, ...args);
            if (type === 'webgpu') {
                spector2.registerObjectIn('canvasContexts', context, new CanvasContextState(this));
            }
            return context;
        };
        this.gpuRequestAdapter = GPU.prototype.requestAdapter;
        GPU.prototype.requestAdapter = async function (options, ...args) {
            const adapter = await spector2.gpuRequestAdapter.call(this, options, ...args);
            spector2.registerObjectIn('adapters', adapter, new AdapterState(options)); // TODO deep copy options
            return adapter;
        };

        // Save everything we wrapped for re-wrapping
        this.wrappers = {
            classes: [
                { Class: GPUAdapter, proto: this.adapterProto, wrappers: {} },
                { Class: GPUBuffer, proto: this.bufferProto, wrappers: {} },
                { Class: GPUCommandEncoder, proto: this.commandEncoderProto, wrappers: {} },
                { Class: GPUCanvasContext, proto: this.canvasContextProto, wrappers: {} },
                { Class: GPUDevice, proto: this.deviceProto, wrappers: {} },
                { Class: GPUQuerySet, proto: this.querySetProto, wrappers: {} },
                { Class: GPUQueue, proto: this.queueProto, wrappers: {} },
                { Class: GPURenderPassEncoder, proto: this.renderPassEncoderProto, wrappers: {} },
                { Class: GPURenderPipeline, proto: this.renderPipelineProto, wrappers: {} },
                { Class: GPUTexture, proto: this.textureProto, wrappers: {} },
            ],
            getContextWrapper: HTMLCanvasElement.prototype.getContext,
            requestAdaptorWrapper: GPU.prototype.requestAdapter,
        };

        const saveEntryPoints = ({ Class, proto, wrappers }: ClassFuncs) => {
            for (const name in proto) {
                wrappers[name] = Class.prototype[name];
            }
        };

        this.wrappers.classes.forEach(saveEntryPoints);
    }

    wrapEntryPoints() {
        const setEntryPointsToWrappers = ({ Class, proto, wrappers }: ClassFuncs) => {
            for (const name in proto) {
                Class.prototype[name] = wrappers[name];
            }
        };

        this.wrappers.classes.forEach(setEntryPointsToWrappers);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        HTMLCanvasElement.prototype.getContext = this.wrappers.getContextWrapper;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        GPU.prototype.requestAdaptor = this.wrappers.requestAdaptorWrapper;
    }

    // For now we don't support all entrypoints, which breaks the replay, here's a method to put regular entrypoints back.
    revertEntryPoints() {
        const revertEntryPoints = ({ Class, proto }: ClassFuncs) => {
            for (const name in proto) {
                Class.prototype[name] = proto[name];
            }
        };

        this.wrappers.classes.forEach(revertEntryPoints);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        HTMLCanvasElement.prototype.getContext = this.canvasGetContext;
        GPU.prototype.requestAdapter = this.gpuRequestAdapter;
    }

    /**
     * Do not call this function outside of this file.
     * If you want to use webgpu without your calls being inspected call one or more
     * of
     *
     * * requestUnwrappedAdapter (instead of navigator.gpu.requestAdapter)
     * * getUnwrappedGPUCanvasContext (instead of someCanvas.getContext('webgpu'))
     * * getUnwrappedGPUDeviceFromWrapped (if you have a wrapped device)
     *
     * Note: The device attached to `ReplayDevice` is already unwrapped and is
     * safe to call.
     *
     * @param f
     */
    doWebGPUOp(f: () => void) {
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
                const serializedObj = obj.serialize();
                if (obj.label) {
                    serializedObj.label = obj.label;
                }
                result[obj.traceSerial] = serializedObj;
            }
            return result;
        }

        // Yuck
        function serializeAsyncAllObjects(registry, pendingPromises) {
            const result = {};
            // TODO have some context where objects can ask for a device?
            for (const obj of registry) {
                pendingPromises.push(
                    obj.serializeAsync().then(serializedObj => {
                        if (obj.label) {
                            serializedObj.label = obj.label;
                        }
                        result[obj.traceSerial] = serializedObj;
                    })
                );
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
        };
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
        console.assert(this.tracing || this.pendingTraceOperations.length > 0);
        this.pendingTraceOperations.push(promise);
    }

    traceCommand(command) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0);
        this.trace.commands.push(command);
    }

    traceData(buffer, offset, size) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0);
        offset ??= 0;
        size ??= buffer.byteLength - offset;

        const byteArray = new Uint8Array(buffer, offset, size);
        // Worst serialization ever!
        const badArray = [];
        for (let i = 0; i < byteArray.byteLength; i++) {
            badArray.push(byteArray[i]);
        }

        this.trace.data[this.dataSerial] = badArray;
        const dataRef = {
            size,
            serial: this.dataSerial,
        };
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

        await new Promise(resolve => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    resolve();
                }, 0);
            });
        });

        return await this.endTracing();
    }
}

const spector2 = new Spector2();
export { spector2 };

class BaseState<T> {
    webgpuObject: T | null;
    traceSerial: number;
    label?: string;

    constructor(desc) {
        // TODO what about the setter for labels?
        if (desc.label) {
            this.label = desc.label;
        }
        this.webgpuObject = null;
        this.traceSerial = -1;
    }
}

class AdapterState extends BaseState<GPUAdapter> {
    constructor() {
        super({});
    }

    serialize() {
        return {};
    }

    async requestDevice(desc) {
        const device = await spector2.adapterProto.requestDevice.call(this.webgpuObject, desc);
        spector2.registerObjectIn('devices', device, new DeviceState(this, desc ?? {}));
        spector2.registerObjectIn(
            'queues',
            device.queue,
            new QueueState(spector2.devices.get(device), {} /*TODO desc*/)
        );
        return device;
    }
}

class BindGroupState extends BaseState<GPUBindGroup> {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.layout = spector2.bindGroupLayouts.get(desc.layout);

        this.entries = desc.entries.map(e => {
            const entry = { binding: e.binding };
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
                const entry = { binding: e.binding };
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

class BindGroupLayoutState extends BaseState<GPUBindGroupLayout> {
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
            const entry = { binding: e.binding, visibility: e.visibility };
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

class BufferState extends BaseState<GPUBuffer> {
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
        if ((this.usage & (GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE)) !== 0) {
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
        this.mappedRanges.push({ arrayBuf, offset, size });
        return arrayBuf;
    }

    unmap() {
        if (spector2.recordingTrace()) {
            spector2.traceCommand({
                name: 'bufferUpdateData',
                bufferSerial: this.traceSerial,
                updates: this.mappedRanges.map(({ arrayBuf, offset, size }) => {
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

class CommandBufferState extends BaseState<GPUCommandBuffer> {
    constructor(encoder, desc) {
        super(desc);
        this.device = encoder.device;
        this.commands = encoder.commands;
        // TODO get commands?
    }

    serialize() {
        return { commands: this.commands, deviceSerial: this.device.traceSerial };
    }
}

class CommandEncoderState extends BaseState<GPUCommandEncoder> {
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
        this.addCommand({
            name: 'copyTextureToTexture',
            args: {
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
            },
        });
        this.reference(source.texture);
        this.reference(destination.texture);
    }

    copyBufferToTexture(source, destination, copySize) {
        spector2.commandEncoderProto.copyBufferToTexture.call(this.webgpuObject, source, destination, copySize);
        this.addCommand({
            name: 'copyBufferToTexture',
            args: {
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
            },
        });
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
        this.addCommand({ name: 'popDebugGroup' });
    }

    pushDebugGroup(groupLabel) {
        spector2.commandEncoderProto.pushDebugGroup.call(this.webgpuObject, groupLabel);
        this.addCommand({
            name: 'pushDebugGroup',
            args: {
                groupLabel,
            },
        });
    }
}

class CanvasContextState extends BaseState<GPUCanvasContext> {
    constructor(canvas) {
        super({});
        this.canvas = canvas;
    }

    configure(config) {
        this.device = spector2.devices.get(config.device);
        this.format = config.format;
        this.usage = config.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;
        // TODO: remove
        this.usage |= GPUTextureUsage.TEXTURE_BINDING;
        this.viewFormats = config.viewFormats ?? []; // TODO clone the inside
        this.colorSpace = config.colorSpace ?? 'srgb';
        this.alphaMode = config.alphaMode ?? 'opaque';

        spector2.canvasContextProto.configure.call(this.webgpuObject, {
            device: this.device.webgpuObject,
            format: this.format,
            usage: this.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
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
        const textureState = new TextureState(
            this.device,
            {
                format: this.format,
                size: { width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1 },
                usage: this.usage,
                viewFormats: this.viewFormats,
            },
            /* isSwapChain */ true
        );
        spector2.registerObjectIn('textures', texture, textureState);

        // Mark the texture as presented right after the animation frame.
        const recordingThePresent = spector2.recordingTrace();

        const presentPromise = new Promise(resolve => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (recordingThePresent) {
                        spector2.traceCommand({
                            name: 'present',
                            args: { canvasContextSerial: this.traceSerial, textureSerial: textureState.traceSerial },
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

class DeviceState extends BaseState<GPUDevice> {
    constructor(adapter, desc) {
        super(desc);
        this.adapter = adapter;
    }

    serialize() {
        return { adapterSerial: this.adapter.traceSerial };
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
        if ((desc.usage & (GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE)) === 0) {
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
            usage: desc.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        });
        spector2.registerObjectIn('textures', texture, new TextureState(this, desc, /*isSwapChain*/ false));
        return texture;
    }
}

class PipelineLayoutState extends BaseState<GPUPipelineLayout> {
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

class QuerySetState extends BaseState<GPUQuerySet> {
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

class QueueState extends BaseState<GPUQueue> {
    constructor(device, desc) {
        super(desc);
        this.device = device;
    }

    serialize() {
        return { deviceSerial: this.device.traceSerial };
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

        const serializedData = this.serializeWriteData(data, dataOffset, size);
        spector2.traceCommand({
            name: 'queueWriteBuffer',
            queueSerial: this.traceSerial,
            args: {
                bufferSerial: spector2.buffers.get(buffer).traceSerial,
                bufferOffset,
                data: serializedData,
            },
        });
    }

    writeTexture(destination, data, dataLayout, size) {
        spector2.queueProto.writeTexture.call(this.webgpuObject, destination, data, dataLayout, size);
        if (!spector2.recordingTrace()) {
            return;
        }

        const serializedData = this.serializeWriteData(
            data,
            dataLayout.dataOffset,
            undefined /*TODO guess the correct size based on the format / size??*/
        );
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
            },
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
            args: { commandBufferSerials: commandBuffers.map(c => spector2.commandBuffers.get(c).traceSerial) },
        });
    }
}

class RenderPassEncoderState extends BaseState<GPURenderPassEncoder> {
    constructor(encoder, desc) {
        super(desc);
        this.encoder = encoder;
        const serializeDesc = {
            colorAttachments: desc.colorAttachments.map(a => {
                this.encoder.reference(a.view);
                this.encoder.reference(a.resolveTarget);
                return {
                    viewSerial: spector2.textureViews.get(a.view).traceSerial,
                    resolveTargetSerial: a.resolveTarget
                        ? spector2.textureViews.get(a.resolveTarget).traceSerial
                        : undefined,

                    clearValue: a.clearValue ?? { r: 0, g: 0, b: 0, a: 0 },
                    loadOp: a.loadOp,
                    storeOp: a.storeOp,
                };
            }),

            timestampWrites: (desc.timestampWrites ?? []).map(w => {
                this.encoder.reference(w.querySet);
                return {
                    querySetSerial: spector2.querySets.get(w.querySet).traceSerial,
                    queryIndex: w.queryIndex,
                    location: e.location,
                };
            }),

            occlusionQuerySetSerial: desc.occlusionQuerySet
                ? spector2.querySets.get(desc.occlusionQuerySet).traceSerial
                : undefined,
            maxDrawCount: desc.maxDrawCount ?? 50000000, // Yes that's the spec default.
        };
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

        this.encoder.addCommand({ name: 'beginRenderPass', args: serializeDesc });
    }

    serialize() {
        return {};
    }

    draw(vertexCount, instanceCount, firstVertex, firstInstance) {
        spector2.renderPassEncoderProto.draw.call(
            this.webgpuObject,
            vertexCount,
            instanceCount,
            firstVertex,
            firstInstance
        );
        this.encoder.addCommand({
            name: 'draw',
            args: {
                vertexCount,
                instanceCount: instanceCount ?? 1,
                firstVertex: firstVertex ?? 0,
                firstInstance: firstInstance ?? 0,
            },
        });
    }

    drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance) {
        spector2.renderPassEncoderProto.drawIndexed.call(
            this.webgpuObject,
            indexCount,
            instanceCount,
            firstIndex,
            baseVertex,
            firstInstance
        );
        this.encoder.addCommand({
            name: 'drawIndexed',
            args: {
                indexCount,
                instanceCount: instanceCount ?? 1,
                firstIndex: firstIndex ?? 0,
                baseVertex: baseVertex ?? 0,
                firstInstance: firstInstance ?? 0,
            },
        });
    }

    popDebugGroup() {
        spector2.renderPassEncoderProto.popDebugGroup.call(this.webgpuObject);
        this.encoder.addCommand({ name: 'popDebugGroup' });
    }

    pushDebugGroup(groupLabel) {
        spector2.renderPassEncoderProto.pushDebugGroup.call(this.webgpuObject, groupLabel);
        this.encoder.addCommand({
            name: 'pushDebugGroup',
            args: {
                groupLabel,
            },
        });
    }

    setBindGroup(index, bindGroup, dynamicOffsets) {
        if (dynamicOffsets !== undefined) {
            console.assert(false, "Don't know how to handle dynamic bindgroups yet.");
        }

        spector2.renderPassEncoderProto.setBindGroup.call(this.webgpuObject, index, bindGroup);
        this.encoder.reference(bindGroup);
        this.encoder.addCommand({
            name: 'setBindGroup',
            args: {
                index,
                bindGroupSerial: spector2.bindGroups.get(bindGroup).traceSerial,
            },
        });
    }

    setIndexBuffer(buffer, indexFormat, offset, size) {
        spector2.renderPassEncoderProto.setIndexBuffer.call(this.webgpuObject, buffer, indexFormat, offset, size);
        this.encoder.reference(buffer);
        const bufferState = spector2.buffers.get(buffer);
        offset = offset ?? 0;
        size = size ?? Math.max(0, bufferState.size - offset);
        this.encoder.addCommand({
            name: 'setIndexBuffer',
            args: {
                bufferSerial: bufferState.traceSerial,
                indexFormat,
                offset,
                size,
            },
        });
    }

    setPipeline(pipeline) {
        spector2.renderPassEncoderProto.setPipeline.call(this.webgpuObject, pipeline);
        this.encoder.reference(pipeline);
        this.encoder.addCommand({
            name: 'setPipeline',
            args: {
                pipelineSerial: spector2.renderPipelines.get(pipeline).traceSerial,
            },
        });
    }

    setVertexBuffer(slot, buffer, offset, size) {
        spector2.renderPassEncoderProto.setVertexBuffer.call(this.webgpuObject, slot, buffer, offset, size);
        this.encoder.reference(buffer);
        const bufferState = spector2.buffers.get(buffer);
        offset = offset ?? 0;
        size = size ?? Math.max(0, bufferState.size - offset);
        this.encoder.addCommand({
            name: 'setVertexBuffer',
            args: {
                slot,
                bufferSerial: bufferState.traceSerial,
                offset,
                size,
            },
        });
    }

    setViewport(x, y, width, height, minDepth, maxDepth) {
        spector2.renderPassEncoderProto.setViewport.call(this.webgpuObject, x, y, width, height, minDepth, maxDepth);
        this.encoder.addCommand({ name: 'setViewport', args: { x, y, width, height, minDepth, maxDepth } });
    }

    end() {
        spector2.renderPassEncoderProto.end.call(this.webgpuObject);
        this.encoder.addCommand({ name: 'endPass', args: {} });
    }
}

class RenderPipelineState extends BaseState<GPURenderPipeline> {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.layout = desc.layout;

        const v = desc.vertex;
        this.vertex = {
            module: spector2.shaderModules.get(v.module),
            entryPoint: v.entryPoint,
            constants: { ...v.constants },

            buffers: (v.buffers ?? []).map(b => {
                return {
                    arrayStride: b.arrayStride,
                    stepMode: b.stepMode ?? 'vertex',
                    attributes: b.attributes.map(a => {
                        return {
                            format: a.format,
                            offset: a.offset,
                            shaderLocation: a.shaderLocation,
                        };
                    }),
                };
            }),
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

                stencilReadMask: ds.stencilReadMask ?? 0xffffffff,
                stencilWriteMask: ds.stencilWriteMask ?? 0xffffffff,

                depthBias: ds.depthBias ?? 0,
                depthBiasSlopScale: ds.depthBiasSlopeScale ?? 0,
                depthBiasClamp: ds.depthBiasClamp ?? 0,
            };
        }

        const m = desc.multisample ?? {};
        this.multisample = {
            count: m.count ?? 1,
            mask: m.mask ?? 0xffffffff,
            alphaToCoverageEnabled: m.alphaToCoverageEnabled ?? false,
        };

        const f = desc.fragment;
        if (f !== undefined) {
            this.fragment = {
                module: spector2.shaderModules.get(f.module),
                entryPoint: f.entryPoint,
                constants: { ...f.constants },

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
                                srcFactor: b.color.srcFactor ?? 'one',
                                dstFactor: b.color.dstFactor ?? 'zero',
                            },
                            alpha: {
                                operation: b.alpha.operation ?? 'add',
                                srcFactor: b.alpha.srcFactor ?? 'one',
                                dstFactor: b.alpha.dstFactor ?? 'zero',
                            },
                        };
                    }

                    return target;
                }),
            };
        }
    }

    serialize() {
        const result = {
            deviceSerial: this.device.traceSerial,
            layout: this.layout,
            vertex: { ...this.vertex },
            primitive: this.primitive,
            multisample: this.multisample,
            depthStencil: this.depthStencil,
            fragment: { ...this.fragment },
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
        spector2.registerObjectIn(
            'bindGroupLayouts',
            bgl,
            new BindGroupLayoutState(this, {
                implicit: true,
                renderPipeline: this,
                groupIndex,
            })
        );
        return bgl;
    }
}

class SamplerState extends BaseState<GPUSampler> {
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

class ShaderModuleState extends BaseState<GPUShaderModule> {
    constructor(device, desc) {
        super(desc);
        this.device = device;
        this.code = desc.code;
    }

    serialize() {
        return { deviceSerial: this.device.traceSerial, code: this.code };
    }
}

type TextureFormatInfo = {
    type: string;
    blockWidth?: number;
    blockHeight?: number;
    blockByteSize?: number;
};

export const kTextureFormatInfo: Record<GPUTextureFormat, TextureFormatInfo> = {
    rgba8unorm: { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 4 },
    'rgba8unorm-srgb': { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 4 },
    bgra8unorm: { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 4 },
    rgba16float: { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 8 },
    rgba32float: { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 16 },

    depth32float: { type: 'depth', blockWidth: 1, blockHeight: 1, blockByteSize: 4 },
    'depth24plus-stencil8': { type: 'depth-stencil' },
    depth24plus: { type: 'depth', blockWidth: 1, blockHeight: 1, blockByteSize: 4 },
};
const kBytesPerRowAlignment = 256;

function align(n, alignment) {
    return Math.ceil(n / alignment) * alignment;
}

class TextureState extends BaseState<GPUTexture> {
    constructor(device, desc, isSwapChain) {
        super(desc);
        this.isSwapChain = isSwapChain;
        this.state = 'available';
        this.device = device;
        this.format = desc.format;
        this.usage = desc.usage;
        this.size = gpuExtent3DDictFullFromGPUExtent3D(desc.size);
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
            console.warn("No support for dimension != '2d' texture initial data.");
            return result;
        }
        if (kTextureFormatInfo[this.format].type !== 'color') {
            console.warn('No support for non-color texture initial data.');
            return result;
        }
        // TODO check for compressed textures as well.

        const formatInfo = kTextureFormatInfo[this.format];

        const readbacks = [];
        let mapPromises = [];

        spector2.doWebGPUOp(() => {
            // TODO pool encoders?
            const encoder = this.device.webgpuObject.createCommandEncoder();

            for (let mip = 0; mip < this.mipLevelCount; mip++) {
                const width = Math.max(1, this.size.width >> mip);
                const height = Math.max(1, this.size.height >> mip);
                const depthOrArrayLayers = this.size.depthOrArrayLayers; // TODO support 3D.
                const bytesPerRow = align(width * formatInfo.blockByteSize, kBytesPerRowAlignment);
                const bufferSize = bytesPerRow * height * depthOrArrayLayers;

                const readbackBuffer = this.device.webgpuObject.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                });

                encoder.copyTextureToBuffer(
                    { texture: this.webgpuObject, mipLevel: mip },
                    { buffer: readbackBuffer, bytesPerRow, rowsPerImage: height },
                    { width, height, depthOrArrayLayers }
                );

                readbacks.push({ buffer: readbackBuffer, bytesPerRow, mipLevel: mip });
            }

            this.device.webgpuObject.queue.submit([encoder.finish()]);

            mapPromises = readbacks.map(r => r.buffer.mapAsync(GPUMapMode.READ));
        });

        await Promise.all(mapPromises);

        const initialData = [];
        spector2.doWebGPUOp(() => {
            for (const { buffer, bytesPerRow, mipLevel } of readbacks) {
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

class TextureViewState extends BaseState<GPUTextureView> {
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
